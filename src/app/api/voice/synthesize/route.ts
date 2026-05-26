import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { synthesize } from "@/lib/voice/clone-router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SynthBody {
  clone_id?: string;
  text?: string;
  format?: "mp3" | "wav";
  speed?: number;
  cache?: boolean;
  context?: string;
}

const MAX_TEXT_LENGTH = 4000;

/**
 * POST /api/voice/synthesize
 *
 * Body: { clone_id, text, format?, speed?, cache?, context? }
 * Returns: { r2_url, duration_seconds, cached }
 *
 * The render is cached server-side per (clone_id, text-hash). Subsequent
 * identical requests reuse the same R2 object — important for voicemail
 * templates that get fired into many calls.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: SynthBody;
  try {
    body = (await request.json()) as SynthBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cloneId = body.clone_id;
  if (!cloneId) {
    return NextResponse.json({ error: "Missing clone_id" }, { status: 400 });
  }
  const text = (body.text || "").trim();
  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `text exceeds ${MAX_TEXT_LENGTH} chars` },
      { status: 400 },
    );
  }
  if (
    body.format !== undefined &&
    body.format !== "mp3" &&
    body.format !== "wav"
  ) {
    return NextResponse.json(
      { error: "format must be 'mp3' or 'wav'" },
      { status: 400 },
    );
  }
  if (body.speed !== undefined && (body.speed < 0.5 || body.speed > 2.0)) {
    return NextResponse.json(
      { error: "speed must be between 0.5 and 2.0" },
      { status: 400 },
    );
  }

  // Verify ownership / preset visibility via RLS-bound read.
  const { data: clone } = await supabase
    .from("voice_clones")
    .select("id, agency_owner_id, owner_subject_kind, status")
    .eq("id", cloneId)
    .maybeSingle();

  if (!clone) {
    return NextResponse.json({ error: "Clone not found" }, { status: 404 });
  }
  // Non-preset clones must belong to this agency.
  if (
    clone.owner_subject_kind !== "preset" &&
    clone.agency_owner_id !== ownerId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (clone.status !== "ready") {
    return NextResponse.json(
      { error: `Clone status=${clone.status}; not ready for synthesis.` },
      { status: 409 },
    );
  }

  try {
    const result = await synthesize({
      cloneId,
      text,
      agencyOwnerId: ownerId,
      format: body.format,
      speed: body.speed,
      cache: body.cache,
      context: body.context,
    });
    return NextResponse.json({
      r2_url: result.r2Url,
      duration_seconds: result.durationSeconds,
      cached: result.cached,
    });
  } catch (err) {
    const reason = "unknown_error";
    console.error("[voice/synthesize] failed:", reason);
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}
