/**
 * /api/viral/watchlists — list + create saved viral research watchlists.
 *
 * Each watchlist is a saved (niche, keywords, platforms) combo that the daily
 * `/api/cron/viral-scan` worker refreshes so users get fresh trending videos
 * every morning without having to burn Claude calls themselves.
 *
 * RLS enforces owner scoping but we also `.eq("user_id", user.id)` defensively
 * — same pattern as /api/deals/route.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const ALLOWED_PLATFORMS = new Set(["youtube", "tiktok", "instagram", "shorts"]);

function sanitizePlatforms(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const p = String(raw || "").trim().toLowerCase();
    if (ALLOWED_PLATFORMS.has(p) && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

function sanitizeKeywords(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(k => String(k || "").trim()).filter(Boolean).slice(0, 20);
}

// GET — list the caller's watchlists
export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("viral_watchlists")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watchlists: data || [] });
}

// POST — create a new watchlist
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const niche = typeof body.niche === "string" ? body.niche.trim().toLowerCase() : "";
  const keywords = sanitizeKeywords(body.keywords);
  const platforms = sanitizePlatforms(body.platforms);
  const active = body.active === undefined ? true : Boolean(body.active);
  const alertOnNew = Boolean(body.alert_on_new);

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!niche) return NextResponse.json({ error: "niche is required" }, { status: 400 });
  if (platforms.length === 0) {
    return NextResponse.json({ error: "at least one platform is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("viral_watchlists")
    .insert({
      user_id: user.id,
      name,
      niche,
      keywords,
      platforms,
      active,
      alert_on_new: alertOnNew,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watchlist: data }, { status: 201 });
}
