import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check admin role
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { email, full_name, password, client_id } = await request.json();

  // Verify the target client belongs to this admin's agency before inviting a client user for it.
  if (client_id) {
    const ctx = await requireOwnedClient(supabase, user.id, client_id);
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Create auth user with client role using Supabase Admin API
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: "client" },
    }),
  });

  const userData = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: userData.msg || "Failed to create user" }, { status: 400 });
  }

  // Create profile (trigger might handle this, but just in case)
  await supabase.from("profiles").upsert({
    id: userData.id,
    email,
    full_name,
    role: "client",
  });

  // Link client record to this user profile. GHL sub-account auto-creation
  // removed Apr 21 — clients live in the native `clients` table only.
  if (client_id) {
    await supabase.from("clients").update({ profile_id: userData.id }).eq("id", client_id);
  }

  return NextResponse.json({ success: true, user_id: userData.id });
}
