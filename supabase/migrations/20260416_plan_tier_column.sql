-- Add plan_tier column to profiles for tracking subscription tier
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_tier text DEFAULT NULL;

-- Also add stripe_customer_id and client_label if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS client_label text DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text DEFAULT NULL;
