/**
 * GET /api/voice-profile/me
 *
 * Returns the calling user's writing-voice profile, or `null` if none has
 * been computed yet. Used by `/dashboard/settings/voice-profile`.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getVoiceProfile, VOICE_MIN_CORPUS_WORDS } from "@/lib/ai/voice-profile";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getVoiceProfile({
    subjectKind: "user",
    subjectId: user.id,
  });

  return NextResponse.json({
    profile,
    minCorpusWords: VOICE_MIN_CORPUS_WORDS,
    active: profile && profile.corpus_size_words >= VOICE_MIN_CORPUS_WORDS,
  });
}
