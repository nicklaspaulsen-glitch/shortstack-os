import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { chatWithFallback } from "@/lib/llm/router";
import { safeJsonParse } from "@/lib/ai/claude-helpers";

// AI Lead Scoring — Ranks leads by conversion likelihood.
// Scoring is a classification task → routes to local Ollama/RunPod when
// available, falls back to Anthropic Haiku on any local failure.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lead_ids } = await request.json();

  // Get leads to score — scoped to caller's owned leads only.
  const { data: leads } = lead_ids
    ? await supabase.from("leads").select("*").eq("user_id", ownerId).in("id", lead_ids)
    : await supabase.from("leads").select("*").eq("user_id", ownerId).eq("status", "new").limit(100);

  if (!leads || leads.length === 0) return NextResponse.json({ results: [] });

  const results: Array<{ id: string; score: number; reason: string }> = [];

  const leadsInfo = leads.map((l) => ({
    id: l.id,
    name: l.business_name,
    industry: l.industry,
    rating: l.google_rating,
    reviews: l.review_count,
    hasPhone: !!l.phone,
    hasEmail: !!l.email,
    hasWebsite: !!l.website,
    hasSocials: !!(l.instagram_url || l.facebook_url || l.linkedin_url),
  }));

  const systemPrompt = `You are a lead scoring expert for a digital marketing agency. Score each lead 1-100 based on likelihood to become a paying client. Consider: industry profitability, online presence gaps (low reviews = needs help), contact info availability, social media presence. Return ONLY a valid JSON array of {id, score, reason} objects. No markdown fences, no prose.`;
  const userPrompt = `Score these leads. Return JSON array of {id, score, reason}: ${JSON.stringify(leadsInfo)}`;

  let routedSuccess = false;
  try {
    // chatWithFallback tries local first, falls back to cloud Haiku automatically.
    const text = await chatWithFallback(userPrompt, "score", {
      system: systemPrompt,
      maxTokens: 3000,
      temperature: 0.2,
      userId: user.id,
    });

    const scores = safeJsonParse<Array<{ id: string; score: number; reason: string }>>(text);
    if (Array.isArray(scores)) {
      results.push(...scores);
      routedSuccess = true;
    }
  } catch {
    // fall through to heuristic below
  }

  if (!routedSuccess) {
    // Heuristic fallback — used when neither local nor cloud produced valid JSON.
    for (const l of leads) {
      let score = 50;
      if (l.phone) score += 15;
      if (l.email) score += 10;
      if (l.website) score += 5;
      if (l.google_rating && l.google_rating < 4) score += 10; // Needs help
      if (l.review_count < 50) score += 10; // Small business, more likely to need marketing
      if (["dentist", "lawyer", "real estate agent"].includes(l.industry || "")) score += 10;
      results.push({ id: l.id, score: Math.min(score, 100), reason: "Rule-based score (router unavailable)" });
    }
  }

  return NextResponse.json({ results });
}
