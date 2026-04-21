import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import crypto from "crypto";

/**
 * /api/settings/api-keys
 *
 * GET    → list the caller's non-revoked keys (prefix + metadata only; the
 *          raw secret is never returned after creation).
 * POST   → generate a new key. The raw secret is returned ONCE in the
 *          response — the DB only stores a SHA-256 hash + the first 8 chars
 *          as a prefix (for user recognition).
 * DELETE → revoke a key by id (soft delete via revoked_at).
 *
 * Scoped to the authenticated user; team_members resolve to their parent
 * agency so staff don't accidentally fork the agency's key pool.
 */

export const runtime = "nodejs";

function generateKey(): { raw: string; prefix: string; hash: string } {
  // 32 random bytes → 64-char hex. Prefix "ss_live_" is purely cosmetic so
  // keys leaked in logs are easy to spot.
  const rand = crypto.randomBytes(32).toString("hex");
  const raw = `ss_live_${rand}`;
  const prefix = raw.slice(0, 12); // "ss_live_xxxx"
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, prefix, hash };
}

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const service = createServiceClient();

  const { data, error } = await service
    .from("api_keys")
    .select("id, name, key_prefix, scopes, last_used_at, expires_at, created_at")
    .eq("user_id", ownerId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Shape the response for the Settings UI — keeps the old column names the
  // existing React code already reads.
  const keys = (data || []).map((k) => ({
    id: k.id,
    name: k.name,
    key: `${k.key_prefix}${"•".repeat(20)}`, // masked
    created: k.created_at,
    last_used: k.last_used_at || "Never",
    status: "active",
    scopes: k.scopes || [],
    expires_at: k.expires_at,
  }));

  return NextResponse.json({ keys });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  let body: { name?: string; scopes?: string[]; expires_at?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (name.length > 80) return NextResponse.json({ error: "Name too long (max 80 chars)" }, { status: 400 });

  const scopes = Array.isArray(body.scopes) ? body.scopes.filter((s) => typeof s === "string") : [];
  const expiresAt = body.expires_at ? new Date(body.expires_at).toISOString() : null;

  const { raw, prefix, hash } = generateKey();

  const service = createServiceClient();
  const { data, error } = await service
    .from("api_keys")
    .insert({
      user_id: ownerId,
      name,
      key_prefix: prefix,
      key_hash: hash,
      scopes,
      expires_at: expiresAt,
    })
    .select("id, name, key_prefix, scopes, expires_at, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to create key" }, { status: 500 });
  }

  // Return the RAW key ONCE — this is the only chance the user has to copy
  // it. After this the DB only has the hash.
  return NextResponse.json({
    id: data.id,
    name: data.name,
    key: raw,
    key_prefix: data.key_prefix,
    created: data.created_at,
    last_used: "Never",
    status: "active",
    scopes: data.scopes || [],
    expires_at: data.expires_at,
    warning: "Copy this key now — it won't be shown again.",
  });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param required" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
