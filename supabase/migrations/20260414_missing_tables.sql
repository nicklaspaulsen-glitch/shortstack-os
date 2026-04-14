-- Migration: Create all missing tables referenced by application code
-- Date: 2026-04-14
-- Creates: voice_profiles, lora_models, batch_generations, client_uploads,
--          notifications, community_posts, community_comments, licenses,
--          ad_actions, settings
-- Also creates Supabase Storage bucket for client-uploads

-- ============================================
-- GPU AI TOOLS
-- ============================================

-- Voice cloning profiles (XTTS v2)
CREATE TABLE IF NOT EXISTS voice_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  embedding JSONB, -- speaker embedding vector from XTTS
  sample_duration DECIMAL(8,2), -- duration of sample audio in seconds
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_profiles_user ON voice_profiles(user_id);

-- LoRA fine-tuned models
CREATE TABLE IF NOT EXISTS lora_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  trigger_word TEXT,
  runpod_job_id TEXT,
  status TEXT DEFAULT 'pending', -- pending, training, ready, failed
  config JSONB DEFAULT '{}', -- training config (steps, lr, etc.)
  lora_url TEXT, -- URL to download the trained LoRA weights
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lora_models_user ON lora_models(user_id);
CREATE INDEX IF NOT EXISTS idx_lora_models_status ON lora_models(status);

-- Batch image generation jobs
CREATE TABLE IF NOT EXISTS batch_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_images INTEGER NOT NULL DEFAULT 1,
  model TEXT DEFAULT 'flux', -- flux, sdxl
  style TEXT,
  job_ids JSONB DEFAULT '[]', -- array of RunPod job IDs
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_generations_user ON batch_generations(user_id);

-- ============================================
-- CLIENT FILE UPLOADS
-- ============================================

CREATE TABLE IF NOT EXISTS client_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT DEFAULT 'unknown',
  file_size BIGINT DEFAULT 0,
  file_url TEXT,
  category TEXT, -- e.g. 'brand_assets', 'content', 'documents'
  status TEXT DEFAULT 'active', -- active, archived, deleted
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_uploads_client ON client_uploads(client_id);
CREATE INDEX IF NOT EXISTS idx_client_uploads_category ON client_uploads(category);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'info', -- info, success, warning, error, alert
  title TEXT NOT NULL,
  description TEXT,
  link TEXT, -- optional deep link within the app
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ============================================
-- COMMUNITY FORUM
-- ============================================

CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'discussion', -- discussion, question, announcement, showcase
  pinned BOOLEAN DEFAULT false,
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_pinned ON community_posts(pinned DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id);

-- ============================================
-- SOFTWARE LICENSES (for Electron desktop app)
-- ============================================

CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_key TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  tier TEXT DEFAULT 'Starter', -- Starter, Growth, Pro, Business, Unlimited
  status TEXT DEFAULT 'trial', -- trial, active, expired, revoked
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  machine_id TEXT, -- hardware lock for single-device activation
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_stripe_sub ON licenses(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ============================================
-- AD ACTIONS (AI-suggested campaign optimizations)
-- ============================================

CREATE TABLE IF NOT EXISTS ad_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  platform TEXT, -- meta_ads, tiktok_ads, google_ads
  action_type TEXT NOT NULL, -- budget_change, audience_adjust, creative_swap, etc.
  title TEXT,
  description TEXT,
  ai_reasoning TEXT,
  proposed_changes JSONB DEFAULT '{}',
  current_values JSONB DEFAULT '{}',
  parameters JSONB DEFAULT '{}',
  estimated_impact TEXT,
  priority TEXT DEFAULT 'medium', -- low, medium, high, critical
  status TEXT DEFAULT 'proposed', -- proposed, approved, executed, rejected, failed
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_actions_campaign ON ad_actions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_actions_status ON ad_actions(status);
CREATE INDEX IF NOT EXISTS idx_ad_actions_client ON ad_actions(client_id);

-- ============================================
-- APP SETTINGS (key-value store)
-- ============================================

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lora_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ── Voice Profiles: users see own ──────────────────────────────────
CREATE POLICY "voice_profiles_own" ON voice_profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "voice_profiles_admin" ON voice_profiles FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ── LoRA Models: users see own ─────────────────────────────────────
CREATE POLICY "lora_models_own" ON lora_models FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "lora_models_admin" ON lora_models FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ── Batch Generations: users see own ───────────────────────────────
CREATE POLICY "batch_generations_own" ON batch_generations FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "batch_generations_admin" ON batch_generations FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ── Client Uploads: admin + client own ─────────────────────────────
CREATE POLICY "client_uploads_admin" ON client_uploads FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "client_uploads_client" ON client_uploads FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));

-- ── Notifications: users see own ───────────────────────────────────
CREATE POLICY "notifications_own" ON notifications FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_admin" ON notifications FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ── Community Posts: anyone can read, own can write ────────────────
CREATE POLICY "community_posts_read" ON community_posts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "community_posts_insert" ON community_posts FOR INSERT
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "community_posts_update_own" ON community_posts FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "community_posts_delete_own" ON community_posts FOR DELETE
  USING (author_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');

CREATE POLICY "community_posts_admin" ON community_posts FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ── Community Comments: anyone can read, own can write ─────────────
CREATE POLICY "community_comments_read" ON community_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "community_comments_insert" ON community_comments FOR INSERT
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "community_comments_delete_own" ON community_comments FOR DELETE
  USING (author_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');

CREATE POLICY "community_comments_admin" ON community_comments FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ── Licenses: admin only (validated via service role in API) ───────
CREATE POLICY "licenses_admin" ON licenses FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ── Ad Actions: admin only ─────────────────────────────────────────
CREATE POLICY "ad_actions_admin" ON ad_actions FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "ad_actions_client" ON ad_actions FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));

-- ── Settings: admin only ───────────────────────────────────────────
CREATE POLICY "settings_admin" ON settings FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "settings_read" ON settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON lora_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- STORAGE BUCKET for client file uploads
-- ============================================

-- Note: Run this in Supabase Dashboard > Storage, or via:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('client-uploads', 'client-uploads', true)
-- ON CONFLICT (id) DO NOTHING;
