-- Migration: Enable anonymous access to ticket_imports for GitHub Pages
-- Date: 2025-11-04
-- Purpose: Allow anon users to insert and read ticket_imports for upload flow
--          This is required for GitHub Pages deployment where users are not authenticated

-- ============================================================================
-- 1) Ensure RLS is enabled on ticket_imports
-- ============================================================================
ALTER TABLE IF EXISTS public.ticket_imports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2) Create policy for anonymous INSERT on ticket_imports
-- ============================================================================
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow anon insert ticket_imports" ON public.ticket_imports;

-- Create policy to allow anonymous users to insert ticket imports
CREATE POLICY "Allow anon insert ticket_imports" 
  ON public.ticket_imports 
  FOR INSERT 
  TO anon 
  WITH CHECK (true);

-- ============================================================================
-- 3) Create policy for anonymous SELECT on ticket_imports
-- ============================================================================
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow anon read ticket_imports" ON public.ticket_imports;

-- Create policy to allow anonymous users to read ticket imports
CREATE POLICY "Allow anon read ticket_imports" 
  ON public.ticket_imports 
  FOR SELECT 
  TO anon 
  USING (true);

-- ============================================================================
-- 4) Verification queries
-- ============================================================================
-- Verify RLS is enabled:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename = 'ticket_imports';

-- Verify policies exist:
-- SELECT schemaname, tablename, policyname, cmd, roles
-- FROM pg_policies 
-- WHERE schemaname = 'public' AND tablename = 'ticket_imports'
-- ORDER BY policyname;
