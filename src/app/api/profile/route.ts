import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Get fresh profile data (cache-busted)
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  // eslint-disable-next-line prefer-const
  let { data: profile, error } = await service
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Auto-create profile if missing (first login after account creation)
  if (error || !profile) {
    const { data: created, error: createErr } = await service
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email || "",
        full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "",
        role: user.user_metadata?.role || "client",
        timezone: "UTC",
        is_active: true,
      })
      .select("*")
      .single();

    if (createErr || !created) {
      console.error("[profile] Auto-create error:", createErr);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    profile = created;
  }

  // Ensure plan_tier is set — column may not exist in DB yet
  if (!profile.plan_tier) {
    profile.plan_tier = profile.role === "admin" ? "Founder" : "Starter";
  }

  return NextResponse.json({ profile }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

// Update profile fields (nickname, etc.)
export async function PATCH(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (!user || authErr) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const allowedFields = ["nickname", "avatar_url"];
    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const service = createServiceClient();
    const { error } = await service.from("profiles").update(updates).eq("id", user.id);
    if (error) {
      console.error("[profile] Update error:", error);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[profile] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
