import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 120;

// Lead Scoring Agent — AI-scores leads 0-100 so outreach prioritizes the best ones
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  let scored = 0;

  // Get unscored leads (no lead_score yet)
  const { data: leads } = await supabase
    .from("leads")
    .select("id, business_name, email, phone, website, google_rating, review_count, industry, instagram_url, facebook_url, linkedin_url")
    .is("lead_score", null)
    .in("status", ["new", "called"])
    .limit(100);

  if (!leads || leads.length === 0) {
    return NextResponse.json({ success: true, scored: 0, message: "No unscored leads" });
  }

  for (const lead of leads) {
    let score = 0;

    // Contact info completeness (max 30)
    if (lead.email) score += 10;
    if (lead.phone) score += 10;
    if (lead.website) score += 10;

    // Social presence (max 20)
    if (lead.instagram_url) score += 7;
    if (lead.facebook_url) score += 7;
    if (lead.linkedin_url) score += 6;

    // Google rating signals quality (max 20)
    if (lead.google_rating) {
      if (lead.google_rating >= 4.5) score += 20;
      else if (lead.google_rating >= 4.0) score += 15;
      else if (lead.google_rating >= 3.5) score += 10;
      else score += 5;
    }

    // Review count — sweet spot is 10-200 (small enough to need help, big enough to pay)
    const reviews = lead.review_count || 0;
    if (reviews >= 10 && reviews <= 50) score += 15; // Perfect target
    else if (reviews >= 51 && reviews <= 200) score += 10; // Good target
    else if (reviews > 200) score += 5; // Probably already has a marketing team
    else score += 3; // Very new business

    // High-value industries (max 15)
    const highValue = ["dentist", "lawyer", "med spa", "real estate", "chiropractor", "accountant"];
    const medValue = ["gym", "restaurant", "salon", "photographer", "therapist"];
    const industry = (lead.industry || "").toLowerCase();
    if (highValue.some(i => industry.includes(i))) score += 15;
    else if (medValue.some(i => industry.includes(i))) score += 10;
    else score += 5;

    // Cap at 100
    score = Math.min(100, score);

    await supabase
      .from("leads")
      .update({ lead_score: score })
      .eq("id", lead.id);

    scored++;
  }

  return NextResponse.json({ success: true, scored, timestamp: new Date().toISOString() });
}
