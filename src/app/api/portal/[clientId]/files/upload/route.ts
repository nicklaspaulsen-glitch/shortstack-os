/**
 * Portal file drop upload.
 *
 * POST /api/portal/[clientId]/files/upload
 *   Multipart form upload (field name: `file`; optional `project_id`).
 *
 *   Flow:
 *     1. Verify caller has access to [clientId].
 *     2. Check org quota. Return 413 if the upload would overflow.
 *     3. Upload the file to Supabase Storage (`client-files` bucket).
 *     4. Insert `client_files` row (source='portal_upload').
 *     5. Increment org_file_quotas.bytes_used.
 *     6. Notify the agency owner (best-effort).
 *
 *   Response: { file: ClientFileRow, signed_url: string | null, quota: {...} }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";
import {
  CLIENT_FILES_BUCKET,
  buildClientFileStorageKey,
  checkAndReserveQuota,
  incrementQuotaUsage,
} from "@/lib/cloud-drive/client-files-helpers";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB hard cap per file
const SIGNED_URL_TTL_SECONDS = 3600;

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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = form.get("file");
  const projectIdRaw = form.get("project_id");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "file field required" }, { status: 400 });
  }

  const uploaded = file as File;
  if (uploaded.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        error: `File exceeds per-file ${Math.round(
          MAX_FILE_SIZE / 1024 / 1024,
        )} MB limit (${uploaded.size} bytes)`,
      },
      { status: 413 },
    );
  }

  const service = createServiceClient();

  // ── Quota gate ────────────────────────────────────────────────
  const quota = await checkAndReserveQuota(service, params.clientId, uploaded.size);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "Upload would exceed your plan's storage limit",
        reason: quota.reason,
        bytes_used: quota.bytesUsed,
        bytes_limit: quota.bytesLimit,
      },
      { status: 413 },
    );
  }

  // ── Write to Storage ──────────────────────────────────────────
  const path = buildClientFileStorageKey(params.clientId, uploaded.name);
  const buffer = Buffer.from(await uploaded.arrayBuffer());
  const { error: storageError } = await service.storage
    .from(CLIENT_FILES_BUCKET)
    .upload(path, buffer, {
      contentType: uploaded.type || "application/octet-stream",
      upsert: false,
    });
  if (storageError) {
    console.error("[client-files upload] storage error:", storageError);
    return NextResponse.json(
      { error: `Storage upload failed: ${storageError.message}` },
      { status: 500 },
    );
  }

  // ── client_files row ──────────────────────────────────────────
  const { data: row, error: insertError } = await service
    .from("client_files")
    .insert({
      client_id: params.clientId,
      uploaded_by: user.id,
      source: "portal_upload",
      filename: uploaded.name,
      mime_type: uploaded.type || null,
      size_bytes: uploaded.size,
      storage_url: path,
      project_id: typeof projectIdRaw === "string" && projectIdRaw ? projectIdRaw : null,
      status: "ready",
      metadata: { original_content_type: uploaded.type || null },
    })
    .select()
    .single();
  if (insertError) {
    // Best-effort cleanup of orphan storage object
    await service.storage.from(CLIENT_FILES_BUCKET).remove([path]);
    console.error("[client-files upload] insert error:", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // ── Quota accounting ─────────────────────────────────────────
  if (quota.orgId) {
    await incrementQuotaUsage(service, quota.orgId, uploaded.size);
  }

  // ── Signed URL for immediate preview ─────────────────────────
  const { data: signed } = await service.storage
    .from(CLIENT_FILES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  // ── Notify the agency owner (best-effort) ────────────────────
  try {
    if (quota.orgId && quota.orgId !== user.id) {
      await service.from("notifications").insert({
        user_id: quota.orgId,
        title: "New client file drop",
        message: `${uploaded.name} (${Math.round(uploaded.size / 1024)} KB) dropped by a client`,
        type: "info",
        link: "/dashboard/client-files",
      });
    }
  } catch (e) {
    console.warn("[client-files upload] notify failed:", e);
  }

  return NextResponse.json({
    file: row,
    signed_url: signed?.signedUrl || null,
    quota: {
      bytes_used: quota.bytesUsed + uploaded.size,
      bytes_limit: quota.bytesLimit,
    },
  });
}

// List client files for the portal (convenient companion to POST).
export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(supabase, user.id, params.clientId);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data: files, error } = await service
    .from("client_files")
    .select(
      "id, client_id, uploaded_by, source, external_id, filename, mime_type, size_bytes, storage_url, project_id, status, metadata, created_at",
    )
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const withUrls = await Promise.all(
    (files || []).map(async (f) => {
      if (!f.storage_url) return { ...f, signed_url: null };
      const { data: signed } = await service.storage
        .from(CLIENT_FILES_BUCKET)
        .createSignedUrl(f.storage_url, SIGNED_URL_TTL_SECONDS);
      return { ...f, signed_url: signed?.signedUrl || null };
    }),
  );

  return NextResponse.json({ files: withUrls });
}
