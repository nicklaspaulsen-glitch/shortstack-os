import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Outreach Configuration — Save/Load full outreach hub config
// Stores: campaigns, templates (call/sms/email/dm), channel settings,
// global AI settings, daily limits, compliance, sequences, targeting
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const config = await request.json();

    // Store full config in system_health as a settings record
    const { data: existing } = await supabase
      .from("system_health")
      .select("id")
      .eq("integration_name", "outreach_config")
      .single();

    const record = {
      integration_name: "outreach_config",
      status: "healthy" as const,
      metadata: {
        // Campaigns
        campaigns: config.campaigns || [],
        // Templates per channel
        call_templates: config.call_templates || [],
        sms_templates: config.sms_templates || [],
        email_templates: config.email_templates || [],
        dm_templates: config.dm_templates || [],
        // Channel settings
        call_settings: config.call_settings || {},
        sms_settings: config.sms_settings || {},
        email_settings: config.email_settings || {},
        dm_settings: config.dm_settings || {},
        // Global AI
        global_settings: config.global_settings || {},
        // Limits & compliance
        daily_limits: config.daily_limits || {},
        compliance: config.compliance || {},
        // Sequences
        sequences: config.sequences || [],
        // Targeting / audiences
        saved_audiences: config.saved_audiences || [],
        // Legacy fields (backward compat)
        platforms: config.platforms || {},
        total_daily_target: config.total_daily_target || 80,
        schedule_time: config.schedule_time || "09:00",
        timezone: config.timezone || "America/New_York",
        // Metadata
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      last_check_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from("system_health").update(record).eq("id", existing.id);
    } else {
      await supabase.from("system_health").insert(record);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[outreach/configure] Error:", err);
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
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

  if (data?.metadata) {
    return NextResponse.json({ config: data.metadata });
  }

  // Return empty config — the page will use its own defaults
  return NextResponse.json({ config: null });
}
