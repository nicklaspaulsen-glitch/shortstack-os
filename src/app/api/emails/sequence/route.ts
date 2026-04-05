import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Email Nurture Sequence Builder — Creates complete drip campaigns
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, sequence_type, num_emails, goal, audience } = await request.json();

  let clientName = "ShortStack";
  let industry = "marketing";
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("business_name, industry").eq("id", client_id).single();
    if (client) { clientName = client.business_name; industry = client.industry || "business"; }
  }

  const types: Record<string, string> = {
    welcome: "New subscriber welcome sequence that builds trust and leads to a sale",
    nurture: "Lead nurture sequence that educates and converts cold leads",
    onboarding: "Client onboarding sequence that sets expectations and delivers value",
    reengagement: "Win-back sequence for inactive leads/customers",
    upsell: "Upsell sequence for existing customers to upgrade",
    launch: "Product/service launch sequence building hype and urgency",
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      system: `You are an email marketing expert for ${clientName} (${industry}). Create complete email sequences with compelling copy. Return valid JSON only.`,
      messages: [{ role: "user", content: `Create a ${num_emails || 7}-email ${sequence_type || "nurture"} sequence.
Purpose: ${types[sequence_type] || goal || "Convert leads into customers"}
Audience: ${audience || "Potential customers"}
Business: ${clientName} (${industry})

Return JSON with:
- sequence_name: catchy name for this sequence
- total_emails: number
- estimated_duration: e.g. "14 days"
- emails: array of {
    day: which day to send (1, 3, 5, etc),
    subject_line: compelling subject (under 50 chars),
    preview_text: email preview text (under 90 chars),
    body_html: full email body in HTML,
    cta_text: call to action button text,
    cta_url_placeholder: "[BOOKING_LINK]" or "[OFFER_LINK]" etc,
    purpose: what this email achieves in the sequence,
    a_b_subject: alternative subject line for split testing
  }
- automation_triggers: array of triggers for when to move people between sequences
- kpis: expected open rate, click rate, conversion rate for this type of sequence` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, sequence: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, sequence: { raw: text } });
  }
}
