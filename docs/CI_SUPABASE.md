# Supabase CI/CD Setup Guide

This guide explains how to configure and use the Supabase CI/CD workflows for automated database migrations.

## Table of Contents

- [Overview](#overview)
- [Required Secrets](#required-secrets)
- [Workflows](#workflows)
- [Network Allowlist Configuration](#network-allowlist-configuration)
- [Manual Workflow Dispatch](#manual-workflow-dispatch)
- [Troubleshooting](#troubleshooting)

## Overview

This repository includes automated GitHub Actions workflows to apply Supabase database migrations:

1. **`supabase-push-ci.yml`** - Uses Supabase CLI to apply migrations from `supabase/migrations/` (RECOMMENDED)
2. **`apply-supabase-migrations.yml`** - Uses `psql` to apply migrations from `sql/` directory
3. **`supabase-push.yml`** - Legacy workflow for `supabase db push`

### When to Use Each Workflow

| Workflow | Use Case | Migration Location | Method |
|----------|----------|-------------------|--------|
| `supabase-push-ci.yml` | Modern migrations managed by Supabase CLI | `supabase/migrations/` | Supabase CLI |
| `apply-supabase-migrations.yml` | Legacy SQL migrations or manual migrations | `sql/` | Direct psql |
| `supabase-push.yml` | Auto-sync on push to main | `supabase/migrations/` | Supabase CLI |

## Required Secrets

Configure these secrets in your GitHub repository:

### 1. SUPABASE_ACCESS_TOKEN

**What it is**: Personal access token for Supabase CLI authentication

**How to get it**:
1. Go to [Supabase Account Tokens](https://supabase.com/dashboard/account/tokens)
2. Click "Generate new token"
3. Give it a name (e.g., "GitHub Actions CI")
4. Copy the token (you won't be able to see it again!)

**How to add it**:
1. Go to your GitHub repository
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click "New repository secret"
4. Name: `SUPABASE_ACCESS_TOKEN`
5. Value: Paste your token
6. Click "Add secret"

### 2. SUPABASE_PROJECT_REF

**What it is**: Your Supabase project reference ID (20-character alphanumeric string)

**How to get it**:
1. Your project ref is in your Supabase URL
2. Example: If your URL is `https://jskajkwulaaakhaolzdu.supabase.co`
3. Then your project ref is: `jskajkwulaaakhaolzdu`

**How to add it**:
1. Go to your GitHub repository
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click "New repository secret"
4. Name: `SUPABASE_PROJECT_REF`
5. Value: Your 20-character project ref (e.g., `jskajkwulaaakhaolzdu`)
6. Click "Add secret"

### 3. SUPABASE_DB_URL (Optional - for psql workflows)

**What it is**: Direct PostgreSQL connection string

**How to get it**:
1. Go to [Supabase Dashboard → Settings → Database](https://supabase.com/dashboard/project/_/settings/database)
2. Find "Connection string" section
3. Select "URI" format
4. Copy the connection string (it looks like `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`)
5. Replace `[YOUR-PASSWORD]` with your actual database password

**How to add it**:
1. Go to your GitHub repository
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click "New repository secret"
4. Name: `SUPABASE_DB_URL`
5. Value: Paste your connection string with password
6. Click "Add secret"

**⚠️ Security Note**: This contains your database password. Keep it secure!

## Workflows

### Supabase Push CI (Recommended)

**File**: `.github/workflows/supabase-push-ci.yml`

**Triggers**:
- Manual workflow dispatch (via GitHub Actions UI)
- Automatic on push to `main` when files change in:
  - `supabase/**`
  - `sql/**`
  - `db/migrations/**`
  - `.github/workflows/supabase-push-ci.yml`

**What it does**:
1. ✅ Validates required secrets (fails early with helpful error messages)
2. 📦 Installs Supabase CLI via `npx`
3. 🔐 Authenticates with Supabase using `SUPABASE_ACCESS_TOKEN`
4. 🔗 Links to your project using `SUPABASE_PROJECT_REF`
5. 🚀 Runs `npx supabase db push` to apply migrations
6. 📊 Provides detailed logs and summary

**Benefits**:
- Uses official Supabase CLI (best practice)
- Handles migration tracking automatically
- Provides better error messages
- Safer than raw SQL execution

## Network Allowlist Configuration

### Why This Matters

Supabase databases can be configured to only accept connections from specific IP addresses. GitHub Actions runners use dynamic IPs, which can cause connection failures if not properly configured.

### Option 1: Allow GitHub Actions IPs (Recommended for Public Projects)

1. Go to [Supabase Dashboard → Settings → Database → Network Restrictions](https://supabase.com/dashboard/project/_/settings/database)
2. In the "Restrict access to IPv4 addresses" section, you have two options:

   **Option A: Allow all IPs (simplest)**
   - Click "Add restriction"
   - Enter: `0.0.0.0/0` (allows all IPv4 addresses)
   - Click "Save"
   
   **Option B: Allow GitHub Actions IP ranges (more secure)**
   - Get the latest GitHub Actions IP ranges from: https://api.github.com/meta
   - Look for the `actions` IP ranges
   - Add each range to your allowlist
   - Note: GitHub's IPs can change, so you may need to update this list periodically

### Option 2: Use Self-Hosted Runner (Recommended for Enterprise)

If you need a static IP for security reasons:

1. Set up a self-hosted GitHub Actions runner with a static IP
2. Add that static IP to your Supabase allowlist
3. Update your workflow to use the self-hosted runner:
   ```yaml
   jobs:
     deploy:
       runs-on: self-hosted  # instead of ubuntu-latest
   ```

### Verifying Allowlist Configuration

After configuring the allowlist, test it:

1. Go to [GitHub Actions](https://github.com/joegibsonoil12-source/KPI-Dashboard/actions)
2. Select "Supabase DB Push CI" workflow
3. Click "Run workflow"
4. Monitor the logs for connection success/failure

If you see connection errors like "connection refused" or "network unreachable", check your allowlist configuration.

## Manual Workflow Dispatch

### How to Manually Run a Workflow

1. **Navigate to Actions**:
   - Go to your repository on GitHub
   - Click the "Actions" tab

2. **Select Workflow**:
   - Choose "Supabase DB Push CI" from the left sidebar

3. **Dispatch Workflow**:
   - Click the "Run workflow" button (top right)
   - Select branch: `main` (or your desired branch)
   - Optional: Check "Force push even if no changes detected" to force a push
   - Click "Run workflow"

4. **Monitor Progress**:
   - Click on the running workflow to see live logs
   - Check each step for success/failure
   - View the summary at the end for details

### When to Manually Dispatch

- After adding new migrations to test them
- After configuring secrets for the first time
- When you suspect migrations are out of sync
- To force a re-push of migrations

## Troubleshooting

### Error: "SUPABASE_ACCESS_TOKEN secret is not set"

**Solution**:
1. Add the `SUPABASE_ACCESS_TOKEN` secret (see [Required Secrets](#required-secrets))
2. Make sure you're using the correct secret name (case-sensitive)
3. Re-run the workflow

### Error: "SUPABASE_PROJECT_REF has invalid format"

**Solution**:
1. Verify your project ref is exactly 20 lowercase alphanumeric characters
2. Check for extra spaces, quotes, or special characters
3. Update the secret with the correct value
4. Re-run the workflow

### Error: "Connection refused" or "Network unreachable"

**Solution**:
1. Check your Supabase database allowlist (see [Network Allowlist Configuration](#network-allowlist-configuration))
2. Add GitHub Actions IPs or `0.0.0.0/0` to the allowlist
3. Wait a few minutes for the change to propagate
4. Re-run the workflow

### Error: "permission denied for schema auth"

**Solution**:
This error occurs when trying to modify the `auth` schema with regular credentials. The `auth` schema requires superuser/service_role privileges.

**For `auth` schema changes**:
1. **Never run auth schema migrations via CI workflows**
2. Run them manually in Supabase SQL Editor:
   - Go to [SQL Editor](https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/sql)
   - Paste your SQL code
   - Click "Run" (this uses your service role automatically)

**For `public` schema changes**:
- These can safely run via CI workflows
- Use `supabase-push-ci.yml` for migrations in `supabase/migrations/`
- Use `apply-supabase-migrations.yml` for migrations in `sql/`

**Best Practice**:
- Store admin-only migrations (auth schema) in `sql/ADMIN_ONLY/`
- Store regular migrations (public schema) in `supabase/migrations/`
- Document which migrations require manual execution

### Error: "Link failed - project file not created"

**Solution**:
1. Verify `SUPABASE_PROJECT_REF` is correct
2. Verify `SUPABASE_ACCESS_TOKEN` is valid and not expired
3. Check Supabase status: https://status.supabase.com/
4. Try regenerating your access token
5. Re-run the workflow

### Error: "No migrations found"

**Solution**:
1. Verify migration files exist in `supabase/migrations/`
2. Ensure migration files have `.sql` extension
3. Check file permissions (should be readable)
4. Verify the workflow is looking in the correct directory

### Workflow runs but no changes applied

**Solution**:
1. Check if migrations have already been applied
2. Supabase tracks applied migrations automatically
3. Use "Force push" option in workflow dispatch to re-apply
4. Check Supabase migration history:
   ```sql
   SELECT * FROM supabase_migrations.schema_migrations;
   ```

## Best Practices

### 1. Migration File Naming

Use descriptive, timestamped names:
```
supabase/migrations/
├── 0001_create_videos_table.sql
├── 0002_create_procedure_attachments_table.sql
├── 0003_create_metrics_views.sql
└── 0004_add_hazmat_fee_column.sql
```

### 2. Migration Safety

- ✅ Make migrations idempotent (use `CREATE TABLE IF NOT EXISTS`, etc.)
- ✅ Test migrations locally first
- ✅ Use transactions where appropriate
- ❌ Avoid destructive operations (`DROP TABLE`, `ALTER TABLE DROP COLUMN`)
- ✅ Add verification queries at the end of migrations

### 3. Secret Management

- ✅ Use GitHub repository secrets (never commit secrets to code)
- ✅ Rotate access tokens periodically
- ✅ Use different tokens for different environments
- ❌ Never log or echo secret values
- ✅ Use minimal permissions (access tokens should only have necessary scopes)

### 4. Workflow Organization

- ✅ Use `supabase-push-ci.yml` for Supabase CLI migrations
- ✅ Use `apply-supabase-migrations.yml` for legacy SQL files
- ✅ Document which workflow to use in migration files
- ✅ Keep workflows DRY (Don't Repeat Yourself)

### 5. Schema Separation

**`auth` schema** (Supabase managed):
- Requires superuser privileges
- Must be modified via Supabase Dashboard SQL Editor
- Examples: `auth.users`, `auth.identities`, auth-related tables
- Store in: `sql/ADMIN_ONLY/`

**`public` schema** (Your application):
- Can be modified via CI workflows
- Safe for automated migrations
- Examples: Your application tables, views, functions
- Store in: `supabase/migrations/`

## Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli/introduction)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Supabase Database Settings](https://supabase.com/dashboard/project/_/settings/database)
- [GitHub Actions IP Addresses](https://api.github.com/meta)

## Need Help?

If you're still having issues:

1. **Check workflow logs**: View the detailed logs in GitHub Actions
2. **Check Supabase logs**: Visit [Supabase Logs](https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/logs)
3. **Verify secrets**: Double-check all secret values are correct
4. **Test locally**: Use Supabase CLI locally to test migrations
5. **Contact support**: Reach out to Supabase support with your project ref

---

**Quick Reference**:
- 🔑 Secrets: Settings → Secrets and variables → Actions
- 🚀 Workflows: Actions tab → Select workflow → Run workflow
- 🌐 Allowlist: Supabase Dashboard → Settings → Database → Network Restrictions
- 📊 Logs: Supabase Dashboard → Logs
- 📝 SQL Editor: Supabase Dashboard → SQL Editor
