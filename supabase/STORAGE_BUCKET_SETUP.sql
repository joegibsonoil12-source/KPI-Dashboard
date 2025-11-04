-- ============================================================================
-- STORAGE BUCKET SETUP FOR TICKET SCANS
-- Run this script in Supabase SQL Editor
-- ============================================================================
-- Purpose: Create 'ticket-scans' storage bucket for uploaded ticket files
--          Configure RLS policies for anon access (GitHub Pages deployment)
--
-- Note: Storage buckets should ideally be created via Supabase Dashboard UI
--       or CLI: supabase storage create-bucket ticket-scans --public false
--       This SQL is provided as a fallback if those methods are not available.
-- ============================================================================

-- ============================================================================
-- 1) Create storage bucket 'ticket-scans' (private)
-- ============================================================================
-- This creates a private bucket for storing ticket scan uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-scans', 
  'ticket-scans', 
  false,  -- private bucket
  52428800,  -- 50MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2) Enable RLS on storage.objects
-- ============================================================================
-- Ensure Row Level Security is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3) Create storage policies for 'ticket-scans' bucket
-- ============================================================================

-- Policy: Allow anonymous users to upload to ticket-scans bucket
DROP POLICY IF EXISTS "Allow anon upload ticket-scans" ON storage.objects;
CREATE POLICY "Allow anon upload ticket-scans"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'ticket-scans');

-- Policy: Allow anonymous users to read from ticket-scans bucket
DROP POLICY IF EXISTS "Allow anon read ticket-scans" ON storage.objects;
CREATE POLICY "Allow anon read ticket-scans"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'ticket-scans');

-- Policy: Allow authenticated users to upload to ticket-scans bucket
DROP POLICY IF EXISTS "Allow authenticated upload ticket-scans" ON storage.objects;
CREATE POLICY "Allow authenticated upload ticket-scans"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ticket-scans');

-- Policy: Allow authenticated users to read from ticket-scans bucket
DROP POLICY IF EXISTS "Allow authenticated read ticket-scans" ON storage.objects;
CREATE POLICY "Allow authenticated read ticket-scans"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'ticket-scans');

-- Policy: Allow service role to manage ticket-scans bucket (all operations)
DROP POLICY IF EXISTS "Allow service_role manage ticket-scans" ON storage.objects;
CREATE POLICY "Allow service_role manage ticket-scans"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'ticket-scans')
  WITH CHECK (bucket_id = 'ticket-scans');

-- ============================================================================
-- 4) Verification queries
-- ============================================================================
-- Verify bucket exists:
-- SELECT id, name, public, file_size_limit, allowed_mime_types 
-- FROM storage.buckets 
-- WHERE id = 'ticket-scans';

-- Verify policies exist:
-- SELECT schemaname, tablename, policyname, cmd, roles
-- FROM pg_policies 
-- WHERE tablename = 'objects' AND schemaname = 'storage'
-- ORDER BY policyname;

-- ============================================================================
-- ALTERNATIVE: Create bucket via Supabase CLI (Recommended)
-- ============================================================================
-- If you have Supabase CLI installed and configured:
--
-- $ supabase login
-- $ supabase link --project-ref jskajkwulaaakhaolzdu
-- $ supabase storage create-bucket ticket-scans --public false
--
-- Then apply the policies above via SQL Editor or migration file.
-- ============================================================================
