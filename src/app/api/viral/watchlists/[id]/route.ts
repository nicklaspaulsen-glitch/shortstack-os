/**
 * /api/viral/watchlists/[id] — fetch, update, or delete a single watchlist.
 *
 * All three verbs are owner-scoped via .eq("user_id", user.id). RLS on
 * `viral_watchlists` is the ultimate authority but we enforce here too.
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

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("viral_watchlists")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ watchlist: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.niche === "string") updates.niche = body.niche.trim().toLowerCase();
  if ("keywords" in body) updates.keywords = sanitizeKeywords(body.keywords);
  if ("platforms" in body) {
    const platforms = sanitizePlatforms(body.platforms);
    if (platforms.length === 0) {
      return NextResponse.json({ error: "at least one platform is required" }, { status: 400 });
    }
    updates.platforms = platforms;
  }
  if ("active" in body) updates.active = Boolean(body.active);
  if ("alert_on_new" in body) updates.alert_on_new = Boolean(body.alert_on_new);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("viral_watchlists")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watchlist: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("viral_watchlists")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
