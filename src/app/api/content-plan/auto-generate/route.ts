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
  const days: number = Math.min(30, Math.max(1, Number(body?.days) || 7));
  const clientId: string | null = body?.client_id || null;
  const startDate = body?.start_date ? new Date(body.start_date) : new Date();

  if (assets.length === 0) {
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

  const systemPrompt = `You are a content-scheduling expert. Given a small pool of assets and a set of platforms, design a ${days}-day posting plan. Spread posts naturally, avoid posting the same asset on the same platform twice on the same day, pick platform-appropriate post_times (24h HH:mm) aligned with common peak windows per platform. Return ONLY valid JSON, no markdown.`;

  const userPrompt = `Assets (${assets.length}):
${JSON.stringify(assetSummary, null, 2)}

Platforms: ${platforms.join(", ")}
Days in plan: ${days}
Day labels (in order): ${dayList.map((d) => `${d.label} (${d.iso})`).join(", ")}

Return JSON: { "schedule": [ { "day": "Mon", "date": "YYYY-MM-DD", "platform": "instagram", "asset_id": "<id or null>", "asset_idx": 0, "post_time": "19:00", "title": "...", "caption": "..." } ] }

Rules:
- Prefer one post per platform per day where assets allow.
- Use each asset at least once if possible.
- Pull titles/captions from the asset's ai_package when present; otherwise invent a short platform-appropriate caption.
- post_time must be HH:mm 24h.`;

  let schedule: PlanEntry[] = [];
  let aiError: string | null = null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const raw = getResponseText(response);
    const parsed = safeJsonParse<{ schedule?: unknown }>(raw);
    if (parsed && Array.isArray(parsed.schedule)) {
      schedule = (parsed.schedule as Array<Record<string, unknown>>)
        .map((s) => normaliseEntry(s, assets, dayList))
        .filter((s): s is PlanEntry => !!s);
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

  // Persist to content_calendar
  const inserted: Array<Record<string, unknown>> = [];
  if (clientId) {
    for (const entry of schedule) {
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
      if (!error && data) inserted.push(data);
    }
  }

  return NextResponse.json({
    success: true,
    schedule,
    saved: inserted.length,
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
