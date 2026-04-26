import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifySniffedMime } from "@/lib/server/file-sniff";

export const maxDuration = 30;

// Mirror of src/lib/file-types.ts ALLOWED_LOGO. WebP added in the drag-drop
// fix sweep (commit pending) — this server route lagged behind the UI
// validation, so WebP uploads were 400'ing post-validation. Codex round-1
// caught the mismatch.
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const BUCKET = "white-label-assets";

/**
 * POST /api/white-label/logo-upload
 * ----------------------------------
 * Accepts a multipart/form-data upload with a single field "logo".
 * Validates type (png/jpeg/svg) and size (≤2 MB).
 * Uploads to the public Supabase Storage bucket `white-label-assets` and
 * returns a public URL the caller can save to white_label_config.logo_url.
 *
 * Logs the action in trinity_log (action_type = "custom",
 * metadata.kind = "white_label_logo_upload").
 */
export async function POST(req: Request) {
  // Auth check (cookie-based)
  const supabase = createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (!user || authErr) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("logo") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No logo file provided (field name must be \"logo\")" }, { status: 400 });
  }

  // Validate type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type "${file.type}". Allowed: PNG, JPEG, WebP, SVG.` },
      { status: 400 }
    );
  }

  // Validate size
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Max 2 MB.` },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }

  // Service client for Storage (bypasses RLS, needed to ensure bucket exists)
  const service = createServiceClient();

  // Ensure the bucket exists (create as public if it doesn't).
  // Storage admin operations are available on the service client.
  try {
    const { data: buckets } = await service.storage.listBuckets();
    const exists = Array.isArray(buckets) && buckets.some((b: { name: string }) => b.name === BUCKET);
    if (!exists) {
      await service.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_BYTES,
        allowedMimeTypes: ALLOWED_TYPES,
      });
    }
  } catch (err) {
    // Non-fatal — if the bucket already exists / can't be listed, the upload
    // attempt below will surface a precise error.
    console.warn("[white-label/logo-upload] bucket check warning:", err);
  }

  // Build deterministic per-user path so re-uploads overwrite cleanly.
  const buffer = Buffer.from(await file.arrayBuffer());

  /*
   * DEFENSE LAYER 2 — server-side magic-byte MIME sniffing.
   * Layer 1 (above) validates file.type against ALLOWED_TYPES.
   * Layer 2 (here) reads the actual bytes to detect spoofed Content-Type.
   * SVG is text-based and returns null from the sniff; it is passed through
   * since the declared-type check above already accepted/rejected it.
   *
   * Codex round-1 follow-up: when the sniff returns a real MIME that's
   * in the allowlist but DIFFERENT from declared (e.g. user uploads a
   * JPG mislabelled as PNG), normalize storage extension + contentType
   * to the SNIFFED type so the file isn't stored under a misleading
   * path/header.
   */
  const { sniffMimeType } = await import("@/lib/server/file-sniff");
  const sniffError = await verifySniffedMime(buffer, ALLOWED_TYPES, file.type);
  if (sniffError) {
    return NextResponse.json({ error: sniffError }, { status: 400 });
  }
  const sniffed = await sniffMimeType(buffer);
  // Use sniffed MIME when it's allowlisted; fall back to declared
  // (necessary for SVG which is unsniffable).
  const effectiveMime =
    sniffed && (ALLOWED_TYPES as string[]).includes(sniffed) ? sniffed : file.type;

  const extByMime: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  const ext = extByMime[effectiveMime] || "bin";
  const path = `${user.id}/logo.${ext}`;

  // Upload to the white-label bucket (upsert to allow re-upload).
  const { error: uploadErr } = await service.storage
    .from(BUCKET)
    .upload(path, buffer, {
      upsert: true,
      contentType: effectiveMime,
      cacheControl: "3600",
    });

  if (uploadErr) {
    console.error("[white-label/logo-upload] upload error:", uploadErr);
    return NextResponse.json(
      { error: "Failed to upload logo to storage", detail: uploadErr.message },
      { status: 500 }
    );
  }

  // Public URL (bucket is public, so this is directly accessible)
  const { data: urlData } = service.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  // Log to trinity_log (action_type "custom", metadata describes the kind)
  void service.from("trinity_log").insert({
    action_type: "custom",
    description: `White-label logo uploaded (${(file.size / 1024).toFixed(1)} KB ${file.type})`,
    status: "completed",
    user_id: user.id,
    result: { url: publicUrl, size: file.size, type: file.type },
    metadata: {
      kind: "white_label_logo_upload",
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      bucket: BUCKET,
      path,
    },
  });

  return NextResponse.json({
    success: true,
    logo_url: publicUrl,
    public_url: publicUrl,
    bucket: BUCKET,
    path,
    size: file.size,
    type: file.type,
  });
}
