-- Writing-voice profiles + corpus for personalised AI text matching.
-- (Distinct from `voice_profiles` which stores audio voice-clone embeddings.)
-- Each agency owner can have writing voice profiles for: themselves (user),
-- each client (so AI can write in the client's voice), and team members.

-- Raw text samples that build a person's writing voice profile.
CREATE TABLE IF NOT EXISTS public.writing_voice_corpus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_kind text NOT NULL CHECK (subject_kind IN ('user', 'client', 'team_member')),
  subject_id uuid NOT NULL,
  source text NOT NULL,                  -- 'sent_email' | 'reply_sms' | 'social_post' | 'meeting_transcript' | 'manual_paste' | 'reply_dm'
  body text NOT NULL,
  channel text,                          -- 'email' | 'sms' | 'dm' | 'social' | 'meeting' | 'manual'
  word_count int NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_writing_voice_corpus_subject ON public.writing_voice_corpus(subject_kind, subject_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_writing_voice_corpus_owner_recent ON public.writing_voice_corpus(agency_owner_id, captured_at DESC);

ALTER TABLE public.writing_voice_corpus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "writing_voice_corpus_owner" ON public.writing_voice_corpus;
CREATE POLICY "writing_voice_corpus_owner" ON public.writing_voice_corpus
  FOR ALL USING (agency_owner_id = auth.uid()) WITH CHECK (agency_owner_id = auth.uid());

-- Computed writing-voice profiles (one per subject).
CREATE TABLE IF NOT EXISTS public.writing_voice_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_kind text NOT NULL CHECK (subject_kind IN ('user', 'client', 'team_member')),
  subject_id uuid NOT NULL,
  corpus_size_words int NOT NULL DEFAULT 0,
  formality_score numeric,                -- 0 (casual) to 1 (formal)
  avg_sentence_length numeric,
  contraction_rate numeric,
  emoji_rate numeric,
  em_dash_rate numeric,
  exclamation_rate numeric,
  signature_phrases text[],
  signature_openings text[],
  signature_closings text[],
  tone_keywords text[],
  vocabulary_signature jsonb,
  prompt_snippet text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  corpus_size_at_computation int NOT NULL DEFAULT 0,
  CONSTRAINT writing_voice_profiles_unique UNIQUE (subject_kind, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_writing_voice_profiles_owner ON public.writing_voice_profiles(agency_owner_id);

ALTER TABLE public.writing_voice_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "writing_voice_profiles_owner" ON public.writing_voice_profiles;
CREATE POLICY "writing_voice_profiles_owner" ON public.writing_voice_profiles
  FOR ALL USING (agency_owner_id = auth.uid()) WITH CHECK (agency_owner_id = auth.uid());
