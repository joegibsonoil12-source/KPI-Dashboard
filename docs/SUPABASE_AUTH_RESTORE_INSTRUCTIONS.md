# Supabase Auth Restoration Instructions

## What Went Wrong?

Your Supabase project is experiencing 500 errors when attempting to invite or create users. The root cause is that the `auth.identities` table is missing from your database. This table is a critical component of Supabase's authentication system.

### Why This Happened

The `auth.identities` table is part of Supabase's internal auth schema and should be created automatically by Supabase. However, it may have been accidentally dropped, or there may have been an issue during project initialization. This table stores identity information for each authentication provider (email, Google, GitHub, etc.) associated with a user.

### What the Migration Will Do

The migration script `sql/2025-10-29_restore_auth_identities.sql` will:

1. ✅ Ensure the `pgcrypto` extension is enabled (required for UUID generation)
2. ✅ Ensure the `auth` schema exists
3. ✅ Recreate the canonical `auth.identities` table with the correct structure
4. ✅ Create necessary indexes for performance
5. ✅ Add a foreign key constraint to `auth.users` (if the table exists)
6. ✅ Verify the table was created successfully

**This migration is idempotent** - it's safe to run multiple times without causing errors or data loss.

## How to Apply the Migration

### Prerequisites

- Access to Supabase Dashboard or Supabase CLI
- Superuser or `supabase_admin` role permissions
- Your Supabase project URL: `https://jskajkwulaaakhaolzdu.supabase.co`

### Option 1: Via Supabase Dashboard (Recommended)

1. **Log into Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu

2. **Open SQL Editor**
   - Navigate to: SQL Editor (left sidebar)
   - Click "New Query"

3. **Copy and Paste the Migration**
   - Open the file `sql/2025-10-29_restore_auth_identities.sql` from this repository
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Execute the Migration**
   - Click "Run" button
   - Wait for confirmation message: `status: ok, identities_count: 0`

5. **Verify Success**
   - You should see a success message
   - The `auth.identities` table is now restored

### Option 2: Via psql Command Line

If you have direct database access with psql:

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR-PASSWORD]@db.jskajkwulaaakhaolzdu.supabase.co:5432/postgres"

# Run the migration file
\i sql/2025-10-29_restore_auth_identities.sql

# Verify the table exists
SELECT COUNT(*) FROM auth.identities;
```

### Option 3: Via Supabase CLI

If you have the Supabase CLI installed:

```bash
# Navigate to your project directory
cd /path/to/KPI-Dashboard

# Link to your project (if not already linked)
supabase link --project-ref jskajkwulaaakhaolzdu

# Apply the migration
supabase db execute --file sql/2025-10-29_restore_auth_identities.sql

# Or push all migrations
supabase db push
```

## Creating Your First Admin User

After restoring the `auth.identities` table, you'll be able to create users again. Here are two methods:

### Method 1: Admin API (Recommended)

Use the Supabase Admin API with your service role key:

```bash
curl -X POST 'https://jskajkwulaaakhaolzdu.supabase.co/auth/v1/admin/users' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-secure-password",
    "email_confirm": true,
    "user_metadata": {
      "role": "admin",
      "full_name": "Your Name"
    }
  }'
```

**Where to find your service_role key:**
- Supabase Dashboard > Settings > API
- Look for "service_role" key (this is a secret key - never expose it publicly!)

### Method 2: Direct SQL Insert (Last Resort Only)

⚠️ **WARNING**: Only use this method if the Admin API is unavailable. See the file `sql/2025-10-29_add_user_example.sql` for a complete example.

The direct SQL method requires:
1. Inserting into `auth.users` with properly encrypted password
2. Creating a corresponding record in `auth.identities`
3. Optionally adding a role in `public.app_roles`

**This is error-prone and not recommended.** Use the Admin API whenever possible.

## Granting Admin Privileges

After creating your user, grant admin privileges in the application:

```sql
-- Add admin role to your user
INSERT INTO public.app_roles (user_id, role, created_at, updated_at)
SELECT 
  id, 
  'admin', 
  now(), 
  now()
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (user_id) DO UPDATE 
SET role = 'admin', updated_at = now();
```

Run this in the Supabase SQL Editor to give your user admin permissions in the KPI Dashboard application.

## Migrating from public.identities (If Applicable)

If your application created a fallback `public.identities` table, you may need to migrate data:

### Check if public.identities exists:

```sql
SELECT COUNT(*) FROM public.identities;
```

### Migrate data if needed:

```sql
-- Copy data from public.identities to auth.identities
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at,
  last_sign_in_at
)
SELECT 
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at,
  last_sign_in_at
FROM public.identities
ON CONFLICT (provider, provider_id) DO NOTHING;

-- Verify migration
SELECT COUNT(*) as migrated_count FROM auth.identities;

-- Optional: Drop the public.identities table after successful migration
-- DROP TABLE public.identities;  -- Uncomment to execute
```

## Verification

After applying the migration and creating your admin user, verify everything works:

### 1. Check auth.identities table exists:

```sql
SELECT 
  table_schema, 
  table_name,
  (SELECT COUNT(*) FROM auth.identities) as row_count
FROM information_schema.tables 
WHERE table_schema = 'auth' AND table_name = 'identities';
```

Expected output: 1 row showing the table exists

### 2. Check your user was created:

```sql
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.email_confirmed_at,
  ar.role as app_role
FROM auth.users u
LEFT JOIN public.app_roles ar ON u.id = ar.user_id
WHERE u.email = 'your-email@example.com';
```

### 3. Check identities were created:

```sql
SELECT 
  i.provider,
  i.provider_id,
  i.created_at,
  u.email
FROM auth.identities i
JOIN auth.users u ON i.user_id = u.id
WHERE u.email = 'your-email@example.com';
```

### 4. Test login:

- Go to your application login page
- Try logging in with your new credentials
- Verify you can access admin features

## Troubleshooting

### Still getting 500 errors after migration?

1. **Check permissions**: Ensure the migration was run with superuser privileges
2. **Verify table ownership**: The `auth.identities` table should be owned by `supabase_admin`
3. **Check foreign key**: Ensure the FK to `auth.users` was created successfully

```sql
-- Check table ownership
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'auth' AND tablename = 'identities';

-- Check foreign keys
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'auth' 
  AND tc.table_name = 'identities'
  AND tc.constraint_type = 'FOREIGN KEY';
```

### Cannot create users via Admin API?

1. **Verify service_role key**: Make sure you're using the correct key from Dashboard > Settings > API
2. **Check API endpoint**: Ensure the URL is correct: `https://jskajkwulaaakhaolzdu.supabase.co/auth/v1/admin/users`
3. **Check headers**: Both `apikey` and `Authorization` headers must contain the service_role key

### Need to reset a user's password?

```bash
curl -X PUT 'https://jskajkwulaaakhaolzdu.supabase.co/auth/v1/admin/users/{user-id}' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "new-secure-password"
  }'
```

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Admin API Reference](https://supabase.com/docs/reference/javascript/auth-admin-api)
- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)

## Support

If you continue to experience issues after following these instructions:

1. Check Supabase Dashboard > Logs for error details
2. Contact Supabase Support with your project ref: `jskajkwulaaakhaolzdu`
3. Include this document and the migration file in your support request

---

**Last Updated**: 2025-10-29  
**Migration File**: `sql/2025-10-29_restore_auth_identities.sql`  
**User Creation Examples**: `sql/2025-10-29_add_user_example.sql`
