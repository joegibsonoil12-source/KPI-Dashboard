-- Migration: Create delivery_tickets, ticket_attachments, and store_invoices tables with RLS
-- Date: 2025-09-30
-- Safe to run multiple times (idempotent). Run in Supabase SQL editor.

-- ============================================================================
-- 0) Enable required extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1) Create delivery_tickets table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.delivery_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date,
  store text,
  product text,
  driver text,
  truck text,
  qty numeric,
  price numeric,
  tax numeric,
  amount numeric,
  status text,
  notes text,
  customerName text,
  account text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- 2) Create ticket_attachments table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES public.delivery_tickets(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  filename text NOT NULL,
  content_type text,
  size bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- 3) Create store_invoices table (optional)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.store_invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_no text NOT NULL,
  store text,
  created date,
  status text,
  total numeric,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- 4) Create triggers for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS delivery_tickets_updated_at ON public.delivery_tickets;
CREATE TRIGGER delivery_tickets_updated_at
  BEFORE UPDATE ON public.delivery_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS store_invoices_updated_at ON public.store_invoices;
CREATE TRIGGER store_invoices_updated_at
  BEFORE UPDATE ON public.store_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 5) Enable Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.delivery_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_invoices ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6) RLS Policies for delivery_tickets
-- ============================================================================

-- INSERT: Authenticated users can insert; created_by must be their own uid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'delivery_tickets' 
      AND policyname = 'delivery_tickets_insert_authenticated'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY delivery_tickets_insert_authenticated
        ON public.delivery_tickets
        FOR INSERT
        TO authenticated
        WITH CHECK (created_by = auth.uid());
    $sql$;
  END IF;
END$$;

-- SELECT: Authenticated users can read all tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'delivery_tickets' 
      AND policyname = 'delivery_tickets_select_authenticated'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY delivery_tickets_select_authenticated
        ON public.delivery_tickets
        FOR SELECT
        TO authenticated
        USING (true);
    $sql$;
  END IF;
END$$;

-- UPDATE: Only ticket creators can update their tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'delivery_tickets' 
      AND policyname = 'delivery_tickets_update_owner'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY delivery_tickets_update_owner
        ON public.delivery_tickets
        FOR UPDATE
        TO authenticated
        USING (created_by = auth.uid())
        WITH CHECK (created_by = auth.uid());
    $sql$;
  END IF;
END$$;

-- DELETE: Only ticket creators can delete their tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'delivery_tickets' 
      AND policyname = 'delivery_tickets_delete_owner'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY delivery_tickets_delete_owner
        ON public.delivery_tickets
        FOR DELETE
        TO authenticated
        USING (created_by = auth.uid());
    $sql$;
  END IF;
END$$;

-- ============================================================================
-- 7) RLS Policies for ticket_attachments
-- ============================================================================

-- INSERT: Authenticated users can insert; uploaded_by must be their own uid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'ticket_attachments' 
      AND policyname = 'ticket_attachments_insert_authenticated'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY ticket_attachments_insert_authenticated
        ON public.ticket_attachments
        FOR INSERT
        TO authenticated
        WITH CHECK (uploaded_by = auth.uid());
    $sql$;
  END IF;
END$$;

-- SELECT: Authenticated users can read all attachments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'ticket_attachments' 
      AND policyname = 'ticket_attachments_select_authenticated'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY ticket_attachments_select_authenticated
        ON public.ticket_attachments
        FOR SELECT
        TO authenticated
        USING (true);
    $sql$;
  END IF;
END$$;

-- UPDATE: Only attachment uploaders can update their attachments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'ticket_attachments' 
      AND policyname = 'ticket_attachments_update_owner'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY ticket_attachments_update_owner
        ON public.ticket_attachments
        FOR UPDATE
        TO authenticated
        USING (uploaded_by = auth.uid())
        WITH CHECK (uploaded_by = auth.uid());
    $sql$;
  END IF;
END$$;

-- DELETE: Only attachment uploaders can delete their attachments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'ticket_attachments' 
      AND policyname = 'ticket_attachments_delete_owner'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY ticket_attachments_delete_owner
        ON public.ticket_attachments
        FOR DELETE
        TO authenticated
        USING (uploaded_by = auth.uid());
    $sql$;
  END IF;
END$$;

-- ============================================================================
-- 8) RLS Policies for store_invoices
-- ============================================================================

-- INSERT: Authenticated users can insert; created_by must be their own uid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'store_invoices' 
      AND policyname = 'store_invoices_insert_authenticated'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY store_invoices_insert_authenticated
        ON public.store_invoices
        FOR INSERT
        TO authenticated
        WITH CHECK (created_by = auth.uid());
    $sql$;
  END IF;
END$$;

-- SELECT: Authenticated users can read all invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'store_invoices' 
      AND policyname = 'store_invoices_select_authenticated'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY store_invoices_select_authenticated
        ON public.store_invoices
        FOR SELECT
        TO authenticated
        USING (true);
    $sql$;
  END IF;
END$$;

-- UPDATE: Only invoice creators can update their invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'store_invoices' 
      AND policyname = 'store_invoices_update_owner'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY store_invoices_update_owner
        ON public.store_invoices
        FOR UPDATE
        TO authenticated
        USING (created_by = auth.uid())
        WITH CHECK (created_by = auth.uid());
    $sql$;
  END IF;
END$$;

-- DELETE: Only invoice creators can delete their invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'store_invoices' 
      AND policyname = 'store_invoices_delete_owner'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY store_invoices_delete_owner
        ON public.store_invoices
        FOR DELETE
        TO authenticated
        USING (created_by = auth.uid());
    $sql$;
  END IF;
END$$;

-- ============================================================================
-- 9) Create indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_delivery_tickets_created_by ON public.delivery_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_delivery_tickets_date ON public.delivery_tickets(date);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON public.ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_by ON public.ticket_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_store_invoices_created_by ON public.store_invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_store_invoices_invoice_no ON public.store_invoices(invoice_no);

-- ============================================================================
-- 10) IMPORTANT: Storage bucket setup
-- ============================================================================
-- NOTE: After running this migration, you must create a private storage bucket
-- in Supabase Dashboard:
--   1. Go to Storage in Supabase Dashboard
--   2. Create a new bucket named: "private-attachments"
--   3. Set bucket to PRIVATE (not public)
--   4. Configure RLS policies for the bucket:
--      - Authenticated users can INSERT (upload)
--      - Authenticated users can SELECT (download via signed URLs)
--      - Only uploaders can UPDATE/DELETE their own files
--
-- The application uses signed URLs for secure, time-limited access to attachments.

-- ============================================================================
-- 11) Verification queries (run separately to verify setup)
-- ============================================================================
-- Verify tables exist:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
--   AND table_name IN ('delivery_tickets', 'ticket_attachments', 'store_invoices');

-- Verify RLS is enabled:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('delivery_tickets', 'ticket_attachments', 'store_invoices');

-- Verify policies exist:
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('delivery_tickets', 'ticket_attachments', 'store_invoices')
-- ORDER BY tablename, policyname;
