# Supabase Upload Setup Guide

## Overview
This guide documents the setup required for the GitHub Pages-compatible upload feature that allows anonymous users to upload ticket scans.

## Environment Status
**Note**: Supabase CLI is not available in the CI/CD environment. All setup must be done manually via Supabase Dashboard.

## Required Setup Steps

### Step 1: Create Storage Bucket
**Bucket Name**: `ticket-scans`  
**Visibility**: Private  
**Purpose**: Store uploaded ticket scan files (PDFs, images)

#### Option A: Via Supabase Dashboard (Recommended)
1. Navigate to: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/storage/buckets
2. Click "New bucket"
3. Configure:
   - Name: `ticket-scans`
   - Public: **unchecked** (private bucket)
   - File size limit: 50 MB
   - Allowed MIME types: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `application/pdf`
4. Click "Create bucket"

#### Option B: Via Supabase CLI (If Available)
```bash
supabase login
supabase link --project-ref jskajkwulaaakhaolzdu
supabase storage create-bucket ticket-scans --public false
```

#### Option C: Via SQL (Fallback)
Run the SQL script at: `supabase/STORAGE_BUCKET_SETUP.sql`

### Step 2: Enable RLS Policies for ticket_imports Table

Run the following SQL in Supabase SQL Editor:

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

**Migration File**: `supabase/migrations/0005_enable_anon_ticket_imports.sql`

**To Apply Migration**:
1. Navigate to: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/sql/new
2. Copy the entire contents of `supabase/migrations/0005_enable_anon_ticket_imports.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Verify success message appears

### Step 3: Configure Storage Policies

Run the storage policies section from: `supabase/STORAGE_BUCKET_SETUP.sql`

**Key Policies**:
- Allow `anon` to INSERT (upload) to `ticket-scans`
- Allow `anon` to SELECT (read) from `ticket-scans`
- Allow `authenticated` users full access
- Allow `service_role` full management access

### Step 4: Verification

After completing the setup, verify with these SQL queries:

```sql
-- Verify bucket exists
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id = 'ticket-scans';

-- Verify ticket_imports RLS policies
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'ticket_imports'
ORDER BY policyname;

-- Verify storage policies
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
  AND policyname LIKE '%ticket-scans%'
ORDER BY policyname;
```

## Expected Results

After setup, you should see:
- 1 storage bucket: `ticket-scans`
- 2+ RLS policies on `ticket_imports` (including anon insert/select)
- 5 storage policies on `storage.objects` for `ticket-scans`

## Testing the Upload Feature

1. Navigate to the Delivery Tickets page
2. Click "📄 Upload Service Scan" button
3. Select a PDF or image file
4. Verify upload completes without authentication
5. Check Supabase:
   - Storage > ticket-scans bucket should contain uploaded files
   - Database > ticket_imports table should have new row with `status='pending'`

## Troubleshooting

### Error: "Bucket not found"
- Verify bucket `ticket-scans` exists in Supabase Storage
- Check bucket name spelling (case-sensitive)

### Error: "Permission denied"
- Verify RLS policies are created for `anon` role
- Check that RLS is enabled on both `ticket_imports` and `storage.objects`

### Error: "Failed to create signed URL"
- Non-fatal error, upload can continue
- Verify storage policies allow `anon` SELECT access

## Security Considerations

- Bucket is **private** - files not publicly accessible via direct URL
- Anonymous users can upload but cannot modify/delete existing files
- Signed URLs expire after 1 hour (3600 seconds)
- File size limited to 50MB
- Only specific MIME types allowed (images, PDFs)

## Related Files

- Migration: `supabase/migrations/0005_enable_anon_ticket_imports.sql`
- Storage Setup: `supabase/STORAGE_BUCKET_SETUP.sql`
- Component: `src/components/UploadServiceScanButton.jsx`

## External copy & migration endpoint

We now optionally copy any uploaded ticket scan to an external company folder.

### To enable S3:
Set the following environment variables in your server env (Netlify/Vercel):
- `AWS_REGION` - Your AWS region (e.g., `us-east-1`)
- `AWS_ACCESS_KEY_ID` - Your AWS access key ID
- `AWS_SECRET_ACCESS_KEY` - Your AWS secret access key
- `AWS_S3_BUCKET` - S3 bucket name to copy files to

### To enable Google Drive:
Set the following environment variables in your server env:
- `GOOGLE_SERVICE_ACCOUNT_JSON` - The JSON key (stringified) for your Google Cloud service account
- `GOOGLE_DRIVE_FOLDER_ID` - The Google Drive folder ID where files should be stored

**Note**: The service account must have write access to the target Drive folder.

### Migration endpoint:
A new serverless function is available to migrate local fallback imports into the database:

**Endpoint**: `POST /.netlify/functions/imports-migrate-local`

**Authentication**: Requires header `x-migrate-secret: <MIGRATE_SECRET>`

**Request Body**:
```json
{
  "localImports": [
    {
      "id": "local_...",
      "src": "...",
      "attached_files": [
        { "name": "x.pdf", "mimetype": "application/pdf", "base64": "..." }
      ],
      "meta": {...}
    }
  ]
}
```

**Environment Variable Required**:
- `MIGRATE_SECRET` - A secure random token to protect the migration endpoint

**Usage**: Use this endpoint to bulk-migrate local fallback imports (stored by the browser in `kpi_local_imports` localStorage) into `ticket_imports` table. The endpoint will:
1. Create a new `ticket_imports` record for each local import
2. Upload attached files to Supabase storage
3. Update the import record with file metadata
4. Optionally copy files to S3/Drive if configured

**External Copy Behavior**:
- External copying is **optional** and **non-fatal**
- If external copy fails, the file is still stored in Supabase
- Copy results are recorded in the `attached_files` metadata as `externalCopy` array
- Example: `{ "type": "s3", "location": "s3://bucket/path" }` or `{ "type": "drive", "id": "fileId", "webViewLink": "..." }`

