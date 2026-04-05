import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI FAQ Generator — Creates industry-specific FAQ content for client websites
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, num_questions, topics } = await request.json();

  let clientName = "the business";
  let industry = "business";
  let services: string[] = [];
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("business_name, industry, services").eq("id", client_id).single();
    if (client) { clientName = client.business_name; industry = client.industry || "business"; services = client.services || []; }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: "You are an SEO content expert. Generate FAQ content optimized for Google's 'People Also Ask' featured snippets. Return valid JSON only.",
      messages: [{ role: "user", content: `Generate ${num_questions || 20} FAQ questions and answers for ${clientName} (${industry}).
Services: ${services.join(", ") || "various services"}
${topics ? `Focus on: ${topics}` : ""}

Return JSON with:
- faqs: array of { question, answer (2-3 sentences, clear and helpful), schema_markup (true if good for schema.org FAQ markup), category }
- schema_json: complete JSON-LD FAQ schema markup code ready to paste into their website
- seo_tips: array of 3 tips for maximizing FAQ SEO value` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, faq: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, faq: { raw: text } });
  }
}
