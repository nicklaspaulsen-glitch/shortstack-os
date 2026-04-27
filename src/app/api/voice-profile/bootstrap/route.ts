/**
 * POST /api/voice-profile/bootstrap
 *
 * Body: { samples: string[] }
 *
 * Imports up to 10 manual writing samples, captures each as a corpus row,
 * then triggers a profile recompute. Used to seed the voice profile when
 * a user wants to short-circuit the "wait for the system to learn" loop.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  captureVoiceSample,
  recomputeVoiceProfile,
} from "@/lib/ai/voice-profile";

export const dynamic = "force-dynamic";

interface BootstrapBody {
  samples?: unknown;
  subjectKind?: unknown;
  subjectId?: unknown;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: BootstrapBody;
  try {
    body = (await request.json()) as BootstrapBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.samples)) {
    return NextResponse.json(
      { error: "samples must be a string array" },
      { status: 400 },
    );
  }

  // Default to bootstrapping the calling user's own voice. Owners can
  // optionally bootstrap a client's voice; we still verify ownership.
  const subjectKind =
    body.subjectKind === "client" || body.subjectKind === "team_member"
      ? body.subjectKind
      : "user";

  let subjectId = user.id;
  if (subjectKind !== "user") {
    if (typeof body.subjectId !== "string" || !body.subjectId) {
      return NextResponse.json(
        { error: "subjectId required when subjectKind is not 'user'" },
        { status: 400 },
      );
    }
    if (subjectKind === "client") {
      // Verify the caller owns this client.
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("id", body.subjectId)
        .eq("profile_id", user.id)
        .maybeSingle();
      if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
    }
    subjectId = body.subjectId;
  }

  const accepted = body.samples
    .filter((s): s is string => typeof s === "string" && s.trim().length > 10)
    .slice(0, 10);

  let captured = 0;
  for (const sample of accepted) {
    try {
      await captureVoiceSample({
        agencyOwnerId: user.id,
        subjectKind,
        subjectId,
        source: "manual_paste",
        body: sample,
        channel: "manual",
      });
      captured += 1;
    } catch (err) {
      console.warn("[voice-profile/bootstrap] capture failed", err);
    }
  }

  if (captured === 0) {
    return NextResponse.json(
      { error: "No usable samples found (each must be > 10 chars)" },
      { status: 400 },
    );
  }

  const result = await recomputeVoiceProfile({
    agencyOwnerId: user.id,
    subjectKind,
    subjectId,
  });

  return NextResponse.json({ ok: true, captured, recompute: result });
}
