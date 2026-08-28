-- SQL Schema for Thumbnail Studio
-- Run this in your Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('thumbnails', 'thumbnails', true),
  ('user-assets', 'user-assets', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

-- Storage policies
DROP POLICY IF EXISTS "Public can read thumbnails bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload their avatar to thumbnails bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their avatar in thumbnails bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their avatar in thumbnails bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read their own user assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload their own user assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their own user assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own user assets" ON storage.objects;

CREATE POLICY "Public can read thumbnails bucket"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'thumbnails');

CREATE POLICY "Authenticated users can upload their avatar to thumbnails bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'thumbnails'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Authenticated users can update their avatar in thumbnails bucket"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'thumbnails'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'thumbnails'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Authenticated users can delete their avatar in thumbnails bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'thumbnails'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Authenticated users can read their own user assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated users can upload their own user assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated users can update their own user assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated users can delete their own user assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 1. Profiles table (linked to Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
  ON profiles FOR SELECT 
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON profiles FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON profiles FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. Assets table (uploaded images)
CREATE TABLE IF NOT EXISTS assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for assets
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assets" 
  ON assets FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assets" 
  ON assets FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets" 
  ON assets FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Generations table (AI generated thumbnails)
CREATE TABLE IF NOT EXISTS generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT,
  prompt TEXT NOT NULL,
  urls TEXT[] NOT NULL, -- Array of image URLs
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE generations ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS generations_user_archived_created_idx ON generations (user_id, archived_at, created_at DESC);

-- Enable RLS for generations
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own generations" 
  ON generations FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generations" 
  ON generations FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generations"
  ON generations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generations" 
  ON generations FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Drafts table (saved editor states)
CREATE TABLE IF NOT EXISTS drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT 'Untitled Draft',
  data JSONB NOT NULL, -- Editor state (layers, settings, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for drafts
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own drafts" 
  ON drafts FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drafts" 
  ON drafts FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts" 
  ON drafts FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts" 
  ON drafts FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. Billing memberships (synced from Whop webhooks)
CREATE TABLE IF NOT EXISTS billing_memberships (
  membership_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  whop_user_id TEXT,
  product_id TEXT,
  plan_id TEXT,
  plan_key TEXT,
  status TEXT,
  manage_url TEXT,
  currency TEXT,
  renewal_period_start TIMESTAMP WITH TIME ZONE,
  renewal_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS billing_memberships_user_id_idx ON billing_memberships (user_id, updated_at DESC);

ALTER TABLE billing_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own billing memberships" ON billing_memberships;

CREATE POLICY "Users can view their own billing memberships"
  ON billing_memberships FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Credit ledger
CREATE TABLE IF NOT EXISTS credit_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  entry_direction TEXT NOT NULL CHECK (entry_direction IN ('credit', 'debit')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  source_type TEXT NOT NULL CHECK (
    source_type IN ('free_monthly', 'payment', 'top_up', 'generation_debit', 'generation_refund', 'admin_adjustment')
  ),
  description TEXT NOT NULL,
  membership_id TEXT,
  external_reference TEXT,
  idempotency_key TEXT UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_ledger_user_id_idx ON credit_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_ledger_source_type_idx ON credit_ledger (source_type, created_at DESC);

ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own credit ledger" ON credit_ledger;

CREATE POLICY "Users can view their own credit ledger"
  ON credit_ledger FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 7. Processed webhooks for replay protection
CREATE TABLE IF NOT EXISTS processed_webhooks (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;

-- 8. Billing helper functions
CREATE OR REPLACE FUNCTION get_credit_balance(target_user UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    COALESCE(
      SUM(
        CASE
          WHEN entry_direction = 'credit' THEN amount
          ELSE -amount
        END
      ),
      0
    ),
    0
  )::INTEGER
  FROM credit_ledger
  WHERE user_id = target_user;
$$;

CREATE OR REPLACE FUNCTION consume_credit(
  target_user UUID,
  idempotency_key_input TEXT,
  debit_description TEXT DEFAULT 'AI thumbnail generation'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(target_user::TEXT));

  SELECT get_credit_balance(target_user) INTO current_balance;

  IF current_balance < 1 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO credit_ledger (
    user_id,
    entry_direction,
    amount,
    source_type,
    description,
    idempotency_key
  )
  VALUES (
    target_user,
    'debit',
    1,
    'generation_debit',
    debit_description,
    idempotency_key_input
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION grant_hobby_credits_if_due(
  target_user UUID,
  grant_amount INTEGER DEFAULT 3
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_membership_exists BOOLEAN;
  latest_free_grant TIMESTAMP WITH TIME ZONE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(target_user::TEXT));

  SELECT EXISTS (
    SELECT 1
    FROM billing_memberships
    WHERE user_id = target_user
      AND status IN ('active', 'trialing')
  )
  INTO active_membership_exists;

  IF active_membership_exists THEN
    RETURN FALSE;
  END IF;

  SELECT MAX(created_at)
  INTO latest_free_grant
  FROM credit_ledger
  WHERE user_id = target_user
    AND entry_direction = 'credit'
    AND source_type = 'free_monthly';

  IF latest_free_grant IS NOT NULL AND latest_free_grant > NOW() - INTERVAL '30 days' THEN
    RETURN FALSE;
  END IF;

  INSERT INTO credit_ledger (
    user_id,
    entry_direction,
    amount,
    source_type,
    description,
    idempotency_key,
    metadata
  )
  VALUES (
    target_user,
    'credit',
    GREATEST(grant_amount, 0),
    'free_monthly',
    'Hobby monthly credit refill',
    'free:' || target_user::TEXT || ':' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISSMS'),
    jsonb_build_object('grant_window', 'rolling_30_day')
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION get_credit_balance(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_credit(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION grant_hobby_credits_if_due(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_credit_balance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION consume_credit(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION grant_hobby_credits_if_due(UUID, INTEGER) TO service_role;

-- 9. Templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,          -- The permanent storage URL (never changes)
  category TEXT DEFAULT 'general',  -- e.g. 'gaming', 'vlog', 'business'
  tags TEXT[] DEFAULT '{}',         -- e.g. ARRAY['viral', 'mrbeast', 'reaction']
  is_trending BOOLEAN DEFAULT false,
  is_popular BOOLEAN DEFAULT false,
  is_new BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update the updated_at column on every edit
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Public can READ templates (for the frontend gallery)
DROP POLICY IF EXISTS "Templates are publicly readable" ON templates;
CREATE POLICY "Templates are publicly readable"
  ON templates FOR SELECT
  USING (true);

-- No browser role should write directly to templates.
-- Template mutations should go through the local server admin endpoints using the service role.
DROP POLICY IF EXISTS "Admins can manage templates" ON templates;

-- 10. Onboarding Emails
CREATE TABLE IF NOT EXISTS onboarding_email_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  step_key TEXT NOT NULL,
  subject TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  resend_email_id TEXT,
  last_error TEXT,
  requires_marketing_opt_in BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, step_key)
);

CREATE INDEX IF NOT EXISTS onboarding_email_jobs_status_scheduled_idx ON onboarding_email_jobs (status, scheduled_for);

DROP TRIGGER IF EXISTS update_onboarding_email_jobs_updated_at ON onboarding_email_jobs;
CREATE TRIGGER update_onboarding_email_jobs_updated_at
  BEFORE UPDATE ON onboarding_email_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE onboarding_email_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own onboarding email jobs" 
  ON onboarding_email_jobs FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

-- Extended profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marketing_email_opt_in BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marketing_email_opt_in_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marketing_email_opt_out_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signup_source TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_initialized_at TIMESTAMPTZ;

-- 11. YouTube integrations (server-only)
CREATE TABLE IF NOT EXISTS youtube_integrations (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  google_account_id TEXT,
  google_account_email TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  selected_channel_id TEXT,
  selected_channel_title TEXT,
  selected_channel_handle TEXT,
  selected_channel_thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS youtube_integrations_selected_channel_id_idx
  ON youtube_integrations (selected_channel_id);

DROP TRIGGER IF EXISTS update_youtube_integrations_updated_at ON youtube_integrations;
CREATE TRIGGER update_youtube_integrations_updated_at
  BEFORE UPDATE ON youtube_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE youtube_integrations ENABLE ROW LEVEL SECURITY;

-- 12. Growth optimization experiments
CREATE TABLE IF NOT EXISTS growth_experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_image_url TEXT,
  experiment_type TEXT NOT NULL DEFAULT 'optimization_pack'
    CHECK (experiment_type IN ('optimization_pack', 'face_optimize', 'viral_pattern')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  metrics_source TEXT NOT NULL DEFAULT 'mock'
    CHECK (metrics_source IN ('mock', 'youtube')),
  external_video_id TEXT,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE growth_experiments
  ADD COLUMN IF NOT EXISTS source_title TEXT NOT NULL DEFAULT 'Untitled video',
  ADD COLUMN IF NOT EXISTS source_image_url TEXT,
  ADD COLUMN IF NOT EXISTS experiment_type TEXT NOT NULL DEFAULT 'optimization_pack',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS metrics_source TEXT NOT NULL DEFAULT 'mock',
  ADD COLUMN IF NOT EXISTS external_video_id TEXT,
  ADD COLUMN IF NOT EXISTS analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS growth_experiments_user_created_idx
  ON growth_experiments (user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_growth_experiments_updated_at ON growth_experiments;
CREATE TRIGGER update_growth_experiments_updated_at
  BEFORE UPDATE ON growth_experiments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE growth_experiments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own growth experiments" ON growth_experiments;
CREATE POLICY "Users can view their own growth experiments"
  ON growth_experiments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own growth experiments" ON growth_experiments;
CREATE POLICY "Users can update their own growth experiments"
  ON growth_experiments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Growth variants. Inserts are server-side so the no-credit paid-plan rule remains enforceable.
CREATE TABLE IF NOT EXISTS growth_variants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  experiment_id UUID REFERENCES growth_experiments ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  ctr_estimate JSONB NOT NULL DEFAULT '{}'::jsonb,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  mock_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics_source TEXT NOT NULL DEFAULT 'mock'
    CHECK (metrics_source IN ('mock', 'youtube')),
  external_video_id TEXT,
  pattern_key TEXT CHECK (pattern_key IS NULL OR pattern_key IN ('high_stakes_challenge', 'ai_authority', 'finance_signal')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'winner', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE growth_variants
  ADD COLUMN IF NOT EXISTS ctr_estimate JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS mock_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metrics_source TEXT NOT NULL DEFAULT 'mock',
  ADD COLUMN IF NOT EXISTS external_video_id TEXT,
  ADD COLUMN IF NOT EXISTS pattern_key TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS growth_variants_experiment_created_idx
  ON growth_variants (experiment_id, created_at ASC);

CREATE INDEX IF NOT EXISTS growth_variants_user_status_idx
  ON growth_variants (user_id, status, created_at DESC);

DROP TRIGGER IF EXISTS update_growth_variants_updated_at ON growth_variants;
CREATE TRIGGER update_growth_variants_updated_at
  BEFORE UPDATE ON growth_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE growth_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own growth variants" ON growth_variants;
CREATE POLICY "Users can view their own growth variants"
  ON growth_variants FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own growth variants" ON growth_variants;
CREATE POLICY "Users can update their own growth variants"
  ON growth_variants FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
