-- Migration: Create cstore_gallons table for C-Store weekly gallons tracking
-- Date: 2025-11-19
-- Safe to run multiple times (idempotent). Run in Supabase SQL editor.
-- Purpose: Track weekly gallon totals for each C-Store location

-- ============================================================================
-- 1) Create cstore_gallons table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cstore_gallons (
  id bigserial PRIMARY KEY,
  store_id text NOT NULL,
  week_ending date NOT NULL,
  total_gallons numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one record per store per week
  CONSTRAINT unique_store_week UNIQUE (store_id, week_ending)
);

-- ============================================================================
-- 2) Create indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_cstore_gallons_store_id 
  ON public.cstore_gallons(store_id);

CREATE INDEX IF NOT EXISTS idx_cstore_gallons_week_ending 
  ON public.cstore_gallons(week_ending DESC);

-- ============================================================================
-- 3) Enable Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.cstore_gallons ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4) Create RLS Policies
-- ============================================================================

-- Allow authenticated users to read all records
DROP POLICY IF EXISTS "Allow authenticated users to read cstore_gallons" ON public.cstore_gallons;
CREATE POLICY "Allow authenticated users to read cstore_gallons"
  ON public.cstore_gallons
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert/update records
DROP POLICY IF EXISTS "Allow authenticated users to upsert cstore_gallons" ON public.cstore_gallons;
CREATE POLICY "Allow authenticated users to upsert cstore_gallons"
  ON public.cstore_gallons
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 5) Grant permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON public.cstore_gallons TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.cstore_gallons_id_seq TO authenticated;

-- ============================================================================
-- 6) Add updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_cstore_gallons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_cstore_gallons_updated_at ON public.cstore_gallons;
CREATE TRIGGER update_cstore_gallons_updated_at
  BEFORE UPDATE ON public.cstore_gallons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cstore_gallons_updated_at();

-- ============================================================================
-- Verification queries (run separately to verify)
-- ============================================================================
-- Verify table exists:
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'cstore_gallons'
-- ORDER BY ordinal_position;

-- Check indexes:
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'cstore_gallons';

-- Check RLS policies:
-- SELECT * FROM pg_policies WHERE tablename = 'cstore_gallons';
