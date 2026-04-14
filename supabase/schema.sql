-- ShortStack OS Database Schema
-- Run this in Supabase SQL Editor

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE user_role AS ENUM ('admin', 'team_member', 'client');
CREATE TYPE lead_status AS ENUM ('new', 'called', 'not_interested', 'booked', 'converted');
CREATE TYPE outreach_platform AS ENUM ('instagram', 'linkedin', 'facebook', 'tiktok');
CREATE TYPE outreach_status AS ENUM ('sent', 'delivered', 'replied', 'no_reply', 'bounced');
CREATE TYPE followup_status AS ENUM ('pending', 'sent', 'completed', 'cancelled');
CREATE TYPE contract_status AS ENUM ('draft', 'sent', 'viewed', 'signed', 'expired', 'declined');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE content_status AS ENUM ('idea', 'scripted', 'in_production', 'editing', 'ready_to_publish', 'scheduled', 'published', 'failed');
CREATE TYPE publish_platform AS ENUM ('youtube', 'youtube_shorts', 'tiktok', 'instagram_reels', 'facebook_reels', 'linkedin_video');
CREATE TYPE campaign_platform AS ENUM ('meta_ads', 'tiktok_ads', 'google_ads');
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');
CREATE TYPE integration_status AS ENUM ('healthy', 'degraded', 'down', 'unknown');
CREATE TYPE trinity_action_type AS ENUM ('website', 'ai_receptionist', 'chatbot', 'automation', 'discord', 'social_setup', 'email_campaign', 'sms_campaign', 'lead_gen', 'custom');
CREATE TYPE brand_idea_type AS ENUM ('long_form', 'short_form');
CREATE TYPE deal_status AS ENUM ('open', 'won', 'lost');

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'client',
  phone TEXT,
  country TEXT,
  timezone TEXT DEFAULT 'Europe/Copenhagen',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 1: LEAD ENGINE
-- ============================================

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name TEXT NOT NULL,
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  google_rating DECIMAL(2,1),
  review_count INTEGER DEFAULT 0,
  industry TEXT,
  category TEXT,
  source TEXT NOT NULL, -- google_maps, linkedin, facebook
  source_url TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  linkedin_url TEXT,
  tiktok_url TEXT,
  status lead_status DEFAULT 'new',
  ghl_contact_id TEXT,
  ghl_sync_status TEXT DEFAULT 'pending', -- pending, synced, failed
  ghl_synced_at TIMESTAMPTZ,
  assigned_to TEXT, -- cold caller name in GHL
  scraped_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(phone, business_name)
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_industry ON leads(industry);
CREATE INDEX idx_leads_scraped_at ON leads(scraped_at);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_business_name ON leads USING gin(business_name gin_trgm_ops);

CREATE TABLE outreach_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  platform outreach_platform NOT NULL,
  business_name TEXT NOT NULL,
  recipient_handle TEXT,
  message_text TEXT NOT NULL,
  status outreach_status DEFAULT 'sent',
  reply_text TEXT,
  replied_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_outreach_platform ON outreach_log(platform);
CREATE INDEX idx_outreach_sent_at ON outreach_log(sent_at);
CREATE INDEX idx_outreach_status ON outreach_log(status);

