import { NextResponse } from "next/server";
import {
  createServerSupabase,
  createServiceClient,
} from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { ensurePresetsSeeded } from "@/lib/voice/preset-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/voice/presets/seed
 *
 * Idempotent — inserts any preset rows missing for the calling agency owner.
 * The dashboard calls this lazily on mount; we expose it as an explicit POST
 * so admins can re-trigger it if presets get accidentally deleted.
 */
export async function POST() {
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

  const service = createServiceClient();
  try {
    const result = await ensurePresetsSeeded(service, ownerId);
    return NextResponse.json({
      ok: true,
      inserted: result.inserted,
      existing: result.existing,
      backfilled: result.backfilled,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}
