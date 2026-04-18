import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/services/trinity";

export const dynamic = "force-dynamic";

// POST /api/telegram/routines/[id]/run-now — fire the routine right now as a test.
// Renders the stored template (substituting any known variables) and sends it
// via Telegram, then updates run counters and last_message on the routine.
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = createServerSupabase();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: routine } = await service
    .from("telegram_routines")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!routine) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (routine.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    return NextResponse.json(
      { error: "No TELEGRAM_CHAT_ID configured" },
      { status: 400 }
    );
  }

  // Render the template with basic variable substitution.
  const today = new Date();
  const variables: Record<string, string> = {
    today_date: today.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    }),
    routine_name: routine.name,
    client_name: "",
    lead_count: "0",
    deal_value: "0",
  };
  let text =
    typeof routine.message_template === "string" && routine.message_template.length > 0
      ? routine.message_template
      : `Test from routine: ${routine.name}`;
  text = text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match: string, key: string) => {
    return variables[key] ?? `{{${key}}}`;
  });

  const result = await sendTelegramMessage(chatId, text);

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    last_run_at: now,
    run_count: (routine.run_count ?? 0) + 1,
    last_message: text,
    updated_at: now,
  };
  if (result.ok) {
    patch.success_count = (routine.success_count ?? 0) + 1;
  } else {
    patch.fail_count = (routine.fail_count ?? 0) + 1;
  }
  await service.from("telegram_routines").update(patch).eq("id", routine.id);

  // Mirror to trinity_log so the "Live Activity" tab can pick it up.
  await service.from("trinity_log").insert({
    agent: "telegram",
    action_type: `telegram_${routine.routine_type || "custom"}`,
    description: `Routine "${routine.name}" run manually`,
    status: result.ok ? "completed" : "failed",
    result: {
      routine_id: routine.id,
      message: text,
      success: result.ok,
    },
  });

  return NextResponse.json({ success: result.ok, message: text });
}