CREATE TABLE follow_up_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outreach_id UUID REFERENCES outreach_log(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  platform outreach_platform NOT NULL,
  followup_number INTEGER NOT NULL DEFAULT 1, -- 1=day3, 2=day7
  scheduled_date DATE NOT NULL,
  status followup_status DEFAULT 'pending',
  message_text TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_followup_scheduled ON follow_up_queue(scheduled_date, status);

-- ============================================
-- SECTION 2: CLIENT PORTAL
-- ============================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  industry TEXT,
  package_tier TEXT, -- e.g. 'Starter', 'Growth', 'Enterprise'
  services JSONB DEFAULT '[]', -- array of active services
  mrr DECIMAL(10,2) DEFAULT 0,
  contract_status contract_status DEFAULT 'draft',
  pandadoc_contract_id TEXT,
  ghl_contact_id TEXT,
  stripe_customer_id TEXT,
  health_score INTEGER DEFAULT 100, -- 0-100
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clients_active ON clients(is_active);

CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  pandadoc_id TEXT,
  title TEXT NOT NULL,
  status contract_status DEFAULT 'draft',
  value DECIMAL(10,2),
  start_date DATE,
  end_date DATE,
  signed_at TIMESTAMPTZ,
  document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status invoice_status DEFAULT 'draft',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  invoice_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE client_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  due_date DATE,
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 3: TEAM & PAYROLL
-- ============================================

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL, -- e.g. 'Cold Caller', 'Video Editor', 'Ads Manager'
  base_pay DECIMAL(10,2) DEFAULT 0,
  commission_rate DECIMAL(5,2) DEFAULT 0, -- percentage
  payment_method TEXT, -- e.g. 'bank_transfer', 'paypal', 'wise'
  payment_details JSONB DEFAULT '{}',
  country TEXT,
  is_active BOOLEAN DEFAULT true,
  started_at DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  service TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status deal_status DEFAULT 'open',
  closed_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  cold_called_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_closed_at ON deals(closed_at);

CREATE TABLE payroll (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- first of month
  base_amount DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  deals_closed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, approved, paid
  paid_at TIMESTAMPTZ,
  payslip_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payroll_month ON payroll(month);

-- ============================================
-- SECTION 4: CONTENT AI AGENT
-- ============================================

CREATE TABLE content_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  script_type TEXT NOT NULL, -- 'long_form', 'short_form'
  brand_voice TEXT,
  script_body TEXT,
  hook TEXT,
  outline JSONB, -- structured outline
  seo_title TEXT,
  description TEXT,
  hashtags TEXT[],
  keywords TEXT[],
  chapters JSONB, -- youtube chapters
  thumbnail_idea TEXT,
  target_platform publish_platform,
  status content_status DEFAULT 'idea',
  drive_folder_url TEXT,
  assigned_editor UUID REFERENCES team_members(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE content_calendar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  content_script_id UUID REFERENCES content_scripts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  platform publish_platform NOT NULL,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status content_status DEFAULT 'scheduled',
  live_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_content_calendar_scheduled ON content_calendar(scheduled_at);

CREATE TABLE content_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  requester_name TEXT NOT NULL,
  source TEXT, -- 'slack', 'dm', 'dashboard'
  request_text TEXT NOT NULL,
  ai_brief TEXT,
  status TEXT DEFAULT 'new', -- new, reviewed, approved, in_progress, completed
  assigned_editor UUID REFERENCES team_members(id),
  reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE publish_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  content_script_id UUID REFERENCES content_scripts(id) ON DELETE SET NULL,
  video_title TEXT NOT NULL,
  description TEXT,
  hashtags TEXT[],
  thumbnail_text TEXT,
  scheduled_at TIMESTAMPTZ,
  publish_now BOOLEAN DEFAULT false,
  platforms publish_platform[] NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, publishing, published, failed
  published_urls JSONB DEFAULT '{}', -- platform -> url mapping
  error_message TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE personal_brand_ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idea_type brand_idea_type NOT NULL,
  title TEXT NOT NULL,
  hook TEXT,
  outline JSONB,
  thumbnail_concept TEXT,
  estimated_length TEXT,
  target_keyword TEXT,
  platform_recommendation TEXT,
  trending_angle TEXT,
  core_concept TEXT,
  is_approved BOOLEAN DEFAULT false,
  added_to_calendar BOOLEAN DEFAULT false,
  batch_date DATE NOT NULL, -- the Sunday it was generated
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_personal_brand_batch ON personal_brand_ideas(batch_date);

-- ============================================
-- SECTION 5: ADS MANAGER
-- ============================================

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform campaign_platform NOT NULL,
  external_campaign_id TEXT,
  status campaign_status DEFAULT 'draft',
  budget_daily DECIMAL(10,2),
  budget_total DECIMAL(10,2),
  spend DECIMAL(10,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  ctr DECIMAL(6,4) DEFAULT 0,
  cpc DECIMAL(10,2) DEFAULT 0,
  roas DECIMAL(10,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  settings JSONB DEFAULT '{}',
  ai_suggestions TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ad_creatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  canva_design_id TEXT,
  title TEXT NOT NULL,
  headline TEXT,
  body_text TEXT,
  cta_text TEXT,
  image_url TEXT,
  video_url TEXT,
  platform campaign_platform NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, approved, active, paused
  performance JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 6: TRINITY AI AGENT
-- ============================================

CREATE TABLE trinity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type trinity_action_type NOT NULL,
  description TEXT NOT NULL,
  command TEXT, -- the command that triggered this
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'started', -- started, in_progress, completed, failed
  result JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trinity_log_created ON trinity_log(created_at DESC);

CREATE TABLE trinity_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_chat_id TEXT,
  user_id UUID REFERENCES profiles(id),
  messages JSONB DEFAULT '[]',
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SECTION 7: SYSTEM MONITOR
-- ============================================

CREATE TABLE system_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_name TEXT NOT NULL,
  status integration_status DEFAULT 'unknown',
  last_check_at TIMESTAMPTZ DEFAULT now(),
  last_healthy_at TIMESTAMPTZ,
  error_message TEXT,
  response_time_ms INTEGER,
  uptime_percentage DECIMAL(5,2) DEFAULT 100,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_system_health_name ON system_health(integration_name);

CREATE TABLE system_health_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_name TEXT NOT NULL,
  status integration_status NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_health_history_name ON system_health_history(integration_name, checked_at DESC);

-- ============================================
-- SECTION 8: MORNING BRIEFING
-- ============================================

CREATE TABLE briefings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content JSONB NOT NULL, -- structured briefing data
  summary TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_briefings_user ON briefings(user_id, generated_at DESC);

-- ============================================
-- SOCIAL ACCOUNTS (for multi-platform publishing)
-- ============================================

CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  account_name TEXT,
  account_id TEXT,
  access_token TEXT, -- encrypted in practice
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_brand_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE trinity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE trinity_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(uid UUID)
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = uid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Admin can see everything
CREATE POLICY "admin_all" ON profiles FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "users_read_own" ON profiles FOR SELECT
  USING (id = auth.uid());

-- Leads: admin and team members
CREATE POLICY "leads_admin_team" ON leads FOR ALL
  USING (get_user_role(auth.uid()) IN ('admin', 'team_member'));

-- Outreach: admin and team members
CREATE POLICY "outreach_admin_team" ON outreach_log FOR ALL
  USING (get_user_role(auth.uid()) IN ('admin', 'team_member'));

CREATE POLICY "followup_admin_team" ON follow_up_queue FOR ALL
  USING (get_user_role(auth.uid()) IN ('admin', 'team_member'));

-- Clients: admin sees all, clients see own
CREATE POLICY "clients_admin" ON clients FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "clients_own" ON clients FOR SELECT
  USING (profile_id = auth.uid());

-- Contracts
CREATE POLICY "contracts_admin" ON contracts FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "contracts_client" ON contracts FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));

-- Invoices
CREATE POLICY "invoices_admin" ON invoices FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "invoices_client" ON invoices FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));

-- Client Tasks
CREATE POLICY "tasks_admin" ON client_tasks FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "tasks_client" ON client_tasks FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));

