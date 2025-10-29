-- ⚠️  WARNING: This file modifies the `auth` schema and REQUIRES superuser/service_role privileges!
-- ⚠️  DO NOT run this via GitHub Actions CI workflows - it will fail with "permission denied for schema auth"
-- ⚠️  INSTEAD: Run this manually in Supabase SQL Editor (Dashboard -> SQL -> New Query -> Paste -> Run)
-- 
-- This file has been MOVED to: sql/ADMIN_ONLY/2025-10-29_restore_auth_identities.sql
-- This copy remains here for reference only.
--
-- NOTE: This file must be executed by the schema owner (supabase_admin) or a superuser.
-- It is idempotent and safe to run repeatedly. It recreates the canonical auth.identities table used by Supabase auth internals.
--
-- HOW TO RUN:
-- 1. Go to: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/sql
-- 2. Click "New Query"
-- 3. Copy the contents of this file (or sql/ADMIN_ONLY/2025-10-29_restore_auth_identities.sql)
-- 4. Paste into SQL Editor
-- 5. Click "RUN"
-- 6. Verify success with: SELECT 'ok' AS status, COUNT(*) AS identities_count FROM auth.identities;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure the auth schema exists
CREATE SCHEMA IF NOT EXISTS auth;

-- Create canonical auth.identities table (idempotent)
CREATE TABLE IF NOT EXISTS auth.identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  identity_data jsonb,
  last_sign_in_at timestamptz,
  provider text,
  provider_id text,
  updated_at timestamptz DEFAULT now(),
  user_id uuid
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON auth.identities(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_provider_providerid ON auth.identities(provider, provider_id);

-- Conditionally add FK to auth.users (only if auth.users exists and FK not already present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'auth' AND tc.table_name = 'identities' AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
      ALTER TABLE auth.identities
      ADD CONSTRAINT fk_auth_identities_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END;
$$;

-- Quick verification output (superuser can run this to confirm)
SELECT 'ok' AS status, COUNT(*) AS identities_count FROM auth.identities;
