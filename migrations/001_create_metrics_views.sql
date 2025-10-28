-- Use native date columns (no timezone conversion) so day buckets align exactly with job_date/date values.

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