-- Team Members: admin only
CREATE POLICY "team_admin" ON team_members FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "team_own" ON team_members FOR SELECT
  USING (profile_id = auth.uid());

-- Deals
CREATE POLICY "deals_admin" ON deals FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "deals_team" ON deals FOR SELECT
  USING (get_user_role(auth.uid()) = 'team_member');

-- Payroll: admin sees all, team sees own
CREATE POLICY "payroll_admin" ON payroll FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "payroll_own" ON payroll FOR SELECT
  USING (team_member_id IN (SELECT id FROM team_members WHERE profile_id = auth.uid()));

-- Content
CREATE POLICY "content_scripts_admin_team" ON content_scripts FOR ALL
  USING (get_user_role(auth.uid()) IN ('admin', 'team_member'));

CREATE POLICY "content_calendar_admin_team" ON content_calendar FOR ALL
  USING (get_user_role(auth.uid()) IN ('admin', 'team_member'));

CREATE POLICY "content_requests_all" ON content_requests FOR ALL
  USING (get_user_role(auth.uid()) IN ('admin', 'team_member'));

CREATE POLICY "publish_queue_admin" ON publish_queue FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "personal_brand_admin" ON personal_brand_ideas FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- Campaigns
CREATE POLICY "campaigns_admin" ON campaigns FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "campaigns_client" ON campaigns FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));

