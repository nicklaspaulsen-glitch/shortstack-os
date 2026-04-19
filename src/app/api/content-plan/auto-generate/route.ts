import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";

type PlanAsset = {
  id?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  mime_type?: string;
  ai_package?: Record<string, unknown> | null;
};

type PlanEntry = {
  day: string;          // "Mon" | "Tue" | ...
  date: string;         // ISO yyyy-mm-dd
  platform: string;
  asset_id?: string | null;
  post_time: string;    // "HH:mm" 24h local
  title?: string;
  caption?: string;
};

/**
 * POST /api/content-plan/auto-generate
 *
 * "Plan my week from these assets" — asks Claude Haiku to spread the given
 * assets across the given platforms over N days (default 7), choosing smart
 * post_times per platform. Persists each scheduled post into content_calendar
 * (when a client_id is available) and returns the plan.
 *
 * Body: {
 *   assets: PlanAsset[],
 *   platforms: string[],
 *   days?: number (default 7),
 *   client_id?: string,
 *   start_date?: ISO date (default today)
 * }
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const body = await request.json();
  const assets: PlanAsset[] = Array.isArray(body?.assets) ? body.assets : [];
  const platforms: string[] = Array.isArray(body?.platforms) && body.platforms.length > 0
    ? body.platforms.map((p: unknown) => String(p))
    : ["instagram", "tiktok", "youtube", "linkedin", "twitter"];
  // Phase 2: support week (7), month (30), quarter (90), or year (365)
  const days: number = Math.min(365, Math.max(1, Number(body?.days) || 7));
  const clientId: string | null = body?.client_id || null;
  const startDate = body?.start_date ? new Date(body.start_date) : new Date();
  // Phase 2: when assets are insufficient to fill the period, Claude
  // generates NEW content IDEAS (titles + briefs) for the gap.
  const fillGap: boolean = body?.fill_gap !== false;
  const postsPerWeekPerPlatform: number = Math.max(1, Math.min(7, Number(body?.posts_per_week) || 3));

  if (assets.length === 0 && !fillGap) {
    return NextResponse.json({ error: "assets array required" }, { status: 400 });
  }

  // Verify client access if client_id is supplied
  if (clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("id, profile_id")
      .eq("id", clientId)
      .single();
    if (!client || client.profile_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Build a compact asset summary for the prompt
  const assetSummary = assets.map((a, i) => ({
    idx: i,
    id: a.id || null,
    name: a.file_name || `asset-${i + 1}`,
    kind: a.file_type || a.mime_type || "file",
    package: a.ai_package ? summarisePackage(a.ai_package) : null,
  }));

  const dayList = generateDays(startDate, days);

  // Phase 2: math the gap so Claude knows when to invent new content
  const weeks = Math.max(1, Math.ceil(days / 7));
  const targetPosts = platforms.length * postsPerWeekPerPlatform * weeks;
  const gap = Math.max(0, targetPosts - assets.length);
  const needsGenerated = fillGap && gap > 0;

  const systemPrompt = `You are an elite content strategist and scheduler. Given a pool of real assets and a set of platforms, design a ${days}-day content plan (${weeks} week${weeks > 1 ? "s" : ""}).

Rules:
- Spread posts naturally across the period. Avoid clustering all uploads on day 1.
- Don't double-post the same asset on the same platform on the same day.
- Pick platform-appropriate post_times (24h HH:mm) in common peak windows:
  - Instagram: 11-13 and 19-21
  - TikTok: 18-22
  - LinkedIn: 07-09 and 17-18 (weekdays only)
  - YouTube: 14-17 and 20-22
  - Twitter/X: 08-10 and 17-19
- Target ~${postsPerWeekPerPlatform} posts/week per platform.
${needsGenerated ? `- When real assets run out, INVENT ${gap} new content ideas. For each: write a clear title, a 1-line brief of what the content should be, and a platform-appropriate caption. Set asset_id=null and include "needs_creation": true.` : "- Stop when real assets are exhausted."}
- Return ONLY valid JSON, no markdown.`;

  const userPrompt = `Real assets available (${assets.length}):
${JSON.stringify(assetSummary, null, 2)}

Platforms: ${platforms.join(", ")}
Period: ${days} days (${weeks} week${weeks > 1 ? "s" : ""}), starting ${dayList[0]?.iso}
Target cadence: ${postsPerWeekPerPlatform} posts/week/platform = ${targetPosts} total posts
Gap to fill with new ideas: ${gap}

${days > 90 ? "Since this is a LONG plan (quarter/year), include thematic arcs: launch announcement, education, social proof, seasonal moments, year-end reflection. Each week should have a theme." : ""}

Return JSON: {
  "schedule": [
    {
      "day": "Mon",
      "date": "YYYY-MM-DD",
      "platform": "instagram",
      "asset_id": "<id or null>",
      "asset_idx": <number or null>,
      "post_time": "19:00",
      "title": "...",
      "caption": "...",
      "brief": "<only when asset_id=null — what the content should be>",
      "needs_creation": <boolean>
    }
  ],
  "themes": [
    { "week": 1, "theme": "Foundation — introduce brand" },
    ...
  ],
  "gap_analysis": {
    "target_posts": ${targetPosts},
    "real_assets": ${assets.length},
    "needs_creation": ${gap},
    "recommendation": "<one-line suggestion>"
  }
}`;

  let schedule: PlanEntry[] = [];
  let themes: Array<{ week: number; theme: string }> = [];
  let gapAnalysis: {
    target_posts: number;
    real_assets: number;
    needs_creation: number;
    recommendation: string;
  } | null = null;
  let aiError: string | null = null;

  try {
    // Scale max_tokens with plan size — year plans need more room
    const maxTokens = days > 90 ? 8000 : days > 30 ? 5000 : 3000;
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const raw = getResponseText(response);
    const parsed = safeJsonParse<{
      schedule?: unknown;
      themes?: unknown;
      gap_analysis?: unknown;
    }>(raw);
    if (parsed && Array.isArray(parsed.schedule)) {
      schedule = (parsed.schedule as Array<Record<string, unknown>>)
        .map((s) => normaliseEntry(s, assets, dayList))
        .filter((s): s is PlanEntry => !!s);
      if (Array.isArray(parsed.themes)) {
        themes = (parsed.themes as Array<Record<string, unknown>>)
          .filter(t => typeof t.week === "number" && typeof t.theme === "string")
          .map(t => ({ week: t.week as number, theme: t.theme as string }));
      }
      if (parsed.gap_analysis && typeof parsed.gap_analysis === "object") {
        const g = parsed.gap_analysis as Record<string, unknown>;
        gapAnalysis = {
          target_posts: Number(g.target_posts) || targetPosts,
          real_assets: Number(g.real_assets) || assets.length,
          needs_creation: Number(g.needs_creation) || gap,
          recommendation: String(g.recommendation || ""),
        };
      }
    } else {
      aiError = "AI returned no schedule";
    }
  } catch (err) {
    aiError = err instanceof Error ? err.message : String(err);
  }

  // Fallback: simple round-robin schedule
  if (schedule.length === 0) {
    schedule = buildFallbackSchedule(assets, platforms, dayList);
  }

  // Persist to content_calendar — annotate each schedule entry with the
  // resulting calendar row id so the UI can target it for Publish Now.
  const inserted: Array<Record<string, unknown>> = [];
  if (clientId) {
    for (let i = 0; i < schedule.length; i++) {
      const entry = schedule[i];
      const scheduledAt = combineDateAndTime(entry.date, entry.post_time);
      const { data, error } = await supabase
        .from("content_calendar")
        .insert({
          client_id: clientId,
          title: entry.title || entry.caption || `Scheduled ${entry.platform}`,
          platform: mapPlatform(entry.platform),
          scheduled_at: scheduledAt,
          status: "scheduled",
          notes: entry.caption || null,
          metadata: {
            source: "drop_and_go",
            asset_id: entry.asset_id,
            day_label: entry.day,
          },
        })
        .select()
        .single();
      if (!error && data) {
        inserted.push(data);
        (schedule[i] as PlanEntry & { calendar_id?: string; status?: string }).calendar_id =
          (data.id as string) || undefined;
        (schedule[i] as PlanEntry & { calendar_id?: string; status?: string }).status =
          (data.status as string) || "scheduled";
      }
    }
  }

  return NextResponse.json({
    success: true,
    schedule,
    saved: inserted.length,
    days,
    themes,
    gap_analysis: gapAnalysis || {
      target_posts: targetPosts,
      real_assets: assets.length,
      needs_creation: gap,
      recommendation: gap > 0
        ? `Upload or generate ${gap} more pieces of content to fully fill the ${days}-day plan.`
        : `You have enough content for the ${days}-day plan.`,
    },
    warning: aiError || undefined,
  });
}

// ── helpers ─────────────────────────────────────────────────────────
function summarisePackage(pkg: Record<string, unknown>) {
  const titles = pkg.titles as Record<string, string> | undefined;
  const captions = pkg.suggested_caption_variations as string[] | undefined;
  return {
    titles: titles || null,
    sample_caption: Array.isArray(captions) ? captions[0] : null,
  };
}

function generateDays(start: Date, count: number): Array<{ label: string; iso: string }> {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const out: Array<{ label: string; iso: string }> = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    out.push({
      label: labels[d.getDay()],
      iso: d.toISOString().slice(0, 10),
    });
  }
  return out;
}

function normaliseEntry(
  raw: Record<string, unknown>,
  assets: PlanAsset[],
  dayList: Array<{ label: string; iso: string }>,
): PlanEntry | null {
  const day = String(raw.day || "").slice(0, 3);
  const date = typeof raw.date === "string" && raw.date.match(/^\d{4}-\d{2}-\d{2}$/)
    ? raw.date
    : dayList.find((d) => d.label === day)?.iso || dayList[0]?.iso;
  if (!date) return null;
  const platform = String(raw.platform || "instagram").toLowerCase();
  const post_time = typeof raw.post_time === "string" && /^\d{1,2}:\d{2}$/.test(raw.post_time)
    ? raw.post_time.padStart(5, "0")
    : "19:00";

  let asset_id: string | null = null;
  if (typeof raw.asset_id === "string") asset_id = raw.asset_id;
  else if (typeof raw.asset_idx === "number" && assets[raw.asset_idx]) {
    asset_id = assets[raw.asset_idx].id || null;
  }

  return {
    day: day || dayList.find((d) => d.iso === date)?.label || "Mon",
    date,
    platform,
    asset_id,
    post_time,
    title: typeof raw.title === "string" ? raw.title : undefined,
    caption: typeof raw.caption === "string" ? raw.caption : undefined,
  };
}

function buildFallbackSchedule(
  assets: PlanAsset[],
  platforms: string[],
  dayList: Array<{ label: string; iso: string }>,
): PlanEntry[] {
  const times: Record<string, string> = {
    instagram: "19:00",
    tiktok: "21:00",
    youtube: "15:00",
    linkedin: "10:00",
    twitter: "12:00",
    x: "12:00",
  };
  const schedule: PlanEntry[] = [];
  let pi = 0;
  let ai = 0;
  for (const d of dayList) {
    const platform = platforms[pi % platforms.length];
    const asset = assets[ai % assets.length];
    const pkg = asset.ai_package as Record<string, unknown> | undefined;
    const titles = (pkg?.titles as Record<string, string> | undefined) || undefined;
    const captions = pkg?.suggested_caption_variations as string[] | undefined;
    schedule.push({
      day: d.label,
      date: d.iso,
      platform,
      asset_id: asset.id || null,
      post_time: times[platform] || "19:00",
      title: titles?.[platform] || asset.file_name,
      caption: Array.isArray(captions) ? captions[0] : undefined,
    });
    pi++;
    ai++;
  }
  return schedule;
}

function combineDateAndTime(date: string, time: string): string {
  // Treat as local time; store as ISO for content_calendar.scheduled_at
  const iso = new Date(`${date}T${time}:00`).toISOString();
  return iso;
}

function mapPlatform(p: string): string {
  const key = p.toLowerCase();
  const map: Record<string, string> = {
    youtube: "youtube",
    shorts: "youtube_shorts",
    youtube_shorts: "youtube_shorts",
    tiktok: "tiktok",
    instagram: "instagram_reels",
    reels: "instagram_reels",
    facebook: "facebook_reels",
    facebook_reels: "facebook_reels",
    linkedin: "linkedin_video",
    twitter: "twitter",
    x: "twitter",
  };
  return map[key] || key;
}
