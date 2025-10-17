-- Migration: Service jobs reschedule tracking
-- Date: 2025-10-17
-- Safe to run multiple times (idempotent)

-- 1) Columns on service_jobs
ALTER TABLE public.service_jobs
  ADD COLUMN IF NOT EXISTS reschedule_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_rescheduled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_service_jobs_reschedule_count
  ON public.service_jobs(reschedule_count);

-- 2) Optional audit/history table (who/when/how schedule changed)
CREATE TABLE IF NOT EXISTS public.service_job_schedule_history (
  id bigserial PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.service_jobs(id) ON DELETE CASCADE,
  old_scheduled_start_at timestamptz,
  new_scheduled_start_at timestamptz,
  change_direction text CHECK (change_direction IN ('earlier','later','set','unset','same')),
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS but allow authenticated read (optional)
ALTER TABLE public.service_job_schedule_history ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='service_job_schedule_history'
      AND policyname='select_authenticated'
  ) THEN
    CREATE POLICY select_authenticated ON public.service_job_schedule_history
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='service_job_schedule_history'
      AND policyname='insert_owner_or_admin'
  ) THEN
    CREATE POLICY insert_owner_or_admin ON public.service_job_schedule_history
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END$$;

-- 3) Trigger to increment reschedule_count only when deferred
CREATE OR REPLACE FUNCTION public.fn_track_service_reschedule()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_dt timestamptz;
  new_dt timestamptz;
  dir text;
BEGIN
  -- Prefer scheduled_start_at; fall back to date-only job_date if needed
  old_dt := COALESCE(OLD.scheduled_start_at,
                     CASE WHEN OLD.job_date IS NOT NULL THEN (OLD.job_date::timestamptz) END);
  new_dt := COALESCE(NEW.scheduled_start_at,
                     CASE WHEN NEW.job_date IS NOT NULL THEN (NEW.job_date::timestamptz) END);

  IF (old_dt IS DISTINCT FROM new_dt) THEN
    IF old_dt IS NULL AND new_dt IS NOT NULL THEN
      dir := 'set';
      IF NEW.first_scheduled_at IS NULL THEN
        NEW.first_scheduled_at := new_dt;
      END IF;
    ELSIF old_dt IS NOT NULL AND new_dt IS NULL THEN
      dir := 'unset';
    ELSIF new_dt > old_dt THEN
      dir := 'later';
      NEW.reschedule_count := COALESCE(OLD.reschedule_count, 0) + 1;
      NEW.last_rescheduled_at := now();
    ELSIF new_dt < old_dt THEN
      dir := 'earlier';
    ELSE
      dir := 'same';
    END IF;

    INSERT INTO public.service_job_schedule_history
      (job_id, old_scheduled_start_at, new_scheduled_start_at, change_direction)
    VALUES
      (OLD.id, old_dt, new_dt, dir);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_service_reschedule ON public.service_jobs;
CREATE TRIGGER trg_track_service_reschedule
BEFORE UPDATE OF scheduled_start_at, job_date
ON public.service_jobs
FOR EACH ROW
EXECUTE FUNCTION public.fn_track_service_reschedule();

-- 4) Simple daily summary view
CREATE OR REPLACE VIEW public.view_service_reschedules_daily AS
SELECT
  (date_trunc('day', COALESCE(scheduled_start_at, job_date::timestamptz)))::date AS day,
  COUNT(*) FILTER (WHERE reschedule_count > 0)      AS jobs_with_defers,
  SUM(reschedule_count)                              AS total_defers
FROM public.service_jobs
GROUP BY 1
ORDER BY 1;