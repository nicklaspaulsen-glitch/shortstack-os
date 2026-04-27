/**
 * Outreach Feed aggregator.
 *
 * Pulls events from three existing sources:
 *
 *   1. voice_calls           (Twilio + ElevenLabs call records, transcripts)
 *   2. outreach_log          (cold-email/SMS/DM outbound + reply log)
 *   3. conversation_messages (Gmail-style inbox messages)
 *
 * and normalizes them into the OutreachEvent shape. The list view groups
 * events per contact (lead OR client) and surfaces the latest interaction.
 *
 * The aggregator degrades gracefully — if any one source returns an error
 * or no rows, the others still produce a useful timeline.
 *
 * Outcome labels come from `outreach_outcome_cache` (lazy population: any
 * event we encounter without a cache hit gets a placeholder
 * outcome='unknown' row, and the `/api/cron/classify-outreach` worker
 * fills them in on the next tick).
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { reportError } from "@/lib/observability/error-reporter";
import type {
  ContactKind,
  ListConversationsOpts,
  OutreachChannel,
  OutreachConversation,
  OutreachDirection,
  OutreachEvent,
  OutreachOutcome,
} from "./types";

interface VoiceCallRow {
  id: string;
  client_id: string | null;
  to_number: string | null;
  from_number: string | null;
  direction: string | null;
  duration_seconds: number | null;
  outcome: string | null;
  transcript: string | null;
  started_at: string | null;
  created_at: string;
}

interface OutreachLogRow {
  id: string;
  lead_id: string | null;
  platform: string;
  business_name: string | null;
  recipient_handle: string | null;
  message_text: string | null;
  reply_text: string | null;
  status: string;
  sent_at: string | null;
  replied_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface ConversationMessageRow {
  id: string;
  conversation_id: string;
  direction: string;
  body: string | null;
  attachments: unknown[] | null;
  sent_at: string;
  external_message_id: string | null;
}

interface ConversationRow {
  id: string;
  channel: string;
  contact_id: string | null;
  subject: string | null;
}

interface LeadRow {
  id: string;
  business_name: string | null;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  client_id: string | null;
}

interface ClientRow {
  id: string;
  business_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
}

interface OutcomeCacheRow {
  channel: string;
  source_id: string;
  outcome: string;
  summary: string;
}

/** Map outreach_log.platform values to the four canonical OutreachChannel values. */
function mapPlatform(platform: string): OutreachChannel | null {
  switch (platform) {
    case "email":
      return "email";
    case "sms":
      return "sms";
    case "instagram_dm":
    case "facebook_dm":
    case "instagram":
    case "facebook":
    case "linkedin":
    case "tiktok":
      return "dm";
    default:
      return null;
  }
}

function mapInboxChannel(channel: string): OutreachChannel | null {
  switch (channel) {
    case "email":
      return "email";
    case "sms":
    case "whatsapp":
      return "sms";
    case "instagram":
    case "telegram":
    case "slack":
    case "discord":
    case "web_chat":
      return "dm";
    default:
      return null;
  }
}

function safeOutcome(value: string | null | undefined): OutreachOutcome {
  if (!value) return "unknown";
  const valid = new Set([
    "interested",
    "objection",
    "no_answer",
    "booked",
    "replied",
    "voicemail",
    "bounced",
    "unknown",
  ]);
  return (valid.has(value) ? value : "unknown") as OutreachOutcome;
}

/**
 * Voice calls live on `client_id` (when made on behalf of a client) but we
 * also need to hang them off the lead they hit. We resolve the contact
 * by phone number — it's the closest thing to a contact key we have on
 * voice_calls today.
 */
function callDirection(direction: string | null): OutreachDirection {
  return direction === "inbound" ? "in" : "out";
}

function logDirection(metadata: Record<string, unknown> | null, status: string): OutreachDirection {
  // Inbound replies are logged with status='replied' OR metadata.direction='inbound'.
  const dir = metadata?.direction;
  if (typeof dir === "string" && dir === "inbound") return "in";
  if (status === "replied") return "in";
  return "out";
}

