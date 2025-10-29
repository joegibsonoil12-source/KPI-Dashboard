-- EXAMPLE: How to create a user (RUN AS SUPERUSER / WITH SERVICE ROLE)
-- Preferred method: use the Supabase Admin REST API with a service_role key (example below).

-- 1) Admin REST API (recommended)
-- Replace <YOUR_SUPABASE_PROJECT_URL> with your project URL: https://jskajkwulaaakhaolzdu.supabase.co
-- Replace <YOUR_SERVICE_ROLE_KEY> with your service_role key from Supabase Dashboard > Settings > API
-- Replace the email and password with the desired user credentials

-- Example cURL command to create a user via Admin API:
/*
curl -X POST 'https://jskajkwulaaakhaolzdu.supabase.co/auth/v1/admin/users' \
  -H "apikey: <YOUR_SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <YOUR_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword123",
    "email_confirm": true,
    "user_metadata": {
      "role": "admin",
      "full_name": "Admin User"
    }
  }'
*/

-- 2) Direct psql INSERT (NOT RECOMMENDED - use Admin API instead)
-- WARNING: Direct INSERT into auth.users should only be done by a DB owner/superuser as a last resort.
-- This bypasses Supabase's auth logic and may cause issues. Use the Admin API whenever possible.

-- Template for direct INSERT (idempotent with ON CONFLICT DO NOTHING):
/*
-- Step 1: Generate a UUID for the user
-- Replace the email, encrypted password, and other values as needed

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',  -- instance_id (use default)
  'admin@example.com',                      -- user email
  crypt('securepassword123', gen_salt('bf')),  -- encrypted password using bcrypt
  now(),                                    -- email_confirmed_at
  now(),                                    -- created_at
  now(),                                    -- updated_at
  '{"provider":"email","providers":["email"]}',  -- raw_app_meta_data
  '{"role":"admin","full_name":"Admin User"}',   -- raw_user_meta_data
  false,                                    -- is_super_admin
  'authenticated',                          -- role
  'authenticated'                           -- aud
)
ON CONFLICT (email) DO NOTHING;

-- Step 2: Create corresponding identity record (REQUIRED for Supabase auth)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  id::text,
  now(),
  now()
FROM auth.users
WHERE email = 'admin@example.com'
ON CONFLICT (provider, provider_id) DO NOTHING;
*/

-- 3) Grant admin role in app_roles table (if using custom roles)
-- After creating the user, optionally add them to your app_roles table:
/*
INSERT INTO public.app_roles (user_id, role, created_at, updated_at)
SELECT 
  id, 
  'admin', 
  now(), 
  now()
FROM auth.users
WHERE email = 'admin@example.com'
ON CONFLICT (user_id) DO UPDATE 
SET role = EXCLUDED.role, updated_at = now();
*/

-- ============================================================================
-- RECOMMENDATION: Use the Admin API (option 1) for creating users
-- ============================================================================
-- The Admin API is the safest and most reliable way to create users.
-- It handles password hashing, identity creation, and all auth internals automatically.
-- Direct SQL inserts should only be used as a last resort when the API is unavailable.
