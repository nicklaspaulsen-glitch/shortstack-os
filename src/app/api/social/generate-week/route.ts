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

  // Fetch client info, social accounts, and past published content in parallel
  const [
    { data: client },
    { data: accounts },
    { data: pastContent },
  ] = await Promise.all([
    serviceSupabase
      .from("clients")
      .select("business_name, industry, services, metadata")
      .eq("id", client_id)
      .single(),
    serviceSupabase
      .from("social_accounts")
      .select("platform, account_name, metadata, is_active")
      .eq("client_id", client_id)
      .eq("is_active", true),
    serviceSupabase
      .from("content_calendar")
      .select("title, platform, content_type, metadata, scheduled_at")
      .eq("client_id", client_id)
      .eq("status", "published")
      .order("scheduled_at", { ascending: false })
      .limit(10),
  ]);

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const connectedPlatforms = platforms || (accounts || []).map((a: { platform: string }) => a.platform).filter((p: string) => ["instagram", "facebook", "tiktok", "linkedin"].includes(p));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  // Extract rich client metadata
  const clientMeta = (client.metadata as Record<string, unknown>) || {};
  const painPoints = clientMeta.biggest_challenge || clientMeta.challenges || "";
  const goals = clientMeta.goals || "";
  const brandVoice = clientMeta.brand_voice || clientMeta.tone || "";
  const targetAudience = clientMeta.target_audience || clientMeta.audience || "";
  const competitors = clientMeta.competitors || "";
  const uniqueSellingProp = clientMeta.usp || clientMeta.unique_selling_proposition || "";

  // Build past content summary for the AI
  const pastContentSummary = (pastContent || []).map((p: { title: string; platform: string; content_type: string; metadata: unknown }) => {
    const meta = (p.metadata as Record<string, unknown>) || {};
    return `- [${p.platform}/${p.content_type}] "${p.title}"${meta.topic ? ` (topic: ${meta.topic})` : ""}`;
  }).join("\n");

  // Build connected accounts context with follower counts
  const accountsSummary = (accounts || []).map((a: { platform: string; account_name: string; metadata: unknown }) => {
    const meta = (a.metadata as Record<string, unknown>) || {};
    const followers = meta.followers_count || meta.follower_count || "";
    return `- ${a.platform}: @${a.account_name}${followers ? ` (${followers} followers)` : ""}`;
  }).join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: `You are an expert social media strategist managing content for ${client.business_name}, a ${client.industry} business.

## Business Profile
- **Business**: ${client.business_name}
- **Industry**: ${client.industry}
- **Services**: ${(client.services || []).join(", ") || "Not specified"}
${uniqueSellingProp ? `- **Unique Value Proposition**: ${uniqueSellingProp}` : ""}

## Brand Voice & Audience
- **Tone**: ${tone || brandVoice || "professional yet approachable"}
${targetAudience ? `- **Target Audience**: ${targetAudience}` : ""}
${competitors ? `- **Competitors to differentiate from**: ${competitors}` : ""}

## Goals & Challenges
${goals ? `- **Goals**: ${goals}` : "- **Goals**: Grow brand awareness and engagement"}
${painPoints ? `- **Challenges**: ${painPoints}` : ""}

## Connected Platforms
${accountsSummary || "No platform details available"}

${pastContentSummary ? `## Past Published Content (most recent)\nThese posts have already been published. Avoid repeating the same topics and instead build on what worked:\n${pastContentSummary}` : ""}

## Your Guidelines
- Write platform-native content (Instagram = visual hooks + hashtags, LinkedIn = thought leadership, TikTok = trends + hooks, Facebook = community-focused)
- Each post must stop the scroll — start with a strong hook
- Mix content types strategically: educational (40%), entertaining (20%), promotional (20%), behind-the-scenes/social proof (20%)
- Use relevant hashtags (5-15 for Instagram, 3-5 for LinkedIn, trending for TikTok)
- Maintain consistent brand voice across all platforms while adapting format`,
        messages: [{
          role: "user",
          content: `Create a 7-day social media content plan for ${client.business_name}.

Platforms: ${connectedPlatforms.join(", ")}
Posts per day: ${posts_per_day || 1}
${topics ? `Priority topics to cover: ${topics}` : "Cover a mix of: tips & education, behind-the-scenes, social proof/testimonials, promotional offers, trending/timely content, community engagement"}

Important: Do NOT repeat topics from the past published content listed in the system prompt. Create fresh, varied content that builds on previous themes.

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
