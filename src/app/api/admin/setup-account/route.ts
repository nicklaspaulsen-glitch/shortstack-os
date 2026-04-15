import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

// Admin-only: Create or update an account with specific role/permissions
export async function POST(req: NextRequest) {
  // Verify caller is admin
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use raw supabase-js for admin auth operations
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify admin role
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

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
      console.log(`[setup-account] Updated existing user ${email}`);
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
      console.log(`[setup-account] Created new user ${email} with id ${userId}`);
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
