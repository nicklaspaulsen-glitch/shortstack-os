import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { uploadToR2 } from "@/lib/server/r2-client";

// CRUD for voicemail templates.
//
// Templates store a name + audio file (mp3/wav uploaded to R2) + duration.
// Used by the dialer / contact-card "Drop voicemail" action which calls
// /api/voicemail/drop with a template_id.
//
//  GET    list owner's templates
//  POST   multipart/form-data: { name, audio: File } — uploads to R2
//  DELETE ?id=X

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMES = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav"]);

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("voicemail_templates")
    .select("id, name, audio_url, duration_seconds, created_at")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const name = (formData.get("name") as string | null)?.trim();
  const audio = formData.get("audio") as File | null;
  const durationStr = formData.get("duration_seconds") as string | null;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!audio || !(audio instanceof File)) {
    return NextResponse.json({ error: "audio file required" }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "audio file too large (max 5 MB)" }, { status: 400 });
  }
  if (!ALLOWED_MIMES.has(audio.type)) {
    return NextResponse.json(
      { error: `unsupported audio type ${audio.type} — use mp3 or wav` },
      { status: 400 },
    );
  }

  const ext = audio.type === "audio/wav" || audio.type === "audio/wave" || audio.type === "audio/x-wav" ? "wav" : "mp3";
  const key = `voicemail/${ownerId}/${Date.now()}-${name.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.${ext}`;

  let publicUrl: string;
  try {
    const buf = Buffer.from(await audio.arrayBuffer());
    publicUrl = await uploadToR2(key, buf, audio.type);
  } catch (err) {
    console.error("[voicemail/templates] R2 upload failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "R2 upload failed" },
      { status: 500 },
    );
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("voicemail_templates")
    .insert({
      user_id: ownerId,
      name,
      audio_url: publicUrl,
      duration_seconds: durationStr ? parseInt(durationStr, 10) || null : null,
    })
    .select("id, name, audio_url, duration_seconds, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service
    .from("voicemail_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
