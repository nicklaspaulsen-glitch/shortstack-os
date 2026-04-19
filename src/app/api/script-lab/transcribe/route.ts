/**
 * Video transcript fetcher.
 *
 * Attempts real YouTube transcript fetch for YouTube URLs via the public
 * timedtext endpoint. Falls back to Claude-generated "likely" transcript
 * based on title/creator when the real transcript is unavailable or the
 * video is on TikTok / Instagram (no public transcript endpoint).
 *
 * Response: { transcript, is_estimated, source, video_id? }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { anthropic, MODEL_HAIKU, getResponseText } from "@/lib/ai/claude-helpers";

function extractYouTubeId(url: string): string | null {
  // Handles youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, youtube.com/embed/ID
  const patterns = [
    /(?:youtube\.com\/watch\?(?:[^&]*&)*v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function detectPlatform(url: string): "youtube" | "tiktok" | "instagram" | "unknown" {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("instagram.com")) return "instagram";
  return "unknown";
}

/** Parse YouTube's timedtext XML into a plain transcript string. */
function parseTimedTextXml(xml: string): string {
  // <text start="1.2" dur="2.3">captions go here</text>
  const textRe = /<text[^>]*>([\s\S]*?)<\/text>/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = textRe.exec(xml)) !== null) {
    const raw = m[1]
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    if (raw) out.push(raw);
  }
  return out.join(" ");
}

async function tryFetchYouTubeTranscript(videoId: string): Promise<string | null> {
  // Try a few language/format combos. The public timedtext endpoint doesn't always
  // respond — it requires the video to have captions and be publicly transcribable.
  const tries = [
    `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`,
    `https://www.youtube.com/api/timedtext?lang=en-US&v=${videoId}`,
    `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=srv3`,
  ];
  for (const url of tries) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ShortStackOS/1.0)",
          Accept: "text/xml,application/xml,*/*",
        },
        // 8s timeout via AbortController
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      if (!xml || xml.length < 50) continue;
      const parsed = parseTimedTextXml(xml);
      if (parsed && parsed.length > 20) return parsed;
    } catch {
      // try next
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const videoUrl = String(body.video_url || "").trim();
  const title = String(body.title || "").trim();
  const creatorName = String(body.creator_name || "").trim();
  const hook = String(body.hook || "").trim();
  const platformHint = String(body.platform || "").trim().toLowerCase();

  if (!videoUrl && !title) {
    return NextResponse.json({ error: "video_url or title is required" }, { status: 400 });
  }

  const platform = platformHint || (videoUrl ? detectPlatform(videoUrl) : "unknown");

  // 1. Try real transcript for YouTube
  if (platform === "youtube" && videoUrl) {
    const videoId = extractYouTubeId(videoUrl);
    if (videoId) {
      const real = await tryFetchYouTubeTranscript(videoId);
      if (real) {
        return NextResponse.json({
          success: true,
          transcript: real,
          is_estimated: false,
          source: "youtube_timedtext",
          video_id: videoId,
          platform,
        });
      }
    }
  }

  // 2. Fall back to Claude-generated plausible transcript
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured and no real transcript available" }, { status: 500 });
  }

  const prompt = `You are a content transcriber. Produce a plausible, realistic transcript for the short-form / long-form video described below. This transcript is an AI estimate — it should match the style, rhythm, and talking points that the title + hook + creator suggest.

PLATFORM: ${platform || "unknown"}
TITLE: ${title || "(not provided)"}
CREATOR: ${creatorName || "(not provided)"}
HOOK: ${hook || "(not provided)"}
URL: ${videoUrl || "(not provided)"}

Write the transcript as a clean paragraph of spoken dialogue (no timestamps, no [MUSIC] tags, no speaker labels). Roughly:
- TikTok / Reels / Shorts: 60-150 words
- YouTube long-form: 400-800 words

Match the platform's vernacular. First-person where natural. Keep the hook as the opening line if provided. End with a natural CTA or sign-off.

Return ONLY the transcript text — no prose, no meta commentary, no quotes around it.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const transcript = getResponseText(response).trim();
    if (!transcript) {
      return NextResponse.json({ error: "Failed to generate transcript" }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      transcript,
      is_estimated: true,
      source: "claude_estimated",
      platform,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
