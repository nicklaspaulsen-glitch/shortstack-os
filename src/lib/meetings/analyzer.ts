/**
 * Claude-based transcript analyzer.
 *
 * Given a raw transcript, returns structured `{summary, action_items,
 * decisions, key_moments}` JSON. Uses prompt caching on the (large) system
 * instruction so repeated analyses across a session hit the 90% cache
 * discount.
 */
import { anthropic, MODEL_SONNET, getResponseText, safeJsonParse } from "@/lib/ai/claude-helpers";

export interface ActionItem {
  id?: string;
  assignee: string;
  text: string;
  due?: string | null;
  done?: boolean;
}

export interface Decision {
  text: string;
  context?: string;
}

export interface KeyMoment {
  ts: number;
  label: string;
}

export interface MeetingAnalysis {
  summary: string;
  action_items: ActionItem[];
  decisions: Decision[];
  key_moments: KeyMoment[];
}

const SYSTEM_PROMPT = `You are an elite meeting-notes analyst for a marketing / creative-agency platform. Your job is to take a raw meeting transcript (with optional speaker labels and timestamps) and return a single JSON object that captures the most decision-useful signal in the conversation.

The downstream UI renders four things: a short summary paragraph, a checkbox list of action items, a prominent "decisions" callout, and clickable timestamp chips that jump to "key moments" in the recording. Your output feeds those exact surfaces.

### Output contract (strict JSON, no prose, no code fences)

{
  "summary": string,         // 3-6 sentence plain-English recap. Lead with the business outcome, not the attendee names.
  "action_items": [
    {
      "id": string,          // short stable id: slug of the text, 3-6 words, a-z0-9-
      "assignee": string,    // "Speaker 1" / "Speaker 2" / an actual name if stated; "Unassigned" if ambiguous
      "text": string,        // imperative sentence: "Draft the Q3 content calendar"
      "due": string | null,  // ISO date (YYYY-MM-DD) if the transcript states a deadline; else null
      "done": false
    }
  ],
  "decisions": [
    {
      "text": string,        // one sentence: "We will move the launch from Apr 30 to May 7."
      "context": string      // one sentence giving the rationale discussed
    }
  ],
  "key_moments": [
    {
      "ts": number,          // seconds from start of recording, integer
      "label": string        // short 3-8 word label: "Decision to postpone launch"
    }
  ]
}

### Quality rules

- Action items must be real commitments ("Nicklas will send revised brief by Friday"), not general talking points.
- If a deadline is relative ("by Friday"), convert it to an absolute ISO date using the meeting_date injected in the user message. If you genuinely cannot resolve it, leave due = null.
- Decisions are discrete agreed-upon outcomes. "We talked about X" is not a decision. "We decided to do X" is.
- Key moments should be 3-8 for a typical 30-60 min meeting. Focus on turning points: decisions made, blockers surfaced, numbers introduced, important handoffs. Don't just index every topic.
- Prefer specific names from the transcript over "Speaker 1" where possible.
- Timestamps: if the transcript provides per-segment start times, use them directly. If it's plain text with no timestamps, return an empty key_moments array rather than inventing times.

### Hard rules

- Return ONLY the JSON object. No markdown. No commentary. No code fences.
- Every field above is required. Use empty strings / arrays when a section has no content, not null.
- Do not hallucinate attendees, deadlines, or decisions that aren't in the transcript. When in doubt, omit.`;

export async function analyzeTranscript(
  transcript: string,
  opts?: { meetingDate?: string; segments?: Array<{ start: number; end: number; speaker?: string; text: string }> },
): Promise<MeetingAnalysis> {
  const meetingDate = opts?.meetingDate || new Date().toISOString().slice(0, 10);

  // If segment-level data is provided, include a compact representation so the
  // model can anchor key_moments to real timestamps.
  const segmentBlock = opts?.segments?.length
    ? `\n\n### Timestamped segments (use these for key_moments ts)\n` +
      opts.segments
        .map(
          (s) =>
            `[${Math.round(s.start)}s] ${s.speaker ? `${s.speaker}: ` : ""}${s.text}`,
        )
        .join("\n")
    : "";

  const userMessage = `meeting_date: ${meetingDate}

### Raw transcript
${transcript}${segmentBlock}

Return the JSON object defined in the system prompt.`;

  const response = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4000,
    // Prompt caching: the system block is large and static — mark it ephemeral
    // so repeated analyses across a session hit the cache.
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const text = getResponseText(response);
  const parsed = safeJsonParse<MeetingAnalysis>(text);
  if (!parsed) {
    throw new Error("Claude returned non-JSON output");
  }

  return {
    summary: parsed.summary || "",
    action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    key_moments: Array.isArray(parsed.key_moments) ? parsed.key_moments : [],
  };
}
