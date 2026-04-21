import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fireTrigger, type TriggerType } from "@/lib/workflows/trigger-dispatch";
import crypto from "crypto";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/resend
//
// Resend uses Svix for webhook delivery. Event payload:
// {
//   type: "email.opened" | "email.clicked" | "email.delivered" | "email.bounced"
//          | "email.complained" | "email.failed" | "email.sent",
//   created_at: ISO date,
//   data: {
//     email_id: "...",
//     from: "agency@domain.com",
//     to: ["recipient@..."],
//     subject: "...",
//     // IMPORTANT: Resend delivers tags in the webhook payload as an
//     // OBJECT MAP, not the `[{name,value}]` array you POST on send:
//     //   tags: { shortstack_user_id: "abc", source: "email_composer" }
//     // See normalizeTags() below — we accept both shapes defensively.
//     tags: { [key]: string },
//     click?: { link, timestamp },
//     ...
//   }
// }
//
// Register at: https://resend.com/webhooks
// URL: https://app.shortstack.work/api/webhooks/resend
// Save the signing secret to Vercel env as RESEND_WEBHOOK_SECRET.
//
// Maps Resend events → our trigger types:
//   email.opened    → email_opened
//   email.clicked   → email_clicked
//   (email.delivered, .sent, .bounced, .complained, .failed are logged
//    for observability but don't currently have a dedicated trigger type)
//
// User resolution: we look at the `from` address and match against
// `agency_mail_domains` to figure out which agency the email belongs to.
// If no match and the `from` uses the shared SMTP_FROM, we skip firing
// (no clear owner). Every event is still logged to trinity_log for debug.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const maxDuration = 30;

// Svix signature verification. Optional — only enforced if
// RESEND_WEBHOOK_SECRET is set. The secret format is `whsec_<base64>`;
// the content we HMAC is `${svix-id}.${svix-timestamp}.${body}`.
function verifySvixSignature(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignatureHeader: string | null,
  secret: string,
): boolean {
  if (!svixId || !svixTimestamp || !svixSignatureHeader) return false;
  // Strip whsec_ prefix + base64-decode to get the raw signing key.
  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(rawSecret, "base64");
  } catch {
    return false;
  }
  const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", keyBytes)
    .update(toSign)
    .digest("base64");
  // Header can contain multiple signatures separated by spaces:
  // "v1,<sig1> v1,<sig2>"
  const parts = svixSignatureHeader.split(" ");
  for (const part of parts) {
    const [, sig] = part.split(",");
    if (sig && timingSafeEqual(sig, expected)) return true;
  }
  return false;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// Resend's webhook payload delivers `tags` in different shapes depending
// on the path (API vs dashboard). Observed shapes:
//   1. Object map:           { shortstack_user_id: "abc", source: "x" }
//   2. Array of pairs:       [{ name: "shortstack_user_id", value: "abc" }]
//   3. Array of {key,value}: [{ key: "shortstack_user_id", value: "abc" }]
// We accept anything and normalize to a plain Record<string, string>.
type ResendTagsRaw =
  | Record<string, string | number | boolean | null | undefined>
  | Array<{ name?: string; key?: string; value?: string }>
  | undefined
  | null;

interface ResendEvent {
  type: string;
  created_at?: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string[] | string;
    subject?: string;
    tags?: ResendTagsRaw;
    headers?: ResendTagsRaw;
    click?: { link: string; timestamp: string };
    [key: string]: unknown;
  };
}

/** Normalize Resend tags into a plain { name: value } record regardless of
 *  the wire shape. Returns an empty object if tags is missing/garbage. */
function normalizeTags(tags: ResendTagsRaw): Record<string, string> {
  if (!tags) return {};
  if (Array.isArray(tags)) {
    const out: Record<string, string> = {};
    for (const t of tags) {
      if (!t || typeof t !== "object") continue;
      const name = typeof t.name === "string" ? t.name : typeof t.key === "string" ? t.key : null;
      const value = typeof t.value === "string" ? t.value : null;
      if (name && value) out[name] = value;
    }
    return out;
  }
  if (typeof tags === "object") {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(tags)) {
      if (v == null) continue;
      out[k] = String(v);
    }
    return out;
  }
  return {};
}

/** Look up the agency owner by the `from` address. Uses the domain
 *  portion of the email to match against `agency_mail_domains`. */
async function resolveOwnerFromFrom(
  supabase: ReturnType<typeof createServiceClient>,
  fromAddress: string | undefined,
): Promise<string | null> {
  if (!fromAddress) return null;
  const match = fromAddress.match(/@([^>\s]+)/);
  const domain = match?.[1]?.toLowerCase().trim();
  if (!domain) return null;
  try {
    const { data } = await supabase
      .from("agency_mail_domains")
      .select("profile_id")
      .eq("domain", domain)
      .eq("status", "verified")
      .maybeSingle();
    return (data as { profile_id?: string } | null)?.profile_id ?? null;
  } catch {
    return null;
  }
}

