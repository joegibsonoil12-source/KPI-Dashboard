-- Migration: Add is_estimate column to service_jobs table
-- Date: 2025-11-19
-- Safe to run multiple times (idempotent). Run in Supabase SQL editor.
-- Purpose: Add boolean flag to distinguish estimates from jobs in Service Tracking and Schedule

-- ============================================================================
-- 1) Add is_estimate column to service_jobs
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'service_jobs' 
      AND column_name = 'is_estimate'
  ) THEN
    ALTER TABLE public.service_jobs 
    ADD COLUMN is_estimate boolean DEFAULT false;
  END IF;
END$$;

-- ============================================================================
-- 2) Create index for filtering by estimate status
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_service_jobs_is_estimate 
  ON public.service_jobs(is_estimate);

-- ============================================================================
-- 3) Backfill existing records by detecting estimates from status/type/notes
-- ============================================================================
-- This updates existing records where job_description, status, or raw_status contain "estimate"
UPDATE public.service_jobs
SET is_estimate = true
WHERE is_estimate = false
  AND (
    LOWER(job_description) LIKE '%estimate%'
    OR LOWER(status) LIKE '%estimate%'
    OR LOWER(raw_status) LIKE '%estimate%'
  );

-- ============================================================================
-- 4) Update RPC function to handle is_estimate field
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
    IF job_num = '' THEN
      CONTINUE; -- Skip rows without job_number
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

    -- Check if job already exists
    SELECT * INTO existing_row
    FROM public.service_jobs
    WHERE created_by = current_user_id AND job_number = job_num;

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
      job_created_at,
      scheduled_start_at,
      job_date,
      assigned_employees_raw,
      primary_tech,
      job_amount,
      due_amount,
      is_estimate,
      raw
    ) VALUES (
      current_user_id,
      job_num,
      row_data->>'job_description',
      row_data->>'status',
      row_data->>'raw_status',
      row_data->>'customer_name',
      row_data->>'address',
      (row_data->>'job_created_at')::timestamptz,
      (row_data->>'scheduled_start_at')::timestamptz,
      new_job_date,
      row_data->>'assigned_employees_raw',
      row_data->>'primary_tech',
      (row_data->>'job_amount')::numeric,
      (row_data->>'due_amount')::numeric,
      COALESCE((row_data->>'is_estimate')::boolean, false),
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
      job_created_at = COALESCE(EXCLUDED.job_created_at, service_jobs.job_created_at),
      scheduled_start_at = COALESCE(EXCLUDED.scheduled_start_at, service_jobs.scheduled_start_at),
      job_date = COALESCE(EXCLUDED.job_date, service_jobs.job_date),
      assigned_employees_raw = COALESCE(EXCLUDED.assigned_employees_raw, service_jobs.assigned_employees_raw),
      primary_tech = COALESCE(EXCLUDED.primary_tech, service_jobs.primary_tech),
      job_amount = COALESCE(EXCLUDED.job_amount, service_jobs.job_amount),
      due_amount = COALESCE(EXCLUDED.due_amount, service_jobs.due_amount),
      is_estimate = COALESCE(EXCLUDED.is_estimate, service_jobs.is_estimate),
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
-- 5) Verification queries (run separately to verify)
-- ============================================================================
-- Verify column exists:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'service_jobs' AND column_name = 'is_estimate';

-- Check count of estimates vs jobs:
-- SELECT 
--   is_estimate,
--   COUNT(*) as count,
--   SUM(job_amount) as total_amount
-- FROM public.service_jobs
-- GROUP BY is_estimate;
