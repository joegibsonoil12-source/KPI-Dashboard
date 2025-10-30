# Database Migrations

This directory contains SQL migration scripts for setting up the KPI Dashboard database views and populating missing data in Supabase.

## Overview

The migrations in this directory are designed to be **idempotent** and **safe to run multiple times** without data loss or duplication. They must be run manually in the Supabase SQL Editor.

---

## Migration Files

### 001_create_metrics_views.sql

**Purpose**: Creates read-only database views that pre-aggregate service jobs and delivery tickets data with strict status filtering and timezone awareness.

**What It Creates**:
- `service_jobs_daily`, `service_jobs_weekly`, `service_jobs_monthly`
  - Only includes **completed** service jobs (excludes canceled)
  - Uses UTC timezone normalization
  - Columns: `day`/`week_start`/`month_start`, `job_count`, `revenue`

- `delivery_tickets_daily`, `delivery_tickets_weekly`, `delivery_tickets_monthly`
  - Excludes **void** and **canceled** tickets
  - Uses UTC timezone normalization
  - Columns: `day`/`week_start`/`month_start`, `ticket_count`, `total_gallons`, `revenue`

**How to Run**:
1. Open Supabase SQL Editor
2. Copy the entire contents of `migrations/001_create_metrics_views.sql`
3. Paste into SQL Editor and click **Run**
4. Verify success with no errors

**Fallback Behavior**: If views don't exist, the client will automatically aggregate from base tables and display a warning with aggregated totals.

---

### 002_job_amount_update_log.sql

**Purpose**: Creates the migration schema and audit log table for tracking job_amount updates.

**What It Creates**:
- Schema: `migrations`
- Table: `migrations.job_amount_update_log`
  - Tracks all updates to service_jobs.job_amount
  - Includes old/new values, timestamp, and user

**How to Run**:
1. Open Supabase SQL Editor
2. Copy the entire contents of `migrations/002_job_amount_update_log.sql`
3. Paste into SQL Editor and click **Run**

---

### 002_add_ticket_imports.sql

**Purpose**: Creates the `ticket_imports` table for storing scanned ticket imports during OCR processing and review.

**What It Creates**:
- Table: `ticket_imports`
  - Stores uploaded files, OCR text, parsed data, and processing status
  - Columns: `id`, `src`, `src_email`, `attached_files` (jsonb), `ocr_text`, `parsed` (jsonb), `confidence`, `status`, `meta` (jsonb), `created_at`, `processed_at`
- RLS policies for service role and authenticated users
- SELECT policies for anon role on service_jobs and delivery_tickets (enables view access)
- Performance indexes on status, created_at, and src

**How to Run**:
1. Open Supabase SQL Editor
2. Copy the entire contents of `migrations/002_add_ticket_imports.sql`
3. Paste into SQL Editor and click **Run**
4. Verify success with no errors

**Storage Bucket Setup** (Required):
After running this migration, create the storage bucket:
1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `ticket-scans`
3. Set it as **private** (not public)
4. Add policies as needed for service role access

---

### 002_populate_job_amounts_from_raw.sql

**Purpose**: Safely populates missing `job_amount` values from raw JSON data, only when parsed amounts are > 0, and logs all changes.

**⚠️ IMPORTANT: Preview Before Running**

Before running this migration, **preview** the changes by running the SELECT query at the top of the file (lines 4-23) to see which records will be updated.

**How to Run**:

1. **Preview (Required)**:
   ```sql
   WITH parsed AS (
     SELECT
       id,
       job_number,
       job_date,
       status,
       (regexp_replace(
         (SELECT elem FROM jsonb_array_elements_text(raw) WITH ORDINALITY arr(elem, idx)
          WHERE elem ~ '^\$[0-9]' LIMIT 1),
         '[$,]', '', 'g'
       ))::numeric AS parsed_amount
     FROM public.service_jobs
     WHERE job_amount IS NULL
   )
   SELECT id, job_number, job_date, parsed_amount
   FROM parsed
   WHERE parsed_amount IS NOT NULL AND parsed_amount > 0;
   ```
   Review the results to ensure they look correct.

2. **Run the Update**:
   - Copy the full migration file
   - Paste into Supabase SQL Editor
   - Click **Run**
   - Review the returned rows showing logged changes

**Safety Features**:
- Only updates records where `job_amount IS NULL`
- Only populates when `parsed_amount > 0`
- Logs all changes to `migrations.job_amount_update_log`
- Transaction-wrapped (atomic operation)

---

## Execution Order

Run migrations in this order:
1. `001_create_metrics_views.sql` (required for optimal performance)
2. `002_add_ticket_imports.sql` (required for scan-to-ticket functionality)
3. `002_job_amount_update_log.sql` (required before running populate script)
4. `002_populate_job_amounts_from_raw.sql` (only if needed to fix missing amounts)

---

## Performance Benefits

**With Views (Recommended)**:
- Dashboard loads instantly
- Pre-aggregated data reduces database load
- Consistent filtering logic across all queries

**Without Views (Fallback)**:
- Client aggregates in real-time from base tables
- Slower performance with large datasets
- Warning displayed in Graphs page with totals

---

## Troubleshooting

### Error: "permission denied"
- Ensure you're running as a user with sufficient privileges (project owner)
- Check that RLS policies allow operations

### Error: "relation does not exist"
- Base tables (`service_jobs`, `delivery_tickets`) must exist first
- Import data before running migrations

### Views created but no data showing
- Check that base tables have data: `SELECT COUNT(*) FROM service_jobs;`
- Verify date ranges match your data
- Check status values match filtering logic

---

## Support

For issues with migrations:
1. Check browser console for detailed error messages
2. Verify Supabase connection is working
3. Review Supabase logs in dashboard
4. Ensure base tables exist and have data

Refer to the main [README.md](../README.md) for more information about database setup.

**Note**: The client-side metrics fetching code expects view columns named `day`, `week_start`, and `month_start`. Ensure that migrations/001_create_metrics_views.sql is run first to create these views with the correct column names.
