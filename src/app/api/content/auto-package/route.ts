import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";

/**
 * POST /api/content/auto-package
 *
 * "Drop & Go" AI auto-packager. Takes an uploaded file URL + metadata,
 * optionally pulls the caller's onboarding data from profiles/clients,
 * and asks Claude Haiku to produce a full multi-platform content package:
 *   - titles per platform
 *   - descriptions per platform
 *   - hashtags per platform
 *   - best_times per platform
 *   - suggested_caption_variations (3)
 *
 * Persists the result to the content_packages table and returns the row.
 *
 * Body: { file_url, file_type?, mime_type?, file_name?, user_context?, client_id? }
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { file_url, file_type, mime_type, file_name, user_context, client_id } = body || {};

  if (!file_url) {
    return NextResponse.json({ error: "file_url required" }, { status: 400 });
  }

  // Pull onboarding/brand context from profiles.metadata or clients.metadata
  // (our codebase stores onboarding_data under metadata.onboarding).
  let brandContext = "";
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("metadata, business_name, role")
      .eq("id", user.id)
      .single();
    const profileMeta = (profile?.metadata || {}) as Record<string, unknown>;
    const onboarding = (profileMeta.onboarding || profileMeta.onboarding_data) as
      | Record<string, unknown>
      | undefined;
    if (onboarding) {
      brandContext = `\nBrand/onboarding context: ${JSON.stringify(onboarding).slice(0, 2000)}`;
    }

    if (!brandContext && client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("business_name, industry, metadata")
        .eq("id", client_id)
        .single();
      if (client) {
        const cm = (client.metadata || {}) as Record<string, unknown>;
        const cOnb = (cm.onboarding || cm.onboarding_data) as Record<string, unknown> | undefined;
        brandContext = `\nClient: ${client.business_name || "-"}${client.industry ? `, industry: ${client.industry}` : ""}${cOnb ? `, onboarding: ${JSON.stringify(cOnb).slice(0, 1500)}` : ""}`;
      }
    }
  } catch {
    // ignore — brand context is optional
  }

  const resolvedMime = mime_type || "";
  const resolvedType = file_type || "";
  const contentKind = classifyContent(resolvedMime, resolvedType, file_name);

  const systemPrompt = `You are an elite multi-platform content strategist. Given a file (${contentKind}) a creator just uploaded, produce a ready-to-post package tuned per platform (YouTube, Instagram, TikTok, LinkedIn, Twitter/X). Your titles must be scroll-stopping; descriptions native to each platform's norms; hashtags mix trending + niche + branded; best_times should be platform-specific peak windows (use common heuristics like "Tue 7pm" etc.). Return ONLY valid JSON, no prose, no markdown fences.`;

  const userPrompt = `File URL: ${file_url}
File type: ${resolvedType || "unknown"}
MIME: ${resolvedMime || "unknown"}
File name: ${file_name || "unknown"}
Detected content kind: ${contentKind}${brandContext}${user_context ? `\nExtra user context: ${user_context}` : ""}

Return JSON with this exact shape:
{
  "titles": {
    "youtube": "...",
    "instagram": "...",
    "tiktok": "...",
    "linkedin": "...",
    "twitter": "..."
  },
  "descriptions": {
    "youtube": "...",
    "instagram": "...",
    "tiktok": "...",
    "linkedin": "...",
    "twitter": "..."
  },
  "hashtags": {
    "instagram": ["#...", "#..."],
    "tiktok": ["#...", "#..."],
    "twitter": ["#...", "#..."],
    "linkedin": ["#...", "#..."]
  },
  "best_times": {
    "instagram": "Tue 7pm",
    "tiktok": "Thu 9pm",
    "youtube": "Sat 3pm",
    "linkedin": "Wed 10am",
    "twitter": "Mon 12pm"
  },
  "suggested_caption_variations": ["variation 1", "variation 2", "variation 3"]
}`;

  let aiPackage: Record<string, unknown> | null = null;
  let errorMessage: string | null = null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const raw = getResponseText(response);
    aiPackage = safeJsonParse<Record<string, unknown>>(raw);
    if (!aiPackage) errorMessage = "AI returned unparseable output";
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  // Fallback skeleton if AI failed — caller still gets a usable shape
  if (!aiPackage) {
    aiPackage = fallbackPackage(file_name || "Untitled", contentKind);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("content_packages")
    .insert({
      user_id: user.id,
      client_id: client_id || null,
      file_url,
      file_name: file_name || null,
      file_type: resolvedType || null,
      mime_type: resolvedMime || null,
      ai_package: aiPackage,
      status: errorMessage ? "failed" : "ready",
      error_message: errorMessage,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message, ai_package: aiPackage }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    package: inserted,
    ai_package: aiPackage,
    warning: errorMessage || undefined,
  });
}

function classifyContent(mime: string, fileType: string, fileName?: string | null): string {
  const m = (mime || "").toLowerCase();
  const t = (fileType || "").toLowerCase();
  const n = (fileName || "").toLowerCase();
  if (m.startsWith("video/") || ["mp4", "mov", "avi", "webm", "mkv"].includes(t)) return "video";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "heic"].includes(t)) return "image";
  if (m.includes("pdf") || t === "pdf" || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a"].includes(t)) return "audio";
  if (m.includes("word") || m.includes("document") || ["doc", "docx", "txt", "md"].includes(t)) return "document";
  return "file";
}

function fallbackPackage(fileName: string, kind: string) {
  const base = fileName.replace(/\.[^.]+$/, "") || "New Post";
  return {
    titles: {
      youtube: `${base} — Full Breakdown`,
      instagram: `${base}`,
      tiktok: `POV: ${base}`,
      linkedin: `What I learned from ${base}`,
      twitter: `${base} (thread)`,
    },
    descriptions: {
      youtube: `A quick look at ${base}. Like & subscribe for more ${kind} content.`,
      instagram: `${base}\n\nDouble tap if this resonates.`,
      tiktok: `${base} — you had to be there.`,
      linkedin: `Sharing a fresh ${kind}: ${base}. Thoughts?`,
      twitter: `${base} — let me explain.`,
    },
    hashtags: {
      instagram: ["#content", "#creator", "#dropandgo"],
      tiktok: ["#fyp", "#foryou", "#viral"],
      twitter: ["#content", "#builder"],
      linkedin: ["#marketing", "#content", "#creator"],
    },
    best_times: {
      instagram: "Tue 7pm",
      tiktok: "Thu 9pm",
      youtube: "Sat 3pm",
      linkedin: "Wed 10am",
      twitter: "Mon 12pm",
    },
    suggested_caption_variations: [
      `${base} — the short version.`,
      `You asked, here it is: ${base}.`,
      `Save this for later: ${base}.`,
    ],
  };
}
