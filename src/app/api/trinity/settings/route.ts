/**
 * Trinity autonomous settings.
 *
 *  GET  — returns the current user's settings (creates default row if none).
 *  PUT  — upsert settings.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  ALL_ACTION_TYPES,
  type TrinityActionType,
  type TrinityMode,
} from "@/lib/trinity/autonomous";

interface PutBody {
  mode?: unknown;
  enabled_actions?: unknown;
  veto_window_hours?: unknown;
  daily_brief_email?: unknown;
}

const ALLOWED_MODES = new Set<TrinityMode>(["off", "shadow", "autopilot"]);
const ALL_ACTIONS_SET: Set<TrinityActionType> = new Set(ALL_ACTION_TYPES);

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("trinity_settings")
    .select(
      "user_id, mode, enabled_actions, veto_window_hours, daily_brief_email, updated_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[trinity/settings] load error", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      settings: {
        user_id: user.id,
        mode: "shadow" as TrinityMode,
        enabled_actions: [] as TrinityActionType[],
        veto_window_hours: 4,
        daily_brief_email: null,
        updated_at: null,
      },
      action_types: ALL_ACTION_TYPES,
    });
  }

  return NextResponse.json({
    settings: data,
    action_types: ALL_ACTION_TYPES,
  });
}

export async function PUT(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (body.mode !== undefined) {
    if (typeof body.mode !== "string" || !ALLOWED_MODES.has(body.mode as TrinityMode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }
    updates.mode = body.mode;
  }

  if (body.enabled_actions !== undefined) {
    if (!Array.isArray(body.enabled_actions)) {
      return NextResponse.json(
        { error: "enabled_actions must be an array" },
        { status: 400 },
      );
    }
    const cleaned: TrinityActionType[] = [];
    for (const a of body.enabled_actions) {
      if (typeof a === "string" && ALL_ACTIONS_SET.has(a as TrinityActionType)) {
        cleaned.push(a as TrinityActionType);
      }
    }
    updates.enabled_actions = Array.from(new Set(cleaned));
  }

  if (body.veto_window_hours !== undefined) {
    const n = Number(body.veto_window_hours);
    if (!Number.isFinite(n) || n < 0 || n > 72) {
      return NextResponse.json(
        { error: "veto_window_hours must be 0..72" },
        { status: 400 },
      );
    }
    updates.veto_window_hours = Math.floor(n);
  }

  if (body.daily_brief_email !== undefined) {
    if (body.daily_brief_email === null || body.daily_brief_email === "") {
      updates.daily_brief_email = null;
    } else if (
      typeof body.daily_brief_email === "string" &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.daily_brief_email)
    ) {
      updates.daily_brief_email = body.daily_brief_email;
    } else {
      return NextResponse.json(
        { error: "daily_brief_email must be a valid email or empty" },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabase
    .from("trinity_settings")
    .upsert(updates, { onConflict: "user_id" })
    .select(
      "user_id, mode, enabled_actions, veto_window_hours, daily_brief_email, updated_at",
    )
    .single();

  if (error || !data) {
    console.error("[trinity/settings] upsert error", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
