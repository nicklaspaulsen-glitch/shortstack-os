import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Social autopilot settings
interface SocialAutopilotConfig {
  enabled: boolean;
  auto_generate_content: boolean;   // AI generates weekly content plans
  auto_publish_scheduled: boolean;  // auto publish when scheduled time arrives
  auto_reply_comments: boolean;     // AI auto-replies to comments/DMs
  auto_hashtag_research: boolean;   // AI researches trending hashtags
  posts_per_day: number;            // how many posts per day to generate
  content_mix: {                    // content type distribution
    educational: number;
    entertaining: number;
    promotional: number;
    social_proof: number;
  };
  allowed_platforms: string[];      // which platforms AI can post to
  require_approval: boolean;        // require manual approval before posting
  tone: string;                     // brand voice
  blacklist_topics: string;         // topics to avoid
  posting_hours: { start: number; end: number }; // allowed posting window
}

const DEFAULT_CONFIG: SocialAutopilotConfig = {
  enabled: false,
  auto_generate_content: true,
  auto_publish_scheduled: false,
  auto_reply_comments: false,
  auto_hashtag_research: true,
  posts_per_day: 1,
  content_mix: { educational: 40, entertaining: 20, promotional: 20, social_proof: 20 },
  allowed_platforms: ["instagram", "facebook", "tiktok", "linkedin"],
  require_approval: true,
  tone: "professional yet approachable",
  blacklist_topics: "",
  posting_hours: { start: 9, end: 18 },
};

// GET — fetch config
export async function GET() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("system_health")
    .select("metadata")
    .eq("integration_name", "agent_settings")
    .single();

  const settings = (data?.metadata as Record<string, unknown>) || {};
  const config = { ...DEFAULT_CONFIG, ...(settings.social_autopilot as Record<string, unknown> || {}) };

  return NextResponse.json({ config });
}

