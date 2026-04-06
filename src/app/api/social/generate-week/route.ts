import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Generate a full week of social media content for a client
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, platforms, posts_per_day, tone, topics } = await request.json();
  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const serviceSupabase = createServiceClient();

  // Get client info
  const { data: client } = await serviceSupabase.from("clients").select("business_name, industry, services, metadata").eq("id", client_id).single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Get connected platforms
  const { data: accounts } = await serviceSupabase
    .from("social_accounts")
    .select("platform, account_name")
    .eq("client_id", client_id)
    .eq("is_active", true);

  const connectedPlatforms = platforms || (accounts || []).map((a: { platform: string }) => a.platform).filter((p: string) => ["instagram", "facebook", "tiktok", "linkedin"].includes(p));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const clientMeta = (client.metadata as Record<string, unknown>) || {};
  const painPoints = clientMeta.biggest_challenge || "";
  const goals = clientMeta.goals || "";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: `You are a social media manager for ${client.business_name}, a ${client.industry} business. Generate engaging, platform-specific content.`,
        messages: [{
          role: "user",
          content: `Create a 7-day social media content plan for ${client.business_name}.

Business: ${client.business_name}
Industry: ${client.industry}
Services: ${(client.services || []).join(", ")}
Pain points: ${painPoints}
Goals: ${goals}
Tone: ${tone || "professional yet approachable"}
Topics to cover: ${topics || "tips, behind-the-scenes, testimonials, promotions, educational content"}
Platforms: ${connectedPlatforms.join(", ")}
Posts per day: ${posts_per_day || 1}

Return a JSON array where each item has:
- day: "Monday" through "Sunday"
- date: next 7 days starting tomorrow in YYYY-MM-DD format
- platform: one of ${connectedPlatforms.join(", ")}
- content_type: "reel" or "post" or "story" or "carousel"
- caption: the full post caption with hashtags and emojis
- hook: the first line / attention grabber
- best_time: posting time like "10:00 AM"
- topic: what the post is about

Return ONLY the JSON array.`,
        }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      return NextResponse.json({ error: "AI failed to generate plan", raw: text }, { status: 500 });
    }

    const posts = JSON.parse(jsonMatch[0]);

    // Save all posts to content_calendar
    let saved = 0;
    for (const post of posts) {
      const scheduledAt = post.date ? new Date(`${post.date}T${post.best_time?.replace(" AM", ":00").replace(" PM", ":00") || "10:00:00"}`).toISOString() : null;

      const { error } = await serviceSupabase.from("content_calendar").insert({
        client_id,
        title: post.hook || post.caption?.substring(0, 80) || "Untitled",
        platform: post.platform || connectedPlatforms[0],
        content_type: post.content_type || "post",
        status: "scheduled",
        scheduled_at: scheduledAt,
        metadata: {
          caption: post.caption,
          hook: post.hook,
          topic: post.topic,
          best_time: post.best_time,
          day: post.day,
          ai_generated: true,
          generated_at: new Date().toISOString(),
        },
      });
      if (!error) saved++;
    }

    // Log
    await serviceSupabase.from("trinity_log").insert({
      action_type: "automation",
      description: `AI generated ${saved}-post weekly content plan for ${client.business_name}`,
      client_id,
      status: "completed",
      result: { posts_generated: saved, platforms: connectedPlatforms },
    });

    return NextResponse.json({ success: true, posts_generated: saved, posts });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
