/**
 * POST /api/voice-profile/recompute
 *
 * Body (optional):
 *   { subjectKind?: "user" | "client" | "team_member", subjectId?: string }
 *
 * Manual refresh trigger. Defaults to recomputing the caller's own voice.
 * Owners can refresh a client's voice; ownership is verified server-side.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { recomputeVoiceProfile } from "@/lib/ai/voice-profile";

export const dynamic = "force-dynamic";

interface RecomputeBody {
  subjectKind?: unknown;
  subjectId?: unknown;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: RecomputeBody = {};
  try {
    body = (await request.json().catch(() => ({}))) as RecomputeBody;
  } catch {
    body = {};
  }

  const subjectKind =
    body.subjectKind === "client" || body.subjectKind === "team_member"
      ? body.subjectKind
      : "user";

  let subjectId = user.id;
  if (subjectKind !== "user") {
    if (typeof body.subjectId !== "string" || !body.subjectId) {
      return NextResponse.json(
        { error: "subjectId required" },
        { status: 400 },
      );
    }
    if (subjectKind === "client") {
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

  const result = await recomputeVoiceProfile({
    agencyOwnerId: user.id,
    subjectKind,
    subjectId,
  });

  return NextResponse.json(result);
}