function inboxDirection(direction: string): OutreachDirection {
  return direction === "inbound" ? "in" : "out";
}

function voiceCallSummary(row: VoiceCallRow): string {
  const dur = row.duration_seconds ?? 0;
  const dirLabel = row.direction === "inbound" ? "Inbound call" : "Outbound call";
  if (dur === 0) return `${dirLabel}, no answer`;
  if (dur < 15) return `${dirLabel}, ${dur}s`;
  const min = Math.floor(dur / 60);
  const sec = dur % 60;
  return `${dirLabel}, ${min}m ${sec}s`;
}

/**
 * Build a lookup of phone-or-email → lead for resolving voice_calls' phone
 * back to a lead row. Falls back to client phone when no lead matches.
 */
interface ContactLookup {
  byPhone: Map<string, { id: string; kind: ContactKind }>;
  byEmail: Map<string, { id: string; kind: ContactKind }>;
  byClientId: Map<string, { id: string; kind: ContactKind }>;
}

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/[^\d+]/g, "");
}

function normalizeEmail(email: string | null | undefined): string {
  return (email || "").toLowerCase().trim();
}

/**
 * Look up cache rows for the given (channel, source_id) tuples. Missing
 * tuples are not present in the returned map — callers can treat those as
 * "needs LLM classification" and write placeholder rows.
 */
async function fetchOutcomeCache(
  supabase: SupabaseClient,
  agencyOwnerId: string,
  pairs: Array<{ channel: OutreachChannel; source_id: string }>,
): Promise<Map<string, { outcome: OutreachOutcome; summary: string }>> {
  const map = new Map<string, { outcome: OutreachOutcome; summary: string }>();
  if (pairs.length === 0) return map;

  // Compose an OR filter that's still index-friendly: pull all cache rows
  // for this owner, filter client-side (volume per agency rarely exceeds
  // a few thousand rows in practice).
  const { data, error } = await supabase
    .from("outreach_outcome_cache")
    .select("channel, source_id, outcome, summary")
    .eq("agency_owner_id", agencyOwnerId);

  if (error) {
    reportError(error, {
      route: "outreach-aggregator",
      component: "fetchOutcomeCache",
      reason: "supabase-select",
    });
    return map;
  }

  const wanted = new Set(pairs.map((p) => `${p.channel}|${p.source_id}`));
  for (const row of (data || []) as OutcomeCacheRow[]) {
    const key = `${row.channel}|${row.source_id}`;
    if (!wanted.has(key)) continue;
    map.set(key, {
      outcome: safeOutcome(row.outcome),
      summary: row.summary || "",
    });
  }
  return map;
}

/**
 * Persist placeholder rows for (channel, source_id) tuples that have no
 * cache entry yet. Lazy population: the cron worker classifies these later.
 */
async function ensureCachePlaceholders(
  supabase: SupabaseClient,
  agencyOwnerId: string,
  missing: Array<{ channel: OutreachChannel; source_id: string }>,
): Promise<void> {
  if (missing.length === 0) return;
  const rows = missing.map((m) => ({
    agency_owner_id: agencyOwnerId,
    channel: m.channel,
    source_id: m.source_id,
    outcome: "unknown" as const,
    summary: "",
  }));
  const { error } = await supabase
    .from("outreach_outcome_cache")
    .upsert(rows, { onConflict: "channel,source_id", ignoreDuplicates: true });
  if (error) {
    reportError(error, {
      route: "outreach-aggregator",
      component: "ensureCachePlaceholders",
      reason: "supabase-upsert",
    });
  }
}

interface AggregatedRows {
  voiceCalls: VoiceCallRow[];
  outreachLogs: OutreachLogRow[];
  inboxMessages: ConversationMessageRow[];
  inboxConversations: Map<string, ConversationRow>;
  leads: LeadRow[];
  clients: ClientRow[];
}

