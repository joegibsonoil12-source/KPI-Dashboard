# Implementation Summary: Supabase CI/CD Workflow & Auth Permissions Fix

## 🎯 Problem Solved

**Issue**: The error `ERROR: 42501: permission denied for schema auth` was preventing database migrations from running via GitHub Actions CI, which blocked the ability to create users and admins.

**Root Cause**: 
- The migration file `sql/2025-10-29_restore_auth_identities.sql` attempts to create tables in the `auth` schema
- Regular database credentials (SUPABASE_DB_URL) don't have permission to modify the `auth` schema
- Only Supabase superuser/service_role can modify auth-related tables
- CI workflows were trying to run auth schema migrations with limited-privilege credentials

## ✅ Solution Implemented

### 1. **Created Robust Supabase CI Workflow**
**File**: `.github/workflows/supabase-push-ci.yml`

This new workflow provides a production-ready CI/CD pipeline for Supabase migrations:

**Features**:
- ✅ Uses official Supabase CLI (best practice)
- ✅ Validates required secrets before running (fails fast with helpful messages)
- ✅ Authenticates with SUPABASE_ACCESS_TOKEN
- ✅ Links to project using SUPABASE_PROJECT_REF
- ✅ Runs `npx supabase db push` to apply migrations
- ✅ Supports manual dispatch and automatic triggers on push to main
- ✅ Comprehensive debug logging and error handling
- ✅ Compatible with multiple Supabase CLI versions (--confirm, --yes flags)

**Triggers**:
- Manual: GitHub Actions UI → "Run workflow"
- Automatic: On push to `main` when files change in `supabase/**`, `sql/**`, or `db/migrations/**`

**Required Secrets**:
- `SUPABASE_ACCESS_TOKEN` - Get from https://supabase.com/dashboard/account/tokens
- `SUPABASE_PROJECT_REF` - 20-character project ID (e.g., `jskajkwulaaakhaolzdu`)

### 2. **Created Comprehensive Documentation**
**File**: `docs/CI_SUPABASE.md`

A complete guide covering:
- ✅ How to configure required GitHub secrets
- ✅ Network allowlist configuration for GitHub Actions runners
- ✅ How to manually dispatch workflows
- ✅ Troubleshooting common errors
- ✅ Best practices for migrations
- ✅ Explanation of when to use each workflow
- ✅ Schema separation guidance (public vs auth)

### 3. **Created Admin-Only Migration Directory**
**Files**: 
- `sql/ADMIN_ONLY/` directory
- `sql/ADMIN_ONLY/README.md`
- `sql/ADMIN_ONLY/2025-10-29_restore_auth_identities.sql`

**Purpose**: Separate auth schema migrations that require manual execution via Supabase SQL Editor

**Why This Matters**:
- Auth schema migrations CANNOT run via CI (permission denied)
- They MUST be run manually in Supabase Dashboard SQL Editor
- This separation prevents accidental CI failures
- Clear documentation helps maintainers understand the requirement

### 4. **Updated Existing Files**

**`sql/2025-10-29_restore_auth_identities.sql`**:
- Added prominent warning that this requires manual execution
- Added instructions on how to run it (Supabase SQL Editor)
- Explains why CI workflows will fail

**`.github/workflows/apply-supabase-migrations.yml`**:
- Modified to skip `sql/ADMIN_ONLY/` directory
- Prevents accidental execution of auth schema migrations

**`README.md`**:
- Added security section explaining required secrets
- Documented network allowlist requirements
- Linked to comprehensive CI_SUPABASE.md documentation
- Explained auth schema migration requirements

**`QUICKSTART_AUTH_RESTORE.md`**:
- Updated to explain why GitHub Actions method fails
- Clarified that Supabase SQL Editor is the correct method
- Added detailed error explanation

## 🚀 How to Use

### Step 1: Configure GitHub Secrets

1. Go to your repository: **Settings → Secrets and variables → Actions**

2. Add these secrets:
   - **SUPABASE_ACCESS_TOKEN**
     - Get from: https://supabase.com/dashboard/account/tokens
     - Click "Generate new token"
     - Copy and save as repository secret
   
   - **SUPABASE_PROJECT_REF**
     - Your project reference ID (20 characters)
     - Example: `jskajkwulaaakhaolzdu`
     - Find it in your Supabase URL

### Step 2: Configure Network Allowlist

