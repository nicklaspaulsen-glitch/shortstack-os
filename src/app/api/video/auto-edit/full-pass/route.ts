import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";
import { resolveOrigin, runFullPass } from "@/lib/auto-edit-pipeline";

/**
 * POST /api/video/auto-edit/full-pass
 *
 * One-click auto-edit. Sequences detect-scenes → suggest → captions →
 * broll-candidates → (optional) apply and returns the aggregated result.
 *
 * Token cost: ~5-8 tokens (aggregate of sub-calls). We reserve 6 tokens up
 * front via checkLimit; each sub-call also records its own usage, so the
 * aggregate is tracked precisely in usage_events. The reservation here only
 * gatekeeps — it doesn't add to the bill.
 *
 * Body:
 *   {
 *     video_url: string,
 *     project_id: string,
 *     creator_pack_id?: string,
 *     client_id?: string,
 *     auto_accept?: boolean,
 *     scenes?: Scene[],             // optional, skips detect-scenes
 *     frame_samples?: [{url, at_sec}],
 *     total_duration_sec?: number
 *   }
 */

export const maxDuration = 300;

interface FullPassBody {
  video_url?: string;
  project_id?: string;
  creator_pack_id?: string;
  client_id?: string;
  auto_accept?: boolean;
  scenes?: unknown;
  frame_samples?: unknown;
  total_duration_sec?: number;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 403 });
  }

  // 6-token reservation up front (gatekeeper only — actual usage is tracked
  // by each sub-call).
  const limit = await checkLimit(ownerId, "tokens", 6);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: limit.reason || "Monthly token limit reached — upgrade to continue.",
        plan_tier: limit.plan_tier,
        current: limit.current,
        limit: limit.limit,
      },
      { status: 429 },
    );
  }

  let body: FullPassBody;
  try {
    body = (await request.json()) as FullPassBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const videoUrl = typeof body.video_url === "string" ? body.video_url.trim() : "";
  const projectId = typeof body.project_id === "string" ? body.project_id.trim() : "";
  if (!videoUrl) {
    return NextResponse.json(
      { ok: false, error: "video_url is required" },
      { status: 400 },
    );
  }
  if (!projectId) {
    return NextResponse.json(
      { ok: false, error: "project_id is required" },
      { status: 400 },
    );
  }

  // Enforce ownership on the project before we start firing sub-calls.
  const db = createServiceClient();
  const { data: project } = await db
    .from("video_projects")
    .select("id, profile_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  }
  if ((project as { profile_id: string }).profile_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const origin = resolveOrigin(request.headers);
  const cookieHeader = request.headers.get("cookie") || undefined;

  const frameSamples = Array.isArray(body.frame_samples)
    ? (body.frame_samples as Array<{ url?: unknown; at_sec?: unknown }>)
        .filter(
          (f): f is { url: string; at_sec: number } =>
            !!f && typeof f.url === "string" && typeof f.at_sec === "number",
        )
    : undefined;

  try {
    const result = await runFullPass({
      origin,
      cookieHeader,
      video_url: videoUrl,
      project_id: projectId,
      creator_pack_id:
        typeof body.creator_pack_id === "string" && body.creator_pack_id.trim()
          ? body.creator_pack_id.trim()
          : undefined,
      client_id:
        typeof body.client_id === "string" && body.client_id.trim()
          ? body.client_id.trim()
          : undefined,
      auto_accept: !!body.auto_accept,
      scenes: Array.isArray(body.scenes) ? body.scenes : undefined,
      frame_samples: frameSamples,
      total_duration_sec:
        typeof body.total_duration_sec === "number"
          ? body.total_duration_sec
          : undefined,
    });

    // Lightweight record — precise token amounts are recorded by each sub-call.
    void recordUsage(ownerId, "tokens", 0, {
      source: "auto_edit_full_pass",
      project_id: projectId,
      auto_accept: !!body.auto_accept,
      errors: result.errors.length,
    });

    void db.from("trinity_log").insert({
      action_type: "ai_auto_edit_full_pass",
      description: `Full-pass auto-edit (${result.errors.length} sub-errors)`,
      profile_id: user.id,
      status: result.ok ? "completed" : "partial",
      result: {
        project_id: projectId,
        auto_accept: !!body.auto_accept,
        errors: result.errors,
      },
    });

    return NextResponse.json({
      ...result,
      project_id: projectId,
    });
  } catch (err) {
    console.error("[video/auto-edit/full-pass] error", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
