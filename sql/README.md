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

## Additional Migrations

Other migrations in this directory:
- `add_procedure_video_columns_and_owner_policies.sql` - Adds video support to procedures table
- `procedure_video_storage_setup.sql` - Storage setup for procedure videos
