# Admin-Only Migrations

⚠️ **WARNING: These migrations MUST be run manually in the Supabase SQL Editor** ⚠️

## Why Admin-Only?

These migrations modify the `auth` schema or require superuser privileges. They **cannot** be run via GitHub Actions CI workflows because:

1. Regular database credentials don't have permission to modify the `auth` schema
2. The `auth` schema is managed by Supabase and requires service_role/superuser access
3. CI workflows use `SUPABASE_DB_URL` which has limited permissions

## How to Run These Migrations

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to: [SQL Editor](https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/sql)
3. Click "New Query"

### Step 2: Copy Migration Contents

1. Open the migration file you want to run (e.g., `2025-10-29_restore_auth_identities.sql`)
2. Copy the **entire** contents of the file

### Step 3: Execute Migration

1. Paste the migration SQL into the SQL Editor
2. Click the "RUN" button (or press Ctrl+Enter / Cmd+Enter)
3. Wait for the query to complete
4. Check for success message or errors in the output panel

### Step 4: Verify Migration

1. Run any verification queries included at the end of the migration
2. Check that the expected tables/functions/policies were created
3. Document that the migration was successfully applied

## Migrations in This Directory

### 2025-10-29_restore_auth_identities.sql

**Purpose**: Recreates the `auth.identities` table (required by Supabase Auth)

**When to run**: If you get 500 errors related to missing `auth.identities` table

**Prerequisites**: Supabase project must exist and be accessible

**Verification**:
```sql
-- Check table exists
SELECT * FROM information_schema.tables 
WHERE table_schema = 'auth' AND table_name = 'identities';

-- Check table has correct structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'auth' AND table_name = 'identities';

-- Verify it works
SELECT 'ok' AS status, COUNT(*) AS identities_count FROM auth.identities;
```

## Important Notes

1. **Never add these to CI workflows**: The `apply-supabase-migrations.yml` and `supabase-push-ci.yml` workflows should NOT run these files

2. **Track manually**: After running a migration, document it (e.g., in a comment or in your project notes)

3. **Idempotent**: All migrations in this directory should be idempotent (safe to run multiple times)

4. **Test carefully**: Because these have superuser privileges, test in a development environment first if possible

5. **Security**: Only trusted admins should run these migrations

## Error: "permission denied for schema auth"

If you see this error in CI workflows, it means:

1. A migration that belongs in `ADMIN_ONLY/` was placed in `sql/` or `supabase/migrations/`
2. The migration tries to modify the `auth` schema
3. You need to move it to `ADMIN_ONLY/` and run it manually in Supabase SQL Editor

**Solution**:
```bash
# Move the problematic migration
mv sql/migration_name.sql sql/ADMIN_ONLY/migration_name.sql

# Add a note to the workflow to skip ADMIN_ONLY migrations
# (this is already configured in apply-supabase-migrations.yml)
```

## Getting Help

If you're unsure whether a migration needs to be admin-only:

**Run it as admin-only if it**:
- ✅ Creates/modifies tables in `auth` schema
- ✅ Creates/modifies `auth.users` or `auth.identities`
- ✅ Requires superuser privileges
- ✅ Modifies Supabase internal structures

**Run it via CI if it**:
- ✅ Creates/modifies tables in `public` schema
- ✅ Creates/modifies your application tables
- ✅ Uses `REFERENCES auth.users(id)` (foreign keys are OK)
- ✅ Only reads from `auth` schema (e.g., in policies)

When in doubt, try running it manually in SQL Editor first!

## Related Documentation

- [CI_SUPABASE.md](../../docs/CI_SUPABASE.md) - Full CI/CD setup guide
- [QUICKSTART_AUTH_RESTORE.md](../../QUICKSTART_AUTH_RESTORE.md) - Quick auth restoration guide
- [Supabase Auth Schema](https://supabase.com/docs/guides/auth/overview) - Official documentation
