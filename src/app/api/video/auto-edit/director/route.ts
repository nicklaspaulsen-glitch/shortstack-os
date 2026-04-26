import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, getResponseText, safeJsonParse } from "@/lib/ai/claude-helpers";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * POST /api/video/auto-edit/director
 *
 * "AI Director Brief" — given the current timeline state, produce a
 * strategic edit brief that reasons like a pro director/writer/producer.
 * NOT auto-edits the timeline. Just gives the editor 5-7 specific
 * notes + suggested cuts, transitions, B-roll inserts, pace changes.
 *
 * Body:
 *   {
 *     intent?: string,           // user's stated goal (e.g. "viral 60s reel")
 *     clips: Array<{
 *       id: string,
 *       kind: "video" | "audio" | "text" | "image",
 *       start: number,           // seconds
 *       duration: number,        // seconds
 *       label?: string,
 *     }>,
 *     total_duration: number,    // timeline length in seconds
 *     target_platform?: "youtube" | "tiktok" | "instagram_reel" | "shorts",
 *   }
 *
 * Returns:
 *   {
 *     hook_assessment: string,
 *     pacing_notes: Array<{ at_seconds: number, note: string, severity: "info" | "warn" | "important" }>,
 *     suggested_cuts: Array<{ at_seconds: number, why: string }>,
 *     suggested_inserts: Array<{ at_seconds: number, kind: "b_roll" | "text_overlay" | "transition" | "sfx", why: string }>,
 *     overall_grade: "A" | "B" | "C" | "D" | "F",
 *     overall_summary: string,
 *   }
 *
 * Auth required, rate-limited. Uses Haiku — strategic reasoning over a
 * structured timeline is well within Haiku's capability and keeps cost low.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkAiRateLimit(user.id);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.clips)) {
    return NextResponse.json({ error: "clips array required" }, { status: 400 });
  }

  const intent = String(body.intent || "general engagement").slice(0, 200);
  const totalDuration = Number(body.total_duration) || 0;
  const targetPlatform = String(body.target_platform || "youtube");
  const clips = (body.clips as Array<{
    id: string;
    kind: string;
    start: number;
    duration: number;
    label?: string;
  }>).slice(0, 50);

  // Build the timeline summary the model will reason over
  const timeline = clips
    .map((c, i) => {
      const start = formatTime(c.start);
      const end = formatTime(c.start + c.duration);
      return `  ${i + 1}. [${start}–${end}] ${c.kind}${c.label ? ` "${c.label.slice(0, 80)}"` : ""}`;
    })
    .join("\n");

  // Sub-task 5: AI Director — improved system prompt with pro-director pacing rules.
  // Adds explicit hook-in-3s, retention-cut-every-7s, audio-ducking, B-roll-on-claims rules.
  const prompt = `You are a senior video director + producer reviewing a rough cut. Think like a pro — Casey Neistat pace, MrBeast retention, Hormozi clarity.

Director principles to apply:
- Hook must land in the first 3 seconds or viewers scroll past.
- Pattern interrupt every 6-8 seconds to fight retention drop (cut, B-roll, text pop, SFX).
- Audio duck music under dialogue; raise it on transitions and pauses.
- Place B-roll on every key claim or statistic — talking-head alone loses attention fast.
- Outro call-to-action must appear in the final 20% of the runtime.
- Dead air over 1.5s is a cut opportunity.

Editor's intent: ${intent}
Target platform: ${targetPlatform}
Total runtime: ${formatTime(totalDuration)}

Timeline (${clips.length} clip${clips.length === 1 ? "" : "s"}):
${timeline}

Produce a strategic edit brief. Return ONLY a valid JSON object — no markdown fences — matching this shape:

{
  "hook_assessment": "<1-2 sentence read on whether the first 3 seconds will hook; cite exact timestamp if it misses>",
  "pacing_notes": [
    { "at_seconds": 0, "note": "...", "severity": "info" | "warn" | "important" }
  ],
  "suggested_cuts": [
    { "at_seconds": 0, "why": "..." }
  ],
  "suggested_inserts": [
    { "at_seconds": 0, "kind": "b_roll" | "text_overlay" | "transition" | "sfx", "why": "..." }
  ],
  "overall_grade": "A" | "B" | "C" | "D" | "F",
  "overall_summary": "<2-3 sentences — would this perform on ${targetPlatform}; single most important fix>"
}

Rules:
  - 3-5 pacing_notes total — flag every dead zone or pacing gap > 7s without a pattern interrupt
  - 2-4 suggested_cuts max — cut dead air and redundant intros first
  - 2-4 suggested_inserts max — prefer b_roll inserts on key claims
  - Use exact seconds from the timeline; vague timestamps are useless
  - severity="important" when the flaw would tank the first-30s retention
  - Don't sugarcoat — if the hook misses, say so and where`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = getResponseText(response);
    const parsed = safeJsonParse<{
      hook_assessment?: string;
      pacing_notes?: Array<{ at_seconds: number; note: string; severity: string }>;
      suggested_cuts?: Array<{ at_seconds: number; why: string }>;
      suggested_inserts?: Array<{ at_seconds: number; kind: string; why: string }>;
      overall_grade?: string;
      overall_summary?: string;
    }>(raw);

    if (!parsed || !parsed.hook_assessment) {
      return NextResponse.json(
        { error: "AI returned an unparseable response — please try again" },
        { status: 502 },
      );
    }

    // Sanitize — clamp bounds, normalize types
    const allowedSeverity = new Set(["info", "warn", "important"]);
    const allowedInsertKind = new Set(["b_roll", "text_overlay", "transition", "sfx"]);
    const allowedGrade = new Set(["A", "B", "C", "D", "F"]);

    const result = {
      hook_assessment: String(parsed.hook_assessment || "").slice(0, 400),
      pacing_notes: (parsed.pacing_notes || []).slice(0, 6).map((p) => ({
        at_seconds: Math.max(0, Number(p.at_seconds) || 0),
        note: String(p.note || "").slice(0, 200),
        severity: allowedSeverity.has(p.severity) ? p.severity : "info",
      })),
      suggested_cuts: (parsed.suggested_cuts || []).slice(0, 5).map((c) => ({
        at_seconds: Math.max(0, Number(c.at_seconds) || 0),
        why: String(c.why || "").slice(0, 200),
      })),
      suggested_inserts: (parsed.suggested_inserts || []).slice(0, 5).map((s) => ({
        at_seconds: Math.max(0, Number(s.at_seconds) || 0),
        kind: allowedInsertKind.has(s.kind) ? s.kind : "b_roll",
        why: String(s.why || "").slice(0, 200),
      })),
      overall_grade: allowedGrade.has(parsed.overall_grade || "")
        ? parsed.overall_grade
        : "C",
      overall_summary: String(parsed.overall_summary || "").slice(0, 500),
    };

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: `Director error: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
