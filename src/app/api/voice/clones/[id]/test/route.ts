import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { synthesize } from "@/lib/voice/clone-router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

interface TestBody {
  text?: string;
}

/**
 * POST /api/voice/clones/[id]/test
 *
 * Renders a quick playback sample using the chosen clone. Used by the
 * "Test playback" button on the Voice Studio dashboard. Caches by text
 * hash so repeated tests with the same string don't re-bill the provider.
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

  const cloneId = context.params.id;
  if (!cloneId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: TestBody;
  try {
    body = (await request.json()) as TestBody;
  } catch {
    body = {};
  }
  const text =
    (body.text || "").trim() ||
    "Hi there — this is a quick test of my new voice clone. How does it sound?";
  if (text.length > 500) {
    return NextResponse.json(
      { error: "Test text exceeds 500 chars." },
      { status: 400 },
    );
  }

  // Read the clone via the user's RLS-bound client so cross-tenant tests
  // bounce. Presets are visible to everyone via the read-everyone policy.
  const { data: clone } = await supabase
    .from("voice_clones")
    .select("id, status")
    .eq("id", cloneId)
    .maybeSingle();
  if (!clone) {
    return NextResponse.json({ error: "Clone not found" }, { status: 404 });
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
      context: "test_playback",
    });
    return NextResponse.json({
      r2_url: result.r2Url,
      duration_seconds: result.durationSeconds,
      cached: result.cached,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}