1. Go to: [Supabase Dashboard → Database → Network Restrictions](https://supabase.com/dashboard/project/_/settings/database)

2. Choose an option:
   - **Option A (Simple)**: Add `0.0.0.0/0` to allow all IPs
   - **Option B (Secure)**: Add GitHub Actions IP ranges from https://api.github.com/meta

### Step 3: Run Auth Schema Migration (One-Time Setup)

**⚠️ This step MUST be done manually - CI cannot do it!**

1. Go to: [Supabase SQL Editor](https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/sql)
2. Click "New Query"
3. Open `sql/ADMIN_ONLY/2025-10-29_restore_auth_identities.sql`
4. Copy entire contents
5. Paste into SQL Editor
6. Click "RUN"
7. Verify success: `SELECT COUNT(*) FROM auth.identities;`

**This restores the `auth.identities` table and fixes the 500 errors!**

### Step 4: Create Your Admin User

After auth.identities is restored, create your admin user via Supabase Admin API:

```bash
# Get your service_role key from: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/settings/api
# Replace <YOUR_SERVICE_ROLE_KEY>, <YOUR_EMAIL>, and <YOUR_PASSWORD>

curl -X POST 'https://jskajkwulaaakhaolzdu.supabase.co/auth/v1/admin/users' \
  -H "apikey: <YOUR_SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <YOUR_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "<YOUR_EMAIL>",
    "password": "<YOUR_PASSWORD>",
    "email_confirm": true,
    "user_metadata": {
      "role": "admin",
      "full_name": "Site Owner"
    }
  }'
```

Then grant admin role in the database:

```sql
-- Run in Supabase SQL Editor
INSERT INTO public.app_roles (user_id, role, created_at, updated_at)
SELECT id, 'admin', now(), now()
FROM auth.users
WHERE email = '<YOUR_EMAIL>'
ON CONFLICT (user_id) DO UPDATE 
SET role = 'admin', updated_at = now();
```

### Step 5: Test the CI Workflow

1. Go to: [GitHub Actions](https://github.com/joegibsonoil12-source/KPI-Dashboard/actions)
2. Select "Supabase DB Push CI"
3. Click "Run workflow"
4. Monitor the logs
5. Verify successful completion

### Step 6: Push Regular Migrations via CI

For regular (non-auth) migrations:

1. Add migration files to `supabase/migrations/`
2. Commit and push to `main` branch
3. Workflow runs automatically
4. Migrations applied to Supabase

## 📁 File Structure

```
├── .github/workflows/
│   ├── supabase-push-ci.yml          # NEW: Robust Supabase CLI workflow
│   ├── apply-supabase-migrations.yml # UPDATED: Skips ADMIN_ONLY
│   └── supabase-push.yml             # EXISTING: Legacy workflow
├── docs/
│   └── CI_SUPABASE.md                # NEW: Comprehensive documentation
├── sql/
│   ├── ADMIN_ONLY/                   # NEW: Auth schema migrations
│   │   ├── README.md                 # NEW: Admin migration guide
│   │   └── 2025-10-29_restore_auth_identities.sql  # NEW: Auth migration
│   └── 2025-10-29_restore_auth_identities.sql      # UPDATED: Warning added
├── supabase/migrations/              # Regular migrations (CI-friendly)
├── README.md                         # UPDATED: Security section added
└── QUICKSTART_AUTH_RESTORE.md        # UPDATED: Clarified CI limitation
```

## 🔐 Security Best Practices

### ✅ DO:
- Store auth schema migrations in `sql/ADMIN_ONLY/`
- Run auth migrations manually via Supabase SQL Editor
- Use SUPABASE_ACCESS_TOKEN for CI workflows
- Configure network allowlist for GitHub Actions
- Use repository secrets (never commit secrets to code)

### ❌ DON'T:
- Don't run auth schema migrations via CI workflows
- Don't commit SUPABASE_DB_URL or tokens to code
- Don't bypass network allowlist security
- Don't skip secret validation steps

## 🎯 What This Fixes

1. ✅ **Restores ability to create users and admins**
   - Auth.identities table can be restored via SQL Editor
   - Admin API works after auth migration is applied
   
2. ✅ **Provides robust CI/CD for migrations**
   - Automated migrations for regular schema changes
   - Manual control for sensitive auth schema changes
   
3. ✅ **Prevents future permission errors**
   - Clear separation of public vs auth schema
   - Workflow automatically skips ADMIN_ONLY directory
   
4. ✅ **Comprehensive documentation**
   - Step-by-step guides for setup and troubleshooting
   - Clear explanation of security requirements

## 🔍 Troubleshooting Quick Reference

| Error | Solution |
|-------|----------|
| "permission denied for schema auth" | Run migration manually in Supabase SQL Editor |
| "SUPABASE_ACCESS_TOKEN not set" | Add secret in GitHub repository settings |
| "Connection refused" | Configure network allowlist in Supabase Dashboard |
| "Project ref invalid format" | Verify 20-character alphanumeric project ref |
| "No migrations found" | Ensure files exist in `supabase/migrations/` |

**Full troubleshooting guide**: See `docs/CI_SUPABASE.md`

## 📚 Documentation Links

- **CI/CD Setup**: [docs/CI_SUPABASE.md](docs/CI_SUPABASE.md)
- **Auth Restoration**: [QUICKSTART_AUTH_RESTORE.md](QUICKSTART_AUTH_RESTORE.md)
- **Admin Migrations**: [sql/ADMIN_ONLY/README.md](sql/ADMIN_ONLY/README.md)
- **Main README**: [README.md](README.md)

## ✨ Next Steps

1. **Immediate**: Run the auth migration in Supabase SQL Editor (Step 3 above)
2. **Create admin user**: Use the Admin API (Step 4 above)
3. **Test CI workflow**: Dispatch the workflow manually (Step 5 above)
4. **Add migrations**: Start using `supabase/migrations/` for regular changes
5. **Monitor**: Check GitHub Actions logs for migration success

---

**Summary**: This implementation separates auth schema migrations (manual) from regular migrations (automated CI), provides comprehensive documentation, and establishes a production-ready CI/CD pipeline for Supabase database changes.
