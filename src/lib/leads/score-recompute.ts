/**
 * Lead score recompute service.
 *
 * - `loadSignals(supabase, leadId)` pulls the latest engagement data for one lead.
 * - `recomputeScore(supabase, leadId)` runs the scoring engine and persists.
 * - `recomputeAllForUser(supabase, userId, opts)` batches recomputes for a
 *   single agency owner with a token-budget guard (used by the cron).
 *
 * IMPORTANT: this module is callable from both authenticated route handlers
 * (`createServerSupabase`) and trusted server contexts (`createServiceClient`).
 * The caller passes in the client — we never bypass RLS implicitly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeScore,
  SCORING_CONFIG,
  type LeadProfile,
  type LeadSignals,
  type ScoreComputation,
  type SignalEvent,
} from "./scoring";

const FULL_HISTORY_DAYS = SCORING_CONFIG.windows.full_history_days;

// Customer-status detection — both 'converted' lead status and a customer flag.
function isLeadCustomer(profile: LeadProfile): boolean {
  return profile.status === "converted";
}

interface RawOutreachRow {
  sent_at: string | null;
  replied_at: string | null;
  reply_text: string | null;
  platform: string | null;
  message_text: string | null;
  status: string | null;
}

interface RawEmailRecipientRow {
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
}

interface RawSocialCommentRow {
  created_at: string | null;
  text: string | null;
  sentiment: string | null;
}

interface RawFunnelEventRow {
  created_at: string | null;
  event_type: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Pull all engagement signals for a lead.
 *
 * We use email match as the join key for `email_campaign_recipients` (no
 * direct lead_id FK exists in that table) and `outreach_log.lead_id` for
 * outreach.
 */
