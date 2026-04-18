import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET — Fetch paginated outreach entries with filters
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  // Resolve owner-scoped lead and client ids so outreach is scoped to the caller's agency.
  // outreach_log has no direct user_id column; ownership flows through the joined lead or client.
  const [{ data: ownedLeads }, { data: ownedClients }] = await Promise.all([
    serviceSupabase.from("leads").select("id").eq("user_id", ownerId),
    serviceSupabase.from("clients").select("id").eq("profile_id", ownerId),
  ]);
  const ownedLeadIds = (ownedLeads || []).map((l) => l.id as string);
  const ownedClientIds = (ownedClients || []).map((c) => c.id as string);

  // If caller has no owned leads or clients, return empty result immediately.
  if (ownedLeadIds.length === 0 && ownedClientIds.length === 0) {
    return NextResponse.json({
      entries: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      stats: { total: 0, sent: 0, replied: 0, failed: 0, byPlatform: {} },
    });
  }

  // Build OR filter for ownership: outreach belongs to caller if its lead or client is owned.
  const ownershipFilters: string[] = [];
  if (ownedLeadIds.length > 0) ownershipFilters.push(`lead_id.in.(${ownedLeadIds.join(",")})`);
  if (ownedClientIds.length > 0) ownershipFilters.push(`client_id.in.(${ownedClientIds.join(",")})`);

  // Build query
  let query = serviceSupabase
    .from("outreach_log")
    .select("*", { count: "exact" })
    .or(ownershipFilters.join(","));

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

  // Aggregate stats (scoped to caller's owned leads/clients)
  const { data: stats } = await serviceSupabase
    .from("outreach_log")
    .select("status, platform")
    .or(ownershipFilters.join(","))
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

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { action, entry_ids, lead_ids, status: bodyStatus } = body;
  if (!action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

  const serviceSupabase = createServiceClient();

  // Resolve owner-scoped ids once so bulk actions only touch caller-owned entries.
  const resolveOwnedEntryIds = async (ids: string[]): Promise<string[]> => {
    if (!ids?.length) return [];
    const capped = ids.slice(0, 100);
    const [{ data: ownedLeads }, { data: ownedClients }] = await Promise.all([
      serviceSupabase.from("leads").select("id").eq("user_id", ownerId),
      serviceSupabase.from("clients").select("id").eq("profile_id", ownerId),
    ]);
    const ownedLeadIds = (ownedLeads || []).map((l) => l.id as string);
    const ownedClientIds = (ownedClients || []).map((c) => c.id as string);
    if (ownedLeadIds.length === 0 && ownedClientIds.length === 0) return [];

    const filters: string[] = [];
    if (ownedLeadIds.length > 0) filters.push(`lead_id.in.(${ownedLeadIds.join(",")})`);
    if (ownedClientIds.length > 0) filters.push(`client_id.in.(${ownedClientIds.join(",")})`);

    const { data: allowed } = await serviceSupabase
      .from("outreach_log")
      .select("id")
      .in("id", capped)
      .or(filters.join(","));
    return (allowed || []).map((r) => r.id as string);
  };

  if (action === "delete" && entry_ids?.length) {
    const allowedIds = await resolveOwnedEntryIds(entry_ids);
    if (allowedIds.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }
    const { error } = await serviceSupabase
      .from("outreach_log")
      .delete()
      .in("id", allowedIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, deleted: allowedIds.length });
  }

  if (action === "mark_status" && entry_ids?.length) {
    const allowedIds = await resolveOwnedEntryIds(entry_ids);
    if (allowedIds.length === 0) {
      return NextResponse.json({ success: true });
    }
    await serviceSupabase.from("outreach_log").update({ status: bodyStatus }).in("id", allowedIds);
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
