-- Migration: Create metrics views for time series data
-- Date: 2025-10-28
-- Purpose: Create read-only views for daily, weekly, and monthly aggregations
--          of service_jobs and delivery_tickets for use by client-side fetching
--          and the Graphs component
-- Safe to run multiple times (idempotent)

-- ============================================================================
-- 1) Service Jobs Daily View
-- ============================================================================
-- Aggregates service jobs by date with key metrics
CREATE OR REPLACE VIEW public.service_jobs_daily AS
SELECT 
  job_date AS date,
  COUNT(*) AS total_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_jobs,
  COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled_jobs,
  COUNT(*) FILTER (WHERE status = 'deferred') AS deferred_jobs,
  COALESCE(SUM(job_amount) FILTER (WHERE status = 'completed'), 0) AS completed_revenue,
  COALESCE(SUM(job_amount) FILTER (WHERE status IN ('scheduled', 'deferred', 'unscheduled', 'in_progress')), 0) AS pipeline_revenue,
  COALESCE(SUM(job_amount), 0) AS total_amount
FROM public.service_jobs
WHERE job_date IS NOT NULL
GROUP BY job_date
ORDER BY job_date DESC;

-- ============================================================================
-- 2) Service Jobs Weekly View
-- ============================================================================
-- Aggregates service jobs by week (Monday start) with key metrics
CREATE OR REPLACE VIEW public.service_jobs_weekly AS
SELECT 
  DATE_TRUNC('week', job_date) AS week_start,
  COUNT(*) AS total_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_jobs,
  COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled_jobs,
  COUNT(*) FILTER (WHERE status = 'deferred') AS deferred_jobs,
  COALESCE(SUM(job_amount) FILTER (WHERE status = 'completed'), 0) AS completed_revenue,
  COALESCE(SUM(job_amount) FILTER (WHERE status IN ('scheduled', 'deferred', 'unscheduled', 'in_progress')), 0) AS pipeline_revenue,
  COALESCE(SUM(job_amount), 0) AS total_amount
FROM public.service_jobs
WHERE job_date IS NOT NULL
GROUP BY DATE_TRUNC('week', job_date)
ORDER BY week_start DESC;

-- ============================================================================
-- 3) Service Jobs Monthly View
-- ============================================================================
-- Aggregates service jobs by month with key metrics
CREATE OR REPLACE VIEW public.service_jobs_monthly AS
SELECT 
  DATE_TRUNC('month', job_date) AS month_start,
  COUNT(*) AS total_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_jobs,
  COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled_jobs,
  COUNT(*) FILTER (WHERE status = 'deferred') AS deferred_jobs,
  COALESCE(SUM(job_amount) FILTER (WHERE status = 'completed'), 0) AS completed_revenue,
  COALESCE(SUM(job_amount) FILTER (WHERE status IN ('scheduled', 'deferred', 'unscheduled', 'in_progress')), 0) AS pipeline_revenue,
  COALESCE(SUM(job_amount), 0) AS total_amount
FROM public.service_jobs
WHERE job_date IS NOT NULL
GROUP BY DATE_TRUNC('month', job_date)
ORDER BY month_start DESC;

-- ============================================================================
-- 4) Delivery Tickets Daily View
-- ============================================================================
-- Aggregates delivery tickets by date with key metrics
CREATE OR REPLACE VIEW public.delivery_tickets_daily AS
SELECT 
  date,
  COUNT(*) AS total_tickets,
  COALESCE(SUM(qty), 0) AS total_gallons,
  COALESCE(SUM(amount), 0) AS revenue,
  COALESCE(AVG(amount), 0) AS avg_ticket_amount
FROM public.delivery_tickets
WHERE date IS NOT NULL
GROUP BY date
ORDER BY date DESC;

-- ============================================================================
-- 5) Delivery Tickets Weekly View
-- ============================================================================
-- Aggregates delivery tickets by week (Monday start) with key metrics
CREATE OR REPLACE VIEW public.delivery_tickets_weekly AS
SELECT 
  DATE_TRUNC('week', date) AS week_start,
  COUNT(*) AS total_tickets,
  COALESCE(SUM(qty), 0) AS total_gallons,
  COALESCE(SUM(amount), 0) AS revenue,
  COALESCE(AVG(amount), 0) AS avg_ticket_amount
FROM public.delivery_tickets
WHERE date IS NOT NULL
GROUP BY DATE_TRUNC('week', date)
ORDER BY week_start DESC;

-- ============================================================================
-- 6) Delivery Tickets Monthly View
-- ============================================================================
-- Aggregates delivery tickets by month with key metrics
CREATE OR REPLACE VIEW public.delivery_tickets_monthly AS
SELECT 
  DATE_TRUNC('month', date) AS month_start,
  COUNT(*) AS total_tickets,
  COALESCE(SUM(qty), 0) AS total_gallons,
  COALESCE(SUM(amount), 0) AS revenue,
  COALESCE(AVG(amount), 0) AS avg_ticket_amount
FROM public.delivery_tickets
WHERE date IS NOT NULL
GROUP BY DATE_TRUNC('month', date)
ORDER BY month_start DESC;

-- ============================================================================
-- 7) Grant SELECT permissions on views to anon and authenticated roles
-- ============================================================================
-- This allows client-side queries using the Supabase anon key
GRANT SELECT ON public.service_jobs_daily TO anon, authenticated;
GRANT SELECT ON public.service_jobs_weekly TO anon, authenticated;
GRANT SELECT ON public.service_jobs_monthly TO anon, authenticated;
GRANT SELECT ON public.delivery_tickets_daily TO anon, authenticated;
GRANT SELECT ON public.delivery_tickets_weekly TO anon, authenticated;
GRANT SELECT ON public.delivery_tickets_monthly TO anon, authenticated;

-- ============================================================================
-- 8) Optional: Create RLS policies for the base tables if not already set
-- ============================================================================
-- Note: These policies allow anonymous reads on service_jobs and delivery_tickets
-- Adjust according to your security requirements

-- Enable RLS on service_jobs if not already enabled
ALTER TABLE public.service_jobs ENABLE ROW LEVEL SECURITY;

-- Allow anonymous SELECT on service_jobs (needed for views)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'service_jobs' 
    AND policyname = 'Allow anonymous read access to service_jobs'
  ) THEN
    CREATE POLICY "Allow anonymous read access to service_jobs"
      ON public.service_jobs
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- Enable RLS on delivery_tickets if not already enabled
ALTER TABLE public.delivery_tickets ENABLE ROW LEVEL SECURITY;

-- Allow anonymous SELECT on delivery_tickets (needed for views)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'delivery_tickets' 
    AND policyname = 'Allow anonymous read access to delivery_tickets'
  ) THEN
    CREATE POLICY "Allow anonymous read access to delivery_tickets"
      ON public.delivery_tickets
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- 9) Create indexes for better query performance (optional but recommended)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_service_jobs_job_date 
  ON public.service_jobs(job_date) WHERE job_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_jobs_status 
  ON public.service_jobs(status);

CREATE INDEX IF NOT EXISTS idx_delivery_tickets_date 
  ON public.delivery_tickets(date) WHERE date IS NOT NULL;

-- Migration complete
