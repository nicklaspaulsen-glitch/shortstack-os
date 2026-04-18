import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Known routine types the UI understands; custom allowed.
const ALLOWED_TYPES = new Set([
  "daily_brief",
  "lead_finder_done",
  "outreach_report",
  "retention_check",
  "invoice_chase",
  "revenue_alert",
  "downtime_alert",
  "content_published",
  "appointment_reminder",
  "weekly_financial_summary",
  "custom",
]);

// GET /api/telegram/routines — list the caller's telegram routines
export async function GET(_request: NextRequest) {
  const auth = createServerSupabase();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("telegram_routines")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[telegram/routines] GET error:", error);
    return NextResponse.json({ error: "Failed to list routines" }, { status: 500 });
  }

  return NextResponse.json({ routines: data ?? [] });
}

// POST /api/telegram/routines — create a new routine for the caller
export async function POST(request: NextRequest) {
  const auth = createServerSupabase();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const routine_type =
    typeof body.routine_type === "string" ? body.routine_type.trim() : "custom";
  const schedule =
    typeof body.schedule === "string" && body.schedule.trim().length > 0
      ? body.schedule.trim()
      : "manual";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(routine_type)) {
    return NextResponse.json({ error: "Unknown routine_type" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("telegram_routines")
    .insert({
      user_id: user.id,
      name,
      description: typeof body.description === "string" ? body.description : null,
      routine_type,
      schedule,
      enabled: body.enabled === undefined ? true : Boolean(body.enabled),
      paused: Boolean(body.paused),
      message_template:
        typeof body.message_template === "string" ? body.message_template : null,
      conditions:
        body.conditions && typeof body.conditions === "object"
          ? body.conditions
          : {},
    })
    .select("*")
    .single();

  if (error) {
    console.error("[telegram/routines] POST error:", error);
    return NextResponse.json({ error: "Failed to create routine" }, { status: 500 });
  }

  return NextResponse.json({ routine: data });
}
