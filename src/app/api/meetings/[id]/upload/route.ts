/**
 * POST /api/meetings/[id]/upload
 *
 * Accepts a multipart form-data body with a `file` field (audio). Uploads it
 * to the `meetings` Storage bucket under `<uid>/<meeting_id>/<filename>` and
 * stores a signed URL on the meetings row. Caller can then call /transcribe.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7; // 7 days
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
  const path = `${user.id}/${params.id}/${Date.now()}_${sanitized}`;

  const buffer = new Uint8Array(await file.arrayBuffer());
  const { error: uploadErr } = await supabase.storage
    .from("meetings")
    .upload(path, buffer, {
      contentType: file.type || "audio/webm",
      upsert: false,
    });
  if (uploadErr) {
    console.error("[meetings/upload] storage error:", uploadErr);
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from("meetings")
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (signErr) {
    console.error("[meetings/upload] sign error:", signErr);
    return NextResponse.json({ error: signErr.message }, { status: 500 });
  }

  const audioUrl = signed?.signedUrl || null;

  const { data: updated, error: updErr } = await supabase
    .from("meetings")
    .update({
      audio_url: audioUrl,
      audio_r2_key: path,
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
    storage_path: path,
    audio_url: audioUrl,
  });
}
