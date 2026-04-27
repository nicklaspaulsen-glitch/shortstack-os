import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  createServiceClient,
} from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  pollCloneStatus,
  type RunPodCloneProvider,
} from "@/lib/voice/runpod-clone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

const RUNPOD_PROVIDERS: ReadonlyArray<RunPodCloneProvider> = [
  "runpod_f5tts",
  "runpod_openvoice",
  "runpod_xtts",
];

/**
 * POST /api/voice/clones/[id]/poll-status
 *
 * Used by the dashboard while a RunPod clone is in `training` state — the UI
 * calls this after a short delay to flip the row to `ready` once the worker
 * finishes. The cron does the same thing on a 2-minute schedule for the
 * background case.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
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

  const service = createServiceClient();
  const { data: clone } = await service
    .from("voice_clones")
    .select("id, agency_owner_id, provider, provider_voice_id, status")
    .eq("id", cloneId)
    .maybeSingle();

  if (!clone) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (clone.agency_owner_id !== ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (clone.status !== "training") {
    return NextResponse.json({
      ok: true,
      status: clone.status,
      changed: false,
    });
  }
  if (
    !RUNPOD_PROVIDERS.includes(clone.provider as RunPodCloneProvider) ||
    !clone.provider_voice_id
  ) {
    return NextResponse.json({
      ok: true,
      status: clone.status,
      changed: false,
      note: "Polling only supported for RunPod-backed jobs.",
    });
  }

  const result = await pollCloneStatus(
    clone.provider as RunPodCloneProvider,
    clone.provider_voice_id,
  );

  if (result.status === "ready") {
    await service
      .from("voice_clones")
      .update({
        status: "ready",
        ready_at: new Date().toISOString(),
        provider_voice_id: result.fingerprint || clone.provider_voice_id,
      })
      .eq("id", cloneId);
    return NextResponse.json({ ok: true, status: "ready", changed: true });
  }
  if (result.status === "failed") {
    await service
      .from("voice_clones")
      .update({
        status: "failed",
        failed_reason: result.failedReason || "runpod_failed",
      })
      .eq("id", cloneId);
    return NextResponse.json({ ok: true, status: "failed", changed: true });
  }
  return NextResponse.json({ ok: true, status: "training", changed: false });
}
