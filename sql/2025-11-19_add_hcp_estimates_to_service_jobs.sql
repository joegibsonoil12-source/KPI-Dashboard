-- Migration: Add HCP Estimates columns to service_jobs table
-- Date: 2025-11-19
-- Safe to run multiple times (idempotent). Run in Supabase SQL editor.
-- Purpose: Extend service_jobs to store HCP estimate data with Open/Won/Lost values

-- ============================================================================
-- 1) Add estimate-specific columns to service_jobs
-- ============================================================================
DO $$
BEGIN
  -- hcp_estimate_id: unique identifier from Housecall Pro estimates export
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'service_jobs' 
      AND column_name = 'hcp_estimate_id'
  ) THEN
    ALTER TABLE public.service_jobs 
    ADD COLUMN hcp_estimate_id text;
  END IF;

  -- estimate_status: raw status from HCP estimates (Pending, Accepted, Declined, etc.)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'service_jobs' 
      AND column_name = 'estimate_status'
  ) THEN
    ALTER TABLE public.service_jobs 
    ADD COLUMN estimate_status text;
  END IF;

  -- hcp_outcome: outcome from HCP (open, won, lost)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'service_jobs' 
      AND column_name = 'hcp_outcome'
  ) THEN
    ALTER TABLE public.service_jobs 
    ADD COLUMN hcp_outcome text;
  END IF;

  -- estimate_tags: tags from HCP estimates
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'service_jobs' 
      AND column_name = 'estimate_tags'
  ) THEN
    ALTER TABLE public.service_jobs 
    ADD COLUMN estimate_tags text;
  END IF;

  -- location_name: location from HCP (in addition to address)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'service_jobs' 
      AND column_name = 'location_name'
  ) THEN
    ALTER TABLE public.service_jobs 
    ADD COLUMN location_name text;
  END IF;

  -- open_value: estimate value when outcome is "open"
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'service_jobs' 
      AND column_name = 'open_value'
  ) THEN
    ALTER TABLE public.service_jobs 
    ADD COLUMN open_value numeric(12, 2);
  END IF;

  -- won_value: estimate value when outcome is "won"
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'service_jobs' 
      AND column_name = 'won_value'
  ) THEN
    ALTER TABLE public.service_jobs 
    ADD COLUMN won_value numeric(12, 2);
  END IF;

  -- lost_value: estimate value when outcome is "lost"
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'service_jobs' 
      AND column_name = 'lost_value'
  ) THEN
    ALTER TABLE public.service_jobs 
    ADD COLUMN lost_value numeric(12, 2);
  END IF;
END$$;

-- ============================================================================
-- 2) Create unique index on hcp_estimate_id for upsert capability
-- ============================================================================
-- This allows re-imports to update existing estimates by hcp_estimate_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_jobs_hcp_estimate_id 
  ON public.service_jobs(created_by, hcp_estimate_id)
  WHERE hcp_estimate_id IS NOT NULL;

-- ============================================================================
-- 3) Create indexes for estimate filtering and aggregation
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_service_jobs_hcp_outcome 
  ON public.service_jobs(hcp_outcome)
  WHERE hcp_outcome IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_jobs_estimate_status 
  ON public.service_jobs(estimate_status)
  WHERE estimate_status IS NOT NULL;

