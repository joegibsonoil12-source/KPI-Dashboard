-- Migration: Add Tank KPIs metrics columns
-- Date: 2025-11-19
-- Safe to run multiple times (idempotent). Run in Supabase SQL editor.
-- Purpose: Add tank-related metrics to support new Dashboard KPI row
--          Initial values will be 0 until real data is tracked

-- ============================================================================
-- 1) Find or create the metrics table/view used by Dashboard
-- ============================================================================
-- Note: This assumes metrics are stored in a table like 'company_metrics' or 'metrics_daily'
-- If your metrics come from a materialized view or are calculated on-the-fly,
-- adjust accordingly.

-- Check if we have a company_metrics or similar table
-- If not, we'll add these as columns that can be populated later

-- ============================================================================
-- 2) Add tank KPI columns to metrics table (if exists)
-- ============================================================================
-- This is a placeholder - adjust table name based on your actual metrics schema

-- Example for a hypothetical metrics table:
-- DO $$
-- BEGIN
--   IF EXISTS (
--     SELECT 1 FROM information_schema.tables 
--     WHERE table_schema = 'public' 
--       AND table_name = 'company_metrics'
--   ) THEN
--     -- Add current_tanks column
--     IF NOT EXISTS (
--       SELECT 1 FROM information_schema.columns 
--       WHERE table_schema = 'public' 
--         AND table_name = 'company_metrics' 
--         AND column_name = 'current_tanks'
--     ) THEN
--       ALTER TABLE public.company_metrics 
--       ADD COLUMN current_tanks integer DEFAULT 0;
--     END IF;
-- 
--     -- Add customers_lost column
--     IF NOT EXISTS (
--       SELECT 1 FROM information_schema.columns 
--       WHERE table_schema = 'public' 
--         AND table_name = 'company_metrics' 
--         AND column_name = 'customers_lost'
--     ) THEN
--       ALTER TABLE public.company_metrics 
--       ADD COLUMN customers_lost integer DEFAULT 0;
--     END IF;
-- 
--     -- Add customers_gained column
--     IF NOT EXISTS (
--       SELECT 1 FROM information_schema.columns 
--       WHERE table_schema = 'public' 
--         AND table_name = 'company_metrics' 
--         AND column_name = 'customers_gained'
--     ) THEN
--       ALTER TABLE public.company_metrics 
--       ADD COLUMN customers_gained integer DEFAULT 0;
--     END IF;
-- 
--     -- Add tanks_set column
--     IF NOT EXISTS (
--       SELECT 1 FROM information_schema.columns 
--       WHERE table_schema = 'public' 
--         AND table_name = 'company_metrics' 
--         AND column_name = 'tanks_set'
--     ) THEN
--       ALTER TABLE public.company_metrics 
--       ADD COLUMN tanks_set integer DEFAULT 0;
--     END IF;
--   END IF;
-- END$$;

-- ============================================================================
-- 3) Create a simple view to expose tank metrics (initially zero)
-- ============================================================================
-- This view can be used by the Dashboard to fetch tank KPIs
-- In the future, you can update this to pull from actual tank tracking tables

CREATE OR REPLACE VIEW public.view_tank_metrics AS
SELECT
  0 AS current_tanks,
  0 AS customers_lost,
  0 AS customers_gained,
  0 AS tanks_set,
  'This is a placeholder view. Update to pull from actual tank tracking data.' AS note;

-- ============================================================================
-- 4) Grant access to authenticated users
-- ============================================================================
GRANT SELECT ON public.view_tank_metrics TO authenticated;

-- ============================================================================
-- 5) Documentation
-- ============================================================================
-- This migration creates a placeholder for tank KPIs on the Dashboard.
-- All values are currently 0.
-- 
-- To populate with real data in the future:
-- 1. Create a tank_inventory table to track current tanks
-- 2. Create a customer_changes table to track gains/losses
-- 3. Create a tank_installations table to track tanks set
-- 4. Update view_tank_metrics to aggregate from these tables
-- 
-- For now, the Dashboard will show these KPIs as 0, but the UI layout is ready.
