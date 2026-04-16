import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

interface OnboardingData {
  business_type?: string;
  years_in_business?: string;
  team_size?: string;
  revenue_range?: string;
  service_area?: string;
  top_goals?: string[];
  timeline?: string;
  challenges?: string[];
  biggest_frustration?: string;
  tried_before?: string[];
  customer_type?: string;
  age_ranges?: string[];
  gender_focus?: string;
  income_level?: string;
  discovery_channels?: string[];
  brand_personality?: string[];
  content_types?: string[];
  posting_frequency?: string;
  content_topics?: string[];
  website_url?: string;
  social_accounts?: Record<string, string>;
  competitors?: string[];
  competitor_urls?: string[];
  competitor_strengths?: string;
  our_usp?: string;
  ai_autopilot_enabled?: boolean;
  ai_autopilot_daily?: boolean;
}

async function callClaude(apiKey: string, system: string, userMessage: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

function buildClientContext(businessName: string, od: OnboardingData): string {
  return `Business: ${businessName}
Type: ${od.business_type || "N/A"}
Years in business: ${od.years_in_business || "N/A"}
Team size: ${od.team_size || "N/A"}
Revenue range: ${od.revenue_range || "N/A"}
Service area: ${od.service_area || "N/A"}
Top goals: ${(od.top_goals || []).join(", ")}
Timeline: ${od.timeline || "N/A"}
Challenges: ${(od.challenges || []).join(", ")}
Biggest frustration: ${od.biggest_frustration || "N/A"}
Previously tried: ${(od.tried_before || []).join(", ")}
Customer type: ${od.customer_type || "N/A"}
Target age ranges: ${(od.age_ranges || []).join(", ")}
Gender focus: ${od.gender_focus || "N/A"}
Income level: ${od.income_level || "N/A"}
Discovery channels: ${(od.discovery_channels || []).join(", ")}
Brand personality: ${(od.brand_personality || []).join(", ")}
Content types preferred: ${(od.content_types || []).join(", ")}
Posting frequency: ${od.posting_frequency || "N/A"}
Content topics: ${(od.content_topics || []).join(", ")}
Website: ${od.website_url || "N/A"}
Active social platforms: ${Object.keys(od.social_accounts || {}).join(", ") || "N/A"}
Competitors: ${(od.competitors || []).join(", ")}
Our USP: ${od.our_usp || "N/A"}`;
}

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const { client_id, onboarding_data } = await request.json() as {
    client_id: string;
    onboarding_data: OnboardingData;
  };

  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const serviceSupabase = createServiceClient();

  // Fetch client record
  const { data: client, error: clientErr } = await serviceSupabase
    .from("clients")
    .select("id, business_name, industry, metadata")
    .eq("id", client_id)
    .single();

  if (clientErr || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Save onboarding data to client metadata
  const existingMetadata = (client.metadata as Record<string, unknown>) || {};
  await serviceSupabase
    .from("clients")
    .update({
      metadata: {
        ...existingMetadata,
        onboarding: onboarding_data,
        onboarding_completed_at: new Date().toISOString(),
      },
    })
    .eq("id", client_id);

  // Create autopilot tasks record in system_health
  const integrationName = `autopilot_${client_id}`;
  const initialTasksMeta = {
    client_id,
    business_name: client.business_name,
    started_at: new Date().toISOString(),
    tasks: {
      strategy: { status: "pending" },
      social_posts: { status: "pending" },
      blog_outlines: { status: "pending" },
      email_templates: { status: "pending" },
      ad_copy: { status: "pending" },
      competitor_analysis: { status: "pending" },
    },
  };

  // Upsert the system_health record
  const { data: existingHealth } = await serviceSupabase
    .from("system_health")
    .select("id")
    .eq("integration_name", integrationName)
    .single();

  let healthId: string | null = null;
  if (existingHealth) {
    healthId = existingHealth.id;
    await serviceSupabase
      .from("system_health")
      .update({ status: "active", metadata: initialTasksMeta, updated_at: new Date().toISOString() })
      .eq("id", healthId);
  } else {
    const { data: newHealth } = await serviceSupabase
      .from("system_health")
      .insert({
        integration_name: integrationName,
        status: "active",
        metadata: initialTasksMeta,
      })
      .select("id")
      .single();
    healthId = newHealth?.id || null;
  }

  const updateTaskStatus = async (taskKey: string, status: string, extra?: Record<string, unknown>) => {
    if (!healthId) return;
    const { data: current } = await serviceSupabase
      .from("system_health")
      .select("metadata")
      .eq("id", healthId)
      .single();
    const meta = (current?.metadata as Record<string, unknown>) || {};
    const tasks = (meta.tasks as Record<string, unknown>) || {};
    tasks[taskKey] = { status, ...extra };
    await serviceSupabase
      .from("system_health")
      .update({ metadata: { ...meta, tasks } })
      .eq("id", healthId);
  };

  const clientCtx = buildClientContext(client.business_name, onboarding_data);
  const tasks: Array<{ type: string; status: string; count?: number }> = [];

  // ── Task 1: Marketing Strategy ──────────────────────────────────────────────
  let strategyStatus = "failed";
  try {
    const strategyText = await callClaude(
      apiKey,
      "You are a senior digital marketing strategist specializing in 30-day go-to-market plans for small businesses. Write practical, specific, actionable strategies tailored to the exact business details provided. No fluff.",
      `Create a personalized 30-day marketing strategy for this business:\n\n${clientCtx}\n\nDeliver a structured 30-day plan with: Week 1 (foundation & quick wins), Week 2 (content launch), Week 3 (audience growth), Week 4 (conversion & optimization). For each week include 3-5 specific daily/weekly actions, platforms to focus on, and measurable KPIs. Be specific to their industry and goals.`
    );
    await serviceSupabase.from("trinity_log").insert({
      action_type: "autopilot_strategy",
      description: `30-Day Marketing Strategy for ${client.business_name}`,
      client_id,
      status: "completed",
      result: { content: strategyText, generated_at: new Date().toISOString() },
    });
    strategyStatus = "complete";
    await updateTaskStatus("strategy", "complete");
    tasks.push({ type: "strategy", status: "complete" });
  } catch {
    await updateTaskStatus("strategy", "failed");
    tasks.push({ type: "strategy", status: "failed" });
  }

  // ── Task 2: Social Media Posts ───────────────────────────────────────────────
  let socialStatus = "failed";
  let socialCount = 0;
  try {
    const activePlatforms = Object.keys(onboarding_data.social_accounts || {});
    const primaryPlatform = activePlatforms[0] || "instagram";

    const socialText = await callClaude(
      apiKey,
      "You are a social media copywriter who writes high-converting posts for small businesses. Write engaging, platform-native content that matches the brand voice. Return exactly 5 posts as a JSON array.",
      `Write 5 social media posts for this business:\n\n${clientCtx}\n\nReturn a JSON array of 5 posts, each with: { "platform": string, "caption": string, "hook": string, "hashtags": string[], "content_type": "post" }. Vary the platforms across their active ones: ${activePlatforms.join(", ") || primaryPlatform}. Make each post unique: educational, behind-the-scenes, testimonial-style, promotional, and engagement-focused. Match their brand personality: ${(onboarding_data.brand_personality || []).join(", ")}.`
    );

    // Parse and save each post
    const jsonMatch = socialText.match(/\[[\s\S]*\]/);
    let posts: Array<{ platform?: string; caption?: string; hook?: string; hashtags?: string[]; content_type?: string }> = [];
    if (jsonMatch) {
      try { posts = JSON.parse(jsonMatch[0]); } catch { /* use empty */ }
    }

    // If parsing failed, create 5 draft posts with the raw content
    if (posts.length === 0) {
      posts = activePlatforms.length > 0
        ? activePlatforms.slice(0, 5).map(p => ({ platform: p, caption: socialText.substring(0, 300), content_type: "post" }))
        : [{ platform: primaryPlatform, caption: socialText.substring(0, 300), content_type: "post" }];
    }

    const scheduledBase = new Date();
    for (let i = 0; i < Math.min(posts.length, 5); i++) {
      const post = posts[i];
      const scheduledDate = new Date(scheduledBase);
      scheduledDate.setDate(scheduledDate.getDate() + (i + 1) * 2);

      await serviceSupabase.from("content_calendar").insert({
        client_id,
        title: post.hook || (post.caption || "").substring(0, 80) || `AI Post ${i + 1}`,
        platform: post.platform || primaryPlatform,
        content_type: post.content_type || "post",
        status: "draft",
        scheduled_at: scheduledDate.toISOString(),
        metadata: {
          caption: post.caption,
          hook: post.hook,
          hashtags: post.hashtags || [],
          source: "autopilot",
          ai_generated: true,
          autopilot_run: new Date().toISOString(),
        },
      });
      socialCount++;
    }

    socialStatus = "complete";
    await updateTaskStatus("social_posts", "complete", { count: socialCount });
    tasks.push({ type: "social_posts", status: "complete", count: socialCount });
  } catch {
    await updateTaskStatus("social_posts", "failed");
    tasks.push({ type: "social_posts", status: "failed", count: 0 });
  }

  // ── Task 3: Blog Article Outlines ────────────────────────────────────────────
  let blogStatus = "failed";
  try {
    const blogText = await callClaude(
      apiKey,
      "You are a content strategist and SEO expert who creates detailed blog outlines for small businesses. Focus on topics that attract their ideal customers and rank for relevant keywords.",
      `Create 3 detailed blog article outlines for this business:\n\n${clientCtx}\n\nFor each outline provide: title, meta_description, target_keywords (3-5), target_audience, estimated_reading_time, sections (array of { heading, key_points: string[], word_count_estimate }), cta (call to action at end). Cover topics that address their customer pain points and showcase their expertise.`
    );
    await serviceSupabase.from("trinity_log").insert({
      action_type: "autopilot_blog",
      description: `3 Blog Article Outlines for ${client.business_name}`,
      client_id,
      status: "completed",
      result: { content: blogText, generated_at: new Date().toISOString() },
    });
    blogStatus = "complete";
    await updateTaskStatus("blog_outlines", "complete", { count: 3 });
    tasks.push({ type: "blog_outlines", status: "complete", count: 3 });
  } catch {
    await updateTaskStatus("blog_outlines", "failed");
    tasks.push({ type: "blog_outlines", status: "failed" });
  }

  // ── Task 4: Email Templates ───────────────────────────────────────────────────
  let emailStatus = "failed";
  try {
    const emailText = await callClaude(
      apiKey,
      "You are an email marketing specialist who writes high-converting email sequences for small businesses. Create personalized, warm emails that build relationships and drive action.",
      `Create 2 email templates for this business:\n\n${clientCtx}\n\nTemplate 1 — Welcome Email: For new leads/customers who just found them. Include: subject line, preview text, greeting, value proposition paragraph, what to expect next, a single clear CTA, and sign-off.\n\nTemplate 2 — Monthly Newsletter: For existing customers. Include: subject line, preview text, featured tip or insight relevant to their industry, a recent win or update, a special offer or CTA, and sign-off.\n\nMatch their brand personality (${(onboarding_data.brand_personality || []).join(", ")}) and speak to their customer type (${onboarding_data.customer_type || "general audience"}).`
    );
    await serviceSupabase.from("trinity_log").insert({
      action_type: "autopilot_email",
      description: `2 Email Templates for ${client.business_name}`,
      client_id,
      status: "completed",
      result: { content: emailText, generated_at: new Date().toISOString() },
    });
    emailStatus = "complete";
    await updateTaskStatus("email_templates", "complete", { count: 2 });
    tasks.push({ type: "email_templates", status: "complete", count: 2 });
  } catch {
    await updateTaskStatus("email_templates", "failed");
    tasks.push({ type: "email_templates", status: "failed" });
  }

  // ── Task 5: Ad Copy Variations ────────────────────────────────────────────────
  let adsStatus = "failed";
  try {
    const adsText = await callClaude(
      apiKey,
      "You are a direct-response Facebook and Instagram ads copywriter. You write scroll-stopping ad copy that generates leads and sales for local businesses. Focus on pain points, benefits, and strong CTAs.",
      `Write 3 Facebook/Instagram ad copy variations for this business:\n\n${clientCtx}\n\nFor each variation provide: { "variation": 1/2/3, "objective": string, "headline": string (under 40 chars), "primary_text": string (under 125 chars), "description": string (under 30 chars), "cta_button": string, "target_audience_note": string }.\n\nVariation 1: Problem-aware (address their biggest customer frustration: ${onboarding_data.biggest_frustration || "their pain points"})\nVariation 2: Benefit-focused (highlight USP: ${onboarding_data.our_usp || "their unique value"})\nVariation 3: Social proof / trust (testimonial-style or credibility-based)`
    );
    await serviceSupabase.from("trinity_log").insert({
      action_type: "autopilot_ads",
      description: `3 Ad Copy Variations for ${client.business_name}`,
      client_id,
      status: "completed",
      result: { content: adsText, generated_at: new Date().toISOString() },
    });
    adsStatus = "complete";
    await updateTaskStatus("ad_copy", "complete", { count: 3 });
    tasks.push({ type: "ad_copy", status: "complete", count: 3 });
  } catch {
    await updateTaskStatus("ad_copy", "failed");
    tasks.push({ type: "ad_copy", status: "failed" });
  }

  // ── Task 6: Competitor Analysis ───────────────────────────────────────────────
  let competitorStatus = "failed";
  try {
    const competitors = onboarding_data.competitors || [];
    const competitorUrls = onboarding_data.competitor_urls || [];

    const competitorText = await callClaude(
      apiKey,
      "You are a competitive intelligence analyst specializing in digital marketing. Analyze competitors and provide actionable positioning strategies for small businesses.",
      `Perform a competitor analysis for this business:\n\n${clientCtx}\n\nCompetitors identified: ${competitors.join(", ") || "Not specified"}\nCompetitor URLs: ${competitorUrls.join(", ") || "Not provided"}\nKnown competitor strengths: ${onboarding_data.competitor_strengths || "Not specified"}\n\nProvide: 1) A competitive landscape overview, 2) Perceived strengths of each competitor based on their name/industry, 3) Gaps and opportunities our client can exploit, 4) Positioning recommendations — how to differentiate in messaging, content, and offers, 5) Quick wins to out-market competitors in the next 30 days. Be specific to their industry and USP (${onboarding_data.our_usp || "not specified"}).`
    );
    await serviceSupabase.from("trinity_log").insert({
      action_type: "autopilot_competitor",
      description: `Competitor Analysis for ${client.business_name}`,
      client_id,
      status: "completed",
      result: { content: competitorText, generated_at: new Date().toISOString() },
    });
    competitorStatus = "complete";
    await updateTaskStatus("competitor_analysis", "complete");
    tasks.push({ type: "competitor_analysis", status: "complete" });
  } catch {
    await updateTaskStatus("competitor_analysis", "failed");
    tasks.push({ type: "competitor_analysis", status: "failed" });
  }

  // Count completed tasks
  const completedCount = tasks.filter(t => t.status === "complete").length;

  // Finalize the system_health record
  if (healthId) {
    await serviceSupabase
      .from("system_health")
      .update({
        status: completedCount > 0 ? "active" : "down",
        metadata: {
          ...initialTasksMeta,
          completed_at: new Date().toISOString(),
          tasks_completed: completedCount,
          daily_autopilot: onboarding_data.ai_autopilot_daily || false,
        },
      })
      .eq("id", healthId);
  }

  // Telegram notification
  try {
    const { sendTelegramMessage } = await import("@/lib/services/trinity");
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      await sendTelegramMessage(
        chatId,
        `🤖 *AI Auto-Pilot Launched*\n\nClient: ${client.business_name}\n6 content tasks generated\nStrategy + 5 posts + 3 blogs + 2 emails + 3 ads + competitor analysis`
      );
    }
  } catch {
    // Telegram notification is non-critical
  }

  return NextResponse.json({
    success: true,
    tasks_completed: completedCount,
    tasks,
    summary: {
      strategy: strategyStatus,
      social_posts: socialStatus,
      blog_outlines: blogStatus,
      email_templates: emailStatus,
      ad_copy: adsStatus,
      competitor_analysis: competitorStatus,
    },
  });
}
