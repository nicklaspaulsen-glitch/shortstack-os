import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Sales Call Script Generator — Creates customized scripts for discovery/close calls
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prospect_name, business_name, industry, call_type, pain_points, budget_range } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: "You are a sales coach for ShortStack digital marketing agency. Write natural, conversational sales scripts that close deals. Return valid JSON only.",
      messages: [{ role: "user", content: `Generate a ${call_type || "discovery"} call script for:
Prospect: ${prospect_name || "the prospect"} at ${business_name}
Industry: ${industry || "business"}
Pain points: ${pain_points || "needs more clients"}
Budget range: ${budget_range || "unknown"}

Return JSON with:
- opening: { greeting, rapport_builder, transition_to_business }
- discovery_questions: array of 8 questions to ask (with follow-up prompts)
- pain_point_deepeners: array of { pain_point, question_to_dig_deeper, empathy_statement }
- pitch: { transition, value_proposition, service_breakdown, social_proof_example }
- objection_handling: array of { objection, response, reframe }
- pricing_presentation: { lead_in, anchor_price, package_recommendation, value_stack }
- close: { trial_close, assumptive_close, urgency_element, next_steps }
- post_call: { follow_up_email_subject, follow_up_timing }
- tips: array of 5 tips specific to selling to ${industry} businesses` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, script: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, script: { raw: text } });
  }
}
