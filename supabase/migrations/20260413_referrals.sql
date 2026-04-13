-- Migration: Referral system
-- Date: 2026-04-13
-- Adds persistent referral codes to profiles and a referrals tracking table

-- ── Add referral_code to profiles ──────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code) WHERE referral_code IS NOT NULL;

-- ── Referrals tracking table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_name TEXT,
  referred_email TEXT,
  referred_phone TEXT,
  status TEXT DEFAULT 'pending', -- pending, signed_up, converted, expired
  converted_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  commission_rate DECIMAL(5,2) DEFAULT 10.00, -- percentage
  commission_earned DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_email ON referrals(referred_email);

-- ── RLS ────────────────────────────────────────────────────────────
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Admin can manage all referrals
CREATE POLICY "referrals_admin" ON referrals FOR ALL
  USING (get_user_role(auth.uid()) = 'admin');

-- Users can see their own referrals
CREATE POLICY "referrals_own" ON referrals FOR SELECT
  USING (referrer_id = auth.uid());

-- Users can insert their own referrals
CREATE POLICY "referrals_insert_own" ON referrals FOR INSERT
  WITH CHECK (referrer_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
