import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * /api/favourites — per-user pinned presets from the Preset Picker panel.
 *
 * Backed by the `user_favourites` table (user_id + kind + item_id, unique).
 * Defensive: when the table isn't present yet (migration not applied), all
 * routes return an empty / accepted response so the UI never crashes.
 */

export const maxDuration = 15;

const VALID_KINDS = new Set([
  "sfx",
  "music",
  "vfx",
  "transition",
  "broll",
  "font",
]);

type FavRow = { kind: string; item_id: string; created_at: string | null };

function tableMissing(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  const msg = (err as { message?: string }).message || "";
  return code === "42P01" || /does not exist/i.test(msg);
}

/* ── GET /api/favourites?kind=sfx ─────────────────────────────────── */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const kindParam = url.searchParams.get("kind");
  const kind =
    kindParam && VALID_KINDS.has(kindParam) ? kindParam : null;

  try {
    let query = supabase
      .from("user_favourites")
      .select("kind, item_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (kind) query = query.eq("kind", kind);

    const { data, error } = await query;
    if (error) {
      if (tableMissing(error)) {
        return NextResponse.json({ ok: true, favourites: [] });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const favourites = ((data || []) as FavRow[]).map((r) => ({
      kind: r.kind,
      item_id: r.item_id,
      created_at: r.created_at,
    }));
    return NextResponse.json({ ok: true, favourites });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/* ── POST /api/favourites  { kind, item_id }  (adds or upserts) ───── */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { kind?: unknown; item_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  const itemId =
    typeof body.item_id === "string" ? body.item_id.trim().slice(0, 160) : "";
  if (!VALID_KINDS.has(kind)) {
    return NextResponse.json(
      { ok: false, error: "kind must be one of sfx|music|vfx|transition|broll|font" },
      { status: 400 },
    );
  }
  if (!itemId) {
    return NextResponse.json(
      { ok: false, error: "item_id required" },
      { status: 400 },
    );
  }

  try {
    const { error } = await supabase
      .from("user_favourites")
      .upsert(
        { user_id: user.id, kind, item_id: itemId },
        { onConflict: "user_id,kind,item_id", ignoreDuplicates: true },
      );
    if (error) {
      if (tableMissing(error)) {
        return NextResponse.json({ ok: true, skipped: "table_missing" });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/* ── DELETE /api/favourites?kind=sfx&item_id=sfx_whoosh_01 ────────── */
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") || "";
  const itemId = url.searchParams.get("item_id") || "";
  if (!VALID_KINDS.has(kind)) {
    return NextResponse.json(
      { ok: false, error: "kind must be one of sfx|music|vfx|transition|broll|font" },
      { status: 400 },
    );
  }
  if (!itemId) {
    return NextResponse.json(
      { ok: false, error: "item_id required" },
      { status: 400 },
    );
  }

  try {
    const { error } = await supabase
      .from("user_favourites")
      .delete()
      .eq("user_id", user.id)
      .eq("kind", kind)
      .eq("item_id", itemId);
    if (error) {
      if (tableMissing(error)) {
        return NextResponse.json({ ok: true, skipped: "table_missing" });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
