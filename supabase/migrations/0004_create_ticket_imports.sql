-- Migration: Create ticket_imports table for scan-to-ticket MVP
-- Date: 2025-10-30
-- Purpose: Store scanned/uploaded delivery tickets and service reports
--          for OCR processing and admin review before creating tickets

-- ============================================================================
-- 1) Create ticket_imports table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ticket_imports (
  id bigserial PRIMARY KEY,
  src text,
  src_email text,
  attached_files jsonb,
  ocr_text text,
  parsed jsonb,
  confidence numeric,
  status text DEFAULT 'pending',
  meta jsonb,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- ============================================================================
-- 2) Create indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ticket_imports_status ON public.ticket_imports(status);
CREATE INDEX IF NOT EXISTS idx_ticket_imports_created_at ON public.ticket_imports(created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_imports_src_email ON public.ticket_imports(src_email);

-- ============================================================================
-- 3) Enable Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.ticket_imports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4) RLS Policies for ticket_imports
-- ============================================================================

-- SELECT: Authenticated users can read all ticket imports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'ticket_imports' 
      AND policyname = 'ticket_imports_select_authenticated'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY ticket_imports_select_authenticated
        ON public.ticket_imports
        FOR SELECT
        TO authenticated
        USING (true);
    $sql$;
  END IF;
END$$;

-- INSERT: Service role only (for server-side operations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'ticket_imports' 
      AND policyname = 'ticket_imports_insert_service_role'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY ticket_imports_insert_service_role
        ON public.ticket_imports
        FOR INSERT
        TO service_role
        WITH CHECK (true);
    $sql$;
  END IF;
END$$;

-- UPDATE: Admin/Manager can update ticket imports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'ticket_imports' 
      AND policyname = 'ticket_imports_update_admin_manager'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY ticket_imports_update_admin_manager
        ON public.ticket_imports
        FOR UPDATE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND LOWER(role) IN ('admin', 'manager')
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND LOWER(role) IN ('admin', 'manager')
          )
        );
    $sql$;
  END IF;
END$$;

-- DELETE: Admin can delete ticket imports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'ticket_imports' 
      AND policyname = 'ticket_imports_delete_admin'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY ticket_imports_delete_admin
        ON public.ticket_imports
        FOR DELETE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND LOWER(role) = 'admin'
          )
        );
    $sql$;
  END IF;
END$$;

-- ============================================================================
-- 5) Create storage bucket for ticket scans (to be run manually in Supabase)
-- ============================================================================
-- Run this in Supabase SQL Editor or via Dashboard > Storage:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('ticket-scans', 'ticket-scans', false)
-- ON CONFLICT (id) DO NOTHING;
--
-- -- Storage policies for ticket-scans bucket
-- CREATE POLICY "Authenticated users can upload ticket scans"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK (bucket_id = 'ticket-scans');
--
-- CREATE POLICY "Authenticated users can view ticket scans"
--   ON storage.objects FOR SELECT
--   TO authenticated
--   USING (bucket_id = 'ticket-scans');
--
-- CREATE POLICY "Service role can manage ticket scans"
--   ON storage.objects FOR ALL
--   TO service_role
--   USING (bucket_id = 'ticket-scans')
--   WITH CHECK (bucket_id = 'ticket-scans');

-- ============================================================================
-- 6) Verification queries
-- ============================================================================
-- Verify table exists:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name = 'ticket_imports';

-- Verify RLS is enabled:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename = 'ticket_imports';

-- Verify policies exist:
-- SELECT schemaname, tablename, policyname, cmd 
-- FROM pg_policies 
-- WHERE schemaname = 'public' AND tablename = 'ticket_imports'
-- ORDER BY policyname;
