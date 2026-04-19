/**
 * Remix-with-my-twist — takes a trending video transcript, keeps its proven
 * structural skeleton (hook → story → turn → CTA), and rewrites it in the
 * client's niche + voice with an optional twist angle.
 *
 * Saves the remixed script to content_scripts when a client_id is supplied,
 * and always logs via trinity_log for the history tab.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";

interface RemixResult {
  remixed_script: string;
  hook: string;
  cta: string;
  suggested_title: string;
  differences: string[];
  structure_kept: string;
  twist_applied: string;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const transcript = String(body.transcript || "").trim();
  const clientNiche = String(body.client_niche || "").trim();
  const clientVoice = String(body.client_voice || "professional, conversational").trim();
  const originalHook = String(body.original_hook || "").trim();
  const originalTitle = String(body.original_title || "").trim();
  const twistAngle = String(body.twist_angle || "").trim();
  const platform = String(body.platform || "tiktok").trim().toLowerCase();
  const clientId = body.client_id ? String(body.client_id) : null;

  if (!transcript || transcript.length < 20) {
    return NextResponse.json({ error: "transcript is required (min 20 chars)" }, { status: 400 });
  }

  const prompt = `You are a scriptwriter who remixes viral content. Take the reference transcript below — keep its PROVEN structural bones (hook archetype, story beats, information curve, CTA placement) — and rewrite it entirely in the client's voice for their niche with a unique twist.

REFERENCE ORIGINAL:
- Title: ${originalTitle || "(unknown)"}
- Hook: ${originalHook || "(inferred from transcript)"}
- Transcript:
"""
${transcript.slice(0, 8000)}
"""

CLIENT:
- Niche: ${clientNiche || "(not specified)"}
- Voice: ${clientVoice}
- Platform: ${platform}
${twistAngle ? `- Twist angle to apply: ${twistAngle}` : "- Twist: find a novel angle (contrarian take, personal insight, or industry-specific reframe)"}

Your job:
1. Identify the structural pattern of the original (e.g. "curiosity-hook → 3-mistake listicle → punchy CTA")
2. Keep that pattern
3. Completely rewrite the words, examples, and specifics so the new script is about the CLIENT's niche
4. Apply the twist so this feels fresh, not a copy
5. Make the hook hit in the first 2 seconds
6. End with a clear, platform-native CTA

Return ONLY valid JSON (no markdown) matching this schema:
{
  "remixed_script": "the full remixed script, ready to read aloud, 1 paragraph or clearly marked sections",
  "hook": "the new opening line (first 2-3 seconds)",
  "cta": "the new closing call-to-action",
  "suggested_title": "a platform-appropriate title for the remix",
  "differences": [
    "3-5 specific ways this differs from the original (content, angle, examples)"
  ],
  "structure_kept": "one sentence describing the structural pattern we preserved",
  "twist_applied": "one sentence describing the twist/angle applied"
}`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<RemixResult>(text);

    if (!parsed || !parsed.remixed_script) {
      return NextResponse.json({ error: "Failed to parse remix", raw: text.slice(0, 500) }, { status: 500 });
    }

    const result: RemixResult = {
      remixed_script: String(parsed.remixed_script || ""),
      hook: String(parsed.hook || ""),
      cta: String(parsed.cta || ""),
      suggested_title: String(parsed.suggested_title || originalTitle || "Remixed Script"),
      differences: Array.isArray(parsed.differences) ? parsed.differences.map(String).slice(0, 10) : [],
      structure_kept: String(parsed.structure_kept || ""),
      twist_applied: String(parsed.twist_applied || ""),
    };

    // Persist into content_scripts when we have a client context (content_scripts is
    // client-scoped, not user-scoped, per the existing schema). Otherwise fall back
    // to trinity_log which is what the "History" tab already reads.
    let scriptId: string | null = null;
    if (clientId) {
      const { data: inserted } = await supabase
        .from("content_scripts")
        .insert({
          client_id: clientId,
          title: result.suggested_title,
          script_type: "short_form",
          brand_voice: clientVoice,
          script_body: result.remixed_script,
          hook: result.hook,
          target_platform: platform,
          status: "draft",
        })
        .select("id")
        .single();
      scriptId = inserted?.id || null;
    }

    // Always log to trinity_log so it shows in History
    await supabase.from("trinity_log").insert({
      action_type: "script_generated",
      description: result.suggested_title,
      client_id: clientId,
      status: "completed",
      metadata: {
        source: "viral_remix",
        platform,
        niche: clientNiche,
        twist_angle: twistAngle,
        original_title: originalTitle,
        original_hook: originalHook,
        script: {
          title: result.suggested_title,
          hook: { text: result.hook, type: "remix" },
          cta: { text: result.cta },
          differences: result.differences,
          structure_kept: result.structure_kept,
          twist_applied: result.twist_applied,
          remixed_script: result.remixed_script,
        },
      },
    });

    return NextResponse.json({
      success: true,
      remix: result,
      script_id: scriptId,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
