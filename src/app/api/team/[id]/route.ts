import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/**
 * PATCH — Update a team member (permissions, role, password reset, email change)
 * DELETE — Remove a team member (soft delete: status=removed, keep for audit)
 */

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const service = createServiceClient();

  // Confirm the team member belongs to this agency
  const { data: member, error: fetchErr } = await service
    .from("team_members")
    .select("id, email, member_profile_id, agency_owner_id")
    .eq("id", params.id)
    .single();

  if (fetchErr || !member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (member.agency_owner_id !== user.id) {
    return NextResponse.json({ error: "Not your team member" }, { status: 403 });
  }

  // Handle password reset (separate from profile update)
  if (body.new_password) {
    if (body.new_password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (member.member_profile_id) {
      const { error } = await service.auth.admin.updateUserById(member.member_profile_id, {
        password: body.new_password,
      });
      if (error) return NextResponse.json({ error: "Password reset failed: " + error.message }, { status: 500 });
    }
  }

  // Handle email change
  if (body.new_email && body.new_email !== member.email) {
    if (member.member_profile_id) {
      const { error } = await service.auth.admin.updateUserById(member.member_profile_id, {
        email: body.new_email.toLowerCase(),
        email_confirm: true,
      });
      if (error) return NextResponse.json({ error: "Email change failed: " + error.message }, { status: 500 });

      await service.from("profiles").update({ email: body.new_email.toLowerCase() }).eq("id", member.member_profile_id);
    }
  }

  // Build allowed update payload (never let team_members change agency_owner_id)
  const allowedFields = [
    "full_name", "role", "job_title", "status",
    "can_manage_clients", "can_manage_outreach", "can_manage_content",
    "can_manage_ads", "can_manage_team", "can_view_financials",
    "client_access_mode", "allowed_client_ids", "avatar_url",
  ];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowedFields) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.new_email) updates.email = body.new_email.toLowerCase();

  const { data: updated, error: updateErr } = await service
    .from("team_members")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Log
  try {
    await service.from("trinity_log").insert({
      user_id: user.id,
      action_type: "team_member_updated",
      description: `Updated team member: ${updated?.email || member.email}${body.new_password ? " (password reset)" : ""}${body.new_email ? " (email changed)" : ""}`,
      status: "completed",
      metadata: { member_id: params.id },
    });
  } catch {}

  return NextResponse.json({ success: true, member: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: member } = await service
    .from("team_members")
    .select("id, email, member_profile_id, agency_owner_id")
    .eq("id", params.id)
    .single();

  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (member.agency_owner_id !== user.id) {
    return NextResponse.json({ error: "Not your team member" }, { status: 403 });
  }

  // Soft-delete (mark as removed)
  await service
    .from("team_members")
    .update({ status: "removed", updated_at: new Date().toISOString() })
    .eq("id", params.id);

  // Also disable the auth user so they can't log in
  if (member.member_profile_id) {
    try {
      await service.auth.admin.updateUserById(member.member_profile_id, {
        user_metadata: { disabled: true, removed_at: new Date().toISOString() },
      });
    } catch {}
  }

  try {
    await service.from("trinity_log").insert({
      user_id: user.id,
      action_type: "team_member_removed",
      description: `Removed team member: ${member.email}`,
      status: "completed",
      metadata: { member_id: params.id },
    });
  } catch {}

  return NextResponse.json({ success: true });
}