-- ============================================================================
-- 4) Update service_jobs_bulk_upsert RPC to handle estimate fields
-- ============================================================================
CREATE OR REPLACE FUNCTION public.service_jobs_bulk_upsert(rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  row_data jsonb;
  job_num text;
  est_id text;
  existing_row public.service_jobs%ROWTYPE;
  new_job_date date;
  merged_raw jsonb;
  inserted_count int := 0;
  updated_count int := 0;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Iterate through each row in the input array
  FOR row_data IN SELECT * FROM jsonb_array_elements(rows)
  LOOP
    -- Extract job_number (required)
    job_num := COALESCE(row_data->>'job_number', '');
    est_id := row_data->>'hcp_estimate_id';
    
    -- Skip rows without job_number
    IF job_num = '' THEN
      CONTINUE;
    END IF;

    -- Derive job_date from scheduled_start_at or job_created_at
    new_job_date := NULL;
    IF row_data->>'scheduled_start_at' IS NOT NULL THEN
      new_job_date := (row_data->>'scheduled_start_at')::timestamptz::date;
    ELSIF row_data->>'job_created_at' IS NOT NULL THEN
      new_job_date := (row_data->>'job_created_at')::timestamptz::date;
    ELSIF row_data->>'job_date' IS NOT NULL THEN
      new_job_date := (row_data->>'job_date')::date;
    END IF;

    -- Check if job already exists (by job_number OR by hcp_estimate_id if present)
    SELECT * INTO existing_row
    FROM public.service_jobs
    WHERE created_by = current_user_id 
      AND (
        job_number = job_num 
        OR (est_id IS NOT NULL AND hcp_estimate_id = est_id)
      );

    -- Merge raw JSON (old + new)
    IF existing_row.id IS NOT NULL THEN
      merged_raw := COALESCE(existing_row.raw, '{}'::jsonb) || COALESCE(row_data->'raw', '{}'::jsonb);
    ELSE
      merged_raw := COALESCE(row_data->'raw', '{}'::jsonb);
    END IF;

    -- Upsert with COALESCE merge logic
    INSERT INTO public.service_jobs (
      created_by,
      job_number,
      job_description,
      status,
      raw_status,
      customer_name,
      address,
      location_name,
      job_created_at,
      scheduled_start_at,
      job_date,
      assigned_employees_raw,
      primary_tech,
      job_amount,
      due_amount,
      is_estimate,
      hcp_estimate_id,
      estimate_status,
      hcp_outcome,
      estimate_tags,
      open_value,
      won_value,
      lost_value,
      raw
    ) VALUES (
      current_user_id,
      job_num,
      row_data->>'job_description',
      row_data->>'status',
      row_data->>'raw_status',
      row_data->>'customer_name',
      row_data->>'address',
      row_data->>'location_name',
      (row_data->>'job_created_at')::timestamptz,
      (row_data->>'scheduled_start_at')::timestamptz,
      new_job_date,
      row_data->>'assigned_employees_raw',
      row_data->>'primary_tech',
      (row_data->>'job_amount')::numeric,
      (row_data->>'due_amount')::numeric,
      COALESCE((row_data->>'is_estimate')::boolean, false),
      est_id,
      row_data->>'estimate_status',
      row_data->>'hcp_outcome',
      row_data->>'estimate_tags',
      (row_data->>'open_value')::numeric,
      (row_data->>'won_value')::numeric,
      (row_data->>'lost_value')::numeric,
      merged_raw
    )
    ON CONFLICT (created_by, job_number)
    DO UPDATE SET
      -- Latest file wins for non-null values; COALESCE preserves existing if new is null
      job_description = COALESCE(EXCLUDED.job_description, service_jobs.job_description),
      status = COALESCE(EXCLUDED.status, service_jobs.status),
      raw_status = COALESCE(EXCLUDED.raw_status, service_jobs.raw_status),
      customer_name = COALESCE(EXCLUDED.customer_name, service_jobs.customer_name),
      address = COALESCE(EXCLUDED.address, service_jobs.address),
      location_name = COALESCE(EXCLUDED.location_name, service_jobs.location_name),
      job_created_at = COALESCE(EXCLUDED.job_created_at, service_jobs.job_created_at),
      scheduled_start_at = COALESCE(EXCLUDED.scheduled_start_at, service_jobs.scheduled_start_at),
      job_date = COALESCE(EXCLUDED.job_date, service_jobs.job_date),
      assigned_employees_raw = COALESCE(EXCLUDED.assigned_employees_raw, service_jobs.assigned_employees_raw),
      primary_tech = COALESCE(EXCLUDED.primary_tech, service_jobs.primary_tech),
      job_amount = COALESCE(EXCLUDED.job_amount, service_jobs.job_amount),
      due_amount = COALESCE(EXCLUDED.due_amount, service_jobs.due_amount),
      is_estimate = COALESCE(EXCLUDED.is_estimate, service_jobs.is_estimate),
      hcp_estimate_id = COALESCE(EXCLUDED.hcp_estimate_id, service_jobs.hcp_estimate_id),
      estimate_status = COALESCE(EXCLUDED.estimate_status, service_jobs.estimate_status),
      hcp_outcome = COALESCE(EXCLUDED.hcp_outcome, service_jobs.hcp_outcome),
      estimate_tags = COALESCE(EXCLUDED.estimate_tags, service_jobs.estimate_tags),
      open_value = COALESCE(EXCLUDED.open_value, service_jobs.open_value),
      won_value = COALESCE(EXCLUDED.won_value, service_jobs.won_value),
      lost_value = COALESCE(EXCLUDED.lost_value, service_jobs.lost_value),
      raw = merged_raw,
      updated_at = now();

    -- Track whether this was insert or update
    IF existing_row.id IS NOT NULL THEN
      updated_count := updated_count + 1;
    ELSE
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;

  -- Return summary
  RETURN jsonb_build_object(
    'inserted', inserted_count,
    'updated', updated_count,
    'total', inserted_count + updated_count
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.service_jobs_bulk_upsert(jsonb) TO authenticated;

-- ============================================================================
-- 5) Update service metrics views to include estimate aggregations
-- ============================================================================

-- Daily metrics including estimates
CREATE OR REPLACE VIEW public.view_service_metrics_daily AS
SELECT 
  job_date,
  status,
  COUNT(*) AS job_count,
  SUM(job_amount) AS total_revenue,
  SUM(due_amount) AS total_due,
  -- Estimate metrics
  SUM(CASE WHEN is_estimate THEN 1 ELSE 0 END) AS estimates_count,
  SUM(CASE WHEN is_estimate THEN open_value ELSE 0 END) AS estimates_open_value,
  SUM(CASE WHEN is_estimate THEN won_value ELSE 0 END) AS estimates_won_value,
  SUM(CASE WHEN is_estimate THEN lost_value ELSE 0 END) AS estimates_lost_value,
  created_by
FROM public.service_jobs
WHERE job_date IS NOT NULL
GROUP BY job_date, status, created_by
ORDER BY job_date DESC, status;

-- Monthly metrics including estimates
CREATE OR REPLACE VIEW public.view_service_metrics_monthly AS
SELECT 
  DATE_TRUNC('month', job_date) AS month,
  status,
  COUNT(*) AS job_count,
  SUM(job_amount) AS total_revenue,
  SUM(due_amount) AS total_due,
  -- Estimate metrics
  SUM(CASE WHEN is_estimate THEN 1 ELSE 0 END) AS estimates_count,
  SUM(CASE WHEN is_estimate THEN open_value ELSE 0 END) AS estimates_open_value,
  SUM(CASE WHEN is_estimate THEN won_value ELSE 0 END) AS estimates_won_value,
  SUM(CASE WHEN is_estimate THEN lost_value ELSE 0 END) AS estimates_lost_value,
  created_by
FROM public.service_jobs
WHERE job_date IS NOT NULL
GROUP BY DATE_TRUNC('month', job_date), status, created_by
ORDER BY month DESC, status;

-- ============================================================================
-- 6) Verification queries (run separately to verify)
-- ============================================================================
-- Verify new columns exist:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'service_jobs' 
--   AND column_name IN ('hcp_estimate_id', 'estimate_status', 'hcp_outcome', 'estimate_tags', 'open_value', 'won_value', 'lost_value', 'location_name');

-- Check estimates vs jobs breakdown:
-- SELECT 
--   is_estimate,
--   COUNT(*) as count,
--   SUM(job_amount) as total_amount,
--   SUM(open_value) as total_open,
--   SUM(won_value) as total_won,
--   SUM(lost_value) as total_lost
-- FROM public.service_jobs
-- GROUP BY is_estimate;
