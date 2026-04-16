import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// GET — Fetch paginated outreach entries with filters
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = request.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get("pageSize") || "25")));
  const platform = url.searchParams.get("platform") || "all";
  const status = url.searchParams.get("status") || "all";
  const type = url.searchParams.get("type") || "all";
  const search = url.searchParams.get("search") || "";
  const dateFrom = url.searchParams.get("dateFrom") || "";
  const dateTo = url.searchParams.get("dateTo") || "";

  const serviceSupabase = createServiceClient();
  const offset = (page - 1) * pageSize;

  // Build query
  let query = serviceSupabase
    .from("outreach_log")
    .select("*", { count: "exact" });

  if (platform !== "all") query = query.eq("platform", platform);
  if (status !== "all") query = query.eq("status", status);
  if (type !== "all") {
    // Type maps to metadata.source or platform
    if (type === "cold_email") query = query.eq("platform", "email");
    else if (type === "cold_dm") query = query.in("platform", ["instagram_dm", "facebook_dm", "instagram", "facebook", "linkedin", "tiktok"]);
    else if (type === "cold_call") query = query.eq("platform", "call");
    else if (type === "sms") query = query.eq("platform", "sms");
  }
  if (search) {
    query = query.or(`business_name.ilike.%${search}%,recipient_handle.ilike.%${search}%,message_text.ilike.%${search}%`);
  }
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) {
    // Include the full end day by appending T23:59:59 if only a date was given
    const endDate = dateTo.length === 10 ? `${dateTo}T23:59:59` : dateTo;
    query = query.lte("created_at", endDate);
  }

  const { data: entries, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  // Aggregate stats
  const { data: stats } = await serviceSupabase
    .from("outreach_log")
    .select("status, platform")
    .limit(5000);

  const statsSummary = {
    total: stats?.length || 0,
    sent: stats?.filter(s => s.status === "sent").length || 0,
    replied: stats?.filter(s => s.status === "replied").length || 0,
    failed: stats?.filter(s => s.status === "failed").length || 0,
    byPlatform: {} as Record<string, number>,
  };
  stats?.forEach(s => {
    statsSummary.byPlatform[s.platform] = (statsSummary.byPlatform[s.platform] || 0) + 1;
  });

  return NextResponse.json({ entries: entries || [], total, page, pageSize, totalPages, stats: statsSummary });
}

// POST — Bulk actions on outreach entries
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { action, entry_ids, lead_ids, status: bodyStatus } = body;
  if (!action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

  const serviceSupabase = createServiceClient();

  if (action === "delete" && entry_ids?.length) {
    const { error } = await serviceSupabase
      .from("outreach_log")
      .delete()
      .in("id", entry_ids.slice(0, 100));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, deleted: entry_ids.length });
  }

  if (action === "mark_status" && entry_ids?.length) {
    await serviceSupabase.from("outreach_log").update({ status: bodyStatus }).in("id", entry_ids.slice(0, 100));
    return NextResponse.json({ success: true });
  }

  // Bulk DM/Call/SMS — delegate to existing routes
  if ((action === "dm" || action === "call" || action === "sms") && lead_ids?.length) {
    return NextResponse.json({
      success: true,
      message: `Use /api/outreach/bulk for ${action} actions`,
      redirect: "/api/outreach/bulk",
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
