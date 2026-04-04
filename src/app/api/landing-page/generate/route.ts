import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Landing Page Generator — Creates high-converting lead magnet pages
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, page_type, offer, headline_idea, target_audience } = await request.json();

  let clientName = "ShortStack";
  let industry = "marketing";
  const brandColors = { primary: "#C9A84C", bg: "#0a0a0a" };
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("business_name, industry, website").eq("id", client_id).single();
    if (client) { clientName = client.business_name; industry = client.industry || "business"; }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: "You are a landing page copywriter and developer. Create complete, high-converting landing pages. Write the full HTML/CSS code. No explanations, just code.",
      messages: [{ role: "user", content: `Create a complete landing page for ${clientName} (${industry}).

Page type: ${page_type || "lead magnet"}
Offer: ${offer || "Free consultation"}
Target audience: ${target_audience || "Local business owners"}
${headline_idea ? `Headline idea: ${headline_idea}` : ""}

Create a single-file HTML page with embedded CSS that includes:
- Attention-grabbing headline with sub-headline
- Hero section with benefit-focused copy
- 3-4 benefit bullet points with icons (use emoji)
- Social proof section (testimonials placeholder)
- Lead capture form (name, email, phone)
- Urgency element (limited spots, countdown feel)
- Trust badges area
- Mobile responsive design
- Colors: primary ${brandColors.primary}, dark background ${brandColors.bg}
- Modern, clean, professional design
- Form submits to "#" (will be connected to GHL)

Return ONLY the complete HTML code, nothing else.` }],
    }),
  });

  const data = await res.json();
  const html = data.content?.[0]?.text || "";

  // Clean up any markdown code blocks
  const cleanHtml = html.replace(/```html\n?/g, "").replace(/```\n?/g, "").trim();

  return NextResponse.json({ success: true, html: cleanHtml, clientName, pageType: page_type });
}
