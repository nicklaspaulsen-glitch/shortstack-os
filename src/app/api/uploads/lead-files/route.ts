import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { uploadToR2 } from "@/lib/server/r2-client";
import { secureCompare } from "@/lib/security/ssrf-guard";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "video/mp4", "video/quicktime", "video/webm",
  "application/zip",
  "text/plain", "text/csv",
]);

/**
 * POST /api/uploads/lead-files
 *
 * Accepts multipart form data with file(s) for a lead.
 * Uploads to R2 and records in lead_pipeline.files JSONB array
 * + lead_pipeline_files table.
 *
 * Fields:
 *   lead_id  — lead_pipeline.id
 *   file(s)  — one or more File objects
 *
 * Auth: authenticated session (agency owner uploading on behalf of lead),
 *       OR WEBHOOK_SECRET if called from n8n/Zernio with downloaded file URLs.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const serviceSupabase = createServiceClient();

  // Try session auth first
  const { data: { user } } = await supabase.auth.getUser();
  let ownerId: string | null = null;

  if (user) {
    ownerId = await getEffectiveOwnerId(supabase, user.id);
  } else {
    // Fall back to webhook key (allows n8n/Zernio to proxy files)
    const key =
      request.headers.get("x-webhook-key") ||
      new URL(request.url).searchParams.get("key");
    const expectedKey = process.env.WEBHOOK_SECRET;
    if (!expectedKey || !key || !secureCompare(key, expectedKey)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // When called via webhook, owner_id must be in the form field
    const rawOwner = request.headers.get("x-owner-id");
    if (rawOwner) ownerId = rawOwner;
  }

  if (!ownerId) {
    return NextResponse.json({ error: "Could not determine owner" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const leadId = formData.get("lead_id");
  if (!leadId || typeof leadId !== "string") {
    return NextResponse.json({ error: "Missing lead_id" }, { status: 400 });
  }

  // Verify lead ownership
  const { data: lead } = await serviceSupabase
    .from("lead_pipeline")
    .select("id, owner_id, files")
    .eq("id", leadId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found or not yours" }, { status: 404 });
  }

  const files = formData.getAll("file");
  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const uploaded: Array<{
    url: string;
    filename: string;
    type: string;
    size: number;
    uploaded_at: string;
  }> = [];
  const errors: string[] = [];

  for (const entry of files) {
    if (!(entry instanceof File)) {
      errors.push("Non-file entry skipped");
      continue;
    }

    if (entry.size > MAX_FILE_SIZE) {
      errors.push(`${entry.name}: exceeds 20 MB limit`);
      continue;
    }
    if (!ALLOWED_TYPES.has(entry.type)) {
      errors.push(`${entry.name}: type ${entry.type} not allowed`);
      continue;
    }

    const buffer = Buffer.from(await entry.arrayBuffer());
    const r2Key = `lead-files/${ownerId}/${leadId}/${Date.now()}-${entry.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    try {
      const r2Url = await uploadToR2(r2Key, buffer, entry.type);

      const fileRecord = {
        url: r2Url,
        filename: entry.name,
        type: entry.type,
        size: entry.size,
        uploaded_at: new Date().toISOString(),
      };

      uploaded.push(fileRecord);

      // Insert into lead_pipeline_files
      await serviceSupabase.from("lead_pipeline_files").insert({
        lead_id: leadId,
        owner_id: ownerId,
        filename: entry.name,
        file_url: r2Url,
        mime_type: entry.type,
        file_size: entry.size,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "upload_failed";
      errors.push(`${entry.name}: ${reason}`);
      console.error(`[uploads/lead-files] upload failed for ${entry.name}:`, reason);
    }
  }

  if (uploaded.length === 0) {
    return NextResponse.json(
      { ok: false, errors },
      { status: 400 },
    );
  }

  // Merge new files into lead_pipeline.files JSONB array
  const existingFiles: unknown[] = Array.isArray(lead.files)
    ? (lead.files as unknown[])
    : [];
  const mergedFiles = [...existingFiles, ...uploaded];

  await serviceSupabase
    .from("lead_pipeline")
    .update({ files: mergedFiles })
    .eq("id", leadId);

  return NextResponse.json({
    ok: true,
    uploaded: uploaded.length,
    files: uploaded,
    errors: errors.length > 0 ? errors : undefined,
  });
}
