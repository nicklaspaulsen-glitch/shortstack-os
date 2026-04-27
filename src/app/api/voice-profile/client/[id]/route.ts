/**
 * GET /api/voice-profile/client/[id]
 *
 * Returns the writing-voice profile for a specific client owned by the
 * caller. Used by the client-detail "Voice Profile" tab.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getVoiceProfile, VOICE_MIN_CORPUS_WORDS } from "@/lib/ai/voice-profile";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the caller owns this client.
  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name")
    .eq("id", params.id)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const profile = await getVoiceProfile({
    subjectKind: "client",
    subjectId: client.id,
  });

  return NextResponse.json({
    profile,
    minCorpusWords: VOICE_MIN_CORPUS_WORDS,
    active: profile && profile.corpus_size_words >= VOICE_MIN_CORPUS_WORDS,
    client: { id: client.id, business_name: client.business_name },
  });
}
