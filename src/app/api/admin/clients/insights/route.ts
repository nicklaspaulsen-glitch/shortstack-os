import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, safeJsonParse } from "@/lib/ai/claude-helpers";

/**
 * Admin-only AI insights endpoint.
 *
 * Generates a one-line health summary, churn risk score, and next-best-
 * action recommendation per client. Uses Claude Haiku for speed + cost.
 *
 * Auth: requires profile.role IN ('admin','founder').
 *
 * Request:
 *   POST /api/admin/clients/insights
 *   { client_ids?: string[] }   // optional — defaults to all active clients
 *
 * Response:
 *   { insights: Array<{
 *       client_id: string;
 *       business_name: string;
 *       health_summary: string;       // 1 sentence
 *       churn_risk: "low" | "medium" | "high";
 *       next_best_action: string;     // 1 sentence
 *     }>;
 *     model: string;
 *     count: number;
 *   }
 */

interface ClientInsight {
  client_id: string;
  business_name: string;
  health_summary: string;
  churn_risk: "low" | "medium" | "high";
  next_best_action: string;
}

const MAX_BATCH = 25; // bound the token cost — admins can paginate

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Role gate — admin / founder only.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || (profile.role !== "admin" && profile.role !== "founder")) {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { client_ids?: string[] };
    const requestedIds = Array.isArray(body.client_ids) ? body.client_ids.slice(0, MAX_BATCH) : null;

    // Pull a small, well-typed shape so TS infers the rows precisely. We
    // use a const projection string + interface to avoid Supabase's
    // multi-line `select()` returning a GenericStringError union.
    type ClientRow = {
      id: string;
      business_name: string | null;
      industry: string | null;
      mrr: number | null;
      health_score: number | null;
      contract_status: string | null;
      is_active: boolean | null;
      cancelled_at: string | null;
      onboarded_at: string | null;
      created_at: string | null;
      package_tier: string | null;
      stripe_subscription_id: string | null;
      services: string[] | null;
    };

    const service = createServiceClient();
    let query = service
      .from("clients")
      .select("id,business_name,industry,mrr,health_score,contract_status,is_active,cancelled_at,onboarded_at,created_at,package_tier,stripe_subscription_id,services")
      .order("health_score", { ascending: true });
    if (requestedIds) {
      query = query.in("id", requestedIds);
    } else {
      query = query.eq("is_active", true).limit(MAX_BATCH);
    }
    const { data, error } = await query;
    if (error) {
      console.error("[/api/admin/clients/insights] fetch error:", error.message);
      return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
    }
    const clients = (data || []) as unknown as ClientRow[];
    if (clients.length === 0) {
      return NextResponse.json({ insights: [], model: MODEL_HAIKU, count: 0 });
    }

    // Compact the per-client context to keep the prompt cheap.
    const compact = clients.map((c) => ({
      id: c.id,
      name: c.business_name,
      industry: c.industry || null,
      mrr_usd: c.mrr || 0,
      health_score: c.health_score || 0,
      contract: c.contract_status || "none",
      tier: c.package_tier || null,
      services: Array.isArray(c.services) ? c.services : null,
      paying: !!c.stripe_subscription_id,
      active: !!c.is_active,
      cancelled_at: c.cancelled_at || null,
      onboarded_at: c.onboarded_at || null,
      age_days: c.created_at
        ? Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000)
        : null,
    }));

    const prompt = `You are an agency operations analyst. Given the following list of agency clients (one row per client), produce a JSON array with one object per client. For each:

  - health_summary: ONE sentence describing how the client is doing right now. Specific, no fluff.
  - churn_risk: "low" | "medium" | "high" — based on signals like low health_score, no paying subscription, no signed contract, recently cancelled, long time since onboarded with low MRR.
  - next_best_action: ONE sentence the agency owner should do this week to improve the relationship. Be concrete (e.g. "send a Q1 review deck", "call to renegotiate the dropped MRR", "ship the overdue website draft").

Return ONLY valid JSON, no markdown fences, no preamble. Schema:
[
  { "client_id": "<uuid>", "health_summary": "...", "churn_risk": "low|medium|high", "next_best_action": "..." }
]

CLIENTS:
${JSON.stringify(compact, null, 2)}`;

    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    // Anthropic ContentBlock is a union; `text` only exists on the "text"
    // variant. Narrow via the discriminator before access.
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n");

    const parsed = safeJsonParse<Array<Omit<ClientInsight, "business_name">>>(text);
    if (!parsed || !Array.isArray(parsed)) {
      console.error("[/api/admin/clients/insights] failed to parse model output:", text.slice(0, 500));
      return NextResponse.json(
        { error: "AI returned unparseable output", raw: text.slice(0, 500) },
        { status: 502 },
      );
    }

    // Re-attach business_name and drop any rows the model hallucinated for
    // unknown client_ids (defensive — the prompt only included the IDs we
    // sent, but we don't trust the model's output blindly).
    const byId = new Map<string, string>(
      clients.map((c) => [c.id, c.business_name || "Unknown"]),
    );
    const insights: ClientInsight[] = parsed
      .filter((p) => byId.has(p.client_id))
      .map((p) => ({
        client_id: p.client_id,
        business_name: byId.get(p.client_id) || "Unknown",
        health_summary: String(p.health_summary || "").slice(0, 240),
        churn_risk: (["low", "medium", "high"] as const).includes(
          p.churn_risk as "low" | "medium" | "high",
        )
          ? (p.churn_risk as "low" | "medium" | "high")
          : "medium",
        next_best_action: String(p.next_best_action || "").slice(0, 240),
      }));

    return NextResponse.json({
      insights,
      model: MODEL_HAIKU,
      count: insights.length,
    });
  } catch (err) {
    console.error("[/api/admin/clients/insights] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
