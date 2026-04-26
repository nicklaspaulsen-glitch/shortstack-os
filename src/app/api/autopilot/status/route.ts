import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";

export async function GET(request: NextRequest) {
  // Auth check
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  // Verify caller owns this client before serving any data
  const ctx = await requireOwnedClient(supabase, user.id, clientId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const serviceSupabase = createServiceClient();

  // Fetch system_health autopilot record
  const { data: healthRecord } = await serviceSupabase
    .from("system_health")
    .select("id, status, metadata, updated_at, created_at")
    .eq("integration_name", `autopilot_${clientId}`)
    .single();

  // Fetch trinity_log entries for this client with autopilot action types
  const { data: logEntries } = await serviceSupabase
    .from("trinity_log")
    .select("id, action_type, description, status, result, created_at")
    .eq("client_id", clientId)
    .like("action_type", "autopilot_%")
    .order("created_at", { ascending: false });

  // Fetch autopilot-sourced content calendar entries
  const { data: contentPosts } = await serviceSupabase
    .from("content_calendar")
    .select("id, title, platform, status, scheduled_at, metadata, created_at")
    .eq("client_id", clientId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(20);

  // Filter content calendar entries with autopilot source
  const autopilotPosts = (contentPosts || []).filter(post => {
    const meta = post.metadata as Record<string, unknown> | null;
    return meta?.source === "autopilot" || meta?.ai_generated === true;
  });

  if (!healthRecord && (!logEntries || logEntries.length === 0)) {
    return NextResponse.json({
      active: false,
      tasks: [],
      total_generated: 0,
      last_run: null,
      daily_autopilot: false,
    });
  }

  const healthMeta = (healthRecord?.metadata as Record<string, unknown>) || {};

  // Build structured task list from trinity_log entries
  const actionTypeMap: Record<string, { title: string; type: string; icon: string }> = {
    autopilot_strategy: { title: "30-Day Marketing Strategy", type: "strategy", icon: "strategy" },
    autopilot_blog: { title: "Blog Article Outlines", type: "blog_outlines", icon: "blog" },
    autopilot_email: { title: "Email Templates", type: "email_templates", icon: "email" },
    autopilot_ads: { title: "Ad Copy Variations", type: "ad_copy", icon: "ads" },
    autopilot_competitor: { title: "Competitor Analysis", type: "competitor_analysis", icon: "competitor" },
  };

  const loggedTasks = (logEntries || []).map(entry => {
    const mapped = actionTypeMap[entry.action_type] || {
      title: entry.description || entry.action_type,
      type: entry.action_type,
      icon: "default",
    };
    const result = entry.result as Record<string, unknown> | null;
    return {
      type: mapped.type,
      status: entry.status === "completed" ? "complete" : entry.status,
      title: mapped.title,
      icon: mapped.icon,
      created_at: entry.created_at,
      content_preview: typeof result?.content === "string"
        ? (result.content as string).substring(0, 200)
        : null,
    };
  });

  // Add social posts task from content calendar count
  if (autopilotPosts.length > 0) {
    const firstPost = autopilotPosts[0];
    loggedTasks.unshift({
      type: "social_posts",
      status: "complete",
      title: "Social Media Posts",
      icon: "social",
      created_at: firstPost.created_at,
      content_preview: autopilotPosts
        .slice(0, 3)
        .map(p => p.title)
        .join(" · "),
    });
  }

  // Deduplicate by type, keep most recent
  const seen = new Set<string>();
  const uniqueTasks = loggedTasks.filter(task => {
    if (seen.has(task.type)) return false;
    seen.add(task.type);
    return true;
  });

  // Calculate totals
  const totalGenerated = uniqueTasks.filter(t => t.status === "complete").length;
  const lastRun = healthRecord?.updated_at || healthRecord?.created_at || null;
  const dailyAutopilot = Boolean(healthMeta.daily_autopilot);
  const isActive = healthRecord?.status === "active" && totalGenerated > 0;

  return NextResponse.json({
    active: isActive,
    tasks: uniqueTasks,
    total_generated: totalGenerated,
    last_run: lastRun,
    daily_autopilot: dailyAutopilot,
    social_posts_count: autopilotPosts.length,
    social_posts: autopilotPosts.slice(0, 5).map(post => ({
      id: post.id,
      title: post.title,
      platform: post.platform,
      status: post.status,
      scheduled_at: post.scheduled_at,
      caption: (post.metadata as Record<string, unknown>)?.caption,
    })),
  });
}
