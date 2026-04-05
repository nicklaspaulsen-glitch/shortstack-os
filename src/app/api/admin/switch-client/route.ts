import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Admin Client Switcher — View any client's portal as admin
export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify admin
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  // Get all clients with their full data for admin overview
  const { data: clients } = await supabase.from("clients").select(`
    id, business_name, contact_name, email, phone, website, industry,
    package_tier, services, mrr, contract_status, health_score, is_active,
    created_at, onboarded_at
  `).order("business_name");

  // Get counts per client
  const enriched = [];
  for (const client of (clients || [])) {
    const [
      { count: tasksDone },
      { count: tasksTotal },
      { count: contentCount },
      { count: campaignCount },
      { count: invoicesPending },
    ] = await Promise.all([
      supabase.from("client_tasks").select("*", { count: "exact", head: true }).eq("client_id", client.id).eq("is_completed", true),
      supabase.from("client_tasks").select("*", { count: "exact", head: true }).eq("client_id", client.id),
      supabase.from("content_scripts").select("*", { count: "exact", head: true }).eq("client_id", client.id),
      supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("client_id", client.id),
      supabase.from("invoices").select("*", { count: "exact", head: true }).eq("client_id", client.id).in("status", ["sent", "overdue"]),
    ]);

    // Get connected social accounts
    const { data: socials } = await supabase.from("social_accounts").select("platform, account_name, is_active").eq("client_id", client.id);

    enriched.push({
      ...client,
      tasks: { done: tasksDone || 0, total: tasksTotal || 0 },
      content_count: contentCount || 0,
      campaign_count: campaignCount || 0,
      invoices_pending: invoicesPending || 0,
      connected_platforms: (socials || []).filter(s => s.is_active && s.platform !== "ai_bot_config" && s.platform !== "white_label_config" && s.platform !== "zernio"),
    });
  }

  return NextResponse.json({ success: true, clients: enriched });
}
