/**
 * POST /api/meetings/[id]/upload
 *
 * Accepts a multipart form-data body with a `file` field (audio). Uploads it
 * to Cloudflare R2 under `meetings/<uid>/<meeting_id>/<filename>` and stores
 * the public CDN URL on the meetings row. Caller can then call /transcribe.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { uploadToR2 } from "@/lib/server/r2-client";

const MAX_BYTES = 250 * 1024 * 1024; // 250 MB cap

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the meeting belongs to the caller (RLS would block otherwise,
  // but we prefer a clean 404 over a silent empty result).
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, created_by")
    .eq("id", params.id)
    .eq("created_by", user.id)
    .maybeSingle();
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 250 MB limit" }, { status: 413 });
  }

  const originalName = (file as File).name || "audio.webm";
  const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const r2Key = `meetings/${user.id}/${params.id}/${Date.now()}_${sanitized}`;
  const contentType = file.type || "audio/webm";

  const buffer = Buffer.from(await file.arrayBuffer());

  let audioUrl: string;
  try {
    audioUrl = await uploadToR2(r2Key, buffer, contentType);
  } catch (err) {
    console.error("[meetings/upload] R2 upload error:", err);
    return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
  }

  const { data: updated, error: updErr } = await supabase
    .from("meetings")
    .update({
      audio_url: audioUrl,
      audio_r2_key: r2Key,
      source_type: "upload",
      status: "processing",
    })
    .eq("id", params.id)
    .eq("created_by", user.id)
    .select()
    .single();
  if (updErr) {
    console.error("[meetings/upload] update error:", updErr);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    meeting: updated,
    storage_path: r2Key,
    audio_url: audioUrl,
  });
}
