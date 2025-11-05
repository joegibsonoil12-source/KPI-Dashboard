# Manual Setup Required: Upload Service Scan Feature

## Status Summary

✅ **Code Implementation**: COMPLETE  
❌ **Supabase Configuration**: REQUIRES MANUAL SETUP  
📋 **Branch**: `feature/fix-upload-supabase`

---

## What Was Done

### ✅ Part A: Code Implementation (Complete)

1. **Branch Created**: `feature/fix-upload-supabase` from `main`
2. **Component Already Implemented**: `src/components/UploadServiceScanButton.jsx` contains:
   - ✅ Pre-upload diagnostics (URL truncation, anon key check)
   - ✅ Supabase client creation with `window.__ENV` override
   - ✅ Bucket access pre-flight test (`supabase.storage.from('ticket-scans').list('', {limit:1})`)
   - ✅ Robust upload flow with comprehensive error handling
   - ✅ Error inspection for 404/400/403 with actionable modal messages
   - ✅ Signed URL creation after successful upload
   - ✅ ticket_imports insert with `status:'pending'` and `meta:{importType:'service', source:'delivery_page_upload'}`
   - ✅ Console.debug logging: `[imports/upload] source=delivery_page_upload id=<uuid> files=<count>`

3. **Documentation Created**:
   - ✅ `docs/UPLOAD_SERVICE_SCAN_SETUP.md` - Comprehensive setup guide
   - ✅ Existing: `SUPABASE_UPLOAD_SETUP.md`
   - ✅ Existing: `supabase/STORAGE_BUCKET_SETUP.sql`
   - ✅ Existing: `supabase/migrations/0005_enable_anon_ticket_imports.sql`

---

## What Requires Manual Setup

### ❌ Part A.2: Create Storage Bucket (BLOCKED)

**Reason**: Supabase CLI requires interactive login which is not available in CI/CD environment.

**Error Details**:
```
Command: supabase login
Output: "Hello from Supabase! Press Enter to open browser and login automatically."
Environment: No SUPABASE_ACCESS_TOKEN or interactive browser available
```

**REQUIRED ACTION - Choose ONE method**:

#### **Method 1: Supabase Dashboard (Recommended)** ⭐

1. Go to: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/storage/buckets
2. Click **"New bucket"**
3. Configure:
   - **Name**: `ticket-scans`
   - **Public**: ❌ Unchecked (private)
   - **File size limit**: 50 MB
   - **Allowed MIME types**: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `application/pdf`
4. Click **"Create bucket"**

**✅ Confirmation**: After creation, reply with: **"ticket-scans bucket created"**

#### **Method 2: Supabase CLI** (if you have credentials locally)

```bash
supabase login
supabase link --project-ref jskajkwulaaakhaolzdu
supabase storage create-bucket ticket-scans --public false
```

**✅ Confirmation**: Copy and paste CLI output showing bucket creation success.

#### **Method 3: SQL Editor** (fallback)

1. Go to: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/sql/new
2. Run:

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

**✅ Confirmation**: Paste SQL execution result.

---

### ❌ Part A.3: Apply RLS Policies (REQUIRES OPERATOR)

**REQUIRED ACTION**: Run this SQL in Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/sql/new
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

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Storage policies for ticket-scans bucket
DROP POLICY IF EXISTS "Allow anon upload ticket-scans" ON storage.objects;
CREATE POLICY "Allow anon upload ticket-scans"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'ticket-scans');

DROP POLICY IF EXISTS "Allow anon read ticket-scans" ON storage.objects;
CREATE POLICY "Allow anon read ticket-scans"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'ticket-scans');

DROP POLICY IF EXISTS "Allow authenticated upload ticket-scans" ON storage.objects;
CREATE POLICY "Allow authenticated upload ticket-scans"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-scans');

DROP POLICY IF EXISTS "Allow authenticated read ticket-scans" ON storage.objects;
CREATE POLICY "Allow authenticated read ticket-scans"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-scans');

DROP POLICY IF EXISTS "Allow service_role manage ticket-scans" ON storage.objects;
CREATE POLICY "Allow service_role manage ticket-scans"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'ticket-scans')
  WITH CHECK (bucket_id = 'ticket-scans');
```

3. Click **"Run"**
4. **✅ Confirmation**: Paste SQL execution result or reply: **"RLS policies applied successfully"**

---

## Verification Queries

After completing manual setup, run these queries to verify:

### 1. Verify Bucket Exists
```sql
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id = 'ticket-scans';
```

**Expected**: 1 row with `ticket-scans` bucket (public=false)

### 2. Verify ticket_imports Policies
```sql
SELECT policyname, roles
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'ticket_imports'
  AND policyname LIKE '%anon%'
ORDER BY policyname;
```

**Expected**: 2 policies (anon insert, anon read)

### 3. Verify Storage Policies
```sql
SELECT policyname, roles
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
  AND policyname LIKE '%ticket-scans%'
ORDER BY policyname;
```

**Expected**: 5 policies (anon upload/read, authenticated upload/read, service_role manage)

---

## Next Steps After Manual Setup

Once you've completed the manual setup steps and provided confirmations:

1. ✅ Verify all setup using verification queries above
2. 🔄 Agent will update PR description with confirmation details
3. 🚀 Ready to merge PR to `main`
4. 🧪 Test the feature on deployed GitHub Pages site

---

## Testing the Feature

After setup is complete:

1. Navigate to: https://joegibsonoil12-source.github.io/KPI-Dashboard/
2. Go to **Delivery Tickets** tab
3. Click **"📄 Upload Service Scan"** button
4. Select a test file (PDF or image)
5. Open browser console (F12) to see diagnostic logs
6. Expected console output:
   ```
   [UploadServiceScanButton] === Upload Diagnostics ===
   [UploadServiceScanButton] Bucket access test: ✓ OK
   [UploadServiceScanButton] File uploaded successfully: upload_...
   [imports/upload] source=delivery_page_upload id=<uuid> files=1
   ```

---

## Quick Reference Links

- **Supabase Dashboard**: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu
- **Storage Buckets**: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/storage/buckets
- **SQL Editor**: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/sql/new
- **Setup Guide**: `docs/UPLOAD_SERVICE_SCAN_SETUP.md`
- **Storage SQL**: `supabase/STORAGE_BUCKET_SETUP.sql`
- **RLS Migration**: `supabase/migrations/0005_enable_anon_ticket_imports.sql`

---

## Summary

✅ **Code is ready** - No code changes needed  
❌ **Manual Supabase setup required** - 2 steps (bucket creation + RLS policies)  
📋 **Awaiting operator confirmation** to proceed with PR finalization