/** Pull our custom `shortstack_user_id` tag if the sender set one when
 *  dispatching the email. Most reliable resolution method. Works across
 *  both the array and object-map wire shapes (see normalizeTags). */
function resolveOwnerFromTags(tags: Record<string, string>): string | null {
  return tags.shortstack_user_id || tags.user_id || null;
}

/** Fallback: look up the email send row in trinity_log by the Resend
 *  email_id and pull `shortstack_user_id` from its `result` JSON. Used
 *  only when tags are absent from the webhook payload entirely (e.g.
 *  dashboard-initiated sends, or if Resend ever drops tags on certain
 *  event types). */
async function resolveOwnerFromEmailId(
  supabase: ReturnType<typeof createServiceClient>,
  emailId: string | undefined,
): Promise<string | null> {
  if (!emailId) return null;
  try {
    const { data } = await supabase
      .from("trinity_log")
      .select("result")
      .eq("action_type", "email_campaign")
      .contains("result", { resend_email_id: emailId })
      .limit(1)
      .maybeSingle();
    const result = (data as { result?: { shortstack_user_id?: string } } | null)?.result;
    return result?.shortstack_user_id ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Svix signature headers
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  const secret = process.env.RESEND_WEBHOOK_SECRET || "";

  if (secret) {
    const valid = verifySvixSignature(rawBody, svixId, svixTimestamp, svixSignature, secret);
    if (!valid) {
      console.warn("[resend-webhook] signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else {
    console.warn(
      "[resend-webhook] RESEND_WEBHOOK_SECRET not set — accepting unsigned events. " +
        "Add the signing secret from resend.com/webhooks to secure this endpoint.",
    );
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Map Resend event types → our trigger types (only the ones we have
  // triggers for). Other event types are logged but don't fire.
  const RESEND_TO_TRIGGER: Record<string, TriggerType> = {
    "email.opened": "email_opened",
    "email.clicked": "email_clicked",
    // Future: email.delivered, .sent, .bounced, .complained, .failed
    // would need their own trigger types added to TriggerType.
  };

  const triggerType = RESEND_TO_TRIGGER[event.type];

  // Normalize tags once — Resend sends them as an object map in the
  // webhook payload, not as the {name,value} array we pass on send.
  const tags = normalizeTags(event.data.tags);

  // Resolve the agency owner whose email this was. Preference order:
  //   1. `shortstack_user_id` tag (most reliable — our send route sets it)
  //   2. `from` domain match against agency_mail_domains
  //   3. Lookup by Resend email_id in our own trinity_log send row
  // (3) catches the case where Resend ever strips tags off an event type
  // we care about, or for emails sent from the Resend dashboard that
  // still reference an email_id we logged.
  const ownerFromTags = resolveOwnerFromTags(tags);
  const ownerFromDomain = ownerFromTags
    ? null
    : await resolveOwnerFromFrom(supabase, event.data.from);
  const ownerFromEmailId =
    ownerFromTags || ownerFromDomain
      ? null
      : await resolveOwnerFromEmailId(supabase, event.data.email_id);
  const ownerId = ownerFromTags || ownerFromDomain || ownerFromEmailId;

  const ownerResolution = ownerFromTags
    ? "tag"
    : ownerFromDomain
    ? "domain"
    : ownerFromEmailId
    ? "email_id_lookup"
    : "none";

  // Audit log — every event, regardless of whether a trigger fires.
  // Lets the user see "email.bounced" events etc. even without a
  // dedicated trigger for them. `raw_tags` is included so future shape
  // changes on Resend's side are debuggable without another redeploy.
  await supabase.from("trinity_log").insert({
    user_id: ownerId,
    agent: "resend-webhook",
    action_type: "email_campaign",
    description: `Resend event: ${event.type}${event.data.email_id ? ` (${event.data.email_id})` : ""}`,
    status: "completed",
    result: {
      event_type: event.type,
      email_id: event.data.email_id,
      from: event.data.from,
      to: event.data.to,
      subject: event.data.subject,
      click: event.data.click,
      owner_resolution: ownerResolution,
      raw_tags: event.data.tags ?? null,
      normalized_tags: tags,
    },
  });

  // Fire the trigger if we have a mapping AND we could resolve an owner.
  if (triggerType && ownerId) {
    fireTrigger({
      supabase,
      userId: ownerId,
      triggerType,
      payload: {
        email_id: event.data.email_id,
        from: event.data.from,
        to: Array.isArray(event.data.to) ? event.data.to[0] : event.data.to,
        subject: event.data.subject,
        click_link: event.data.click?.link,
        click_timestamp: event.data.click?.timestamp,
        // Pass through any `campaign_id` tag so filters can match on it.
        campaign_id: tags.campaign_id,
      },
    }).catch((err) => console.error("[resend-webhook] fireTrigger failed:", err));
  }

  return NextResponse.json({
    ok: true,
    event_type: event.type,
    fired: !!(triggerType && ownerId),
    owner_resolution: ownerResolution,
  });
}