async function loadSourceRows(
  supabase: SupabaseClient,
  agencyOwnerId: string,
): Promise<AggregatedRows> {
  // Run the four source queries in parallel — they're independent.
  const [voiceRes, logRes, leadsRes, clientsRes] = await Promise.all([
    supabase
      .from("voice_calls")
      .select(
        "id, client_id, to_number, from_number, direction, duration_seconds, outcome, transcript, started_at, created_at",
      )
      .eq("profile_id", agencyOwnerId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("outreach_log")
      .select(
        "id, lead_id, platform, business_name, recipient_handle, message_text, reply_text, status, sent_at, replied_at, created_at, metadata",
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("leads")
      .select("id, business_name, owner_name, email, phone, client_id")
      .eq("user_id", agencyOwnerId)
      .limit(2000),
    supabase
      .from("clients")
      .select("id, business_name, contact_name, email, phone")
      .eq("profile_id", agencyOwnerId)
      .limit(500),
  ]);

  // Pull inbox conversations + messages in a second pass so we can scope
  // by user_id (RLS). conversation_messages doesn't carry user_id directly.
  const { data: convRows } = await supabase
    .from("conversations")
    .select("id, channel, contact_id, subject")
    .eq("user_id", agencyOwnerId)
    .limit(500);

  const conversations = (convRows || []) as ConversationRow[];
  const conversationMap = new Map<string, ConversationRow>();
  for (const c of conversations) conversationMap.set(c.id, c);

  const inboxMessages: ConversationMessageRow[] = [];
  if (conversations.length > 0) {
    const ids = conversations.map((c) => c.id);
    const { data: msgRows } = await supabase
      .from("conversation_messages")
      .select("id, conversation_id, direction, body, attachments, sent_at, external_message_id")
      .in("conversation_id", ids)
      .order("sent_at", { ascending: false })
      .limit(2000);
    inboxMessages.push(...((msgRows || []) as ConversationMessageRow[]));
  }

  return {
    voiceCalls: (voiceRes.data || []) as VoiceCallRow[],
    outreachLogs: (logRes.data || []) as OutreachLogRow[],
    inboxMessages,
    inboxConversations: conversationMap,
    leads: (leadsRes.data || []) as LeadRow[],
    clients: (clientsRes.data || []) as ClientRow[],
  };
}

function buildContactLookup(rows: AggregatedRows): ContactLookup {
  const byPhone = new Map<string, { id: string; kind: ContactKind }>();
  const byEmail = new Map<string, { id: string; kind: ContactKind }>();
  const byClientId = new Map<string, { id: string; kind: ContactKind }>();

  // Leads first so they win when duplicate phone/email exists.
  for (const lead of rows.leads) {
    const ph = normalizePhone(lead.phone);
    if (ph) byPhone.set(ph, { id: lead.id, kind: "lead" });
    const em = normalizeEmail(lead.email);
    if (em) byEmail.set(em, { id: lead.id, kind: "lead" });
  }
  for (const c of rows.clients) {
    const ph = normalizePhone(c.phone);
    if (ph && !byPhone.has(ph)) byPhone.set(ph, { id: c.id, kind: "client" });
    const em = normalizeEmail(c.email);
    if (em && !byEmail.has(em)) byEmail.set(em, { id: c.id, kind: "client" });
    byClientId.set(c.id, { id: c.id, kind: "client" });
  }
  return { byPhone, byEmail, byClientId };
}

interface NormalizedEvent extends OutreachEvent {
  contact_id: string;
  contact_kind: ContactKind;
}

function normalizeVoiceCall(
  row: VoiceCallRow,
  lookup: ContactLookup,
): NormalizedEvent | null {
  // Voice calls don't carry a lead_id directly — resolve by phone, then
  // by client_id, otherwise drop the event from the feed.
  const target = row.direction === "inbound" ? row.from_number : row.to_number;
  const ph = normalizePhone(target);
  let contact = ph ? lookup.byPhone.get(ph) : undefined;
  if (!contact && row.client_id) contact = lookup.byClientId.get(row.client_id);
  if (!contact) return null;

  const ts = row.started_at || row.created_at;
  return {
    id: `voice_call:${row.id}`,
    channel: "voice_call",
    direction: callDirection(row.direction),
    body: voiceCallSummary(row),
    transcript: row.transcript || undefined,
    duration_seconds: row.duration_seconds ?? undefined,
    ts,
    outcome: safeOutcome(row.outcome),
    source_id: row.id,
    source_table: "voice_calls",
    contact_id: contact.id,
    contact_kind: contact.kind,
  };
}

function normalizeOutreachLog(
  row: OutreachLogRow,
  lookup: ContactLookup,
  leadsById: Map<string, LeadRow>,
): NormalizedEvent | null {
  const channel = mapPlatform(row.platform);
  if (!channel) return null;

  // Prefer the lead row directly. If it's missing, try to resolve via
  // recipient_handle (email or phone).
  let contact: { id: string; kind: ContactKind } | undefined;
  if (row.lead_id && leadsById.has(row.lead_id)) {
    contact = { id: row.lead_id, kind: "lead" };
  } else if (row.recipient_handle) {
    const handle = row.recipient_handle.trim();
    if (handle.includes("@")) {
      contact = lookup.byEmail.get(normalizeEmail(handle));
    } else {
      contact = lookup.byPhone.get(normalizePhone(handle));
    }
  }
  if (!contact) return null;

  // The outreach_log captures BOTH the outbound message and (when present)
  // the inbound reply on a single row. Render whichever has the more
  // interesting timestamp; if both exist, we render the reply since that's
  // the most recent interaction. The outbound side will show on the
  // earlier-row from the same lead.
  const hasReply = !!row.reply_text;
  const direction: OutreachDirection = hasReply ? "in" : logDirection(row.metadata, row.status);
  const body = hasReply ? row.reply_text || "" : row.message_text || "";
  const ts = hasReply ? row.replied_at || row.created_at : row.sent_at || row.created_at;

  return {
    id: `outreach_log:${row.id}${hasReply ? ":reply" : ""}`,
    channel,
    direction,
    body,
    ts,
    source_id: row.id,
    source_table: "outreach_log",
    contact_id: contact.id,
    contact_kind: contact.kind,
  };
}

function normalizeInboxMessage(
  row: ConversationMessageRow,
  conv: ConversationRow | undefined,
  lookup: ContactLookup,
  leadsById: Map<string, LeadRow>,
): NormalizedEvent | null {
  if (!conv) return null;
  const channel = mapInboxChannel(conv.channel);
  if (!channel) return null;

  let contact: { id: string; kind: ContactKind } | undefined;
  if (conv.contact_id && leadsById.has(conv.contact_id)) {
    contact = { id: conv.contact_id, kind: "lead" };
  } else if (conv.contact_id && lookup.byClientId.has(conv.contact_id)) {
    contact = { id: conv.contact_id, kind: "client" };
  }
  if (!contact) return null;

  const attachments = Array.isArray(row.attachments) ? row.attachments.length : 0;
  return {
    id: `messages:${row.id}`,
    channel,
    direction: inboxDirection(row.direction),
    body: row.body || "",
    subject: conv.subject || undefined,
    ts: row.sent_at,
    source_id: row.id,
    source_table: "messages",
    attachment_count: attachments > 0 ? attachments : undefined,
    contact_id: contact.id,
    contact_kind: contact.kind,
  };
}

interface ContactRecord {
  id: string;
  kind: ContactKind;
  name: string;
  email?: string;
  phone?: string;
  client_id: string | null;
}

function buildContactRecords(rows: AggregatedRows): Map<string, ContactRecord> {
  const map = new Map<string, ContactRecord>();
  for (const lead of rows.leads) {
    const name = lead.business_name || lead.owner_name || lead.email || lead.phone || "Lead";
    map.set(`lead:${lead.id}`, {
      id: lead.id,
      kind: "lead",
      name,
      email: lead.email || undefined,
      phone: lead.phone || undefined,
      client_id: lead.client_id,
    });
  }
  for (const c of rows.clients) {
    const name = c.business_name || c.contact_name || c.email || c.phone || "Client";
    map.set(`client:${c.id}`, {
      id: c.id,
      kind: "client",
      name,
      email: c.email || undefined,
      phone: c.phone || undefined,
      client_id: c.id,
    });
  }
  return map;
}

/**
 * List every prospect/client the agency has interacted with, one row per
 * contact, sorted by last_message.ts DESC.
 */
export async function listConversations(
  supabase: SupabaseClient,
  agencyOwnerId: string,
  opts: ListConversationsOpts = {},
): Promise<OutreachConversation[]> {
  const rows = await loadSourceRows(supabase, agencyOwnerId);
  const lookup = buildContactLookup(rows);
  const contactRecords = buildContactRecords(rows);

  const leadsById = new Map<string, LeadRow>();
  for (const l of rows.leads) leadsById.set(l.id, l);

  const events: NormalizedEvent[] = [];
  for (const v of rows.voiceCalls) {
    const e = normalizeVoiceCall(v, lookup);
    if (e) events.push(e);
  }
  for (const l of rows.outreachLogs) {
    const e = normalizeOutreachLog(l, lookup, leadsById);
    if (e) events.push(e);
  }
  for (const m of rows.inboxMessages) {
    const e = normalizeInboxMessage(m, rows.inboxConversations.get(m.conversation_id), lookup, leadsById);
    if (e) events.push(e);
  }

  // Apply outcome cache. We pull all matching rows in a single round-trip.
  const cachePairs = events.map((e) => ({ channel: e.channel, source_id: e.source_id }));
  const cache = await fetchOutcomeCache(supabase, agencyOwnerId, cachePairs);
  const missing: Array<{ channel: OutreachChannel; source_id: string }> = [];
  for (const e of events) {
    const key = `${e.channel}|${e.source_id}`;
    const hit = cache.get(key);
    if (hit) {
      e.outcome = hit.outcome;
      e.outcome_summary = hit.summary;
    } else {
      missing.push({ channel: e.channel, source_id: e.source_id });
    }
  }
  // Fire-and-forget: write placeholder rows so the cron worker can pick
  // them up. We do NOT await on the read path to keep latency tight.
  if (missing.length > 0) {
    ensureCachePlaceholders(supabase, agencyOwnerId, missing).catch(() => {});
  }

  // Group events by contact.
  const buckets = new Map<string, NormalizedEvent[]>();
  for (const e of events) {
    const key = `${e.contact_kind}:${e.contact_id}`;
    const arr = buckets.get(key) || [];
    arr.push(e);
    buckets.set(key, arr);
  }

  // Optional client_id filter (portal): drop conversations whose contact
  // isn't tied to that client.
  const clientFilter = opts.client_id || null;
  const channelFilter = opts.channel || null;
  const search = (opts.q || "").toLowerCase().trim();

  // Pull mark-read rows in one go.
  const { data: readRows } = await supabase
    .from("outreach_thread_reads")
    .select("contact_kind, contact_id, last_read_at")
    .eq("agency_owner_id", agencyOwnerId);
  const readMap = new Map<string, string>();
  for (const r of (readRows || []) as Array<{ contact_kind: string; contact_id: string; last_read_at: string }>) {
    readMap.set(`${r.contact_kind}:${r.contact_id}`, r.last_read_at);
  }

  const conversations: OutreachConversation[] = [];
  const bucketEntries: Array<[string, NormalizedEvent[]]> = Array.from(buckets.entries());
  for (const [key, evs] of bucketEntries) {
    const contact = contactRecords.get(key);
    if (!contact) continue;
    if (clientFilter && contact.client_id !== clientFilter) continue;

    if (channelFilter && !evs.some((e: NormalizedEvent) => e.channel === channelFilter)) continue;

    if (search) {
      const haystack = `${contact.name} ${contact.email || ""} ${contact.phone || ""}`.toLowerCase();
      if (!haystack.includes(search)) continue;
    }

    evs.sort((a: NormalizedEvent, b: NormalizedEvent) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    const last = evs[0];
    const lastReadAt = readMap.get(key);
    const unread = lastReadAt
      ? evs.filter((e: NormalizedEvent) => e.direction === "in" && new Date(e.ts) > new Date(lastReadAt)).length
      : evs.filter((e: NormalizedEvent) => e.direction === "in").length;

    const channelSet = new Set<OutreachChannel>();
    for (const e of evs) channelSet.add(e.channel);
    const channelsUsed: OutreachChannel[] = Array.from(channelSet);

    conversations.push({
      contact_id: contact.id,
      contact_kind: contact.kind,
      contact_name: contact.name,
      contact_email: contact.email,
      contact_phone: contact.phone,
      client_id: contact.client_id,
      channels_used: channelsUsed,
      last_message: {
        channel: last.channel,
        body: last.body || "",
        direction: last.direction,
        ts: last.ts,
      },
      last_outcome: last.outcome || "unknown",
      unread_count: unread,
      total_interactions: evs.length,
    });
  }

  conversations.sort((a, b) => new Date(b.last_message.ts).getTime() - new Date(a.last_message.ts).getTime());

  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.max(1, Math.min(200, opts.limit ?? 50));
  return conversations.slice(offset, offset + limit);
}

/**
 * Full event timeline for one contact, oldest → newest. Mixes channels.
 */
export async function getThread(
  supabase: SupabaseClient,
  agencyOwnerId: string,
  contactKind: ContactKind,
  contactId: string,
): Promise<{ events: OutreachEvent[]; contact: ContactRecord | null }> {
  const rows = await loadSourceRows(supabase, agencyOwnerId);
  const lookup = buildContactLookup(rows);
  const contactRecords = buildContactRecords(rows);
  const leadsById = new Map<string, LeadRow>();
  for (const l of rows.leads) leadsById.set(l.id, l);

  const events: NormalizedEvent[] = [];
  for (const v of rows.voiceCalls) {
    const e = normalizeVoiceCall(v, lookup);
    if (e && e.contact_id === contactId && e.contact_kind === contactKind) events.push(e);
  }
  for (const l of rows.outreachLogs) {
    const e = normalizeOutreachLog(l, lookup, leadsById);
    if (e && e.contact_id === contactId && e.contact_kind === contactKind) events.push(e);
  }
  for (const m of rows.inboxMessages) {
    const e = normalizeInboxMessage(m, rows.inboxConversations.get(m.conversation_id), lookup, leadsById);
    if (e && e.contact_id === contactId && e.contact_kind === contactKind) events.push(e);
  }

  // Resolve outcome cache for this thread.
  const cachePairs = events.map((e) => ({ channel: e.channel, source_id: e.source_id }));
  const cache = await fetchOutcomeCache(supabase, agencyOwnerId, cachePairs);
  for (const e of events) {
    const hit = cache.get(`${e.channel}|${e.source_id}`);
    if (hit) {
      e.outcome = hit.outcome;
      e.outcome_summary = hit.summary;
    }
  }

  events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  // Strip the internal contact fields before returning.
  const cleaned: OutreachEvent[] = events.map((e) => {
    const { contact_id, contact_kind, ...rest } = e;
    void contact_id;
    void contact_kind;
    return rest;
  });

  return {
    events: cleaned,
    contact: contactRecords.get(`${contactKind}:${contactId}`) || null,
  };
}
