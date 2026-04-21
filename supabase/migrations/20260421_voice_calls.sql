-- voice_calls — inbound/outbound call log keyed by Twilio CallSid.
-- Receives upserts from /api/twilio/voice-webhook and /api/twilio/voice-status-callback.
-- On completion, outcome is classified via Claude Haiku and surfaced in the
-- voice-receptionist dashboard. Fires the voice_call_completed workflow trigger.

CREATE TABLE IF NOT EXISTS voice_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  twilio_call_sid text UNIQUE,
  eleven_agent_id text,
  from_number text,
  to_number text,
  direction text CHECK (direction IN ('inbound','outbound')),
  duration_seconds int,
  status text CHECK (status IN ('ringing','in_progress','completed','failed','no_answer','busy','spam')),
  outcome text CHECK (outcome IN ('booked','qualified','unqualified','spam','dropped','pending')),
  transcript text,
  recording_url text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_voice_calls_profile_started
  ON voice_calls(profile_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_calls_client_started
  ON voice_calls(client_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_calls_twilio_sid
  ON voice_calls(twilio_call_sid);

ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners view own voice calls" ON voice_calls;
CREATE POLICY "Owners view own voice calls" ON voice_calls
  FOR SELECT USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Owners manage own voice calls" ON voice_calls;
CREATE POLICY "Owners manage own voice calls" ON voice_calls
  FOR ALL USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
