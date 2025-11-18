-- Migration: Create financial_imports table for QuickBooks-compatible financial module
-- Date: 2025-11-18
-- Purpose: Store QuickBooks report uploads for financial KPIs and analysis
--          Supports 10 standard QuickBooks report types

-- ============================================================================
-- 1) Create financial_imports table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.financial_imports (
  id bigserial PRIMARY KEY,
  type text NOT NULL CHECK (type IN (
    'profit_loss',
    'profit_loss_by_class',
    'profit_loss_by_location',
    'balance_sheet',
    'cash_flow_statement',
    'ar_aging_summary',
    'ap_aging_summary',
    'sales_by_product',
    'expenses_by_vendor',
    'payroll_summary'
  )),
  period text NOT NULL, -- Format: YYYY-MM or YYYY-Q1 or YYYY
  period_start date,
  period_end date,
  source text DEFAULT 'quickbooks',
  file_metadata jsonb, -- { filename, size, mimeType, storagePath }
  parsed jsonb, -- Normalized rows from the report
  summary jsonb, -- Computed metrics from the report
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 2) Create indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_financial_imports_type ON public.financial_imports(type);
CREATE INDEX IF NOT EXISTS idx_financial_imports_period ON public.financial_imports(period);
CREATE INDEX IF NOT EXISTS idx_financial_imports_created_at ON public.financial_imports(created_at);
CREATE INDEX IF NOT EXISTS idx_financial_imports_type_period ON public.financial_imports(type, period);

-- ============================================================================
-- 3) Enable Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.financial_imports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4) RLS Policies for financial_imports
-- ============================================================================

-- SELECT: Authenticated users can read all financial imports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'financial_imports' 
      AND policyname = 'financial_imports_select_authenticated'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY financial_imports_select_authenticated
        ON public.financial_imports
        FOR SELECT
        TO authenticated
        USING (true);
    $sql$;
  END IF;
END$$;

-- INSERT: Authenticated users with admin/manager role can insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'financial_imports' 
      AND policyname = 'financial_imports_insert_admin_manager'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY financial_imports_insert_admin_manager
        ON public.financial_imports
        FOR INSERT
        TO authenticated
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

-- UPDATE: Admin/Manager can update financial imports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'financial_imports' 
      AND policyname = 'financial_imports_update_admin_manager'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY financial_imports_update_admin_manager
        ON public.financial_imports
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

-- DELETE: Admin can delete financial imports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'financial_imports' 
      AND policyname = 'financial_imports_delete_admin'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY financial_imports_delete_admin
        ON public.financial_imports
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
-- 5) Create storage bucket for financial documents
-- ============================================================================
-- Run this in Supabase SQL Editor or via Dashboard > Storage:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('financial-docs', 'financial-docs', false)
-- ON CONFLICT (id) DO NOTHING;
--
-- -- Storage policies for financial-docs bucket
-- CREATE POLICY "Admin/Manager can upload financial docs"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK (
--     bucket_id = 'financial-docs' AND
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid()
--         AND LOWER(role) IN ('admin', 'manager')
--     )
--   );
--
-- CREATE POLICY "Authenticated users can view financial docs"
--   ON storage.objects FOR SELECT
--   TO authenticated
--   USING (bucket_id = 'financial-docs');
--
-- CREATE POLICY "Admin can delete financial docs"
--   ON storage.objects FOR DELETE
--   TO authenticated
--   USING (
--     bucket_id = 'financial-docs' AND
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid()
--         AND LOWER(role) = 'admin'
--     )
--   );

-- ============================================================================
-- 6) Create helper function to update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_financial_imports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_financial_imports_updated_at ON public.financial_imports;
CREATE TRIGGER trigger_update_financial_imports_updated_at
  BEFORE UPDATE ON public.financial_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_financial_imports_updated_at();

-- ============================================================================
-- 7) Verification queries
-- ============================================================================
-- Verify table exists:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name = 'financial_imports';

-- Verify RLS is enabled:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename = 'financial_imports';

-- Verify policies exist:
-- SELECT schemaname, tablename, policyname, cmd 
-- FROM pg_policies 
-- WHERE schemaname = 'public' AND tablename = 'financial_imports'
-- ORDER BY policyname;
