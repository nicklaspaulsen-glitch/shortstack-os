import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// AI Lead Scoring — Ranks leads by conversion likelihood
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const results: Array<{ id: string; score: number; reason: string }> = [];

  if (apiKey) {
    // Batch score with Claude
    const leadsInfo = leads.map(l => ({
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

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3000,
        system: `You are a lead scoring expert for a digital marketing agency. Score each lead 1-100 based on likelihood to become a paying client. Consider: industry profitability, online presence gaps (low reviews = needs help), contact info availability, social media presence. Return valid JSON array only.`,
        messages: [{ role: "user", content: `Score these leads. Return JSON array of {id, score, reason}: ${JSON.stringify(leadsInfo)}` }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || "[]";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
      const scores = JSON.parse(cleaned);
      results.push(...scores);
    } catch {
      // Fallback: simple scoring
      for (const l of leads) {
        let score = 50;
        if (l.phone) score += 15;
        if (l.email) score += 10;
        if (l.website) score += 5;
        if (l.google_rating && l.google_rating < 4) score += 10; // Needs help
        if (l.review_count < 50) score += 10; // Small business, more likely to need marketing
        if (["dentist", "lawyer", "real estate agent"].includes(l.industry || "")) score += 10; // High-value industries
        results.push({ id: l.id, score: Math.min(score, 100), reason: "Auto-scored based on data" });
      }
    }
  } else {
    // Simple rule-based scoring
    for (const l of leads) {
      let score = 50;
      if (l.phone) score += 15;
      if (l.email) score += 10;
      if (l.website) score += 5;
      if (l.google_rating && l.google_rating < 4) score += 10;
      if (l.review_count < 50) score += 10;
      results.push({ id: l.id, score: Math.min(score, 100), reason: "Rule-based score" });
    }
  }

  return NextResponse.json({ results });
}
