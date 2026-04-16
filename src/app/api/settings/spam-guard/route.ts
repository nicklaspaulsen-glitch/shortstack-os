import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// GET — check if spam guard is enabled (default: true)
export async function GET(_request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const serviceSupabase = createServiceClient();
    const { data } = await serviceSupabase
      .from("app_settings")
      .select("value")
      .eq("user_id", user.id)
      .eq("key", "spam_guard_enabled")
      .single();

    // Default to enabled if no setting exists or table missing
    return NextResponse.json({ enabled: data?.value !== "false" });
  } catch {
    // Safe default — if table doesn't exist or any error, assume enabled
    return NextResponse.json({ enabled: true });
  }
}

// PUT — toggle spam guard on/off
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { enabled } = await request.json();
    const serviceSupabase = createServiceClient();

    // Upsert the setting
    await serviceSupabase
      .from("app_settings")
      .upsert({
        user_id: user.id,
        key: "spam_guard_enabled",
        value: String(enabled),
      }, { onConflict: "user_id,key" });

    return NextResponse.json({ enabled });
  } catch {
    return NextResponse.json({ error: "Failed to save setting" }, { status: 500 });
  }
}
