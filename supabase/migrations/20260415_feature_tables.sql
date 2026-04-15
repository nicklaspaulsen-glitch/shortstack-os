-- ============================================================
-- calendar_events
-- ============================================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  client TEXT,
  team_member TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  time TEXT NOT NULL DEFAULT '09:00',
  duration TEXT NOT NULL DEFAULT '30',
  category TEXT NOT NULL DEFAULT 'meeting',
  type TEXT NOT NULL DEFAULT 'video',
  recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_events_own" ON calendar_events FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- deals
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  client_name     text NOT NULL,
  value           numeric NOT NULL DEFAULT 0,
  stage           text NOT NULL DEFAULT 'prospect'
                    CHECK (stage IN ('prospect','qualified','proposal_sent','negotiation','closed_won','closed_lost')),
  probability     integer NOT NULL DEFAULT 10,
  expected_close_date date,
  contact_email   text,
  contact_phone   text,
  notes           text,
  source          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_deals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_deals_updated_at();

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deals"
  ON deals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own deals"
  ON deals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own deals"
  ON deals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own deals"
  ON deals FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage   ON deals(stage);

-- ============================================================
-- community_posts
-- ============================================================
CREATE TABLE IF NOT EXISTS community_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  author_name   text NOT NULL,
  author_avatar text,
  title         text NOT NULL,
  content       text NOT NULL,
  category      text NOT NULL DEFAULT 'discussion'
                CHECK (category IN ('announcement','discussion','question','resource','showcase')),
  pinned        boolean NOT NULL DEFAULT false,
  likes         integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_user    ON community_posts (user_id);

-- ============================================================
-- notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  message     text NOT NULL,
  type        text NOT NULL DEFAULT 'info',
  read        boolean NOT NULL DEFAULT false,
  link        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- smtp_config
-- ============================================================
CREATE TABLE IF NOT EXISTS smtp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL DEFAULT '',
  use_tls BOOLEAN NOT NULL DEFAULT true,
  provider TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_smtp_config_user ON smtp_config(user_id);

ALTER TABLE smtp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own smtp config"   ON smtp_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own smtp config" ON smtp_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own smtp config" ON smtp_config FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own smtp config" ON smtp_config FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- white_label_config
-- ============================================================
CREATE TABLE IF NOT EXISTS white_label_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name    text,
  logo_url        text,
  primary_color   text,
  accent_color    text,
  favicon_url     text,
  login_text      text,
  show_powered_by boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_white_label_user ON white_label_config(user_id);

-- ============================================================
-- meeting_types
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_types (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  duration              integer NOT NULL DEFAULT 30,
  description           text,
  location_type         text NOT NULL DEFAULT 'zoom',
  color                 text,
  price                 numeric,
  active                boolean NOT NULL DEFAULT true,
  buffer_time           integer NOT NULL DEFAULT 0,
  max_bookings_per_day  integer,
  available_days        text[] NOT NULL DEFAULT '{mon,tue,wed,thu,fri}',
  available_hours_start text NOT NULL DEFAULT '09:00',
  available_hours_end   text NOT NULL DEFAULT '17:00',
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meeting_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meeting_types"
  ON meeting_types FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meeting_types"
  ON meeting_types FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meeting_types"
  ON meeting_types FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meeting_types"
  ON meeting_types FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_meeting_types_user_id ON meeting_types(user_id);

-- ============================================================
-- bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_type_id  uuid NOT NULL REFERENCES meeting_types(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_name       text NOT NULL,
  guest_email      text NOT NULL,
  guest_phone      text,
  date             date NOT NULL,
  time             text NOT NULL,
  status           text NOT NULL DEFAULT 'confirmed'
                     CHECK (status IN ('confirmed','cancelled','completed','no_show')),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookings"
  ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bookings"
  ON bookings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookings"
  ON bookings FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_meeting_type_id ON bookings(meeting_type_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);

-- ============================================================
-- content_assets
-- ============================================================
CREATE TABLE IF NOT EXISTS content_assets (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  file_url      text        NOT NULL,
  file_type     text        NOT NULL,
  file_size     integer     NOT NULL DEFAULT 0,
  mime_type     text,
  tags          text[]      DEFAULT '{}',
  collection_id text,
  width         integer,
  height        integer,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE content_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content_assets"
  ON content_assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own content_assets"
  ON content_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own content_assets"
  ON content_assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own content_assets"
  ON content_assets FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_content_assets_user ON content_assets(user_id);

-- ============================================================
-- content_collections
-- ============================================================
CREATE TABLE IF NOT EXISTS content_collections (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  description   text,
  color         text,
  asset_count   integer     DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE content_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content_collections"
  ON content_collections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own content_collections"
  ON content_collections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own content_collections"
  ON content_collections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own content_collections"
  ON content_collections FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_content_collections_user ON content_collections(user_id);

-- ============================================================
-- Supabase Storage bucket for content library
-- ============================================================
-- Run in Supabase Dashboard > Storage:
-- Create bucket "content-assets" with public access
