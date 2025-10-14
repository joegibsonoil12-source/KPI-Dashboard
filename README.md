# KPI Dashboard — GitHub Pages (React + Vite)

Upload these files to your repo root. The GitHub Actions workflow will build and publish automatically to GitHub Pages.

## Features

### Video Management
The dashboard includes video management functionality through the **Procedures** tab only. The standalone Videos tab has been removed from the application. Video management features include:

- **Procedure-integrated videos**: Add training videos directly to specific procedures
- **URL-based videos**: Add external video links (YouTube, Vimeo, Loom, etc.)
- **File uploads**: Upload video files directly through the Procedures tab (requires Supabase configuration)
- **Embedded video players**: YouTube, Vimeo, and Loom videos are automatically embedded
- **Supabase integration**: Videos are stored and managed through Supabase with the procedures they belong to

**Note**: Video management is now exclusively available through the Procedures tab. The standalone Videos tab has been removed to consolidate video management with procedure documentation.

To configure Supabase uploads, ensure your Supabase client is properly configured and you have a public storage bucket named 'videos'.

## Supabase Configuration

### Row-Level Security (RLS) for Procedures Table

The application requires proper Supabase Row-Level Security (RLS) configuration for the procedures table to function correctly. Without proper RLS policies, users may encounter permission errors when trying to add procedures.

#### Required Database Setup

1. **Enable RLS on the procedures table:**
```sql
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;
```

2. **Create a policy to allow authenticated users to insert procedures:**
```sql
CREATE POLICY "Allow authenticated users to insert procedures" 
ON procedures 
FOR INSERT 
TO authenticated 
WITH CHECK (true);
```

3. **Create a policy to allow authenticated users to read procedures:**
```sql
CREATE POLICY "Allow authenticated users to read procedures" 
ON procedures 
FOR SELECT 
TO authenticated 
USING (true);
```

4. **Create a policy to allow authenticated users to update their procedures:**
```sql
CREATE POLICY "Allow authenticated users to update procedures" 
ON procedures 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);
```

5. **Create a policy to allow authenticated users to delete procedures:**
```sql
CREATE POLICY "Allow authenticated users to delete procedures" 
ON procedures 
FOR DELETE 
TO authenticated 
USING (true);
```

#### Similar setup for procedure_videos table:
```sql
ALTER TABLE procedure_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage procedure videos" 
ON procedure_videos 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
```

### Troubleshooting Common Supabase Permission Errors

#### Error: "new row violates row-level security policy"
**Cause:** RLS is enabled but no INSERT policy exists for the current user role.
**Solution:** 
- Ensure you have created the INSERT policy shown above
- Verify the user is authenticated (check `supabase.auth.getUser()`)
- Check that the policy conditions match your use case

#### Error: "permission denied for table procedures"
**Cause:** RLS is not properly configured or user lacks table permissions.
**Solution:**
- Enable RLS on the table: `ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;`
- Create appropriate policies for SELECT, INSERT, UPDATE, DELETE operations
- Ensure your Supabase service role has proper permissions

#### Error: "Failed to add procedure: [supabase error]"
**Cause:** Various Supabase configuration issues.
**Solution:**
- Check browser console for detailed error messages
- Verify Supabase URL and anon key in environment variables
- Test database connection using Supabase dashboard
- Ensure the procedures table exists with correct schema

#### Error: Video upload failures
**Cause:** Storage bucket not configured or RLS issues.
**Solution:**
- Create a public storage bucket named 'videos'
- Configure storage RLS policies if needed
- Verify storage URL configuration

#### General debugging steps:
1. Open browser developer tools and check console for errors
2. Verify authentication status in the application
3. Test queries directly in Supabase SQL editor
4. Check RLS policies in Supabase dashboard under Authentication > Policies
5. Ensure environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are correctly set

## Delivery Tickets Tracking

The Delivery Tickets feature has been enhanced with comprehensive tracking capabilities:

### New Features

- **Ticket ID tracking**: Reference external ticket numbers
- **Gallons Delivered**: Track exact gallons delivered per ticket
- **Time Windows**: Record scheduled delivery windows, arrival, and departure times
- **Odometer Tracking**: Log starting and ending odometer readings
- **Computed Metrics**:
  - **Miles Driven**: Automatically calculated from odometer readings
  - **On-Time Flag**: Auto-computed based on arrival vs. scheduled time (5-minute grace period)
- **Summary Dashboard**: Real-time metrics showing:
  - Total Gallons Delivered
  - Average Miles per Ticket
  - On-Time Delivery Percentage

### Database Migration

Apply the tracking enhancement migration:
```
sql/2025-10-16_extend_delivery_tickets_tracking.sql
```

This migration:
- Adds 9 new columns to delivery_tickets table
- Creates performance indexes
- Is idempotent and safe to re-run
- Performs no destructive operations
- See `sql/README.md` for detailed documentation

### On-Time Calculation

A delivery is marked "on time" (✅) if:
```
arrival_time <= scheduled_window_start + 5 minutes
```

Otherwise, it's marked as late (⏱️).

## Local dev
```bash
npm install
npm run dev
```
Commit to main

## Fuel Budgets & Roles Migration

A new additive migration file is provided at:
```
sql/2025-10-16_safe_roles_permissions_extension.sql
```

Apply it in the Supabase SQL Editor (copy/paste entire file). It is idempotent and safe to re-run.

### Verification

After applying the migration, verify the setup:
```sql
SELECT system_health_summary();
```

### Objects Created (only if missing)

The migration creates the following objects conditionally:

- **app_roles table** - User role assignments (admin, manager, editor, viewer)
- **audit_log table** - Audit trail for delivery_tickets changes
- **Audit triggers** - Automatic logging of INSERT/UPDATE/DELETE on delivery_tickets
- **dim_product table** - Product dimension with baseline seeds (PROPANE, OFF_DIESEL, HWY_DIESEL, FUEL_OIL_2, UNLEADED)
- **mapping_ticket_product table** - Maps raw product names to normalized products
- **fuel_budgets table** - Monthly fuel budgets by store and product with RLS enabled
- **Views**:
  - `ticket_products_normalized` - Delivery tickets with normalized product names
  - `view_ticket_metrics_monthly` - Monthly aggregated ticket metrics
  - `fuel_budget_vs_actual` - Budget vs actual comparison with variance calculations
- **RLS Policies**:
  - fuel_budgets: SELECT (all), INSERT (admin/manager), UPDATE (admin/manager/owner), DELETE (admin only)
  - delivery_tickets: SELECT (all), INSERT (role-based), UPDATE (role/owner), DELETE (admin/manager)
- **Function**: `system_health_summary()` - Returns JSON snapshot of system status

### No Destructive Operations

This migration performs **no destructive operations**:
- No DROP TABLE or TRUNCATE
- No ALTER TABLE DROP COLUMN
- No data deletion
- All changes are additive and backward compatible

## Applying Migrations via GitHub Actions

Add secret `SUPABASE_DB_URL` (Postgres connection string) in repository settings. Then run the "Apply Supabase Migrations" workflow (Actions > Apply Supabase Migrations > Run workflow). Provide a specific `migration_file` for a single file or leave blank to apply all. The workflow blocks if it detects potentially destructive `DROP TABLE` or `ALTER TABLE ... DROP` statements.
