-- Migration: Add hazmat_fee column to delivery_tickets table
-- Date: 2025-10-16
-- Safe to run multiple times (idempotent). Run in Supabase SQL editor.
-- Adds hazmat_fee column for tracking hazardous material fees separately from tax.

-- ============================================================================
-- 1) Add hazmat_fee column to delivery_tickets table
-- ============================================================================

-- Add hazmat_fee for hazardous material fees (separate from tax)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'delivery_tickets' 
      AND column_name = 'hazmat_fee'
  ) THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN hazmat_fee numeric;
  END IF;
END $$;

-- ============================================================================
-- 2) Optional: Create index for performance on hazmat_fee column
-- ============================================================================
-- Index is optional; only needed if frequently filtering/sorting by hazmat_fee
-- Uncomment if needed:
-- CREATE INDEX IF NOT EXISTS idx_delivery_tickets_hazmat_fee ON public.delivery_tickets(hazmat_fee);

-- ============================================================================
-- 3) Verification queries (commented out, run separately to verify)
-- ============================================================================
-- Verify hazmat_fee column exists:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'delivery_tickets'
--   AND column_name = 'hazmat_fee';

-- Check sample of hazmat_fee values:
-- SELECT id, customerName, qty, price, tax, hazmat_fee, amount
-- FROM delivery_tickets
-- ORDER BY updated_at DESC
-- LIMIT 10;

-- Verify no RLS policy changes are needed (existing policies remain valid):
-- SELECT schemaname, tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE tablename = 'delivery_tickets'
-- ORDER BY policyname;
