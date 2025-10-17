-- Backfill job_date so dashboard metrics populate
-- Safe to run multiple times

UPDATE public.service_jobs
SET job_date = COALESCE(scheduled_start_at::date, job_created_at::date)
WHERE job_date IS NULL;

-- Optional quick check (run manually):
-- SELECT job_date, status, COUNT(*) 
-- FROM public.service_jobs 
-- WHERE job_date IS NOT NULL
-- GROUP BY 1,2
-- ORDER BY 1 DESC, 2;