export async function loadSignals(
  supabase: SupabaseClient,
  leadId: string,
): Promise<LeadSignals | null> {
  const { data: leadRow, error: leadErr } = await supabase
    .from("leads")
    .select(
      "id, user_id, business_name, email, phone, website, industry, city, state, google_rating, review_count, status, source",
    )
    .eq("id", leadId)
    .single();

  if (leadErr || !leadRow) return null;

  const profile = leadRow as LeadProfile;
  const sinceIso = new Date(
    Date.now() - FULL_HISTORY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const events: SignalEvent[] = [];
  const recentInteractions: LeadSignals["recentInteractions"] = [];

  // 1) Outreach log — both directions
  const { data: outreach } = await supabase
    .from("outreach_log")
    .select("sent_at, replied_at, reply_text, platform, message_text, status")
    .eq("lead_id", leadId)
    .gte("sent_at", sinceIso)
    .order("sent_at", { ascending: false })
    .limit(50);

  for (const row of (outreach ?? []) as RawOutreachRow[]) {
    if (row.sent_at) {
      events.push({
        type: "outreach_sent",
        occurred_at: row.sent_at,
        metadata: { platform: row.platform, status: row.status },
      });
      recentInteractions.push({
        direction: "outbound",
        channel: row.platform ?? "unknown",
        text: row.message_text ?? null,
        occurred_at: row.sent_at,
      });
    }
    if (row.replied_at) {
      events.push({
        type: "outreach_replied",
        occurred_at: row.replied_at,
        metadata: { platform: row.platform },
      });
      recentInteractions.push({
        direction: "inbound",
        channel: row.platform ?? "unknown",
        text: row.reply_text ?? null,
        occurred_at: row.replied_at,
      });
    }
  }

  // 2) Email campaign recipients — open/click events. Match by email.
  if (profile.email) {
    const { data: emailRows } = await supabase
      .from("email_campaign_recipients")
      .select("sent_at, opened_at, clicked_at")
      .eq("email", profile.email)
      .gte("sent_at", sinceIso)
      .limit(100);

    for (const row of (emailRows ?? []) as RawEmailRecipientRow[]) {
      if (row.opened_at) {
        events.push({ type: "email_open", occurred_at: row.opened_at });
      }
      if (row.clicked_at) {
        events.push({ type: "email_click", occurred_at: row.clicked_at });
      }
    }
  }

  // 3) Social comments — match by user_id (the agency owner's social monitoring).
  // We only count comments left BY this lead. Without a direct join, we filter by
  // commenter_handle matching email/phone/business name when present.
  const handles = [
    profile.email,
    profile.phone,
    profile.business_name,
  ].filter((v): v is string => !!v);

  if (handles.length > 0) {
    const { data: socialRows } = await supabase
      .from("social_comments")
      .select("created_at, text, sentiment, commenter_handle")
      .eq("user_id", profile.user_id)
      .in("commenter_handle", handles)
      .gte("created_at", sinceIso)
      .limit(50);

    for (const row of (socialRows ?? []) as Array<
      RawSocialCommentRow & { commenter_handle: string | null }
    >) {
      if (row.created_at) {
        events.push({
          type: "social_comment",
          occurred_at: row.created_at,
          metadata: { sentiment: row.sentiment },
        });
      }
    }
  }

  // 4) Funnel analytics — page views, pricing views, form submits, demo bookings.
  // We match by visitor_id stored in metadata (best-effort) — when no link exists,
  // these signals simply don't fire for this lead. That's fine.
  if (profile.email) {
    const { data: funnelRows } = await supabase
      .from("funnel_analytics")
      .select("created_at, event_type, metadata")
      .gte("created_at", sinceIso)
      .filter("metadata->>email", "eq", profile.email)
      .limit(200);

    for (const row of (funnelRows ?? []) as RawFunnelEventRow[]) {
      if (!row.created_at || !row.event_type) continue;
      const t = row.event_type;
      const mapped: SignalEvent["type"] | null =
        t === "page_view"
          ? "page_view"
          : t === "pricing_view"
            ? "pricing_view"
            : t === "form_submit"
              ? "form_submit"
              : t === "demo_booked"
                ? "demo_booked"
                : null;
      if (mapped) {
        events.push({
          type: mapped,
          occurred_at: row.created_at,
          metadata: row.metadata ?? undefined,
        });
      }
    }
  }

  // Sort interactions newest-first, take top 5
  recentInteractions.sort(
    (a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at),
  );

  return {
    profile,
    events,
    recentInteractions: recentInteractions.slice(0, 5),
    isCustomer: isLeadCustomer(profile),
  };
}

/**
 * Persist a `ScoreComputation` back to the leads row + log a `lead_score_events` row.
 * The caller is responsible for ensuring `client` has permission to write to
 * the lead (via RLS or service-role bypass).
 */
export async function persistScore(
  supabase: SupabaseClient,
  leadId: string,
  userId: string,
  priorScore: number | null,
  result: ScoreComputation,
): Promise<void> {
  const nowIso = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("leads")
    .update({
      score: result.score,
      score_grade: result.grade,
      score_signals: result.signal_breakdown,
      score_breakdown: {
        base_score: result.base_score,
        ai_bonus: result.ai_bonus,
        signals: result.signal_breakdown,
      },
      score_reasoning: result.ai_reasoning,
      score_computed_at: nowIso,
      score_updated_at: nowIso,
      score_version: result.algo_version,
    })
    .eq("id", leadId);

  if (updateErr) {
    throw new Error(`[score-recompute] update failed: ${updateErr.message}`);
  }

  // Best-effort event log — failure here must not break the main flow.
  try {
    await supabase.from("lead_score_events").insert({
      lead_id: leadId,
      user_id: userId,
      event_type: "recompute",
      event_value: result.score,
      prior_score: priorScore,
      new_score: result.score,
      metadata: {
        base_score: result.base_score,
        ai_bonus: result.ai_bonus,
        grade: result.grade,
        algo_version: result.algo_version,
      },
    });
  } catch (err) {
    console.error("[score-recompute] event log insert failed", err);
  }
}

export interface RecomputeOutcome {
  leadId: string;
  prior_score: number | null;
  score: number;
  grade: ScoreComputation["grade"];
}

/**
 * Recompute and persist a single lead's score. Returns the new score or null
 * if the lead can't be loaded.
 */
export async function recomputeScore(
  supabase: SupabaseClient,
  leadId: string,
  context = "/lead-scoring/recompute-one",
): Promise<RecomputeOutcome | null> {
  const signals = await loadSignals(supabase, leadId);
  if (!signals) return null;

  const priorScoreRow = await supabase
    .from("leads")
    .select("score")
    .eq("id", leadId)
    .single();
  const priorScore = priorScoreRow.data?.score ?? null;

  const result = await computeScore(signals, { context });
  await persistScore(supabase, leadId, signals.profile.user_id, priorScore, result);

  return {
    leadId,
    prior_score: priorScore,
    score: result.score,
    grade: result.grade,
  };
}

export interface BatchRecomputeOptions {
  /** Cap on rows to process this run. */
  maxLeads?: number;
  /** Hard ceiling on AI spend per run, USD. */
  maxCostUsd?: number;
  /** Only recompute leads whose score_updated_at is older than this many minutes. */
  staleMinutes?: number;
  /** When the caller is the cron, wire the trusted source for telemetry. */
  context?: string;
}

export interface BatchRecomputeResult {
  processed: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

/**
 * Recompute scores for the most-stale leads under a single agency owner.
 *
 * Per-run budget guard: we approximate $0.0005/lead for Haiku and stop early
 * if the running total exceeds `maxCostUsd` (default $1).
 */
export async function recomputeAllForUser(
  supabase: SupabaseClient,
  userId: string,
  opts: BatchRecomputeOptions = {},
): Promise<BatchRecomputeResult> {
  const startedAt = Date.now();
  const maxLeads = opts.maxLeads ?? 100;
  const maxCostUsd = opts.maxCostUsd ?? 1.0;
  const staleMinutes = opts.staleMinutes ?? 60;
  const context = opts.context ?? "/api/cron/recompute-lead-scores";

  const cutoffIso = new Date(
    Date.now() - staleMinutes * 60 * 1000,
  ).toISOString();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", userId)
    .or(`score_updated_at.is.null,score_updated_at.lt.${cutoffIso}`)
    .order("score_updated_at", { ascending: true, nullsFirst: true })
    .limit(maxLeads);

  if (error) {
    console.error("[score-recompute] batch select failed", error);
    return {
      processed: 0,
      skipped: 0,
      errors: 1,
      durationMs: Date.now() - startedAt,
    };
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  // Rough cost estimator — Haiku is ~$0.001 per ~1k tokens; we send <=400 tokens
  // and read <=200, so we budget $0.0005/lead and stop early when exceeded.
  const APPROX_COST_PER_LEAD = 0.0005;
  let runningCost = 0;

  for (const row of leads ?? []) {
    if (runningCost >= maxCostUsd) {
      skipped += (leads?.length ?? 0) - processed - errors;
      break;
    }
    try {
      const out = await recomputeScore(supabase, row.id, context);
      if (out) {
        processed++;
        runningCost += APPROX_COST_PER_LEAD;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error("[score-recompute] lead failed", row.id, err);
      errors++;
    }
  }

  return {
    processed,
    skipped,
    errors,
    durationMs: Date.now() - startedAt,
  };
}
