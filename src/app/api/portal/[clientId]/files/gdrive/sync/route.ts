/**
 * POST /api/portal/[clientId]/files/gdrive/sync
 *   body: { fileIds: string[] }
 *
 * Imports the selected Drive files into Supabase Storage + `client_files`
 * (source='gdrive', external_id=drive file id). Skips files already imported
 * (unique on client_id + source + external_id). Enforces the org quota.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";
import { downloadGDriveFile, gdriveFromTokens } from "@/lib/cloud-drive/gdrive";
import { decryptToken } from "@/lib/crypto/token-cipher";
import {
  CLIENT_FILES_BUCKET,
  buildClientFileStorageKey,
  checkAndReserveQuota,
  incrementQuotaUsage,
} from "@/lib/cloud-drive/client-files-helpers";

const MAX_SYNC_BATCH = 25;

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(supabase, user.id, params.clientId);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { fileIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const fileIds = (body.fileIds || []).filter((id) => typeof id === "string").slice(0, MAX_SYNC_BATCH);
  if (!fileIds.length) {
    return NextResponse.json(
      { error: "fileIds (string[]) required (non-empty, up to 25)" },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { data: tokenRow } = await service
    .from("client_oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("client_id", params.clientId)
    .eq("provider", "gdrive")
    .is("revoked_at", null)
    .maybeSingle();
  if (!tokenRow) {
    return NextResponse.json(
      { error: "Google Drive not connected" },
      { status: 400 },
    );
  }

  let access_token: string;
  let refresh_token: string | null = null;
  try {
    access_token = decryptToken(tokenRow.access_token);
    if (tokenRow.refresh_token) refresh_token = decryptToken(tokenRow.refresh_token);
  } catch (e) {
    console.error("[gdrive sync] decrypt failed:", e);
    return NextResponse.json(
      { error: "Stored token could not be decrypted — please reconnect" },
      { status: 500 },
    );
  }

  const drive = gdriveFromTokens({
    access_token,
    refresh_token,
    expires_at: tokenRow.expires_at,
  });

  const imported: Array<Record<string, unknown>> = [];
  const skipped: Array<{ fileId: string; reason: string }> = [];

  for (const fileId of fileIds) {
    // ── Look up metadata first so we can quota-check before we download. ──
    let meta;
    try {
      const res = await drive.files.get({
        fileId,
        fields: "id, name, mimeType, size",
      });
      meta = res.data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      skipped.push({ fileId, reason: `metadata: ${msg}` });
      continue;
    }

    // Dedupe against what's already imported for this client/source.
    const { data: existing } = await service
      .from("client_files")
      .select("id")
      .eq("client_id", params.clientId)
      .eq("source", "gdrive")
      .eq("external_id", fileId)
      .maybeSingle();
    if (existing) {
      skipped.push({ fileId, reason: "already_imported" });
      continue;
    }

    const approxSize = Number(meta.size || 0);
    const quota = await checkAndReserveQuota(service, params.clientId, approxSize || 1);
    if (!quota.allowed) {
      skipped.push({ fileId, reason: "over_quota" });
      continue;
    }

    // ── Download + upload ────────────────────────────────────────
    let download;
    try {
      download = await downloadGDriveFile(
        drive,
        fileId,
        meta.mimeType || "application/octet-stream",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "download failed";
      skipped.push({ fileId, reason: `download: ${msg}` });
      continue;
    }

    const baseName = meta.name || `gdrive-${fileId}`;
    const finalName = download.suggestedExt
      ? `${baseName}${baseName.toLowerCase().endsWith(download.suggestedExt.toLowerCase()) ? "" : download.suggestedExt}`
      : baseName;
    const key = buildClientFileStorageKey(params.clientId, finalName);

    const { error: storageError } = await service.storage
      .from(CLIENT_FILES_BUCKET)
      .upload(key, download.buffer, {
        contentType: download.mimeType,
        upsert: false,
      });
    if (storageError) {
      skipped.push({ fileId, reason: `storage: ${storageError.message}` });
      continue;
    }

    const sizeBytes = download.buffer.byteLength;
    const { data: row, error: insertError } = await service
      .from("client_files")
      .insert({
        client_id: params.clientId,
        uploaded_by: user.id,
        source: "gdrive",
        external_id: fileId,
        filename: finalName,
        mime_type: download.mimeType,
        size_bytes: sizeBytes,
        storage_url: key,
        status: "ready",
        metadata: {
          original_mime_type: meta.mimeType || null,
          original_name: baseName,
        },
      })
      .select()
      .single();
    if (insertError) {
      await service.storage.from(CLIENT_FILES_BUCKET).remove([key]);
      skipped.push({ fileId, reason: `db: ${insertError.message}` });
      continue;
    }
    if (quota.orgId) await incrementQuotaUsage(service, quota.orgId, sizeBytes);
    imported.push(row);
  }

  return NextResponse.json({ imported, skipped });
}
