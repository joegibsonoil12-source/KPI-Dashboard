-- ============================================================================
-- COMPLETE SUPABASE SETUP SCRIPT
-- Run this entire script in your Supabase SQL Editor
-- Project: jskajkwulaaakhaolzdu
-- ============================================================================

-- 1. CREATE TABLES (if they don't exist)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.service_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_date DATE NOT NULL,
  status TEXT,
  job_amount NUMERIC(10,2),
  customer_name TEXT,
  tech_name TEXT,
  job_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.delivery_tickets (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  status TEXT,
  qty NUMERIC(10,2),
  amount NUMERIC(10,2),
  customer_name TEXT,
  product TEXT,
  driver TEXT,
  truck TEXT,
  scheduled_window_start TIMESTAMP WITH TIME ZONE,
  gallons_delivered NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.service_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tickets ENABLE ROW LEVEL SECURITY;

-- 3. CREATE RLS POLICIES FOR ANONYMOUS READ ACCESS
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anonymous read access on service_jobs" ON public.service_jobs;
DROP POLICY IF EXISTS "Allow anonymous read access on delivery_tickets" ON public.delivery_tickets;
DROP POLICY IF EXISTS "Allow authenticated read access on service_jobs" ON public.service_jobs;
DROP POLICY IF EXISTS "Allow authenticated read access on delivery_tickets" ON public.delivery_tickets;

-- Create new policies
CREATE POLICY "Allow anonymous read access on service_jobs"
ON public.service_jobs FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow anonymous read access on delivery_tickets"
ON public.delivery_tickets FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow authenticated read access on service_jobs"
ON public.service_jobs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated read access on delivery_tickets"
ON public.delivery_tickets FOR SELECT
TO authenticated
USING (true);

-- 4. CREATE AGGREGATE VIEWS
-- ============================================================================

-- Service jobs daily
CREATE OR REPLACE VIEW public.service_jobs_daily AS
SELECT
  job_date::date AS day,
  COUNT(*)::int AS job_count,
  SUM(COALESCE(job_amount::numeric, 0))::numeric AS revenue
FROM public.service_jobs
WHERE (status IS NULL OR status NOT ILIKE '%cancel%') AND status ILIKE '%completed%'
GROUP BY day
ORDER BY day;

-- Service jobs weekly (week starting Monday)
CREATE OR REPLACE VIEW public.service_jobs_weekly AS
SELECT
  (date_trunc('week', job_date::timestamp)::date + INTERVAL '1 day')::date AS week_start,
  COUNT(*)::int AS job_count,
  SUM(COALESCE(job_amount::numeric, 0))::numeric AS revenue
FROM public.service_jobs
WHERE (status IS NULL OR status NOT ILIKE '%cancel%') AND status ILIKE '%completed%'
GROUP BY week_start
ORDER BY week_start;

-- Service jobs monthly
CREATE OR REPLACE VIEW public.service_jobs_monthly AS
SELECT
  date_trunc('month', job_date::timestamp)::date AS month_start,
  COUNT(*)::int AS job_count,
  SUM(COALESCE(job_amount::numeric, 0))::numeric AS revenue
FROM public.service_jobs
WHERE (status IS NULL OR status NOT ILIKE '%cancel%') AND status ILIKE '%completed%'
GROUP BY month_start
ORDER BY month_start;

-- Delivery tickets daily
CREATE OR REPLACE VIEW public.delivery_tickets_daily AS
SELECT
  date::date AS day,
  COUNT(*)::int AS ticket_count,
  SUM(COALESCE(qty::numeric, 0))::numeric AS total_gallons,
  SUM(COALESCE(amount::numeric, 0))::numeric AS revenue
FROM public.delivery_tickets
WHERE (status IS NULL OR (status NOT ILIKE '%void%' AND status NOT ILIKE '%cancel%'))
GROUP BY day
ORDER BY day;

-- Delivery tickets weekly
CREATE OR REPLACE VIEW public.delivery_tickets_weekly AS
SELECT
  (date_trunc('week', date::timestamp)::date + INTERVAL '1 day')::date AS week_start,
  COUNT(*)::int AS ticket_count,
  SUM(COALESCE(qty::numeric, 0))::numeric AS total_gallons,
  SUM(COALESCE(amount::numeric, 0))::numeric AS revenue
FROM public.delivery_tickets
WHERE (status IS NULL OR (status NOT ILIKE '%void%' AND status NOT ILIKE '%cancel%'))
GROUP BY week_start
ORDER BY week_start;

-- Delivery tickets monthly
CREATE OR REPLACE VIEW public.delivery_tickets_monthly AS
SELECT
  date_trunc('month', date::timestamp)::date AS month_start,
  COUNT(*)::int AS ticket_count,
  SUM(COALESCE(qty::numeric, 0))::numeric AS total_gallons,
  SUM(COALESCE(amount::numeric, 0))::numeric AS revenue
FROM public.delivery_tickets
WHERE (status IS NULL OR (status NOT ILIKE '%void%' AND status NOT ILIKE '%cancel%'))
GROUP BY month_start
ORDER BY month_start;

-- 5. INSERT SAMPLE DATA FOR TESTING (Optional - Comment out if not needed)
-- ============================================================================

-- Delete existing sample data (optional)
-- DELETE FROM public.service_jobs WHERE customer_name IN ('ABC Company', 'XYZ Corp', 'Smith LLC', 'Jones Inc', 'Brown Enterprises', 'Green Co', 'Blue Industries');
-- DELETE FROM public.delivery_tickets WHERE customer_name IN ('ABC Company', 'XYZ Corp', 'Smith LLC', 'Jones Inc', 'Brown Enterprises', 'Green Co', 'Blue Industries');

-- Insert sample service jobs (past 30 days)
INSERT INTO public.service_jobs (job_date, status, job_amount, customer_name, tech_name, job_number) VALUES
  (CURRENT_DATE, 'completed', 1500.00, 'ABC Company', 'John Smith', 'SJ-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-001'),
  (CURRENT_DATE, 'completed', 2300.00, 'XYZ Corp', 'Jane Doe', 'SJ-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-002'),
  (CURRENT_DATE, 'scheduled', 1200.00, 'Acme Inc', 'Bob Johnson', 'SJ-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-003'),
  (CURRENT_DATE - 1, 'completed', 1800.00, 'Smith LLC', 'John Smith', 'SJ-' || TO_CHAR(CURRENT_DATE - 1, 'YYYYMMDD') || '-001'),
  (CURRENT_DATE - 1, 'scheduled', 2500.00, 'Jones Inc', 'Jane Doe', 'SJ-' || TO_CHAR(CURRENT_DATE - 1, 'YYYYMMDD') || '-002'),
  (CURRENT_DATE - 2, 'completed', 3200.00, 'Brown Enterprises', 'Bob Johnson', 'SJ-' || TO_CHAR(CURRENT_DATE - 2, 'YYYYMMDD') || '-001'),
  (CURRENT_DATE - 3, 'completed', 2100.00, 'Tech Solutions', 'John Smith', 'SJ-' || TO_CHAR(CURRENT_DATE - 3, 'YYYYMMDD') || '-001'),
  (CURRENT_DATE - 4, 'completed', 1750.00, 'Data Corp', 'Jane Doe', 'SJ-' || TO_CHAR(CURRENT_DATE - 4, 'YYYYMMDD') || '-001'),
  (CURRENT_DATE - 5, 'completed', 2850.00, 'Mega Industries', 'Bob Johnson', 'SJ-' || TO_CHAR(CURRENT_DATE - 5, 'YYYYMMDD') || '-001'),
  (CURRENT_DATE - 7, 'completed', 1900.00, 'Green Co', 'John Smith', 'SJ-' || TO_CHAR(CURRENT_DATE - 7, 'YYYYMMDD') || '-001'),
  (CURRENT_DATE - 7, 'completed', 2100.00, 'Blue Industries', 'Jane Doe', 'SJ-' || TO_CHAR(CURRENT_DATE - 7, 'YYYYMMDD') || '-002'),
  (CURRENT_DATE - 8, 'completed', 1650.00, 'Red Logistics', 'Bob Johnson', 'SJ-' || TO_CHAR(CURRENT_DATE - 8, 'YYYYMMDD') || '-001'),
  (CURRENT_DATE - 10, 'completed', 2450.00, 'Yellow Transport', 'John Smith', 'SJ-' || TO_CHAR(CURRENT_DATE - 10, 'YYYYMMDD') || '-001'),
  (CURRENT_DATE - 14, 'completed', 1890.00, 'Orange Systems', 'Jane Doe', 'SJ-' || TO_CHAR(CURRENT_DATE - 14, 'YYYYMMDD') || '-001'),
  (CURRENT_DATE - 14, 'completed', 2340.00, 'Purple Networks', 'Bob Johnson', 'SJ-' || TO_CHAR(CURRENT_DATE - 14, 'YYYYMMDD') || '-002'),
  (CURRENT_DATE - 21, 'completed', 2150.00, 'Pink Solutions', 'John Smith', 'SJ-' || TO_CHAR(CURRENT_DATE - 21, 'YYYYMMDD') || '-001'),
  (CURRENT_DATE - 21, 'completed', 1780.00, 'Gray Enterprises', 'Jane Doe', 'SJ-' || TO_CHAR(CURRENT_DATE - 21, 'YYYYMMDD') || '-002'),
  (CURRENT_DATE - 28, 'completed', 2680.00, 'Silver Corp', 'Bob Johnson', 'SJ-' || TO_CHAR(CURRENT_DATE - 28, 'YYYYMMDD') || '-001');

-- Insert sample delivery tickets (past 30 days)
INSERT INTO public.delivery_tickets (date, status, qty, amount, customer_name, product, driver, truck) VALUES
  (CURRENT_DATE, 'delivered', 500.5, 2250.00, 'ABC Company', 'Propane', 'Mike Wilson', 'Truck 1'),
  (CURRENT_DATE, 'delivered', 750.0, 3375.00, 'XYZ Corp', 'Propane', 'Sarah Davis', 'Truck 2'),
  (CURRENT_DATE, 'scheduled', 600.0, 2700.00, 'Tech World', 'Propane', 'Mike Wilson', 'Truck 1'),
  (CURRENT_DATE - 1, 'delivered', 620.0, 2790.00, 'Smith LLC', 'Propane', 'Tom Brown', 'Truck 3'),
  (CURRENT_DATE - 1, 'scheduled', 800.0, 3600.00, 'Jones Inc', 'Propane', 'Sarah Davis', 'Truck 2'),
  (CURRENT_DATE - 2, 'delivered', 900.5, 4052.25, 'Brown Enterprises', 'Propane', 'Mike Wilson', 'Truck 1'),
  (CURRENT_DATE - 3, 'delivered', 720.0, 3240.00, 'Tech Solutions', 'Propane', 'Tom Brown', 'Truck 3'),
  (CURRENT_DATE - 4, 'delivered', 580.0, 2610.00, 'Data Corp', 'Propane', 'Sarah Davis', 'Truck 2'),
  (CURRENT_DATE - 5, 'delivered', 850.0, 3825.00, 'Mega Industries', 'Propane', 'Mike Wilson', 'Truck 1'),
  (CURRENT_DATE - 7, 'delivered', 550.0, 2475.00, 'Green Co', 'Propane', 'Tom Brown', 'Truck 3'),
  (CURRENT_DATE - 7, 'delivered', 680.0, 3060.00, 'Blue Industries', 'Propane', 'Sarah Davis', 'Truck 2'),
  (CURRENT_DATE - 8, 'delivered', 490.0, 2205.00, 'Red Logistics', 'Propane', 'Mike Wilson', 'Truck 1'),
  (CURRENT_DATE - 10, 'delivered', 770.0, 3465.00, 'Yellow Transport', 'Propane', 'Tom Brown', 'Truck 3'),
  (CURRENT_DATE - 14, 'delivered', 630.0, 2835.00, 'Orange Systems', 'Propane', 'Sarah Davis', 'Truck 2'),
  (CURRENT_DATE - 14, 'delivered', 710.0, 3195.00, 'Purple Networks', 'Propane', 'Mike Wilson', 'Truck 1'),
  (CURRENT_DATE - 21, 'delivered', 660.0, 2970.00, 'Pink Solutions', 'Propane', 'Tom Brown', 'Truck 3'),
  (CURRENT_DATE - 21, 'delivered', 540.0, 2430.00, 'Gray Enterprises', 'Propane', 'Sarah Davis', 'Truck 2'),
  (CURRENT_DATE - 28, 'delivered', 820.0, 3690.00, 'Silver Corp', 'Propane', 'Mike Wilson', 'Truck 1');

-- 6. VERIFY SETUP
-- ============================================================================

-- Check if tables have data
SELECT 'service_jobs' as table_name, COUNT(*) as row_count FROM public.service_jobs
UNION ALL
SELECT 'delivery_tickets', COUNT(*) FROM public.delivery_tickets;

-- Check views work correctly
SELECT 'service_jobs_daily' as view_name, COUNT(*) as row_count FROM public.service_jobs_daily
UNION ALL
SELECT 'delivery_tickets_daily', COUNT(*) FROM public.delivery_tickets_daily;

-- Show recent data
SELECT 'Recent Service Jobs' as info;
SELECT job_date, status, job_amount, customer_name 
FROM public.service_jobs 
ORDER BY job_date DESC 
LIMIT 5;

SELECT 'Recent Delivery Tickets' as info;
SELECT date, status, qty, amount, customer_name 
FROM public.delivery_tickets 
ORDER BY date DESC 
LIMIT 5;

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
-- Your database is now ready for the KPI Dashboard
-- The live site will automatically pull data from these tables and views
-- ============================================================================
