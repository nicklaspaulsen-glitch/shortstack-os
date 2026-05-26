import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { synthesize, getDefaultClone } from "@/lib/voice/clone-router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  text?: string;
  clone_id?: string;
  template_name?: string;
}

const MAX_TEXT = 1500;

/**
 * POST /api/voicemail/render-template
 *
 * Bridge between Voice Studio and Voicemail Drop:
 *   1. Render the supplied text using the chosen clone (defaults to the
 *      caller's voicemail-default clone).
 *   2. Insert a voicemail_templates row pointing at the rendered audio.
 *   3. Return the new template id so the Voicemail Drop UI can pick it up.
 *
 * Body: { text, clone_id?, template_name? }
 *
 * The audio is cached by (clone_id, text-hash), so calling this with the
 * same (clone, text) reuses the already-rendered file.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = (body.text || "").trim();
  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > MAX_TEXT) {
    return NextResponse.json(
      { error: `text exceeds ${MAX_TEXT} chars` },
      { status: 400 },
    );
  }

  // Resolve clone — explicit or surface-default.
  let cloneId = body.clone_id;
  if (!cloneId) {
    const fallback = await getDefaultClone({
      agencyOwnerId: ownerId,
      surface: "voicemail",
    });
    if (!fallback) {
      return NextResponse.json(
        {
          error:
            "No voice clone provided and no voicemail-default configured. Visit /dashboard/voice-studio to set one.",
        },
        { status: 400 },
      );
    }
    cloneId = fallback.id;
  } else {
    // Apr 28 IDOR fix: caller-supplied `clone_id` must belong to the
    // caller's agency. Without this check, an authenticated user could
    // synthesize using another agency's voice clone (and the synthesis
    // cache would attribute usage to that other agency).
    const supabaseRls = createServerSupabase();
    const { data: ownsClone } = await supabaseRls
      .from("voice_clones")
      .select("id")
      .eq("id", cloneId)
      .eq("agency_owner_id", ownerId)
      .maybeSingle();
    if (!ownsClone) {
      return NextResponse.json({ error: "Voice clone not found or not yours" }, { status: 403 });
    }
  }

  try {
    const result = await synthesize({
      cloneId,
      text,
      agencyOwnerId: ownerId,
      format: "mp3",
      context: "voicemail_template",
    });

    const service = createServiceClient();
    const templateName =
      (body.template_name || "").trim() || `Voice Studio · ${new Date().toISOString().slice(0, 16)}`;
    const { data: tpl, error: insErr } = await service
      .from("voicemail_templates")
      .insert({
        user_id: ownerId,
        name: templateName,
        audio_url: result.r2Url,
        duration_seconds: Math.round(result.durationSeconds),
      })
      .select("id, name, audio_url, duration_seconds")
      .single();

    if (insErr) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      template: tpl,
      cached: result.cached,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}
