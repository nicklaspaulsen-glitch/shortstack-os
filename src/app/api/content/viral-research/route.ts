import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Viral Video Research — finds competitor's top videos and analyzes why they work
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { competitor_name, industry, platform, client_id } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  // Get client context if available
  let clientContext = "";
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("business_name, industry, services, metadata").eq("id", client_id).single();
    if (client) {
      const meta = (client.metadata as Record<string, unknown>) || {};
      clientContext = `\nClient: ${client.business_name} (${client.industry})\nServices: ${(client.services || []).join(", ")}\nPain points: ${meta.biggest_challenge || ""}\nGoals: ${meta.goals || ""}`;
    }
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: `You are a viral content researcher and strategist. Your job is to analyze what makes content go viral in specific industries and create actionable insights. You have deep knowledge of social media trends, algorithm behavior, and content psychology.`,
        messages: [{
          role: "user",
          content: `Research viral content for the ${industry || "business"} industry${competitor_name ? `, specifically looking at what "${competitor_name}" and similar accounts are doing` : ""} on ${platform || "Instagram and TikTok"}.
${clientContext}

Return a JSON object with:
{
  "viral_videos": [
    {
      "title": "video concept title",
      "hook": "the exact first 3 seconds / opening line",
      "format": "talking head / b-roll / text overlay / POV / etc",
      "why_it_works": "psychological triggers: curiosity gap, controversy, relatability, etc",
      "estimated_views": "100K-500K",
      "transcript_summary": "brief summary of what they say in the video",
      "key_moments": ["moment 1", "moment 2", "moment 3"],
      "cta_used": "what call to action they use",
      "hashtags_used": ["tag1", "tag2"]
    }
  ] (give 8 examples),
  "patterns": {
    "top_hooks": ["5 most effective hook styles in this niche"],
    "best_formats": ["formats that perform best"],
    "optimal_length": "what length gets most engagement",
    "posting_times": "best times to post",
    "trending_sounds": ["popular sounds/audio in this niche"],
    "content_pillars": ["3-5 content categories that consistently perform"]
  },
  "competitor_analysis": {
    "strengths": ["what they do well"],
    "weaknesses": ["gaps we can exploit"],
    "content_frequency": "how often they post",
    "engagement_style": "how they interact with audience"
  },
  "opportunities": ["5 specific content ideas that could go viral based on this research"]
}`,
        }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const research = JSON.parse(cleaned);

    return NextResponse.json({ success: true, research });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
