import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/thumbnail/face-upload
// Accepts a multipart form with a single `file` field. Stores the image at
// `faces/{profile_id}/{timestamp}-{rand}.{ext}` and returns the public URL.
// Used by the face-swap modal in /dashboard/thumbnail-generator.
// ──────────────────────────────────────────────────────────────────────────

export const maxDuration = 30;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB (matches bucket file_size_limit)

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid multipart form" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "file field required" }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ ok: false, error: "Only JPEG, PNG, or WebP allowed" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "File exceeds 10 MB" }, { status: 400 });
  }

  const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const key = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  // Use the service client so we bypass RLS. We've already verified the user
  // and we're writing under a path keyed to their user id.
  const db = createServiceClient();
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await db.storage
    .from("faces")
    .upload(key, buf, { contentType: file.type, upsert: false });
  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  const { data: pub } = db.storage.from("faces").getPublicUrl(key);

  return NextResponse.json({
    ok: true,
    url: pub.publicUrl,
    path: key,
  });
}
