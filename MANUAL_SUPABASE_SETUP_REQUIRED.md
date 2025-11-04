# Manual Supabase Setup Required

## Status: ⚠️ STOPPED - Supabase Access Required

This PR implements the code changes for GH Pages-safe upload fixes, but requires manual Supabase configuration that cannot be automated.

## ✅ Completed Steps

1. **Created branch**: `feature/fix-upload-supabase` from `main`
2. **Verified component code**: `src/components/UploadServiceScanButton.jsx` already contains all required features:
   - Pre-upload diagnostics
   - Robust client upload with `supabase.storage.from('ticket-scans').upload`
   - Bucket-not-found error handling with user-friendly modal
   - Permission error handling with clear instructions
   - Signed URL creation for file review
   - ticket_imports insert via anon client with correct meta structure: `{importType:'service', source:'delivery_page_upload'}`
   - Console logging: `console.debug('[imports/upload] source=delivery_page_upload id=${importId} files=${attached_files.length}')`

## ⏸️ Pending Manual Steps (Require Supabase Access)

### Step 2: Create Storage Bucket 'ticket-scans'

**Supabase CLI is NOT available** in this environment. Manual creation required.

#### Option A: Supabase CLI (Recommended if available locally)
```bash
# Login to Supabase
supabase login

# Link to project
supabase link --project-ref jskajkwulaaakhaolzdu

# Create bucket
supabase storage create-bucket ticket-scans --public false
```

#### Option B: Supabase Dashboard UI (Recommended)
1. Navigate to: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/storage/buckets
2. Click "New bucket"
3. Configure:
   - **Name**: `ticket-scans`
   - **Public**: ❌ unchecked (must be private)
   - **File size limit**: 50 MB
   - **Allowed MIME types**: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `application/pdf`
4. Click "Create bucket"

#### Option C: SQL Editor (Fallback)
Run the complete SQL from: `supabase/STORAGE_BUCKET_SETUP.sql`

### Step 3: Enable RLS Policies for ticket_imports

**IMPORTANT**: Do not run without permission. Run these in Supabase SQL Editor:

```sql
-- Enable RLS on ticket_imports table
ALTER TABLE IF EXISTS public.ticket_imports ENABLE ROW LEVEL SECURITY;

-- Allow anonymous INSERT
CREATE POLICY IF NOT EXISTS "Allow anon insert ticket_imports" 
  ON public.ticket_imports 
  FOR INSERT 
  TO anon 
  WITH CHECK (true);

-- Allow anonymous SELECT
CREATE POLICY IF NOT EXISTS "Allow anon read ticket_imports" 
  ON public.ticket_imports 
  FOR SELECT 
  TO anon 
  USING (true);
```

**Migration file**: `supabase/migrations/0005_enable_anon_ticket_imports.sql`

**To apply**:
1. Navigate to: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/sql/new
2. Copy the entire contents of `supabase/migrations/0005_enable_anon_ticket_imports.sql`
3. Paste into SQL Editor
4. Click "Run"
5. **Paste SQL run confirmation into this PR**

### Step 4: Configure Storage Policies

Run the storage policies from: `supabase/STORAGE_BUCKET_SETUP.sql`

Key policies to create:
```sql
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow anon upload to ticket-scans
DROP POLICY IF EXISTS "Allow anon upload ticket-scans" ON storage.objects;
CREATE POLICY "Allow anon upload ticket-scans"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'ticket-scans');

-- Allow anon read from ticket-scans (for signed URLs)
DROP POLICY IF EXISTS "Allow anon read ticket-scans" ON storage.objects;
CREATE POLICY "Allow anon read ticket-scans"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'ticket-scans');

-- Allow authenticated users full access
DROP POLICY IF EXISTS "Allow authenticated upload ticket-scans" ON storage.objects;
CREATE POLICY "Allow authenticated upload ticket-scans"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-scans');

DROP POLICY IF EXISTS "Allow authenticated read ticket-scans" ON storage.objects;
CREATE POLICY "Allow authenticated read ticket-scans"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-scans');

-- Allow service_role full management
DROP POLICY IF EXISTS "Allow service_role manage ticket-scans" ON storage.objects;
CREATE POLICY "Allow service_role manage ticket-scans"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'ticket-scans')
  WITH CHECK (bucket_id = 'ticket-scans');
```

## 🔍 Verification Steps (After Manual Setup)

Run these queries in Supabase SQL Editor to verify setup:

```sql
-- 1. Verify bucket exists
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'ticket-scans';

-- Expected: 1 row with name='ticket-scans', public=false

-- 2. Verify ticket_imports RLS policies
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'ticket_imports'
ORDER BY policyname;

-- Expected: At least 2 policies including "Allow anon insert ticket_imports" and "Allow anon read ticket_imports"

-- 3. Verify storage policies
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
  AND policyname LIKE '%ticket-scans%'
ORDER BY policyname;

-- Expected: 5 policies for ticket-scans bucket
```

## 📋 SQL Confirmation Template

**After running the SQL, paste confirmation here**:

```
SQL Run Confirmation:
- Date: [YYYY-MM-DD]
- User: [your-username]
- Project: jskajkwulaaakhaolzdu

Bucket Creation:
[ ] ticket-scans bucket created successfully
[ ] Bucket is private (public=false)
[ ] File size limit: 50MB
[ ] MIME types configured

RLS Policies Applied:
[ ] ticket_imports RLS enabled
[ ] "Allow anon insert ticket_imports" policy created
[ ] "Allow anon read ticket_imports" policy created

Storage Policies Applied:
[ ] storage.objects RLS enabled
[ ] "Allow anon upload ticket-scans" policy created
[ ] "Allow anon read ticket-scans" policy created
[ ] "Allow authenticated upload ticket-scans" policy created
[ ] "Allow authenticated read ticket-scans" policy created
[ ] "Allow service_role manage ticket-scans" policy created

Verification Queries:
[Paste results of verification queries here]
```

## 📝 Related Files

- Component: `src/components/UploadServiceScanButton.jsx` (already updated)
- Migration: `supabase/migrations/0005_enable_anon_ticket_imports.sql`
- Storage Setup: `supabase/STORAGE_BUCKET_SETUP.sql`
- Setup Guide: `SUPABASE_UPLOAD_SETUP.md`

## 🚀 Testing After Setup

1. Navigate to Delivery Tickets page
2. Click "📄 Upload Service Scan" button
3. Select a PDF or image file
4. Verify upload completes without errors
5. Check console for debug logs: `[imports/upload] source=delivery_page_upload id=...`
6. Verify in Supabase:
   - Storage > ticket-scans bucket contains the file
   - Database > ticket_imports table has new row with status='pending'

## 🔒 Security Notes

- Bucket is **private** - files are not publicly accessible
- Anonymous users can upload but cannot modify/delete
- Signed URLs expire after 1 hour
- File size limited to 50MB
- Only specific MIME types allowed

## Next Steps

1. **Manual Supabase setup** must be completed by someone with Supabase access
2. **Paste SQL confirmation** into this PR
3. **Test upload functionality** to verify everything works
4. **Merge to main** after verification
