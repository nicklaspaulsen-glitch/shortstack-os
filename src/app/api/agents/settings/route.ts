import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

type AllowedRole = "admin" | "founder" | "agency" | "team_member";
const WRITE_ROLES: AllowedRole[] = ["admin", "founder"];
const READ_ROLES: AllowedRole[] = ["admin", "founder", "agency", "team_member"];

async function getUserRole(supabase: ReturnType<typeof createServerSupabase>, userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return profile?.role ?? null;
}

// GET — load all agent settings (admin/founder/agency/team_member only)
export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getUserRole(supabase, user.id);
  if (!role || !(READ_ROLES as string[]).includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceSupabase = createServiceClient();
  const { data } = await serviceSupabase
    .from("system_health")
    .select("integration_name, metadata")
    .eq("integration_name", "agent_settings")
    .single();

  const defaults = getDefaults();
  const saved = (data?.metadata as Record<string, unknown>) || {};

  return NextResponse.json({ success: true, settings: { ...defaults, ...saved } });
}

// POST — save agent settings (admin/founder only)
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getUserRole(supabase, user.id);
  if (!role || !(WRITE_ROLES as string[]).includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await request.json();
  const serviceSupabase = createServiceClient();

  // Upsert into system_health as a config store
  const { error } = await serviceSupabase
    .from("system_health")
    .upsert({
      integration_name: "agent_settings",
      status: "healthy",
      metadata: settings,
      last_checked: new Date().toISOString(),
    }, { onConflict: "integration_name" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

function getDefaults() {
  return {
    lead_engine: {
      enabled: true,
      schedule: "05:00",
      leads_per_run: 50,
      platforms: ["google_maps"],
      required_fields: ["email", "phone"],
      target_industries: ["dental", "legal", "hvac", "gym", "restaurant"],
      target_locations: ["Miami, FL"],
    },
    outreach: {
      enabled: true,
      schedule: "09:00",
      emails_per_day: 20,
      sms_per_day: 20,
      calls_per_day: 200,
      ig_dms_per_day: 20,
      fb_dms_per_day: 20,
      active_days: ["mon", "tue", "wed", "thu", "fri"],
      message_style: "friendly",
      goal_mode: false,
      weekly_reply_goal: 10,
      weekly_booking_goal: 5,
    },
    content: {
      enabled: true,
      schedule: "07:00",
      schedule_day: "monday",
      posts_per_client: 5,
      platforms: ["instagram", "tiktok", "linkedin"],
      tone: "professional",
    },
    retention: {
      enabled: true,
      schedule: "10:00",
      health_threshold: 50,
      inactive_days: 7,
    },
    invoice: {
      enabled: true,
      schedule: "11:00",
      chase_after_days: 1,
    },
    health_check: {
      enabled: true,
      interval_minutes: 30,
    },
    daily_brief: {
      enabled: true,
      schedule: "08:00",
    },
  };
}
