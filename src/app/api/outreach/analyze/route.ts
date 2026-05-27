import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * POST — Analyze a single outreach conversation with Claude.
 * Returns sentiment, intent, topics, next-best-reply, and summary.
 */

const SYSTEM_PROMPT = `You are a sales conversation analyst. Given an outreach message and any reply, analyze the engagement.

Return strict JSON only:
{
  "sentiment": "positive" | "neutral" | "negative" | "no_reply",
  "sentiment_score": -100 to 100,
  "intent": "interested" | "curious" | "objection" | "not_interested" | "ghosted" | "ready_to_buy" | "needs_info",
  "intent_confidence": 0 to 100,
  "win_probability": 0 to 100,
  "key_signals": ["string"],
  "objections": ["string"],
  "topics": ["string"],
  "recommended_action": "follow_up" | "book_call" | "send_info" | "disqualify" | "nurture" | "close",
  "next_reply_draft": "Draft a 2-3 sentence reply tailored to the context. Empty string if no reply makes sense.",
  "summary": "one-line analyst summary",
  "urgency": "high" | "medium" | "low"
}`;

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkAiRateLimit(user.id);
  if (limited) return limited;

  const body = await req.json();
  const { entry_id } = body;
  if (!entry_id) return NextResponse.json({ error: "entry_id required" }, { status: 400 });

  // OWNERSHIP: outreach_entries has no user_id column — ownership is indirect
  // via lead_id → leads.user_id. No migration exists in supabase/migrations/
  // (table was created via dashboard). The auth-scoped supabase client enforces
  // RLS on both SELECT and UPDATE, which is the correct isolation mechanism for
  // indirect ownership. Adding an explicit user_id filter is not possible here.
  const { data: entry, error } = await supabase
    .from("outreach_entries")
    .select("id, platform, business_name, recipient_handle, message_text, reply_text, status, sent_at, replied_at, metadata")
    .eq("id", entry_id)
    .single();

  if (error || !entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const userPrompt = `Analyze this outreach:

BUSINESS: ${entry.business_name}
PLATFORM: ${entry.platform}
STATUS: ${entry.status}

OUR MESSAGE (sent ${entry.sent_at || "not sent"}):
"${entry.message_text || "(no message content)"}"

REPLY:
${entry.reply_text ? `"${entry.reply_text}"` : "(no reply yet)"}

Analyze and return structured JSON.`;

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 1000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = getResponseText(resp);
    const parsed = safeJsonParse<{
      sentiment: string;
      sentiment_score: number;
      intent: string;
      intent_confidence: number;
      win_probability: number;
      key_signals: string[];
      objections: string[];
      topics: string[];
      recommended_action: string;
      next_reply_draft: string;
      summary: string;
      urgency: string;
    }>(text);

    if (!parsed) return NextResponse.json({ error: "AI returned invalid format" }, { status: 502 });

    // Cache analysis back to entry metadata.
    // SECURITY: Use the auth-scoped supabase client (not service client) so RLS
    // restricts the UPDATE to entries the caller owns. Previously the service
    // client was used with no ownership filter, allowing any authenticated user
    // to overwrite another tenant's outreach_entries metadata.
    try {
      const existingMetadata = (entry.metadata as Record<string, unknown>) || {};
      await supabase
        .from("outreach_entries")
        .update({
          metadata: { ...existingMetadata, ai_analysis: parsed, ai_analyzed_at: new Date().toISOString() },
        })
        .eq("id", entry_id);

      const service = createServiceClient();
      void service.from("trinity_log").insert({
        user_id: user.id,
        action_type: "ai_outreach_analyze",
        description: `Analyzed ${entry.platform} outreach: ${entry.business_name}`,
        status: "completed",
        metadata: { entry_id, sentiment: parsed.sentiment, win_probability: parsed.win_probability },
      });
    } catch (cacheErr) {
      console.error("[outreach/analyze] failed to cache analysis for entry", entry_id, cacheErr);
    }

    return NextResponse.json({ success: true, analysis: parsed });
  } catch (err) {
    console.error("[outreach/analyze] AI analysis failed for entry", entry_id, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
