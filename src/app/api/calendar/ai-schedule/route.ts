import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

const SYSTEM_PROMPT = `You are a scheduling expert. Given a meeting purpose, participant timezones, existing busy slots, and preferences, recommend 3 optimal meeting time slots.

Factors to consider:
- Timezone fairness (avoid early morning / late night in any timezone)
- Meeting type (discovery calls work better mid-morning; focus sessions work better when fresh)
- Day of week (Tuesday-Thursday are typically best)
- Don't schedule back-to-back with other meetings
- Buffer time for prep (15 min before/after important meetings)
- Avoid lunch hours (12-1pm local)

Return JSON only:
{
  "recommendations": [
    {
      "start_iso": "2026-04-20T14:00:00Z",
      "end_iso": "2026-04-20T14:30:00Z",
      "reason": "Mid-morning for East Coast, early afternoon for Europe — ideal for discovery calls"
    }
  ],
  "best_pick": 0,
  "notes": "Brief scheduling notes"
}`;

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkAiRateLimit(user.id);
  if (limited) return limited;

  const body = await req.json();
  const { meeting_type, duration_minutes, participant_timezones, busy_slots, preferences } = body;

  if (!meeting_type) {
    return NextResponse.json({ error: "meeting_type required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const prompt = `Schedule optimal meeting times.

Meeting type: ${meeting_type}
Duration: ${duration_minutes || 30} minutes
Current time: ${now}
Participant timezones: ${(participant_timezones || ["America/New_York"]).join(", ")}
${Array.isArray(busy_slots) && busy_slots.length ? `Busy slots:\n${busy_slots.map((b: { start: string; end: string }) => `  ${b.start} → ${b.end}`).join("\n")}` : "No conflicts."}
${preferences ? `Preferences: ${preferences}` : ""}

Recommend 3 slots in the next 7 business days. Return absolute UTC timestamps.`;

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 800,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: prompt }],
    });

    const text = getResponseText(resp);
    const parsed = safeJsonParse<{ recommendations: Array<{ start_iso: string; end_iso: string; reason: string }>; best_pick: number; notes: string }>(text);

    if (!parsed || !Array.isArray(parsed.recommendations)) {
      return NextResponse.json({ error: "AI returned invalid format" }, { status: 502 });
    }

    return NextResponse.json({ success: true, ...parsed });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
