-- Transcription jobs queue.
-- ------------------------------------------------------------------
-- Long audio (>60s of cold-start time on RunPod) returns a job id from
-- the runsync endpoint instead of inline output. Callers persist a row
-- here and `/api/cron/poll-transcription-jobs` finishes the work, then
-- updates the source table (meetings.transcript_raw / voice_calls.transcript).
--
-- Provider matches the TranscriptionProvider TS union — we use a text
-- column instead of an enum to avoid a future migration when we add new
-- providers (Deepgram, AssemblyAI, etc).
--
-- Source-row coupling: (source_table, source_id) tells the cron handler
-- which row to write back to. agency_owner_id duplicates the FK so RLS
-- lookups don't need a join.
--
-- Indexes: pending-status partial index for the cron's WHERE filter, plus
-- (source_table, source_id) so re-runs / lookups by row are O(1).

CREATE TABLE IF NOT EXISTS public.transcription_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  audio_url text NOT NULL,
  provider text NOT NULL,
  provider_job_id text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','completed','failed')),
  diarize boolean NOT NULL DEFAULT false,
  language text,
  speaker_count_hint int,
  result jsonb,
  error_message text,
  attempts int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Pending-status partial index — cron picks up rows in this set every
-- minute; everything else is irrelevant to that query.
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_pending
  ON public.transcription_jobs(status, started_at)
  WHERE status IN ('queued','processing');

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_source
  ON public.transcription_jobs(source_table, source_id);

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_owner
  ON public.transcription_jobs(agency_owner_id, started_at DESC);

ALTER TABLE public.transcription_jobs ENABLE ROW LEVEL SECURITY;

-- Owner can see + manage their own rows. Service role bypasses RLS so the
-- cron / webhooks can update arbitrary rows.
DROP POLICY IF EXISTS "transcription_jobs_owner" ON public.transcription_jobs;
CREATE POLICY "transcription_jobs_owner"
  ON public.transcription_jobs
  FOR ALL
  USING (agency_owner_id = auth.uid())
  WITH CHECK (agency_owner_id = auth.uid());

COMMENT ON TABLE public.transcription_jobs IS
  'Async transcription job queue. Polled by /api/cron/poll-transcription-jobs every minute.';
COMMENT ON COLUMN public.transcription_jobs.provider IS
  'TranscriptionProvider TS union: openai_whisper | runpod_faster_whisper | runpod_whisperx';
COMMENT ON COLUMN public.transcription_jobs.source_table IS
  'meetings | voice_calls — the row to write the transcript back to on completion';
