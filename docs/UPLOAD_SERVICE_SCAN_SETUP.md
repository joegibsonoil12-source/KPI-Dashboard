# Upload Service Scan Setup Guide

## Overview
This guide provides step-by-step instructions for setting up the GitHub Pages-compatible Upload Service Scan feature. This feature allows anonymous users to upload scanned service tickets directly from the Delivery Tickets page.

## Prerequisites
- Supabase project access with admin permissions
- Project reference: `jskajkwulaaakhaolzdu`
- Supabase CLI installed (optional, for CLI method)

## Setup Steps

### Step 1: Create Storage Bucket 'ticket-scans'

The `ticket-scans` bucket is required to store uploaded ticket scan files (PDFs and images).

#### Method A: Supabase Dashboard (Recommended)

1. Navigate to Supabase Storage:
   - URL: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/storage/buckets
2. Click **"New bucket"**
3. Configure the bucket:
   - **Name**: `ticket-scans`
   - **Public**: ❌ **Unchecked** (keep bucket private)
   - **File size limit**: `50 MB` (52428800 bytes)
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/jpg`
     - `image/png`
     - `image/gif`
     - `application/pdf`
4. Click **"Create bucket"**
5. **Confirmation**: After creation, you should see `ticket-scans` in your buckets list

#### Method B: Supabase CLI

```bash
# Login to Supabase
supabase login

# Link to project
supabase link --project-ref jskajkwulaaakhaolzdu

# Create bucket
supabase storage create-bucket ticket-scans --public false
```

**Expected output:**
```
✓ Created bucket ticket-scans
```

#### Method C: SQL (Fallback)

If neither method above is available, run this SQL in Supabase SQL Editor:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-scans', 
  'ticket-scans', 
  false,
  52428800,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;
```

### Step 2: Enable RLS on ticket_imports Table

Run the following SQL in **Supabase SQL Editor**:

1. Navigate to: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/sql/new
2. Copy and paste this SQL:

```sql
-- Enable RLS on ticket_imports
ALTER TABLE IF EXISTS public.ticket_imports ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to INSERT ticket imports
CREATE POLICY IF NOT EXISTS "Allow anon insert ticket_imports" 
  ON public.ticket_imports 
  FOR INSERT 
  TO anon 
  WITH CHECK (true);

-- Allow anonymous users to SELECT ticket imports
CREATE POLICY IF NOT EXISTS "Allow anon read ticket_imports" 
  ON public.ticket_imports 
  FOR SELECT 
  TO anon 
  USING (true);
```

3. Click **"Run"**
4. **Expected output**: `Success. No rows returned`

**Confirmation**: Verify policies were created:
```sql
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'ticket_imports'
ORDER BY policyname;
```

### Step 3: Configure Storage RLS Policies

Run the following SQL in **Supabase SQL Editor**:

```sql
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to upload to ticket-scans bucket
DROP POLICY IF EXISTS "Allow anon upload ticket-scans" ON storage.objects;
CREATE POLICY "Allow anon upload ticket-scans"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'ticket-scans');

-- Allow anonymous users to read from ticket-scans bucket
DROP POLICY IF EXISTS "Allow anon read ticket-scans" ON storage.objects;
CREATE POLICY "Allow anon read ticket-scans"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'ticket-scans');

-- Allow authenticated users to upload to ticket-scans bucket
DROP POLICY IF EXISTS "Allow authenticated upload ticket-scans" ON storage.objects;
CREATE POLICY "Allow authenticated upload ticket-scans"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ticket-scans');

-- Allow authenticated users to read from ticket-scans bucket
DROP POLICY IF EXISTS "Allow authenticated read ticket-scans" ON storage.objects;
CREATE POLICY "Allow authenticated read ticket-scans"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'ticket-scans');

-- Allow service role to manage ticket-scans bucket
DROP POLICY IF EXISTS "Allow service_role manage ticket-scans" ON storage.objects;
CREATE POLICY "Allow service_role manage ticket-scans"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'ticket-scans')
  WITH CHECK (bucket_id = 'ticket-scans');
```

**Expected output**: `Success. No rows returned`

**Confirmation**: Verify storage policies:
```sql
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
  AND policyname LIKE '%ticket-scans%'
ORDER BY policyname;
```

## Verification

After completing all setup steps, verify the configuration:

### 1. Check Bucket Exists
```sql
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id = 'ticket-scans';
```

**Expected result:**
| id | name | public | file_size_limit |
|----|------|--------|-----------------|
| ticket-scans | ticket-scans | false | 52428800 |

### 2. Check ticket_imports Policies
```sql
SELECT tablename, policyname, roles
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'ticket_imports'
ORDER BY policyname;
```

**Expected policies:**
- `Allow anon insert ticket_imports` (roles: anon)
- `Allow anon read ticket_imports` (roles: anon)

### 3. Check Storage Policies
```sql
SELECT tablename, policyname, roles
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
  AND policyname LIKE '%ticket-scans%'
ORDER BY policyname;
```

**Expected policies:**
- `Allow anon read ticket-scans` (roles: anon)
- `Allow anon upload ticket-scans` (roles: anon)
- `Allow authenticated read ticket-scans` (roles: authenticated)
- `Allow authenticated upload ticket-scans` (roles: authenticated)
- `Allow service_role manage ticket-scans` (roles: service_role)

