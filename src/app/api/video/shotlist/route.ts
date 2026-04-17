import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_SONNET,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

interface ShotListInput {
  script: string;
  style_preset?: string;
  duration_seconds: number;
}

type ShotType = "a_roll" | "b_roll" | "text_overlay" | "transition";

interface Shot {
  shot_number: number;
  description: string;
  type: ShotType;
  duration: number;
  search_query: string;
}

interface ShotListOutput {
  shots: Shot[];
}

const SYSTEM_PROMPT = `You are a senior video editor and cinematographer who storyboards viral YouTube and TikTok content. You take a script and produce a production-ready shot list — exactly what the editor will cut together, in order.

SHOT TYPE TAXONOMY
- a_roll: main speaker/subject on camera (face visible, talking)
- b_roll: supporting footage that illustrates what's being said (products, landscapes, reactions, demos, graphics, screen recordings)
- text_overlay: a text-heavy moment — a stat on screen, a title card, a pull quote
- transition: a deliberate visual break between scenes (whoosh, zoom blur, glitch, cut to black)

SEARCH QUERY RULES
- Each shot must have a search_query the editor can paste into Pexels, Unsplash, or Storyblocks
- Queries should be SHORT (2-5 words), visual-first, and concrete ("woman typing on laptop", "slow motion water splash", "aerial city skyline sunset")
- For a_roll, use a descriptor of the speaker pose/emotion (e.g. "confident man speaking on camera")
- For text_overlay and transition, the query describes the abstract visual (e.g. "animated countdown numbers", "glitch transition effect")

PACING
- Average shot duration: 2-4 seconds for energetic content, 4-8 seconds for educational
- Total of all shot durations must equal the input duration_seconds (±0.5s)
- Alternate between a_roll and b_roll to maintain visual variety (no more than 2 a_roll shots back-to-back)
- Use transitions sparingly (every 3-5 shots)

OUTPUT FORMAT
Respond with ONLY raw JSON matching:
{
  "shots": [
    {
      "shot_number": 1,
      "description": "<what the viewer sees, 1-2 sentences>",
      "type": "a_roll" | "b_roll" | "text_overlay" | "transition",
      "duration": <seconds as number>,
      "search_query": "<short stock footage query>"
    }
  ]
}

No markdown. No commentary. JSON only.`;

export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await authSupabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: ShotListInput;
  try {
    body = (await request.json()) as ShotListInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.script || typeof body.script !== "string") {
    return NextResponse.json({ error: "script is required" }, { status: 400 });
  }
  const duration = Number(body.duration_seconds);
  if (!duration || duration <= 0) {
    return NextResponse.json(
      { error: "duration_seconds must be positive" },
      { status: 400 }
    );
  }

  const userPrompt = `Storyboard this script into a shot list.

SCRIPT:
"""
${body.script}
"""

TOTAL DURATION: ${duration} seconds
STYLE: ${body.style_preset ?? "modern / fast-paced"}

JSON only.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<ShotListOutput>(text);

    if (!parsed || !Array.isArray(parsed.shots)) {
      return NextResponse.json(
        { error: "Claude returned an invalid response", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const validTypes = new Set<ShotType>([
      "a_roll",
      "b_roll",
      "text_overlay",
      "transition",
    ]);

    const shots: Shot[] = parsed.shots
      .filter(
        (s): s is Shot =>
          !!s &&
          typeof s.description === "string" &&
          typeof s.search_query === "string" &&
          typeof s.duration === "number" &&
          validTypes.has(s.type as ShotType)
      )
      .map((s, idx) => ({
        shot_number: typeof s.shot_number === "number" ? s.shot_number : idx + 1,
        description: s.description,
        type: s.type,
        duration: Math.max(0.5, s.duration),
        search_query: s.search_query,
      }));

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_video_shotlist",
      description: `Shot list: ${shots.length} shots (${duration}s)`,
      profile_id: user.id,
      status: "completed",
      result: {
        shot_count: shots.length,
        duration_seconds: duration,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({ shots });
  } catch (err) {
    console.error("[video/shotlist] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { error: "Failed to generate shot list", detail: message },
      { status: 500 }
    );
  }
}
