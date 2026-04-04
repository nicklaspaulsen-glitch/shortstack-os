import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaign_id } = await request.json();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaign_id)
    .single();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: "You are a paid ads optimization expert. Analyze campaign performance and give actionable optimization suggestions. Be specific with numbers and recommendations.",
      messages: [
        {
          role: "user",
          content: `Analyze this ${campaign.platform} campaign:
Name: ${campaign.name}
Spend: $${campaign.spend}
Impressions: ${campaign.impressions}
Clicks: ${campaign.clicks}
CTR: ${(campaign.ctr * 100).toFixed(2)}%
CPC: $${campaign.cpc}
Conversions: ${campaign.conversions}
ROAS: ${campaign.roas}x
Daily Budget: $${campaign.budget_daily}

Give 3-5 specific optimization suggestions.`,
        },
      ],
    }),
  });

  const data = await res.json();
  const suggestions = data.content?.[0]?.text || "No suggestions available";

  await supabase.from("campaigns").update({ ai_suggestions: suggestions }).eq("id", campaign_id);

  return NextResponse.json({ success: true, suggestions });
}