CREATE POLICY "ad_creatives_admin" ON ad_creatives FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- Trinity
CREATE POLICY "trinity_log_admin" ON trinity_log FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "trinity_conv_admin" ON trinity_conversations FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- System Health
CREATE POLICY "system_health_admin" ON system_health FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "system_health_history_admin" ON system_health_history FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- Briefings
CREATE POLICY "briefings_own" ON briefings FOR ALL
  USING (user_id = auth.uid());

-- Social Accounts
CREATE POLICY "social_admin" ON social_accounts FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON content_scripts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON content_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON system_health FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON social_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Calculate payroll for a team member for a given month
CREATE OR REPLACE FUNCTION calculate_payroll(
  p_team_member_id UUID,
  p_month DATE
)
RETURNS TABLE(base DECIMAL, commission DECIMAL, total DECIMAL, deal_count INTEGER) AS $$
DECLARE
  v_base DECIMAL;
  v_rate DECIMAL;
  v_commission DECIMAL;
  v_deal_count INTEGER;
BEGIN
  SELECT base_pay, commission_rate INTO v_base, v_rate
  FROM team_members WHERE id = p_team_member_id;

  SELECT COUNT(*), COALESCE(SUM(amount), 0) * (v_rate / 100)
  INTO v_deal_count, v_commission
  FROM deals
  WHERE closed_by = p_team_member_id
    AND status = 'won'
    AND DATE_TRUNC('month', closed_at) = DATE_TRUNC('month', p_month);

  RETURN QUERY SELECT v_base, v_commission, v_base + v_commission, v_deal_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SECTION 9: GPU AI TOOLS
-- ============================================

CREATE TABLE voice_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  embedding JSONB,
  sample_duration DECIMAL(8,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_voice_profiles_user ON voice_profiles(user_id);

CREATE TABLE lora_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  trigger_word TEXT,
  runpod_job_id TEXT,
  status TEXT DEFAULT 'pending',
  config JSONB DEFAULT '{}',
  lora_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lora_models_user ON lora_models(user_id);
CREATE INDEX idx_lora_models_status ON lora_models(status);

CREATE TABLE batch_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_images INTEGER NOT NULL DEFAULT 1,
  model TEXT DEFAULT 'flux',
  style TEXT,
  job_ids JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_batch_generations_user ON batch_generations(user_id);

-- ============================================
-- SECTION 10: CLIENT UPLOADS
-- ============================================

CREATE TABLE client_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT DEFAULT 'unknown',
  file_size BIGINT DEFAULT 0,
  file_url TEXT,
  category TEXT,
  status TEXT DEFAULT 'active',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_client_uploads_client ON client_uploads(client_id);
CREATE INDEX idx_client_uploads_category ON client_uploads(category);

-- ============================================
-- SECTION 11: NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================
-- SECTION 12: COMMUNITY FORUM
-- ============================================

CREATE TABLE community_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'discussion',
  pinned BOOLEAN DEFAULT false,
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_community_posts_author ON community_posts(author_id);
CREATE INDEX idx_community_posts_pinned ON community_posts(pinned DESC, created_at DESC);

CREATE TABLE community_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_community_comments_post ON community_comments(post_id);

-- ============================================
-- SECTION 13: SOFTWARE LICENSES
-- ============================================

CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_key TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  tier TEXT DEFAULT 'Starter',
  status TEXT DEFAULT 'trial',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  machine_id TEXT,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_licenses_email ON licenses(email);
CREATE INDEX idx_licenses_status ON licenses(status);

-- ============================================
-- SECTION 14: AD ACTIONS
-- ============================================

CREATE TABLE ad_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  platform TEXT,
  action_type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  ai_reasoning TEXT,
  proposed_changes JSONB DEFAULT '{}',
  current_values JSONB DEFAULT '{}',
  parameters JSONB DEFAULT '{}',
  estimated_impact TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'proposed',
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ad_actions_campaign ON ad_actions(campaign_id);
CREATE INDEX idx_ad_actions_status ON ad_actions(status);

-- ============================================
-- SECTION 15: APP SETTINGS
-- ============================================

CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
