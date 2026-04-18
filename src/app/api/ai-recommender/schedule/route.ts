import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST — Save a recurring schedule for AI recommendations.
 * GET — Retrieve the user's current schedule.
 * Stored in profiles.onboarding_preferences.ai_recommender_schedule
 */

interface Schedule {
  enabled: boolean;
  frequency: "once" | "daily" | "every_other_day" | "weekdays" | "weekly" | "monthly";
  time_of_day: string;    // "09:00"
  day_of_week?: string;    // "monday" (for weekly)
  day_of_month?: number;   // 1-28 (for monthly)
  auto_execute_top_pick?: boolean;
  pinned_types?: string[];  // user's preferred content types
}

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_preferences")
    .eq("id", user.id)
    .single();

  const prefs = (profile?.onboarding_preferences as Record<string, unknown>) || {};
  const schedule = (prefs.ai_recommender_schedule as Schedule) || {
    enabled: false,
    frequency: "once",
    time_of_day: "09:00",
    auto_execute_top_pick: false,
    pinned_types: [],
  };

  return NextResponse.json({ schedule });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { schedule } = await req.json();
  if (!schedule) return NextResponse.json({ error: "schedule required" }, { status: 400 });

  // Read current preferences then merge
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_preferences")
    .eq("id", user.id)
    .single();

  const prefs = (profile?.onboarding_preferences as Record<string, unknown>) || {};
  const updated = {
    ...prefs,
    ai_recommender_schedule: schedule,
  };

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_preferences: updated })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, schedule });
}
