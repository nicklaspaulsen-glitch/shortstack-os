/**
 * Zapier / generic webhook — external drop of a file metadata payload.
 *
 * POST /api/webhooks/zapier/[clientId]/[secret]/file-dropped
 *   body: {
 *     filename: string,
 *     mime_type?: string,
 *     size_bytes?: number,
 *     url?: string,           // direct public URL — we fetch & store
 *     external_id?: string,
 *     metadata?: object
 *   }
 *
 * The `[secret]` path segment must match WEBHOOK_SECRET — same pattern as
 * `/api/telegram/webhook/*` (secret-in-path, silent 200 on mismatch so
 * scanners can't enumerate).
 *
 * If `url` is provided we try to download the file and stash it in the
 * client-files bucket. Otherwise the row is inserted with status='pending'
 * and no storage_url — a downstream worker can hydrate it later.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  CLIENT_FILES_BUCKET,
  buildClientFileStorageKey,
  checkAndReserveQuota,
  incrementQuotaUsage,
} from "@/lib/cloud-drive/client-files-helpers";

const MAX_FETCH_BYTES = 200 * 1024 * 1024; // 200 MB cap on webhook-fetched blobs

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string; secret: string } },
) {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected || params.secret !== expected) {
    // Silent — don't leak whether the secret exists.
    return NextResponse.json({ ok: true });
  }

  let body: {
    filename?: string;
    mime_type?: string;
    size_bytes?: number;
    url?: string;
    external_id?: string;
    metadata?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const filename = (body.filename || "").trim();
  if (!filename) {
    return NextResponse.json({ error: "filename required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Validate clientId actually exists before we do anything.
  const { data: client } = await service
    .from("clients")
    .select("id")
    .eq("id", params.clientId)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Unknown client" }, { status: 404 });
  }

  // Dedupe on external_id if provided.
  if (body.external_id) {
    const { data: existing } = await service
      .from("client_files")
      .select("id")
      .eq("client_id", params.clientId)
      .eq("source", "webhook")
      .eq("external_id", body.external_id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: true, deduped: true, file_id: existing.id });
    }
  }

  let storageKey: string | null = null;
  let sizeBytes = Number(body.size_bytes || 0);
  let mimeType = body.mime_type || "application/octet-stream";
  let status: "pending" | "ready" | "failed" = "pending";
  let orgIdForQuota: string | null = null;

  if (body.url) {
    try {
      const r = await fetch(body.url);
      if (!r.ok) throw new Error(`fetch ${r.status}`);
      const ct = r.headers.get("content-type");
      if (ct) mimeType = ct.split(";")[0];
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.byteLength > MAX_FETCH_BYTES) {
        throw new Error(`file > ${MAX_FETCH_BYTES} bytes`);
      }
      sizeBytes = buf.byteLength;

      const quota = await checkAndReserveQuota(service, params.clientId, sizeBytes);
      if (!quota.allowed) {
        return NextResponse.json({ error: "over_quota" }, { status: 413 });
      }
      orgIdForQuota = quota.orgId;

      const key = buildClientFileStorageKey(params.clientId, filename);
      const { error: storageError } = await service.storage
        .from(CLIENT_FILES_BUCKET)
        .upload(key, buf, { contentType: mimeType, upsert: false });
      if (storageError) throw new Error(`storage: ${storageError.message}`);
      storageKey = key;
      status = "ready";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      console.error("[zapier webhook] fetch failed:", msg);
      status = "failed";
    }
  }

  const { data: row, error: insertError } = await service
    .from("client_files")
    .insert({
      client_id: params.clientId,
      source: "webhook",
      external_id: body.external_id || null,
      filename,
      mime_type: mimeType,
      size_bytes: sizeBytes || null,
      storage_url: storageKey,
      status,
      metadata: body.metadata || {},
    })
    .select()
    .single();
  if (insertError) {
    if (storageKey) {
      await service.storage.from(CLIENT_FILES_BUCKET).remove([storageKey]);
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (orgIdForQuota && sizeBytes > 0 && status === "ready") {
    await incrementQuotaUsage(service, orgIdForQuota, sizeBytes);
  }

  return NextResponse.json({ ok: true, file: row });
}
