import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { callLLM } from "@/lib/ai/llm-router";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * POST /api/ai/inline-assist
 *
 * Backs the <AiAssistButton /> drop-in component. Takes a structured intent
 * + optional context and returns a single AI-written string for the field.
 *
 * Body:
 *   {
 *     intent: string,                  // e.g. "email subject line"
 *     current_value?: string | null,   // what's currently in the field
 *     hint?: string | null,            // user's free-text steering
 *     context?: Record<string, ...>,   // serialized into prompt
 *     max_chars?: number | null        // target length
 *   }
 *
 * Returns:
 *   { text: string }
 *
 * Auth required (any authenticated user). Rate-limited via checkAiRateLimit.
 * Uses Haiku — cheap and plenty for this kind of one-shot.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: this is potentially called many times per page so keep it tight.
  const limited = checkAiRateLimit(user.id);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.intent !== "string" || !body.intent.trim()) {
    return NextResponse.json(
      { error: "intent is required" },
      { status: 400 },
    );
  }

  const intent = String(body.intent).slice(0, 200);
  const currentValue = body.current_value ? String(body.current_value).slice(0, 4000) : null;
  const hint = body.hint ? String(body.hint).slice(0, 500) : null;
  const maxChars =
    typeof body.max_chars === "number" && body.max_chars > 0
      ? Math.min(body.max_chars, 4000)
      : null;
  const context: Record<string, unknown> | null =
    body.context && typeof body.context === "object" ? body.context : null;

  // Build the prompt — keep it tight so Haiku stays fast.
  const lines: string[] = [];
  lines.push(`Write a ${intent}.`);
  if (maxChars) lines.push(`Target length: under ${maxChars} characters.`);
  lines.push(
    `Output ONLY the text. No commentary, no markdown fences, no quotes around the result.`,
  );
  if (context) {
    lines.push(`\nContext:\n${formatContext(context)}`);
  }
  if (currentValue) {
    lines.push(
      `\nCurrent draft (rewrite or improve, keep what works):\n"${currentValue}"`,
    );
  }
  if (hint) {
    lines.push(`\nUser steering: ${hint}`);
  }

  try {
    const response = await callLLM({
      // Generic short polish task — Haiku-tier routing.
      taskType: "polish_copy",
      userPrompt: lines.join("\n"),
      maxTokens: maxChars ? Math.min(Math.ceil(maxChars / 3) + 50, 1024) : 600,
      userId: user.id,
      context: "/api/ai/inline-assist",
    });

    let text = response.text.trim();

    // Defensive cleanup — strip leading/trailing quotes the model sometimes adds
    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      text = text.slice(1, -1).trim();
    }
    // Strip residual markdown-fence pollution
    text = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();

    if (!text) {
      return NextResponse.json(
        { error: "AI returned an empty response, please try again" },
        { status: 502 },
      );
    }

    if (maxChars && text.length > maxChars) {
      text = text.slice(0, maxChars).trim();
    }

    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json(
      { error: `AI error: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}

function formatContext(ctx: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(ctx)) {
    if (v == null || v === "") continue;
    const safeKey = String(k).slice(0, 64);
    const safeVal = String(v).slice(0, 500);
    lines.push(`  ${safeKey}: ${safeVal}`);
  }
  return lines.join("\n");
}
