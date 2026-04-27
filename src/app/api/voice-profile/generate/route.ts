/**
 * POST /api/voice-profile/generate
 *
 * Body: { subjectKind: "user" | "client" | "team_member", subjectId: string, prompt: string }
 *
 * Generate a piece of copy in the requested subject's voice. Used by the
 * client-detail "Generate copy in their voice" button. Calls the LLM
 * router with voice-profile injection + humanize on.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { callLLMHumanized } from "@/lib/ai/call-llm-humanized";

export const dynamic = "force-dynamic";

interface GenerateBody {
  subjectKind?: unknown;
  subjectId?: unknown;
  prompt?: unknown;
  channel?: unknown;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subjectKind =
    body.subjectKind === "client" || body.subjectKind === "team_member"
      ? body.subjectKind
      : body.subjectKind === "user"
      ? "user"
      : null;
  if (!subjectKind) {
    return NextResponse.json(
      { error: "subjectKind must be 'user' | 'client' | 'team_member'" },
      { status: 400 },
    );
  }
  if (typeof body.subjectId !== "string" || !body.subjectId) {
    return NextResponse.json({ error: "subjectId required" }, { status: 400 });
  }
  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  // Ownership checks: user-kind subject must be the caller; client must be
  // owned by the caller.
  if (subjectKind === "user" && body.subjectId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (subjectKind === "client") {
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", body.subjectId)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
  }

  const channel =
    body.channel === "email" || body.channel === "sms" || body.channel === "dm" ||
    body.channel === "social" || body.channel === "doc" || body.channel === "voice_script"
      ? body.channel
      : "doc";

  const result = await callLLMHumanized({
    taskType: "generation_short",
    systemPrompt:
      "Write a short piece of copy that matches the supplied voice context as closely as possible. Plain text only, no markdown, no commentary.",
    userPrompt: body.prompt.slice(0, 2000),
    maxTokens: 600,
    temperature: 0.7,
    userId: user.id,
    context: "/api/voice-profile/generate",
    voiceProfile: { subjectKind, subjectId: body.subjectId },
    humanize: true,
    channel,
  });

  return NextResponse.json({
    text: result.text,
    cost_usd: result.costUsd,
    voice_used: result.voiceUsed,
  });
}
