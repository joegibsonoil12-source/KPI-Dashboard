# Database Migrations

This directory contains SQL migration scripts for setting up the KPI Dashboard database views and structures in Supabase.

## Overview

The migrations in this directory are designed to be **idempotent** and **non-destructive**. They can be run multiple times safely without data loss or duplication.

## Migration: 001_create_metrics_views.sql

### Purpose

Creates read-only database views that pre-aggregate service jobs and delivery tickets data by day, week, and month. These views significantly improve the performance of the Billboard and Graphs features by avoiding real-time aggregation queries.

### What It Creates

The migration creates 6 aggregate views:

**Service Jobs Views:**
- `service_jobs_daily` - Daily aggregation of jobs with status counts and revenue
- `service_jobs_weekly` - Weekly aggregation (Monday start) with status counts and revenue
- `service_jobs_monthly` - Monthly aggregation with status counts and revenue

**Delivery Tickets Views:**
- `delivery_tickets_daily` - Daily aggregation with ticket count, gallons, and revenue
- `delivery_tickets_weekly` - Weekly aggregation (Monday start)
- `delivery_tickets_monthly` - Monthly aggregation

### Performance Benefits

- **Faster Dashboard Loading**: Pre-aggregated views are much faster than querying and aggregating thousands of rows in real-time
- **Reduced Database Load**: Aggregation is done once when views are created, not on every page load
- **Better User Experience**: Billboard and Graphs pages load instantly even with large datasets

### How to Run the Migration

1. **Open Supabase SQL Editor**:
   - Go to your Supabase project dashboard
   - Click on **SQL Editor** in the left sidebar
   - Click **+ New query** button

2. **Copy the Migration SQL**:
   - Open `migrations/001_create_metrics_views.sql`
   - Copy the entire contents of the file

3. **Paste and Execute**:
   - Paste the SQL into the Supabase SQL Editor
   - Click **Run** (or press Ctrl/Cmd + Enter)

4. **Verify Success**:
   - Check for any error messages in the output panel
   - If successful, you should see a success message
   - You can verify the views were created by running:
     ```sql
     SELECT table_name 
     FROM information_schema.views 
     WHERE table_schema = 'public' 
     AND table_name LIKE '%_daily' OR table_name LIKE '%_weekly' OR table_name LIKE '%_monthly';
     ```

### What Happens If Views Don't Exist?

The KPI Dashboard includes **automatic fallback behavior**:

- If the views don't exist, the application will detect this and automatically aggregate data from the base tables (`service_jobs` and `delivery_tickets`)
- A warning message will be displayed in the UI explaining that views are missing
- The Graphs page will show a yellow alert with instructions to run this migration
- Performance will be slower, but the application will still function

### Safety Features

This migration includes several safety features:

1. **Idempotent**: Uses `CREATE OR REPLACE VIEW` so it can be run multiple times safely
2. **Non-destructive**: Creates views only; does not modify or delete existing data
3. **Conditional RLS Policies**: Only creates Row-Level Security policies if they don't already exist
4. **Permissions**: Automatically grants SELECT permissions to `anon` and `authenticated` roles
5. **Indexes**: Creates performance indexes only if they don't exist

### Troubleshooting

#### Error: "permission denied for table service_jobs"

**Cause**: Your database user doesn't have permission to create views on these tables.

**Solution**: 
- Ensure you're running the migration with a user that has sufficient privileges (typically the project owner)
- Check that RLS policies allow the necessary operations

#### Error: "relation service_jobs does not exist"

**Cause**: The base tables haven't been created yet.

**Solution**:
- Import or create service jobs data first
- Run the service tracking migration: `sql/2025-10-16_service_tracking.sql`
- Run the delivery tickets migration if needed

#### Views created but data not showing

**Cause**: The base tables might be empty or the date filters might not match your data.

**Solution**:
- Check that you have data in `service_jobs` and `delivery_tickets` tables
- Verify the date ranges of your data match what you're filtering for in the dashboard
- Run: `SELECT COUNT(*) FROM service_jobs;` and `SELECT COUNT(*) FROM delivery_tickets;`

### When to Run This Migration

You should run this migration:

- ✅ **After initial setup**: When you first set up your Supabase database
- ✅ **If you see warnings**: When the dashboard shows "Using fallback aggregation" warnings
- ✅ **Performance issues**: When the Graphs page is slow to load
- ✅ **After data import**: After importing large amounts of historical data

You don't need to re-run it:
- ❌ After every data change (views are dynamic and update automatically)
- ❌ When adding new records (views query the base tables in real-time)

### Additional Migrations

Other migrations may be located in:
- `/sql/` - Historical SQL migrations
- `/supabase/migrations/` - Supabase-specific migrations
- `/db/migrations/` - Database-specific migrations

Refer to the main [README.md](../README.md) for more information about database setup and configuration.

## Support

If you encounter issues with migrations:

1. Check the browser console for detailed error messages
2. Verify your Supabase connection is working
3. Ensure you have the necessary permissions
4. Review the Supabase logs in the dashboard
5. Check that base tables exist and have data

For more help, refer to:
- [Supabase Documentation](https://supabase.com/docs)
- Project README.md
- GitHub Issues
