/**
 * POST /api/uploads/r2
 *
 * Generic authenticated R2 upload for images + short videos. Used by
 * surfaces that need a public CDN URL the AI can fetch (Social Studio
 * AI Auto-Upload was the original caller — see audit Apr 26 M1: Tab2AIUpload
 * was passing blob: URLs to /auto-upload + /schedule, which Claude and
 * Zernio cannot fetch).
 *
 * Pattern mirrors src/app/api/portal/uploads/route.ts and
 * src/app/api/white-label/logo-upload/route.ts (Layer-1 declared-MIME
 * allowlist + Layer-2 magic-byte sniff). Lighter than portal/uploads —
 * no DB row, no notifications, just upload + return URL.
 *
 * Request:    multipart/form-data with field "file"
 * Response:   { url, r2_key, size, type, kind }
 * Status:     200 on success; 400 invalid file; 401 unauth;
 *             413 too large; 500 R2 error
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifySniffedMime } from "@/lib/server/file-sniff";
import { ALLOWED_IMAGES, ALLOWED_VIDEOS } from "@/lib/file-types";
import { uploadToR2 } from "@/lib/server/r2-client";

export const maxDuration = 30;

// Images + videos. Audio + docs intentionally excluded — surfaces that
// need those (portal uploads, voice clones) have their own endpoints.
const ALLOWED_TYPES = [...ALLOWED_IMAGES, ...ALLOWED_VIDEOS] as const;
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — covers most short-form social video.

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (!user || authErr) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const fileEntry = form.get("file");
  if (!fileEntry || typeof fileEntry === "string") {
    return NextResponse.json({ error: 'file field required' }, { status: 400 });
  }
  const file = fileEntry as File;

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File exceeds ${MAX_BYTES / 1024 / 1024} MB limit (${(file.size / 1024 / 1024).toFixed(2)} MB)` },
      { status: 413 },
    );
  }

  // Layer 1: declared MIME allowlist. Reject empty Content-Type explicitly
  // so an attacker can't bypass both layers via a no-Content-Type upload.
  if (!file.type || !(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      {
        error: file.type
          ? `Unsupported MIME type "${file.type}". Allowed: ${ALLOWED_TYPES.join(", ")}.`
          : "Missing Content-Type — upload must declare a supported MIME.",
      },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Layer 2: magic-byte sniff. Catches spoofed Content-Type when the bytes
  // disagree with the declared type.
  const sniffError = await verifySniffedMime(buffer, ALLOWED_TYPES, file.type);
  if (sniffError) {
    return NextResponse.json({ error: sniffError }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const r2Key = `social-media/${user.id}/${Date.now()}-${safeName}`;
  const isVideo = file.type.startsWith("video/");
  const kind: "image" | "video" = isVideo ? "video" : "image";

  let cdnUrl: string;
  try {
    cdnUrl = await uploadToR2(r2Key, buffer, file.type);
  } catch (err: unknown) {
    const detail = "Internal server error";
    console.error("[uploads/r2] R2 upload error:", detail);
    return NextResponse.json(
      { error: "Failed to upload to storage", detail },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: cdnUrl,
    r2_key: r2Key,
    size: file.size,
    type: file.type,
    kind,
  });
}
