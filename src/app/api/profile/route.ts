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
  const { data: profile, error } = await service
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
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
