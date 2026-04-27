/**
 * POST /api/ads-manager/insights/generate
 *
 * Asks Claude (via callLLM with taskType: "complex_analysis") to review the
 * last 30 days of ad metrics and propose optimizations:
 *   - reallocate budget between platforms (Meta -> Google etc)
 *   - pause underperforming campaigns
 *   - scale up high-ROAS campaigns
 *   - flag creative fatigue
 *
 * Each suggestion is persisted to `ads_optimization_suggestions` with status
 * "pending" — the human approves/rejects via the Insights tab UI.
 *
 * Also returns time-series chart data for the Insights tab (spend, conversions,
 * ROAS over time per platform).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { UnifiedAdsClient } from "@/lib/ads/unified-client";
import { callLLM } from "@/lib/ai/llm-router";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SuggestionType = "reallocate" | "pause" | "scale" | "optimize_creative";

interface AISuggestion {
  type: SuggestionType;
  platform?: "meta" | "google" | "tiktok";
  campaignId?: string;
  rationale: string;
  potentialLiftPct?: number;
  currentState?: Record<string, unknown>;
  suggestedState?: Record<string, unknown>;
}

const aiResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      type: z.enum(["reallocate", "pause", "scale", "optimize_creative"]),
      platform: z.enum(["meta", "google", "tiktok"]).optional(),
      campaignId: z.string().optional(),
      rationale: z.string(),
      potentialLiftPct: z.number().optional(),
      currentState: z.record(z.unknown()).optional(),
      suggestedState: z.record(z.unknown()).optional(),
    }),
  ),
});

const SYSTEM_PROMPT = `You are an expert paid-ads analyst working inside an
agency operating system. Your job is to review 30 days of ad performance data
across Meta, Google Ads, and TikTok, and propose specific, actionable
optimisations the operator can apply with one click.

Suggestion types:
  - "reallocate": move budget from a low-performing platform/campaign to a
    high-performing one. Be quantitative ("$50/day from Meta to Google").
  - "pause": flag a campaign that's burned spend with zero/near-zero
    conversions. Cite the spend and conversion count.
  - "scale": flag a campaign with strong ROAS that's currently budget-capped.
    Recommend a specific budget increase (e.g. "raise from $20/day to $40/day").
  - "optimize_creative": flag creative fatigue — high CPM rising over time, or
    declining CTR — and recommend a refresh.

Rules:
  - Maximum 5 suggestions, ranked by potential lift.
  - Always include a "potentialLiftPct" estimate (best-effort, conservative).
  - "rationale" must cite real numbers from the input data — no vague claims.
  - "currentState" and "suggestedState" should be small JSON blobs that the
    UI can use to show before/after pills.
  - Output ONLY valid JSON matching the schema below — no prose, no markdown.

Schema:
  { "suggestions": [
      { "type": "...", "platform": "...", "campaignId": "...",
        "rationale": "...", "potentialLiftPct": 0,
        "currentState": {...}, "suggestedState": {...} }
  ] }`;

function buildUserPrompt(payload: {
  totals: { spend: number; conversions: number; roas: number | null };
  perPlatform: Record<
    string,
    { spend: number; conversions: number; ctr: number; roas: number | null; campaigns: number }
  >;
  campaigns: Array<{
    id: string;
    name: string;
    platform: string;
    spend: number;
    conversions: number;
    ctr: number;
    roas: number | null;
    status: string;
    dailyBudget: number | null;
  }>;
}): string {
  return [
    "Last 30 days of ad performance data:",
    "",
    "TOTALS:",
    JSON.stringify(payload.totals, null, 2),
    "",
    "PER PLATFORM:",
    JSON.stringify(payload.perPlatform, null, 2),
    "",
    "CAMPAIGNS (sorted by spend, top 25):",
    JSON.stringify(payload.campaigns.slice(0, 25), null, 2),
    "",
    "Generate optimisation suggestions in the JSON format described above.",
  ].join("\n");
}

function safeParseJson(raw: string): unknown {
  // Strip ```json fences if the model added them despite instructions.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find a JSON object substring.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function POST(): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  // Pull the last 30 days of campaign data.
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const fromIso = fromDate.toISOString().slice(0, 10);

  const client = new UnifiedAdsClient(supabase, ownerId);
  const campaigns = await client.listCampaigns({ fromDate: fromIso });

  if (campaigns.length === 0) {
    return NextResponse.json({
      suggestions: [],
      message:
        "No campaigns yet — connect an ad account and run /api/ads/{platform}/campaigns to populate the cache.",
    });
  }

  // Build aggregates for the prompt.
  const totals = {
    spend: campaigns.reduce((s, c) => s + c.totalSpend, 0),
    conversions: campaigns.reduce((s, c) => s + c.conversions, 0),
    roas: weightedRoas(campaigns),
  };

  const perPlatform: Record<
    string,
    { spend: number; conversions: number; ctr: number; roas: number | null; campaigns: number }
  > = {};
  for (const platform of ["meta", "google", "tiktok"] as const) {
    const filtered = campaigns.filter((c) => c.platform === platform);
    if (filtered.length === 0) continue;
    const spend = filtered.reduce((s, c) => s + c.totalSpend, 0);
    const conversions = filtered.reduce((s, c) => s + c.conversions, 0);
    const impressions = filtered.reduce((s, c) => s + c.impressions, 0);
    const clicks = filtered.reduce((s, c) => s + c.clicks, 0);
    perPlatform[platform] = {
      spend,
      conversions,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      roas: weightedRoas(filtered),
      campaigns: filtered.length,
    };
  }

  const promptCampaigns = campaigns
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      spend: c.totalSpend,
      conversions: c.conversions,
      ctr: c.ctr,
      roas: c.roas,
      status: c.status,
      dailyBudget: c.dailyBudget,
    }));

  let suggestions: AISuggestion[] = [];
  try {
    const llmResponse = await callLLM({
      taskType: "complex_analysis",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt({ totals, perPlatform, campaigns: promptCampaigns }),
      userId: user.id,
      context: "/api/ads-manager/insights/generate",
      maxTokens: 2000,
      temperature: 0.3,
    });

    const parsed = aiResponseSchema.safeParse(safeParseJson(llmResponse.text));
    if (parsed.success) {
      suggestions = parsed.data.suggestions;
    } else {
      console.error("[ads-manager/insights] LLM returned unparseable JSON:", llmResponse.text);
    }
  } catch (err) {
    console.error("[ads-manager/insights] callLLM failed:", err);
    return NextResponse.json(
      { error: "AI suggestions failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  // Persist suggestions to the optimization_suggestions table.
  // We expire any prior pending suggestions for the same user first — the
  // user shouldn't see stale recs after a fresh run.
  await supabase
    .from("ads_optimization_suggestions")
    .update({ status: "expired" })
    .eq("user_id", ownerId)
    .eq("status", "pending");

  if (suggestions.length > 0) {
    const rows = suggestions.map((s) => ({
      user_id: ownerId,
      suggestion_type: s.type,
      platform: s.platform || null,
      campaign_id: s.campaignId || null,
      current_state: s.currentState || {},
      suggested_state: s.suggestedState || {},
      rationale: s.rationale,
      potential_lift_pct: s.potentialLiftPct ?? null,
      status: "pending",
    }));
    const { error: insertError } = await supabase
      .from("ads_optimization_suggestions")
      .insert(rows);
    if (insertError) {
      console.error("[ads-manager/insights] suggestion insert failed:", insertError);
    }
  }

  // Return the freshly inserted suggestions with their ids.
  const { data: stored } = await supabase
    .from("ads_optimization_suggestions")
    .select("*")
    .eq("user_id", ownerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return NextResponse.json({
    suggestions: stored || [],
    generated: suggestions.length,
  });
}

function weightedRoas(
  campaigns: Array<{ roas: number | null; totalSpend: number }>,
): number | null {
  let weightedSum = 0;
  let weight = 0;
  for (const c of campaigns) {
    if (c.roas !== null && c.totalSpend > 0) {
      weightedSum += c.roas * c.totalSpend;
      weight += c.totalSpend;
    }
  }
  return weight > 0 ? weightedSum / weight : null;
}
