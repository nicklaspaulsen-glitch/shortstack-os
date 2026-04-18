import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/**
 * GET — List all team members for the authenticated agency
 * POST — Invite a new team member (creates auth user + profile + team_members row)
 */

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("agency_owner_id", user.id)
    .neq("status", "removed")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    email,
    full_name,
    password,
    role = "member",
    job_title,
    permissions = {},
    client_access_mode = "all",
    allowed_client_ids = [],
  } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const service = createServiceClient();

  // Check if team member already exists for this agency
  const { data: existing } = await service
    .from("team_members")
    .select("id")
    .eq("agency_owner_id", user.id)
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "A team member with this email already exists" }, { status: 400 });
  }

  // Create auth user with password
  const { data: authUser, error: authErr } = await service.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: {
      full_name: full_name || email,
      role: "team_member",
      parent_agency_id: user.id,
      is_team_member: true,
    },
  });

  if (authErr || !authUser?.user) {
    return NextResponse.json({ error: authErr?.message || "Failed to create user" }, { status: 500 });
  }

  const memberProfileId = authUser.user.id;

  // Upsert profile row (trigger might have created one already)
  await service.from("profiles").upsert({
    id: memberProfileId,
    email: email.toLowerCase(),
    full_name: full_name || email,
    role: "team_member",
    parent_agency_id: user.id,
    is_team_member: true,
  }, { onConflict: "id" });

  // Create team_members row with permissions
  const { data: member, error: memberErr } = await service
    .from("team_members")
    .insert({
      agency_owner_id: user.id,
      member_profile_id: memberProfileId,
      email: email.toLowerCase(),
      full_name: full_name || email,
      role,
      job_title: job_title || null,
      can_manage_clients: permissions.can_manage_clients ?? true,
      can_manage_outreach: permissions.can_manage_outreach ?? true,
      can_manage_content: permissions.can_manage_content ?? true,
      can_manage_ads: permissions.can_manage_ads ?? false,
      can_manage_billing: false, // never allow team members to manage billing
      can_manage_team: permissions.can_manage_team ?? false,
      can_view_financials: permissions.can_view_financials ?? false,
      client_access_mode,
      allowed_client_ids: client_access_mode === "specific" ? allowed_client_ids : [],
      accepted_at: new Date().toISOString(),
      status: "active",
    })
    .select()
    .single();

  if (memberErr) {
    // Rollback auth user
    await service.auth.admin.deleteUser(memberProfileId);
    return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }

  // Log
  try {
    await service.from("trinity_log").insert({
      user_id: user.id,
      action_type: "team_member_invited",
      description: `Invited team member: ${email}`,
      status: "completed",
      metadata: { member_id: member.id, member_email: email, role },
    });
  } catch {}

  return NextResponse.json({ success: true, member });
}
