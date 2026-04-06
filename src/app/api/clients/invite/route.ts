import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check admin role
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { email, full_name, password, client_id } = await request.json();

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

  // Link client record to this user profile
  if (client_id) {
    await supabase.from("clients").update({ profile_id: userData.id }).eq("id", client_id);

    // Auto-create GHL sub-account for this client
    const { data: client } = await supabase.from("clients").select("business_name, phone").eq("id", client_id).single();
    if (client && process.env.GHL_AGENCY_KEY) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app"}/api/ghl/create-subaccount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id, business_name: client.business_name, email, phone: client.phone }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({ success: true, user_id: userData.id });
}
