import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Admin Client Switcher — View any client's portal as admin
export async function GET(_request: NextRequest) {
  // Verify the requester is an admin via cookie auth
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    console.warn("[switch-client] No authenticated user — cookie auth failed");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service client for all data queries (bypasses RLS, more reliable)
  const supabase = createServiceClient();

  // Verify admin role
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileErr) {
    console.error("[switch-client] Profile lookup error:", profileErr.message);
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // Get all clients with profile_id included
  const { data: clients, error: clientsErr } = await supabase.from("clients").select(`
    id, profile_id, business_name, contact_name, email, phone, website, industry,
    package_tier, services, mrr, contract_status, health_score, is_active,
    created_at, onboarded_at
  `).order("business_name");

  if (clientsErr) {
    console.error("[switch-client] Clients query error:", clientsErr.message);
    return NextResponse.json({ error: "Failed to load clients" }, { status: 500 });
  }

  if (!clients || clients.length === 0) {
    console.log("[switch-client] No clients found in database");
    return NextResponse.json({ success: true, clients: [] });
  }

  // Enrich each client with counts (errors on individual queries don't break the whole list)
  const enriched = [];
  for (const client of clients) {
    let tasksDone = 0, tasksTotal = 0, contentCount = 0, campaignCount = 0, invoicesPending = 0;
    let connectedPlatforms: Array<{ platform: string; account_name: string; is_active: boolean }> = [];

    try {
      const [t1, t2, t3, t4, t5] = await Promise.all([
        supabase.from("client_tasks").select("*", { count: "exact", head: true }).eq("client_id", client.id).eq("is_completed", true),
        supabase.from("client_tasks").select("*", { count: "exact", head: true }).eq("client_id", client.id),
        supabase.from("content_scripts").select("*", { count: "exact", head: true }).eq("client_id", client.id),
        supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("client_id", client.id),
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("client_id", client.id).in("status", ["sent", "overdue"]),
      ]);
      tasksDone = t1.count || 0;
      tasksTotal = t2.count || 0;
      contentCount = t3.count || 0;
      campaignCount = t4.count || 0;
      invoicesPending = t5.count || 0;
    } catch (err) {
      console.warn(`[switch-client] Enrichment failed for ${client.business_name}:`, err);
    }

    try {
      const { data: socials } = await supabase
        .from("social_accounts")
        .select("platform, account_name, is_active")
        .eq("client_id", client.id);
      connectedPlatforms = (socials || []).filter(
        (s) => s.is_active && s.platform !== "ai_bot_config" && s.platform !== "white_label_config" && s.platform !== "zernio"
      );
    } catch {}

    enriched.push({
      ...client,
      tasks: { done: tasksDone, total: tasksTotal },
      content_count: contentCount,
      campaign_count: campaignCount,
      invoices_pending: invoicesPending,
      connected_platforms: connectedPlatforms,
    });
  }

  console.log(`[switch-client] Returning ${enriched.length} clients`);
  return NextResponse.json({ success: true, clients: enriched });
}
