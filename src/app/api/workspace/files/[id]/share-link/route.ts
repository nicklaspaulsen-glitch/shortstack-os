/**
 * Workspace Files — share-link.
 *
 * GET /api/workspace/files/[id]/share-link?ttl=24h
 *   Returns a presigned GET URL with the requested TTL (capped at 7 days).
 *
 * Accepted ttl formats:
 *   - "5m", "1h", "24h", "3d", "7d"
 *   - or a raw number of seconds (e.g. "3600")
 *
 * Anything bigger than 7 days is clamped because S3-style presigned URLs have
 * a hard week ceiling. Anything missing/invalid defaults to 24h.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { getR2SignedGetUrl } from "@/lib/server/r2-client";
import { getOwnedFile, isUuid } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteCtx {
  params: { id: string };
}

const MAX_SHARE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const DEFAULT_SHARE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

function parseTtl(raw: string | null): number {
  if (!raw) return DEFAULT_SHARE_TTL_SECONDS;
  const trimmed = raw.trim().toLowerCase();
  // Numeric seconds form.
  if (/^\d+$/.test(trimmed)) {
    return Math.min(Math.max(parseInt(trimmed, 10), 60), MAX_SHARE_TTL_SECONDS);
  }
  // suffix form: <num><unit>
  const m = /^(\d+)\s*([smhd])$/.exec(trimmed);
  if (!m) return DEFAULT_SHARE_TTL_SECONDS;
  const n = parseInt(m[1], 10);
  const unitFactor: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const seconds = n * (unitFactor[m[2]] ?? 60);
  return Math.min(Math.max(seconds, 60), MAX_SHARE_TTL_SECONDS);
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const fileId = ctx.params.id;
  if (!isUuid(fileId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const file = await getOwnedFile(supabase, fileId, ownerId);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const ttl = parseTtl(url.searchParams.get("ttl"));

  let signed: string;
  try {
    signed = await getR2SignedGetUrl(file.r2_key, ttl);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to sign URL";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    url: signed,
    expires_in: ttl,
    name: file.name,
    mime_type: file.mime_type,
  });
}
