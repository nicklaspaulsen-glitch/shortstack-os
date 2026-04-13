import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Usage Tracking & Paywall System
// Tracks API usage per client and enforces tier limits

const TIER_LIMITS = {
  Starter: {
    max_clients: 5,
    team_members: 1,
    ai_requests_monthly: 100,
    content_scripts: 10,
    social_posts: 30,
    seo_audits: 2,
    competitor_analyses: 1,
    landing_pages: 1,
    email_sequences: 1,
    proposals: 3,
    reports: 1,
    voice_assistant_minutes: 30,
    storage_mb: 500,
  },
  Growth: {
    max_clients: 25,
    team_members: 5,
    ai_requests_monthly: 500,
    content_scripts: 50,
    social_posts: 150,
    seo_audits: 10,
    competitor_analyses: 5,
    landing_pages: 5,
    email_sequences: 5,
    proposals: 10,
    reports: 5,
    voice_assistant_minutes: 120,
    storage_mb: 2000,
  },
  Enterprise: {
    max_clients: -1, // unlimited
    team_members: -1,
    ai_requests_monthly: -1,
    content_scripts: -1,
    social_posts: -1,
    seo_audits: -1,
    competitor_analyses: -1,
    landing_pages: -1,
    email_sequences: -1,
    proposals: -1,
    reports: -1,
    voice_assistant_minutes: -1,
    storage_mb: 10000,
  },
};

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("client_id");

  // Get client's tier
  let tier = "Growth";
  if (clientId) {
    const { data: client } = await supabase.from("clients").select("package_tier").eq("id", clientId).single();
    tier = client?.package_tier || "Growth";
  }

  const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.Growth;

  // Count usage this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const since = monthStart.toISOString();

  const { count: aiRequests } = await supabase
    .from("trinity_log")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since)
    .eq("client_id", clientId || "");

  const { count: contentScripts } = await supabase
    .from("content_scripts")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since)
    .eq("client_id", clientId || "");

  const usage = {
    ai_requests_monthly: aiRequests || 0,
    content_scripts: contentScripts || 0,
  };

  return NextResponse.json({
    tier,
    limits,
    usage,
    tier_options: TIER_LIMITS,
  });
}

// Check if a specific action is allowed
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, action } = await request.json();

  // Validate action is one of the known tier limit keys
  const validActions = [
    "max_clients", "team_members", "ai_requests_monthly", "content_scripts",
    "social_posts", "seo_audits", "competitor_analyses", "landing_pages",
    "email_sequences", "proposals", "reports", "voice_assistant_minutes", "storage_mb",
  ];
  if (!action || typeof action !== "string" || !validActions.includes(action)) {
    return NextResponse.json({ error: "Invalid action type" }, { status: 400 });
  }

  let tier = "Growth";
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("package_tier").eq("id", client_id).single();
    tier = client?.package_tier || "Growth";
  }

  const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.Growth;
  const limit = limits[action as keyof typeof limits];

  // -1 means unlimited
  if (limit === -1) return NextResponse.json({ allowed: true, limit: "unlimited" });

  // Count current usage
  const monthStart = new Date();
  monthStart.setDate(1);
  const since = monthStart.toISOString();

  // Sanitize action for ilike query — strip wildcard chars to prevent pattern injection
  const sanitizedAction = action.replace(/[%_\\]/g, "");

  const { count } = await supabase
    .from("trinity_log")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since)
    .eq("client_id", client_id || "")
    .ilike("action_type", `%${sanitizedAction}%`);

  const used = count || 0;
  const allowed = used < (limit || 0);

  return NextResponse.json({
    allowed,
    used,
    limit,
    remaining: Math.max(0, (limit || 0) - used),
    upgrade_needed: !allowed,
    tier,
  });
}
