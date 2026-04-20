import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Admin Client Switcher — View any client's portal as admin/founder/agency
export async function GET(_request: NextRequest) {
  // Verify the requester via cookie auth
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    console.warn("[switch-client] No authenticated user — cookie auth failed");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service client for all data queries (bypasses RLS, more reliable)
  const supabase = createServiceClient();

  // Verify role — anyone who can own clients (admin, founder, agency) is
  // allowed to view their own list. Team members resolve up to the parent
  // agency. Clients themselves (end-users) are blocked.
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, role, parent_agency_id")
    .eq("id", user.id)
    .single();

  if (profileErr) {
    console.error("[switch-client] Profile lookup error:", profileErr.message);
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }
  const ownerRoles = ["admin", "founder", "agency"];
  const role = (profile as { role: string } | null)?.role || "";
  const parentAgencyId = (profile as { parent_agency_id?: string } | null)?.parent_agency_id || null;
  const isTeamMember = role === "team_member" && parentAgencyId;
  if (!ownerRoles.includes(role) && !isTeamMember) {
    return NextResponse.json(
      { error: "Only agency owners, founders, admins, or team members can switch clients" },
      { status: 403 },
    );
  }
  const effectiveOwnerId = isTeamMember ? (parentAgencyId as string) : user.id;

  // Get only the caller's own clients (team members resolve to parent agency)
  const { data: clients, error: clientsErr } = await supabase.from("clients").select(`
    id, profile_id, business_name, contact_name, email, phone, website, industry,
    package_tier, services, mrr, contract_status, health_score, is_active,
    created_at, onboarded_at
  `).eq("profile_id", effectiveOwnerId).order("business_name");

  if (clientsErr) {
    console.error("[switch-client] Clients query error:", clientsErr.message);
    return NextResponse.json({ error: "Failed to load clients" }, { status: 500 });
  }

  if (!clients || clients.length === 0) {
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
    } catch (err) { console.error(`[switch-client] socials lookup failed for ${client.business_name}:`, err); }

    enriched.push({
      ...client,
      tasks: { done: tasksDone, total: tasksTotal },
      content_count: contentCount,
      campaign_count: campaignCount,
      invoices_pending: invoicesPending,
      connected_platforms: connectedPlatforms,
    });
  }

  return NextResponse.json({ success: true, clients: enriched });
}
