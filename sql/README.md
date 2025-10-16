# SQL Migrations

This directory contains SQL migration scripts for the KPI Dashboard Supabase database.

## How to Apply Migrations

### Running SQL Migrations in Supabase

1. **Open the Supabase SQL Editor:**
   - Log in to your Supabase project at [app.supabase.com](https://app.supabase.com)
   - Navigate to the SQL Editor in the left sidebar

2. **Execute the migration:**
   - Open the migration file (e.g., `2025-09-30_create_tickets_and_rls.sql`)
   - Copy the entire contents
   - Paste into the Supabase SQL Editor
   - Click "Run" to execute

3. **Verify the migration:**
   - Check that tables were created successfully
   - Verify RLS policies are in place (see verification queries at bottom of migration file)

### Creating the Private Storage Bucket

After running the `2025-09-30_create_tickets_and_rls.sql` migration, you **must** create a private storage bucket:

1. **Go to Storage in Supabase Dashboard:**
   - Click "Storage" in the left sidebar
   - Click "New bucket"

2. **Create the bucket:**
   - Name: `private-attachments`
   - Public bucket: **OFF** (keep it private)
   - Click "Create bucket"

3. **Configure bucket RLS policies:**
   
   Navigate to the bucket settings and add these policies:

   ```sql
   -- Allow authenticated users to upload files
   CREATE POLICY "Authenticated users can upload attachments"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'private-attachments');

   -- Allow authenticated users to view/download files (via signed URLs)
   CREATE POLICY "Authenticated users can view attachments"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'private-attachments');

   -- Allow users to update their own uploads
   CREATE POLICY "Users can update their own attachments"
   ON storage.objects FOR UPDATE
   TO authenticated
   USING (bucket_id = 'private-attachments' AND owner = auth.uid())
   WITH CHECK (bucket_id = 'private-attachments' AND owner = auth.uid());

   -- Allow users to delete their own uploads
   CREATE POLICY "Users can delete their own attachments"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (bucket_id = 'private-attachments' AND owner = auth.uid());
   ```

## Migration: 2025-09-30_create_tickets_and_rls.sql

This migration creates the core tables for the delivery tickets feature with proper Row Level Security.

### Tables Created

1. **delivery_tickets** - Stores delivery ticket records
   - Fields: id, date, store, product, driver, qty, price, tax, amount, status, notes, customerName, account
   - Owner field: `created_by` (references auth.users)
   - Timestamps: created_at, updated_at

2. **ticket_attachments** - Stores metadata for uploaded files
   - Fields: id, ticket_id, storage_key, filename, content_type, size
   - Owner field: `uploaded_by` (references auth.users)
   - Timestamp: uploaded_at

3. **store_invoices** - Optional table for store invoicing
   - Fields: id, invoice_no, store, created, status, total
   - Owner field: `created_by` (references auth.users)
   - Timestamps: created_at, updated_at

### Why RLS Policies Are Required

Row Level Security (RLS) is essential for multi-tenant data security in Supabase:

1. **Data Isolation:** Without RLS, authenticated users could access ALL rows in a table, including data from other users.

2. **Fine-grained Access Control:** RLS policies enforce:
   - Users can only insert records with their own `created_by`/`uploaded_by` ID
   - Users can read all records (for collaborative viewing)
   - Users can only update/delete their own records (based on owner fields)

3. **Security by Default:** Even if client-side code has bugs or is bypassed, RLS policies at the database level prevent unauthorized access.

### Policy Structure

Each table has four types of policies:

- **INSERT policies:** Require `created_by` or `uploaded_by` to match `auth.uid()` (the authenticated user's ID)
- **SELECT policies:** Allow authenticated users to read all rows (permissive for collaboration)
- **UPDATE policies:** Only allow owners (via `created_by`/`uploaded_by`) to modify their rows
- **DELETE policies:** Only allow owners to delete their rows

This ensures:
- All inserts are properly attributed to the creating user
- Everyone can see data (useful for dashboards and reports)
- Only the creator can modify or delete their data

### Verifying the Setup

After running the migration and creating the storage bucket, verify everything is working:

1. **Check tables exist:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
     AND table_name IN ('delivery_tickets', 'ticket_attachments', 'store_invoices');
   ```

2. **Verify RLS is enabled:**
   ```sql
   SELECT schemaname, tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
     AND tablename IN ('delivery_tickets', 'ticket_attachments', 'store_invoices');
   ```

3. **Check policies are created:**
   ```sql
   SELECT schemaname, tablename, policyname, cmd 
   FROM pg_policies 
   WHERE schemaname = 'public' 
     AND tablename IN ('delivery_tickets', 'ticket_attachments', 'store_invoices')
   ORDER BY tablename, policyname;
   ```

4. **Test in the application:**
   - Sign in to the app
   - Navigate to Delivery Tickets
   - Create a new ticket - verify `created_by` is set to your user ID
   - Upload an attachment - verify it creates a record in `ticket_attachments`
   - Download the attachment - verify signed URL is generated and file downloads correctly
   - Try to edit/delete another user's ticket - should be blocked by RLS

### Troubleshooting

**Error: "new row violates row-level security policy"**
- Ensure you're authenticated (check `supabase.auth.getUser()`)
- Verify the INSERT policy exists
- Check that `created_by` or `uploaded_by` is being set to `auth.uid()`

**Error: "permission denied for table"**
- Verify RLS is enabled on the table
- Check that the appropriate policies exist
- Ensure user is authenticated with a valid session

**Attachments not uploading:**
- Verify the `private-attachments` bucket exists
- Check bucket is set to private (not public)
- Ensure storage bucket policies are configured
- Verify authenticated user has INSERT permission on the bucket

**Downloads not working:**
- Check signed URL is being created correctly
- Verify bucket SELECT policy exists
- Ensure storage key matches the uploaded file path
- Check signed URL hasn't expired (default: 10 minutes)

## Migration: 2025-10-16_extend_delivery_tickets_tracking.sql

**Purpose:** Extends the `delivery_tickets` table with additional tracking fields for enhanced delivery management, including ticket IDs, time windows, odometer readings, and computed metrics.

**Date:** 2025-10-16

**What it does:**
- Adds new columns to `delivery_tickets` table for enhanced tracking
- Creates indexes for performance optimization
- Computes `on_time_flag` for existing rows with available data

### New Columns Added

1. **ticket_id** (text) - External ticket reference/ID
2. **gallons_delivered** (numeric) - Gallons delivered (can be used separately from qty)
3. **scheduled_window_start** (timestamptz) - Scheduled delivery window start time
4. **arrival_time** (timestamptz) - Actual arrival timestamp
5. **departure_time** (timestamptz) - Departure timestamp
6. **odometer_start** (numeric) - Starting odometer reading
7. **odometer_end** (numeric) - Ending odometer reading
8. **miles_driven** (numeric) - Miles driven (computed from odometer readings)
9. **on_time_flag** (smallint) - On-time delivery indicator (1 = on time, 0 = late, null = not computed)

### Key Features

- **Idempotent:** Safe to run multiple times without errors
- **Non-destructive:** Only adds columns, never removes existing data
- **Backward compatible:** Existing rows will have null values for new columns
- **Computed metrics:** Automatically computes `on_time_flag` for existing rows with available data

### On-Time Calculation

A delivery is considered "on time" if:
- `arrival_time <= scheduled_window_start + 5 minutes`

### Indexes Created

- `idx_delivery_tickets_ticket_id`
- `idx_delivery_tickets_scheduled_window_start`
- `idx_delivery_tickets_arrival_time`
- `idx_delivery_tickets_on_time_flag`

### Running the Migration

1. Open Supabase SQL Editor
2. Copy and paste the contents of `2025-10-16_extend_delivery_tickets_tracking.sql`
3. Click "Run"
4. Verify columns were added successfully using the verification queries at the end of the file

### Frontend Integration

The `DeliveryTickets.jsx` component has been updated to:
- Display all new fields in the table
- Auto-compute `miles_driven` when odometer values are entered
- Auto-compute `on_time_flag` when arrival and scheduled times are entered
- Show summary metrics (Total Gallons, Avg Miles per Ticket, On-Time %)

## Migration: 2025-10-16_add_hazmat_fee.sql

**Purpose:** Adds `hazmat_fee` column to the `delivery_tickets` table for tracking hazardous material fees separately from tax.

**Date:** 2025-10-16

**What it does:**
- Adds `hazmat_fee` column (numeric, nullable) to `delivery_tickets` table
- Backfills NULL values to 0 for consistency with UI expectations
- Optional: Creates index on `hazmat_fee` for performance (commented out by default)
- Includes verification queries to confirm successful migration

### New Column Added

1. **hazmat_fee** (numeric) - Hazardous material fee (separate from tax)

### Key Features

- **Idempotent:** Safe to run multiple times without errors
- **Non-destructive:** Only adds column, never removes existing data
- **Backward compatible:** Existing rows will have hazmat_fee set to 0 by default
- **Amount calculation:** Frontend automatically includes hazmat_fee in amount: qty * price + tax + hazmat_fee

### Running the Migration

1. Open Supabase SQL Editor
2. Copy and paste the contents of `2025-10-16_add_hazmat_fee.sql`
3. Click "Run"
4. Verify column was added successfully using the verification queries at the end of the file

### Frontend Integration

The `DeliveryTickets.jsx` component has been updated to:
- Display hazmat_fee field in the table (after Tax column)
- Auto-compute `amount` when hazmat_fee is entered
- Include hazmat_fee in CSV and Excel exports
- Persist hazmat_fee via autosave and manual save

### Verification

After running the migration:
```sql
-- Verify hazmat_fee column exists:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'delivery_tickets'
  AND column_name = 'hazmat_fee';

-- Should return: hazmat_fee | numeric | YES
```

## Migration: 2025-10-16_delivery_tickets_admin_delete_policy.sql

**Purpose:** Allows users with `admin` or `manager` roles to delete any delivery ticket and its attachments, even if they didn't create them. This enables proper administrative control while maintaining security for regular users.

**Date:** 2025-10-16

**What it does:**
- Adds `delivery_tickets_delete_admin` policy for admin/manager to delete any ticket
- Adds `ticket_attachments_delete_admin` policy for admin/manager to delete any attachment
- Ensures CASCADE delete works properly when admin/manager deletes a ticket

### The Problem This Solves

**Before this migration:**
- Admins with `admin` role could VIEW all tickets (broad SELECT policy)
- But admins could NOT delete tickets created by others (DELETE policy restricted to owner only)
- UI showed delete (✖) icon but deletions failed silently due to RLS blocking the operation
- CASCADE delete on `ticket_attachments` would also fail even if admin deleted parent ticket

**After this migration:**
- Admins and managers can delete ANY ticket, regardless of who created it
- Admins and managers can delete ANY attachment, regardless of who uploaded it
- CASCADE delete now works properly when admin/manager deletes a ticket
- Regular users retain owner-only delete restrictions

### Prerequisites

This migration requires:
1. The `app_roles` table must exist (created by `2025-10-16_safe_roles_permissions_extension.sql`)
2. Users must have roles assigned in `app_roles` table with role values: `admin`, `manager`, `editor`, or `viewer`
3. Only users with `admin` or `manager` role will gain the additional delete permissions

### RLS Policies Created

**delivery_tickets_delete_admin:**
- Allows authenticated users with admin or manager role to delete any delivery ticket
- Checks: `EXISTS (SELECT 1 FROM public.app_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))`

**ticket_attachments_delete_admin:**
- Allows authenticated users with admin or manager role to delete any attachment
- Critical for CASCADE delete compatibility when admin/manager deletes parent ticket
- Checks: `EXISTS (SELECT 1 FROM public.app_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))`

### Key Features

- **Additive only:** Works alongside existing owner-based delete policies
- **Idempotent:** Safe to run multiple times without errors
- **Non-destructive:** Does not modify or remove existing policies
- **Role-based:** Leverages `app_roles` table for authorization
- **CASCADE-compatible:** Ensures foreign key constraints work with RLS

### Running the Migration

1. **Prerequisite:** Ensure `2025-10-16_safe_roles_permissions_extension.sql` has been run first
2. Open Supabase SQL Editor
3. Copy and paste the contents of `2025-10-16_delivery_tickets_admin_delete_policy.sql`
4. Click "Run"
5. Verify policies were created successfully using the verification queries in the file

### Verification

After running the migration:
```sql
-- Verify the new admin delete policies exist:
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('delivery_tickets', 'ticket_attachments')
  AND policyname LIKE '%_admin'
ORDER BY tablename, policyname;

-- Should return 2 rows:
-- delivery_tickets | delivery_tickets_delete_admin | DELETE | ...
-- ticket_attachments | ticket_attachments_delete_admin | DELETE | ...
```

### Testing

**As a regular user (no admin role):**
1. Create a ticket
2. Try to delete someone else's ticket → Should fail (expected behavior)
3. Try to delete your own ticket → Should succeed (existing owner policy)

**As an admin or manager:**
1. Sign in with a user that has `admin` or `manager` role in `app_roles`
2. Navigate to delivery tickets
3. Delete a ticket created by another user → Should succeed
4. Verify the ticket and its attachments are removed from the database

### Documentation Updates

See `docs/DeliveryTickets_Setup.md` for comprehensive RLS policy documentation, including the new admin/manager delete policies.

## Additional Migrations

Other migrations in this directory:
- `add_procedure_video_columns_and_owner_policies.sql` - Adds video support to procedures table
- `procedure_video_storage_setup.sql` - Storage setup for procedure videos
- `2025-10-16_safe_roles_permissions_extension.sql` - Creates app_roles table and role-based policies
