import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOwnedClient, getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { schedulePost as zernioSchedule } from "@/lib/services/zernio";
import { ALL_PLATFORMS } from "@/lib/social-studio/constants";
import type { SocialPlatform, SocialPost } from "@/lib/social-studio/types";

/**
 * POST /api/social/schedule
 *
 * Body shape:
 * {
 *   client_id?: string,
 *   platforms: SocialPlatform[],
 *   caption: string,
 *   hashtags?: string[],
 *   media_urls?: string[],
 *   scheduled_at?: string,   // ISO. If omitted, posts immediately.
 *   ai_metadata?: Record<string, unknown>  // pass-through from AI tab
 * }
 *
 * Inserts a row into social_posts and (if Zernio is configured)
 * forwards the post to Zernio. The DB row is the source of truth — if
 * Zernio is unreachable we still keep the row at status "scheduled" or
 * "failed" so the user can retry.
 */
type ScheduleRequest = {
  client_id?: string;
  platforms: SocialPlatform[];
  caption: string;
  hashtags?: string[];
  media_urls?: string[];
  scheduled_at?: string;
  ai_metadata?: Record<string, unknown>;
};

function isValidPlatform(p: unknown): p is SocialPlatform {
  return typeof p === "string" && ALL_PLATFORMS.includes(p as SocialPlatform);
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve effective owner — team_members create posts under the parent agency
  // so the parent (and other team_members) sees them in the lineup.
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: ScheduleRequest;
  try {
    body = (await request.json()) as ScheduleRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate required fields up front — fail fast with a clear message
  // rather than letting Postgres reject NULLs.
  if (!Array.isArray(body.platforms) || body.platforms.length === 0) {
    return NextResponse.json(
      { error: "platforms must be a non-empty array" },
      { status: 400 },
    );
  }
  const platforms = body.platforms.filter(isValidPlatform);
  if (platforms.length === 0) {
    return NextResponse.json(
      { error: "platforms must contain at least one supported platform" },
      { status: 400 },
    );
  }
  if (typeof body.caption !== "string" || body.caption.trim().length === 0) {
    return NextResponse.json({ error: "caption is required" }, { status: 400 });
  }

  // If a client was named, verify ownership before binding the row.
  if (body.client_id) {
    const ownership = await requireOwnedClient(supabase, user.id, body.client_id);
    if (!ownership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Decide initial status. If no scheduled_at and Zernio call succeeds,
  // status flips to "publishing" → "published" once Zernio confirms.
  // For v1 we keep it simple: insert with the right status, then patch
  // after the Zernio call.
  const willPostNow = !body.scheduled_at;
  const initialStatus = willPostNow ? "publishing" : "scheduled";

  const insert = {
    user_id: ownerId,
    client_id: body.client_id ?? null,
    platforms,
    caption: body.caption,
    content: body.caption,
    hashtags: body.hashtags ?? [],
    media_urls: body.media_urls ?? [],
    scheduled_at: body.scheduled_at ?? null,
    status: initialStatus as SocialPost["status"],
    ai_metadata: body.ai_metadata ?? {},
  };

  const { data: row, error: insertErr } = await supabase
    .from("social_posts")
    .insert(insert)
    .select("*")
    .single();

  if (insertErr || !row) {
    console.error("[social-studio/schedule] insert error", insertErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Forward to Zernio. Fail soft — if Zernio is unreachable or the API
  // key isn't set we still keep the local row so the user can retry.
  let zernioPostId: string | null = null;
  let zernioError: string | null = null;
  try {
    const hashtagString = (body.hashtags ?? [])
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .join(" ");
    const fullText = hashtagString ? `${body.caption}\n\n${hashtagString}` : body.caption;
    const result = await zernioSchedule({
      text: fullText,
      platforms: platforms as string[],
      mediaUrls: body.media_urls,
      scheduledAt: body.scheduled_at,
      hashtags: body.hashtags,
    });
    if (result.success && result.postId) {
      zernioPostId = result.postId;
    } else {
      zernioError = result.error ?? "Zernio rejected the post";
    }
  } catch (err) {
    zernioError = err instanceof Error ? err.message : String(err);
  }

  const finalStatus: SocialPost["status"] = zernioError
    ? "failed"
    : willPostNow
      ? "published"
      : "scheduled";

  const { data: updated } = await supabase
    .from("social_posts")
    .update({
      zernio_post_id: zernioPostId,
      status: finalStatus,
      published_at: finalStatus === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      ai_metadata: zernioError
        ? { ...(insert.ai_metadata as Record<string, unknown>), zernio_error: zernioError }
        : insert.ai_metadata,
    })
    .eq("id", row.id)
    .select("*")
    .single();

  return NextResponse.json({
    post: (updated ?? row) as SocialPost,
    zernio_post_id: zernioPostId,
    zernio_error: zernioError,
  });
}
