import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Outreach Configuration — Set platforms, DM limits, message templates, and schedule
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await request.json();

  // Store config in system_health as a settings record
  const { data: existing } = await supabase
    .from("system_health")
    .select("id")
    .eq("integration_name", "outreach_config")
    .single();

  const record = {
    integration_name: "outreach_config",
    status: "healthy" as const,
    metadata: {
      platforms: config.platforms || {
        instagram: { enabled: true, daily_limit: 20 },
        linkedin: { enabled: true, daily_limit: 20 },
        facebook: { enabled: true, daily_limit: 20 },
        tiktok: { enabled: true, daily_limit: 20 },
      },
      total_daily_target: config.total_daily_target || 80,
      schedule_time: config.schedule_time || "09:00",
      timezone: config.timezone || "Europe/Copenhagen",
      auto_followup: config.auto_followup !== false,
      followup_day_3: config.followup_day_3 !== false,
      followup_day_7: config.followup_day_7 !== false,
      message_style: config.message_style || "professional and friendly",
      custom_template: config.custom_template || null,
      target_industries: config.target_industries || [],
      exclude_contacted: config.exclude_contacted !== false,
      pause_on_reply: config.pause_on_reply !== false,
    },
    last_check_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from("system_health").update(record).eq("id", existing.id);
  } else {
    await supabase.from("system_health").insert(record);
  }

  return NextResponse.json({ success: true, config: record.metadata });
}

export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("system_health")
    .select("metadata")
    .eq("integration_name", "outreach_config")
    .single();

  const defaults = {
    platforms: {
      instagram: { enabled: true, daily_limit: 20 },
      linkedin: { enabled: true, daily_limit: 20 },
      facebook: { enabled: true, daily_limit: 20 },
      tiktok: { enabled: true, daily_limit: 20 },
    },
    total_daily_target: 80,
    schedule_time: "09:00",
    timezone: "Europe/Copenhagen",
    auto_followup: true,
    followup_day_3: true,
    followup_day_7: true,
    message_style: "professional and friendly",
    target_industries: [],
    exclude_contacted: true,
    pause_on_reply: true,
  };

  return NextResponse.json({ config: data?.metadata || defaults });
}