## Testing the Feature

1. **Build and deploy** the application:
   ```bash
   npm run build
   npm run deploy  # or deploy via GitHub Pages
   ```

2. **Navigate** to the deployed app: https://joegibsonoil12-source.github.io/KPI-Dashboard/

3. **Test upload**:
   - Click on **"Delivery Tickets"** tab
   - Click **"📄 Upload Service Scan"** button
   - Select a test file (PDF or image)
   - Watch browser console for diagnostic logs

4. **Expected behavior**:
   - Console shows: `[UploadServiceScanButton] === Upload Diagnostics ===`
   - Console shows: `[UploadServiceScanButton] Bucket access test: ✓ OK`
   - Console shows: `[UploadServiceScanButton] File uploaded successfully: upload_YYYY-MM-DD.../filename`
   - Console shows: `[imports/upload] source=delivery_page_upload id=<uuid> files=1`
   - Page navigates to **Imports** tab with new import highlighted

5. **Verify in Supabase**:
   - **Storage**: Check `ticket-scans` bucket for uploaded file
   - **Database**: Query `ticket_imports` table for new record:
     ```sql
     SELECT id, src, status, meta, created_at 
     FROM ticket_imports 
     ORDER BY created_at DESC 
     LIMIT 5;
     ```

## Troubleshooting

### Error: "Storage bucket 'ticket-scans' not found"

**Cause**: Bucket doesn't exist or is named incorrectly.

**Solution**: 
- Verify bucket exists in Supabase Dashboard → Storage
- Check bucket name is exactly `ticket-scans` (lowercase, with hyphen)
- Re-run Step 1 to create the bucket

### Error: "Permission denied for storage upload"

**Cause**: RLS policies for storage are missing or incorrect.

**Solution**:
- Verify `storage.objects` has RLS enabled
- Re-run Step 3 to create storage policies
- Check that policies target the `anon` role

### Error: "Permission denied for creating import record"

**Cause**: RLS policies for `ticket_imports` are missing.

**Solution**:
- Verify `ticket_imports` has RLS enabled
- Re-run Step 2 to create table policies
- Check that policies allow `anon` INSERT and SELECT

### Error: "Missing Supabase configuration"

**Cause**: Environment variables not set in GitHub Pages deployment.

**Solution**:
- Check `public/runtime-config.js` contains:
  ```javascript
  window.__ENV = {
    VITE_SUPABASE_URL: "https://your-project.supabase.co",
    VITE_SUPABASE_ANON_KEY: "your-anon-key"
  };
  ```
- Verify environment variables in deployment settings

### Upload succeeds but file not visible

**Cause**: Bucket is private; files require signed URLs.

**Solution**:
- This is expected behavior - the component creates signed URLs automatically
- Files are accessible via signed URLs (expire after 1 hour)
- Check `attached_files` field in `ticket_imports` record for signed URL

## Security Considerations

- ✅ **Bucket is private**: Files are not publicly accessible via direct URL
- ✅ **Anonymous uploads allowed**: Users can upload without authentication
- ✅ **Anonymous cannot delete**: Users cannot modify or delete existing files
- ✅ **Signed URLs expire**: Access links expire after 1 hour (3600 seconds)
- ✅ **File size limit**: Uploads limited to 50MB per file
- ✅ **MIME type validation**: Only images and PDFs are accepted
- ⚠️ **No malware scanning**: Consider adding virus scanning for production
- ⚠️ **No rate limiting**: Consider adding rate limits to prevent abuse

## Architecture Notes

### GitHub Pages Compatibility

This implementation is designed for **GitHub Pages** deployment where:
- No server-side code is available
- Users are not authenticated (anonymous access)
- All operations use Supabase client directly from browser

### Upload Flow

1. **Client-side validation** (browser)
2. **Diagnostics logging** (console)
3. **Bucket access test** (pre-flight check)
4. **File upload** to `ticket-scans` bucket
5. **Signed URL creation** (1-hour expiry)
6. **Database insert** to `ticket_imports` table
7. **Optional processing** (best-effort POST to API)
8. **Navigation** to Imports review tab

### Component: UploadServiceScanButton.jsx

**Location**: `src/components/UploadServiceScanButton.jsx`

**Features**:
- ✅ Diagnostics logging with URL truncation (security)
- ✅ Supabase client creation with `window.__ENV` override
- ✅ Bucket access pre-flight test
- ✅ Robust error handling (404, 403, 400)
- ✅ Actionable error modals
- ✅ Signed URL generation
- ✅ ticket_imports draft creation
- ✅ Metadata tracking (importType, source)
- ✅ Console logging for debugging

## Related Files

- **Component**: `src/components/UploadServiceScanButton.jsx`
- **Migration**: `supabase/migrations/0005_enable_anon_ticket_imports.sql`
- **Storage Setup**: `supabase/STORAGE_BUCKET_SETUP.sql`
- **Main Guide**: `SUPABASE_UPLOAD_SETUP.md`

## Support

For issues or questions:
1. Check browser console for diagnostic logs
2. Verify Supabase setup using verification queries
3. Review error messages in modal dialogs
4. Check GitHub Issues for known problems
