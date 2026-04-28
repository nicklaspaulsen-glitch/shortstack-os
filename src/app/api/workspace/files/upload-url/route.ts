/**
 * Workspace Files — pre-signed PUT URL for direct browser → R2 upload.
 *
 * POST /api/workspace/files/upload-url
 *   Body: { folder_id: uuid, name: string, mime_type: string, size_bytes: number }
 *
 *   Returns: { upload_url, file_id, r2_key, public_url }
 *
 * Flow:
 *   1. Validate the destination folder belongs to the resolved agency owner.
 *   2. Reject obviously bad mime types / oversized payloads.
 *   3. Insert a `workspace_files` row in 'pending' status with the computed
 *      r2_key. The DB is the source of truth — if the browser PUT fails, the
 *      pending row is collected by a future sweeper.
 *   4. Return a 5-minute presigned PUT URL.
 *   5. Browser PUTs the file. On success, calls /finalize to flip status.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  getR2SignedPutUrl,
  r2PublicUrlFor,
  SIGNED_PUT_URL_TTL_SECONDS,
} from "@/lib/server/r2-client";
import { buildWorkspaceFileKey, MAX_UPLOAD_BYTES } from "@/lib/workspace/keys";
import { getOwnedFolder, isUuid } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIME_RE = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i;

interface UploadBody {
  folder_id?: unknown;
  name?: unknown;
  mime_type?: unknown;
  size_bytes?: unknown;
  client_id?: unknown;
  source?: unknown;
}

const ALLOWED_SOURCES = [
  "manual",
  "thumbnail_editor",
  "video_editor",
  "ai_studio",
  "client_portal",
] as const;

type Source = (typeof ALLOWED_SOURCES)[number];

function isSource(v: unknown): v is Source {
  return typeof v === "string" && (ALLOWED_SOURCES as readonly string[]).includes(v);
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as UploadBody | null;
  if (!body) return NextResponse.json({ error: "Body required" }, { status: 400 });

  const folderId = body.folder_id;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const mime = typeof body.mime_type === "string" ? body.mime_type.trim() : "";
  const size = typeof body.size_bytes === "number" ? body.size_bytes : NaN;

  if (!folderId || !isUuid(folderId)) {
    return NextResponse.json({ error: "folder_id (uuid) required" }, { status: 400 });
  }
  if (!name || name.length > 240) {
    return NextResponse.json({ error: "name required (1-240 chars)" }, { status: 400 });
  }
  if (!mime || !MIME_RE.test(mime) || mime.length > 120) {
    return NextResponse.json({ error: "mime_type must be a valid IANA type" }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `size_bytes must be 1..${MAX_UPLOAD_BYTES}` },
      { status: 400 },
    );
  }

  const folder = await getOwnedFolder(supabase, folderId as string, ownerId);
  if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  // Optional fields.
  const clientId = body.client_id ?? null;
  if (clientId !== null && !isUuid(clientId)) {
    return NextResponse.json({ error: "client_id must be a uuid or null" }, { status: 400 });
  }
  const source: Source = isSource(body.source) ? body.source : "manual";

  const r2Key = buildWorkspaceFileKey({
    agencyOwnerId: ownerId,
    folderId: folderId as string,
    fileName: name,
  });

  // Insert the pending row BEFORE issuing the URL so a downstream race can
  // never produce an orphan R2 object with no DB pointer.
  const { data: row, error: insertErr } = await supabase
    .from("workspace_files")
    .insert({
      agency_owner_id: ownerId,
      folder_id: folderId,
      client_id: clientId,
      name,
      size_bytes: size,
      mime_type: mime,
      r2_key: r2Key,
      r2_public_url: r2PublicUrlFor(r2Key),
      status: "pending",
      source,
      uploaded_by: user.id,
    })
    .select("id, r2_key, r2_public_url")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Generate the presigned PUT (5 min TTL by default).
  let uploadUrl: string;
  try {
    uploadUrl = await getR2SignedPutUrl(r2Key, mime);
  } catch (err: unknown) {
    // Roll back the pending row so the user can retry without piling up
    // half-failed inserts.
    await supabase.from("workspace_files").delete().eq("id", row.id);
    const msg = err instanceof Error ? err.message : "Failed to sign URL";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    upload_url: uploadUrl,
    upload_method: "PUT",
    upload_headers: { "Content-Type": mime },
    expires_in: SIGNED_PUT_URL_TTL_SECONDS,
    file_id: row.id,
    r2_key: row.r2_key,
    public_url: row.r2_public_url,
  });
}
