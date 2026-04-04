import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Lead Enrichment — Researches a lead and adds intelligence before cold calling
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lead_id } = await request.json();

  const { data: lead } = await supabase.from("leads").select("*").eq("id", lead_id).single();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Scrape their website for intel
  let siteContent = "";
  if (lead.website) {
    try {
      const res = await fetch(lead.website, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      });
      const html = await res.text();
      siteContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 2000);
    } catch { /* ignore */ }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: "You are a sales intelligence analyst. Research leads and provide actionable intel for cold calls. Return valid JSON only.",
      messages: [{ role: "user", content: `Enrich this lead for a cold call:
Business: ${lead.business_name}
Industry: ${lead.industry || "unknown"}
Phone: ${lead.phone}
Website: ${lead.website || "none"}
Google Rating: ${lead.google_rating || "unknown"} (${lead.review_count} reviews)
Location: ${lead.city || ""}, ${lead.state || ""}
Website content: ${siteContent || "not available"}

Return JSON with:
- business_summary: what they do in 1 sentence
- estimated_size: small/medium/large
- online_presence_gaps: array of what they're missing
- pain_points_likely: array of 3 probable pain points
- personalized_opener: a natural opening line for the cold call
- services_to_pitch: array of 3 most relevant ShortStack services
- objections_to_expect: array of 2 likely objections with rebuttals
- conversation_hooks: array of 3 things to mention from their website/reviews
- call_priority: 1-10 (how likely to convert)` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const enrichment = JSON.parse(cleaned);
    return NextResponse.json({ success: true, enrichment, lead });
  } catch {
    return NextResponse.json({ success: true, enrichment: { raw: text } });
  }
}