// POST — save config or run autopilot cycle
export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const supabase = createServiceClient();

  if (body.action === "save_config") {
    const { data: existing } = await supabase
      .from("system_health")
      .select("id, metadata")
      .eq("integration_name", "agent_settings")
      .single();

    if (existing) {
      const metadata = (existing.metadata as Record<string, Record<string, unknown>>) || {};
      metadata.social_autopilot = body.config;
      await supabase.from("system_health").update({ metadata }).eq("id", existing.id);
    }
    return NextResponse.json({ success: true });
  }

  if (body.action === "run") {
    const { data: settingsRow } = await supabase
      .from("system_health")
      .select("metadata")
      .eq("integration_name", "agent_settings")
      .single();

    const settings = (settingsRow?.metadata as Record<string, unknown>) || {};
    const config: SocialAutopilotConfig = { ...DEFAULT_CONFIG, ...(settings.social_autopilot as Record<string, unknown> || {}) };

    if (!config.enabled) {
      return NextResponse.json({ skipped: true, reason: "Social autopilot disabled" });
    }

    const results = {
      content_generated: 0,
      posts_published: 0,
      posts_skipped: 0,
      details: [] as string[],
    };

    // Get all clients with social accounts
    const { data: clients } = await supabase
      .from("clients")
      .select("id, business_name, industry, services, metadata")
      .eq("is_active", true);

    for (const client of clients || []) {
      const { data: accounts } = await supabase
        .from("social_accounts")
        .select("platform, account_name, access_token, account_id")
        .eq("client_id", client.id)
        .eq("is_active", true)
        .in("platform", config.allowed_platforms);

      if (!accounts || accounts.length === 0) continue;
      const platforms = accounts.map(a => a.platform);

      // Auto-generate content if no scheduled posts for next 3 days
      if (config.auto_generate_content) {
        const threeDaysOut = new Date(Date.now() + 3 * 86400000).toISOString();
        const { data: upcoming } = await supabase
          .from("content_calendar")
          .select("id")
          .eq("client_id", client.id)
          .in("status", ["scheduled", "idea"])
          .lte("scheduled_at", threeDaysOut)
          .limit(1);

        if (!upcoming || upcoming.length === 0) {
          // Generate content via the existing generate-week API logic
          try {
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (apiKey) {
              const res = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
                body: JSON.stringify({
                  model: "claude-haiku-4-5-20251001",
                  max_tokens: 2000,
                  messages: [{
                    role: "user",
                    content: `Create 3 social media posts for ${client.business_name} (${client.industry}).
Platforms: ${platforms.join(", ")}
Tone: ${config.tone}
${config.blacklist_topics ? `AVOID these topics: ${config.blacklist_topics}` : ""}

Return a JSON array with objects: { platform, content_type ("post"|"reel"|"carousel"), caption (full text with hashtags), hook (first line), best_time ("10:00 AM"), topic }
Return ONLY the JSON array.`,
                  }],
                }),
              });
              const data = await res.json();
              const text = data.content?.[0]?.text || "";
              const jsonMatch = text.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const posts = JSON.parse(jsonMatch[0]);
                const baseDate = new Date();
                for (let i = 0; i < posts.length; i++) {
                  const post = posts[i];
                  baseDate.setDate(baseDate.getDate() + 1);
                  const scheduledAt = new Date(baseDate);
                  const hour = parseInt(post.best_time) || (config.posting_hours.start + Math.floor(Math.random() * (config.posting_hours.end - config.posting_hours.start)));
                  scheduledAt.setHours(hour, 0, 0, 0);

                  await supabase.from("content_calendar").insert({
                    client_id: client.id,
                    title: post.hook || post.caption?.substring(0, 80) || "AI Post",
                    platform: post.platform || platforms[0],
                    content_type: post.content_type || "post",
                    status: config.require_approval ? "idea" : "scheduled",
                    scheduled_at: scheduledAt.toISOString(),
                    metadata: { caption: post.caption, hook: post.hook, topic: post.topic, best_time: post.best_time, ai_generated: true, autopilot: true },
                  });
                  results.content_generated++;
                }
                results.details.push(`Generated ${posts.length} posts for ${client.business_name}`);
              }
            }
          } catch { /* continue */ }
        }
      }

      // Auto-publish scheduled posts that are due
      if (config.auto_publish_scheduled) {
        const now = new Date().toISOString();
        const { data: duePosts } = await supabase
          .from("content_calendar")
          .select("*")
          .eq("client_id", client.id)
          .eq("status", "scheduled")
          .lte("scheduled_at", now)
          .order("scheduled_at")
          .limit(5);

        for (const post of duePosts || []) {
          const account = accounts.find(a => a.platform === post.platform);
          if (!account?.access_token) {
            results.posts_skipped++;
            continue;
          }

          const meta = (post.metadata as Record<string, unknown>) || {};
          const caption = (meta.caption as string) || post.title;

          try {
            let posted = false;

            if (post.platform === "facebook" && account.account_id) {
              const res = await fetch(`https://graph.facebook.com/v18.0/${account.account_id}/feed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: caption, access_token: account.access_token }),
              });
              const data = await res.json();
              posted = !!data.id;
            }

            if (post.platform === "linkedin" && account.account_id) {
              const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
                method: "POST",
                headers: { Authorization: `Bearer ${account.access_token}`, "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0" },
                body: JSON.stringify({
                  author: `urn:li:person:${account.account_id}`,
                  lifecycleState: "PUBLISHED",
                  specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text: caption }, shareMediaCategory: "NONE" } },
                  visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
                }),
              });
              posted = res.ok;
            }

            if (posted) {
              await supabase.from("content_calendar").update({ status: "published" }).eq("id", post.id);
              results.posts_published++;
              results.details.push(`Published to ${post.platform}: "${post.title.substring(0, 40)}..."`);
            } else {
              results.posts_skipped++;
            }
          } catch {
            results.posts_skipped++;
          }
        }
      }
    }

    // Log
    if (results.content_generated > 0 || results.posts_published > 0) {
      await supabase.from("trinity_log").insert({
        action_type: "automation",
        description: `Social Autopilot: ${results.content_generated} generated, ${results.posts_published} published`,
        status: "completed",
        metadata: results,
      });
    }

    return NextResponse.json({ success: true, ...results });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
