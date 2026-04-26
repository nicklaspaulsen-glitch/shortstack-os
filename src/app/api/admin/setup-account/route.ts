/**
 * Security fixes (admin-route-audit.md — HIGH):
 *
 * 1. Replaced inline `createClient(SERVICE_ROLE_KEY)` for the role lookup with
 *    createServerSupabase() (user-scoped). The role read doesn't need RLS bypass;
 *    using the service client for this was overprivileged.
 *
 * 2. Role gate now accepts both "admin" and "founder" — founders were previously
 *    locked out of this endpoint despite having equivalent platform authority.
 *
 * The service client (supabaseAdmin) is still used for the auth.admin.* write
 * operations that genuinely require service_role.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Admin-only: Create or update an account with specific role/permissions
export async function POST(req: NextRequest) {
  // Verify caller identity with the user-scoped client (no RLS bypass needed here).
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read role via the user-scoped client — RLS on profiles allows self-read.
  const { data: profile } = await authSupabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "founder") {
    return NextResponse.json({ error: "Admin or founder only" }, { status: 403 });
  }

  // Service client required only for auth.admin.* write operations.
  const supabaseAdmin = createServiceClient();

  try {
    const { email, password, full_name, role, nickname } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existing) {
      // Update existing user password
      await supabaseAdmin.auth.admin.updateUserById(existing.id, { password });
      userId = existing.id;
    } else {
      // Create new user
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr || !newUser.user) {
        console.error("[setup-account] Create user error:", createErr);
        return NextResponse.json({ error: createErr?.message || "Failed to create user" }, { status: 500 });
      }
      userId = newUser.user.id;
    }

    // Upsert profile with role and details
    const profileData: Record<string, unknown> = {
      id: userId,
      email,
      role: role || "admin",
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    if (full_name) profileData.full_name = full_name;
    if (nickname) profileData.nickname = nickname;

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert(profileData, { onConflict: "id" });

    if (profileErr) {
      console.error("[setup-account] Profile upsert error:", profileErr);
      return NextResponse.json({ error: "User created but profile update failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: existing ? "Account updated" : "Account created",
      userId,
    });
  } catch (err) {
    console.error("[setup-account] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
