import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve effective owner — suspends team_members can't search
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const search = `%${q}%`;

  // Search across all tables in parallel — all queries scoped to ownerId
  // to prevent cross-tenant data leakage (IDOR fix, May 3).
  const [
    { data: leads },
    { data: clients },
    { data: deals },
    { data: scripts },
    { data: team },
    { data: trinity },
  ] = await Promise.all([
    supabase.from("leads").select("id, business_name, phone, industry, status").eq("user_id", ownerId).ilike("business_name", search).limit(5),
    supabase.from("clients").select("id, business_name, contact_name, email, package_tier").eq("user_id", ownerId).ilike("business_name", search).limit(5),
    supabase.from("deals").select("id, client_name, service, amount, status").eq("user_id", ownerId).ilike("client_name", search).limit(5),
    supabase.from("content_scripts").select("id, title, script_type, status").eq("user_id", ownerId).ilike("title", search).limit(5),
    supabase.from("team_members").select("id, full_name, role, email").eq("owner_id", ownerId).ilike("full_name", search).limit(5),
    supabase.from("trinity_log").select("id, description, action_type, status, created_at").eq("user_id", ownerId).ilike("description", search).limit(5),
  ]);

  const results = [
    ...(leads || []).map(l => ({ type: "lead", id: l.id, title: l.business_name, subtitle: `${l.industry || "Lead"} · ${l.status}`, href: "/dashboard/leads" })),
    ...(clients || []).map(c => ({ type: "client", id: c.id, title: c.business_name, subtitle: `${c.contact_name} · ${c.package_tier || "Client"}`, href: `/dashboard/clients/${c.id}` })),
    ...(deals || []).map(d => ({ type: "deal", id: d.id, title: d.client_name, subtitle: `${d.service} · $${d.amount}`, href: "/dashboard/deals" })),
    ...(scripts || []).map(s => ({ type: "content", id: s.id, title: s.title, subtitle: `${s.script_type} · ${s.status}`, href: "/dashboard/content" })),
    ...(team || []).map(t => ({ type: "team", id: t.id, title: t.full_name, subtitle: t.role, href: "/dashboard/team" })),
    ...(trinity || []).map(t => ({ type: "action", id: t.id, title: t.description, subtitle: `${t.action_type} · ${t.status}`, href: "/dashboard/trinity" })),
  ];

  return NextResponse.json({ results });
}
