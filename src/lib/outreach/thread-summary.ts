/**
 * Thread summary — the AI-generated header that sits on top of an open
 * thread ("Warm prospect; last contact 3d ago; suggested action: send case
 * study"). Uses callLLM with `complex_analysis` taskType for quality
 * (Opus → Sonnet fallback). Cached for 24h in `outreach_thread_summaries`
 * keyed by (agency_owner_id, contact_kind, contact_id).
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { callLLM } from "@/lib/ai/llm-router";
import { reportError } from "@/lib/observability/error-reporter";
import type { ContactKind, OutreachEvent, OutreachThreadSummary } from "./types";

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TIMELINE_CHARS = 4000;

interface CacheRow {
  summary: string;
  suggested_action: string;
  computed_at: string;
}

function timelineToText(events: OutreachEvent[]): string {
  const lines: string[] = [];
  let chars = 0;
  for (const e of events) {
    const date = e.ts.slice(0, 10);
    const dirLabel = e.direction === "in" ? "← inbound" : "→ outbound";
    const channelLabel = e.channel.replace("_", " ");
    const body = (e.transcript ? e.transcript : e.body || "").slice(0, 400);
    const line = `[${date}] ${dirLabel} ${channelLabel}: ${body}`;
    chars += line.length;
    lines.push(line);
    if (chars >= MAX_TIMELINE_CHARS) {
      lines.push("[…older interactions truncated]");
      break;
    }
  }
  return lines.join("\n\n");
}

function safeParseSummary(raw: string): { summary: string; suggested_action: string } {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed !== null) {
      return {
        summary: String(parsed.summary || "").slice(0, 320),
        suggested_action: String(parsed.suggested_action || "").slice(0, 240),
      };
    }
  } catch {
    // fall through
  }
  return {
    summary: cleaned.slice(0, 320),
    suggested_action: "",
  };
}

/**
 * Get an AI-rendered top-of-thread summary, from cache when fresh
 * (< 24h old) and computed-on-demand otherwise. Never throws — returns
 * an empty summary on any failure path so the UI can still render.
 */
export async function getOrComputeThreadSummary(
  supabase: SupabaseClient,
  agencyOwnerId: string,
  contactKind: ContactKind,
  contactId: string,
  events: OutreachEvent[],
  contactName: string,
): Promise<OutreachThreadSummary> {
  // Try cache first.
  const { data: cached } = await supabase
    .from("outreach_thread_summaries")
    .select("summary, suggested_action, computed_at")
    .eq("agency_owner_id", agencyOwnerId)
    .eq("contact_kind", contactKind)
    .eq("contact_id", contactId)
    .single();

  if (cached) {
    const row = cached as CacheRow;
    const age = Date.now() - new Date(row.computed_at).getTime();
    if (age < TTL_MS) {
      return {
        summary: row.summary,
        suggested_action: row.suggested_action,
        computed_at: row.computed_at,
      };
    }
  }

  if (events.length === 0) {
    const empty: OutreachThreadSummary = {
      summary: "",
      suggested_action: "",
      computed_at: new Date().toISOString(),
    };
    return empty;
  }

  const userPrompt = `Contact: ${contactName}

Timeline (oldest first):
${timelineToText(events)}

Return ONLY a JSON object on a single line, no markdown:
{"summary":"<2 short sentences: prospect temperature, last touch, key signal>","suggested_action":"<one short next-step recommendation>"}`;

  try {
    const llm = await callLLM({
      taskType: "complex_analysis",
      systemPrompt:
        "You are a senior outbound-sales analyst. Read a multi-channel outreach timeline and produce a concise, actionable summary for the agency owner. Be specific; reference the actual messages. No fluff.",
      userPrompt,
      maxTokens: 220,
      temperature: 0.2,
      userId: agencyOwnerId,
      context: "/api/outreach/thread-summary",
    });

    const parsed = safeParseSummary(llm.text);
    const out: OutreachThreadSummary = {
      summary: parsed.summary,
      suggested_action: parsed.suggested_action,
      computed_at: new Date().toISOString(),
    };

    // Cache. Best-effort — failure here doesn't block the request.
    await supabase
      .from("outreach_thread_summaries")
      .upsert(
        {
          agency_owner_id: agencyOwnerId,
          contact_kind: contactKind,
          contact_id: contactId,
          summary: out.summary,
          suggested_action: out.suggested_action,
          computed_at: out.computed_at,
        },
        { onConflict: "agency_owner_id,contact_kind,contact_id" },
      );

    return out;
  } catch (err) {
    reportError(err, {
      route: "outreach-thread-summary",
      component: "getOrComputeThreadSummary",
      reason: "llm-or-db",
    });
    return {
      summary: "",
      suggested_action: "",
      computed_at: new Date().toISOString(),
    };
  }
}
