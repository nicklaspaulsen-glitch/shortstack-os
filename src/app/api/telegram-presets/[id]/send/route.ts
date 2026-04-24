import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { sendTelegramMessage } from "@/lib/services/trinity";

export const dynamic = "force-dynamic";

// POST /api/telegram-presets/[id]/send
// Body: { chat_id?: string, variables?: Record<string, string> }
//
// Renders the preset body by substituting {{var}} tokens with provided
// variables (missing keys are left as-is so the UI can show them), then
// sends to the requested chat_id (or TELEGRAM_CHAT_ID env fallback for
// quick admin tests). On success increments sent_count + last_sent_at;
// on failure increments error_count. Mirrors the result to trinity_log
// so the unified activity feed picks it up.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = createServerSupabase();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = (await getEffectiveOwnerId(auth, user.id)) ?? user.id;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional — default to env chat_id with no variables.
    body = {};
  }

  const requestedChat = typeof body.chat_id === "string" ? body.chat_id.trim() : "";
  const chatId = requestedChat.length > 0 ? requestedChat : process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    return NextResponse.json(
      { error: "No chat_id provided and TELEGRAM_CHAT_ID is not configured" },
      { status: 400 }
    );
  }

  const rawVars = body.variables;
  const vars: Record<string, string> =
    rawVars && typeof rawVars === "object" && !Array.isArray(rawVars)
      ? Object.fromEntries(
          Object.entries(rawVars as Record<string, unknown>).map(([k, v]) => [
            k,
            typeof v === "string" ? v : v === null || v === undefined ? "" : String(v),
          ])
        )
      : {};

  const service = createServiceClient();
  const { data: preset, error: fetchErr } = await service
    .from("telegram_presets")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchErr) {
    console.error("[telegram-presets/:id/send] fetch error:", fetchErr);
    return NextResponse.json({ error: "Failed to load preset" }, { status: 500 });
  }
  if (!preset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Readable by owner or for global defaults.
  if (preset.user_id !== null && preset.user_id !== ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (preset.active === false) {
    return NextResponse.json({ error: "Preset is inactive" }, { status: 400 });
  }

  // Render the body — {{var}} with optional surrounding whitespace.
  // Missing vars are preserved so the sender can see what went unsubstituted.
  const rendered = String(preset.body ?? "").replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_match: string, key: string) => {
      return vars[key] ?? `{{${key}}}`;
    }
  );

  const result = await sendTelegramMessage(chatId, rendered);

  // Update counters (only on user-owned rows — global defaults stay read-only).
  const now = new Date().toISOString();
  if (preset.user_id !== null) {
    const patch: Record<string, unknown> = { updated_at: now };
    if (result.ok) {
      patch.sent_count = (preset.sent_count ?? 0) + 1;
      patch.last_sent_at = now;
    } else {
      patch.error_count = (preset.error_count ?? 0) + 1;
    }
    await service.from("telegram_presets").update(patch).eq("id", preset.id);
  }

  // Mirror to trinity_log for the live activity feed.
  await service.from("trinity_log").insert({
    agent: "telegram",
    action_type: "telegram_preset_send",
    description: `Sent preset "${preset.name}" (${preset.category})`,
    status: result.ok ? "completed" : "failed",
    result: {
      preset_id: preset.id,
      category: preset.category,
      chat_id: chatId,
      message: rendered,
      success: result.ok,
    },
  });

  return NextResponse.json({
    success: result.ok,
    message: rendered,
    chat_id: chatId,
  });
}
