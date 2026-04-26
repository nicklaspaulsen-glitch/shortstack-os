import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifySniffedMime } from "@/lib/server/file-sniff";
import { uploadToR2, deleteFromR2, r2KeyFromPublicUrl } from "@/lib/server/r2-client";

export const maxDuration = 30;

// Mirror of src/lib/file-types.ts ALLOWED_LOGO. WebP added in the drag-drop
// fix sweep (commit pending) — this server route lagged behind the UI
// validation, so WebP uploads were 400'ing post-validation. Codex round-1
// caught the mismatch.
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * POST /api/white-label/logo-upload
 * ----------------------------------
 * Accepts a multipart/form-data upload with a single field "logo".
 * Validates type (png/jpeg/svg/webp) and size (≤2 MB).
 * Uploads to Cloudflare R2 under key `white-label/{user_id}/logo.{ext}` and
 * returns a cdn.shortstack.cloud URL the caller saves to white_label_config.logo_url.
 * Appends `?v={ts}` for cache-busting after logo replacement.
 * Best-effort deletes the previously stored logo when the extension changes.
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

  const service = createServiceClient();

  // Read file bytes once — shared between sniff + upload.
  const buffer = Buffer.from(await file.arrayBuffer());

  /*
   * DEFENSE LAYER 2 — server-side magic-byte MIME sniffing.
   * Layer 1 (above) validates file.type against ALLOWED_TYPES.
   * Layer 2 (here) reads the actual bytes to detect spoofed Content-Type.
   * SVG is text-based and returns null from the sniff; it is passed through
   * since the declared-type check above already accepted/rejected it.
   *
   * When the sniff returns a real MIME that is in the allowlist but differs
   * from declared (e.g. JPG mislabelled as PNG), we normalize the storage
   * extension + contentType to the sniffed type to avoid misleading paths.
   */
  const { sniffMimeType } = await import("@/lib/server/file-sniff");
  const sniffError = await verifySniffedMime(buffer, ALLOWED_TYPES, file.type);
  if (sniffError) {
    return NextResponse.json({ error: sniffError }, { status: 400 });
  }
  const sniffed = await sniffMimeType(buffer);
  // Use sniffed MIME when allowlisted; fall back to declared (SVG is unsniffable).
  const effectiveMime =
    sniffed && (ALLOWED_TYPES as string[]).includes(sniffed) ? sniffed : file.type;

  const extByMime: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  const ext = extByMime[effectiveMime] || "bin";
  // Deterministic key — overwriting the same key is R2's "upsert" equivalent.
  const r2Key = `white-label/${user.id}/logo.${ext}`;

  // Best-effort delete of the previous logo if it was already on R2.
  // We look up the existing logo_url from white_label_config and derive the
  // old key. A different extension (e.g. old PNG → new JPEG) means a stale
  // object would otherwise linger in the bucket.
  try {
    const { data: existing } = await service
      .from("white_label_config")
      .select("logo_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.logo_url) {
      const oldKey = r2KeyFromPublicUrl(existing.logo_url);
      if (oldKey && oldKey !== r2Key) {
        // Fire-and-forget — a delete failure must not block the upload.
        void deleteFromR2(oldKey).catch((e: unknown) => {
          console.warn("[white-label/logo-upload] old logo delete failed:", e);
        });
      }
    }
  } catch (e: unknown) {
    // Non-fatal — proceed with upload regardless.
    console.warn("[white-label/logo-upload] existing logo lookup failed:", e);
  }

  // Upload to R2. The deterministic key means this is idempotent on retry.
  let publicUrl: string;
  try {
    const cdnUrl = await uploadToR2(r2Key, buffer, effectiveMime);
    // Append cache-bust query param so the browser doesn't serve the old logo
    // from its HTTP cache after a replace.
    publicUrl = `${cdnUrl}?v=${Date.now()}`;
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[white-label/logo-upload] R2 upload error:", detail);
    return NextResponse.json(
      { error: "Failed to upload logo to storage", detail },
      { status: 500 },
    );
  }

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
      r2_key: r2Key,
    },
  });

  return NextResponse.json({
    success: true,
    logo_url: publicUrl,
    public_url: publicUrl,
    r2_key: r2Key,
    size: file.size,
    type: file.type,
  });
}
