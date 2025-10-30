-- Migration: Create ticket_imports table
-- Purpose: Store scanned ticket imports for OCR processing and review
-- Created: 2025-10-30

-- Create ticket_imports table
CREATE TABLE IF NOT EXISTS public.ticket_imports (
  id bigserial primary key,
  src text,
  src_email text,
  attached_files jsonb,
  ocr_text text,
  parsed jsonb,
  confidence numeric,
  status text default 'pending',
  meta jsonb,
  created_at timestamptz default now(),
  processed_at timestamptz
);

-- Enable RLS on ticket_imports
ALTER TABLE public.ticket_imports ENABLE ROW LEVEL SECURITY;

-- Add policy for service role (full access)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ticket_imports' 
    AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON public.ticket_imports
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add policy for authenticated users (read access)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ticket_imports' 
    AND policyname = 'Authenticated users can view imports'
  ) THEN
    CREATE POLICY "Authenticated users can view imports" ON public.ticket_imports
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Enable RLS on aggregate views (if they don't already have it)
-- service_jobs_daily
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'service_jobs_daily' AND relkind = 'v') THEN
    -- Views can't have RLS directly, but we can add policies on the base table
    -- This is a placeholder for documentation
    RAISE NOTICE 'Views rely on RLS of underlying tables (service_jobs, delivery_tickets)';
  END IF;
END $$;

-- Add SELECT policy for anon role on service_jobs (for view access)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'service_jobs' 
    AND policyname = 'Anon users can view service jobs for metrics'
  ) THEN
    CREATE POLICY "Anon users can view service jobs for metrics" ON public.service_jobs
      FOR SELECT
      USING (true);
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Table service_jobs does not exist yet';
END $$;

-- Add SELECT policy for anon role on delivery_tickets (for view access)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'delivery_tickets' 
    AND policyname = 'Anon users can view delivery tickets for metrics'
  ) THEN
    CREATE POLICY "Anon users can view delivery tickets for metrics" ON public.delivery_tickets
      FOR SELECT
      USING (true);
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Table delivery_tickets does not exist yet';
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_imports_status ON public.ticket_imports(status);
CREATE INDEX IF NOT EXISTS idx_ticket_imports_created_at ON public.ticket_imports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_imports_src ON public.ticket_imports(src);

-- Success message
DO $$ BEGIN
  RAISE NOTICE 'Migration 002_add_ticket_imports completed successfully';
END $$;
