-- Mobile push tokens — registers Expo push tokens per user.
--
-- Each row represents one device. A user can have multiple rows when
-- they install the app on more than one device. The (token) column
-- carries the Expo push token (looks like ExponentPushToken[xxxxx]).
--
-- We deliberately avoid foreign key on `user_id` to `profiles` — the
-- existing tables in this repo use `profiles(id)` interchangeably with
-- `auth.users(id)` (they're the same uuid). Other migrations in this
-- repo follow that convention.

CREATE TABLE IF NOT EXISTS mobile_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios','android','web')),
  device_name text,
  os_version text,
  app_version text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Failed-delivery tracking. After N consecutive failures we treat
  -- the token as dead and skip it. Reset to 0 on next successful send.
  failure_count int NOT NULL DEFAULT 0,
  is_dead boolean NOT NULL DEFAULT false
);

-- One row per (user, token). If the same user installs the app on a
-- new device with the same token (rare but possible), we update the
-- existing row instead of duplicating.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mobile_push_tokens_user_token
  ON mobile_push_tokens(user_id, token);

CREATE INDEX IF NOT EXISTS idx_mobile_push_tokens_user
  ON mobile_push_tokens(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mobile_push_tokens_alive
  ON mobile_push_tokens(user_id) WHERE is_dead = false;

ALTER TABLE mobile_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users see only their own tokens. The /api/mobile/push-tokens route
-- runs as the user (createServerSupabase()) so RLS is the actual gate.
DROP POLICY IF EXISTS "mobile_push_tokens_own" ON mobile_push_tokens;
CREATE POLICY "mobile_push_tokens_own"
  ON mobile_push_tokens
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role bypasses RLS for the admin notify path.
COMMENT ON TABLE mobile_push_tokens IS
  'Expo push tokens registered by the mobile shell. RLS owners only; service role used for fan-out sends.';
