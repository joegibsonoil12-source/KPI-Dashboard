-- =====================================================
-- Supabase Service Setup SQL Migration
-- =====================================================
-- This file sets up the public.service_tickets table and supporting
-- functions/triggers for the KPI Dashboard "Mark Completed" feature.
--
-- It is safe to run multiple times (uses IF NOT EXISTS where possible).
-- =====================================================

-- 1) Create public.service_tickets table (if not exists)
-- -----------------------------------------------------
-- Fields: id, customer, status, date, defer, total, note, created_at, updated_at
CREATE TABLE IF NOT EXISTS public.service_tickets (
  id SERIAL PRIMARY KEY,
  customer TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  defer INTEGER DEFAULT 0,
  total NUMERIC(10, 2) DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index on customer for better query performance
CREATE INDEX IF NOT EXISTS idx_service_tickets_customer ON public.service_tickets(customer);
CREATE INDEX IF NOT EXISTS idx_service_tickets_date ON public.service_tickets(date);
CREATE INDEX IF NOT EXISTS idx_service_tickets_status ON public.service_tickets(status);

-- 2) Create updated_at trigger function and trigger
-- -----------------------------------------------------
-- This automatically updates the updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_service_tickets_updated_at ON public.service_tickets;
CREATE TRIGGER trigger_service_tickets_updated_at
  BEFORE UPDATE ON public.service_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3) Create enforce_defer_zero_on_completed trigger function and trigger
-- -----------------------------------------------------
-- This ensures defer is set to 0 when status is 'completed'
CREATE OR REPLACE FUNCTION public.enforce_defer_zero_on_completed()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is 'completed' (case-insensitive), force defer to 0
  IF LOWER(NEW.status) IN ('completed', 'complete') THEN
    NEW.defer = 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_enforce_defer_zero ON public.service_tickets;
CREATE TRIGGER trigger_enforce_defer_zero
  BEFORE INSERT OR UPDATE ON public.service_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_defer_zero_on_completed();

-- 4) Create RPC function mark_customer_completed
-- -----------------------------------------------------
-- Updates all service_tickets for a given customer to status='completed' and defer=0
-- Returns the number of rows updated
CREATE OR REPLACE FUNCTION public.mark_customer_completed(customer_key TEXT)
RETURNS TABLE(updated_count INT) AS $$
DECLARE
  row_count INT;
BEGIN
  -- Update all matching rows for the customer
  UPDATE public.service_tickets
  SET status = 'completed', defer = 0
  WHERE customer = customer_key
    AND LOWER(status) NOT IN ('completed', 'complete');
  
  -- Get the number of rows affected
  GET DIAGNOSTICS row_count = ROW_COUNT;
  
  -- Return the count as a table
  RETURN QUERY SELECT row_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (adjust as needed for your RLS policy)
GRANT EXECUTE ON FUNCTION public.mark_customer_completed(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_customer_completed(TEXT) TO anon;

-- 5) Create optional view public.service_weekly_aggregates
-- -----------------------------------------------------
-- This view provides aggregated service data by week
-- Useful for dashboard queries and reporting
CREATE OR REPLACE VIEW public.service_weekly_aggregates AS
SELECT
  date_trunc('week', date) AS week_start,
  customer,
  status,
  COUNT(*) AS ticket_count,
  SUM(defer) AS total_defer,
  SUM(total) AS total_revenue,
  MAX(updated_at) AS last_updated
FROM public.service_tickets
GROUP BY date_trunc('week', date), customer, status
ORDER BY week_start DESC, customer;

-- Grant select permission on the view
GRANT SELECT ON public.service_weekly_aggregates TO authenticated;
GRANT SELECT ON public.service_weekly_aggregates TO anon;

-- =====================================================
-- Setup complete!
-- =====================================================
-- You can now:
-- 1. Call mark_customer_completed('Customer Name') to mark all jobs completed
-- 2. Query service_weekly_aggregates for aggregated metrics
-- 3. Rely on triggers to maintain data integrity (defer=0 on completed, updated_at)
-- =====================================================
