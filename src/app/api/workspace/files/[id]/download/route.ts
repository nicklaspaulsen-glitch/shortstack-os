/**
 * Workspace Files — issue a 5-minute signed GET URL for download.
 *
 * GET /api/workspace/files/[id]/download
 *   Returns: { url, expires_in }
 *
 * Files served via the public R2 CDN don't strictly need this — the bucket
 * has been configured for public reads. But folders with `permission`
 * `'owner_only'` should not expose persistent public URLs in DB; for those,
 * always use this signed-GET route in the UI download path.
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

const DOWNLOAD_TTL_SECONDS = 300; // 5 minutes per acceptance criteria

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const fileId = ctx.params.id;
  if (!isUuid(fileId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const file = await getOwnedFile(supabase, fileId, ownerId);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let url: string;
  try {
    url = await getR2SignedGetUrl(file.r2_key, DOWNLOAD_TTL_SECONDS);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to sign URL";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    url,
    expires_in: DOWNLOAD_TTL_SECONDS,
    name: file.name,
    mime_type: file.mime_type,
  });
}
