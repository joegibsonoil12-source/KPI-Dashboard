-- Migration: Create service_jobs table with RLS for Service Tracking feature
-- Date: 2025-10-16
-- Safe to run multiple times (idempotent). Run in Supabase SQL editor.
-- Purpose: Track service jobs from Housecall Pro daily CSV/XLSX uploads
--          with deduplication on (created_by, job_number) for re-uploads and date changes

-- ============================================================================
-- 1) Create service_jobs table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.service_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Core job fields from Housecall Pro
  job_number text NOT NULL,
  job_description text,
  status text, -- normalized: scheduled|unscheduled|in_progress|completed|canceled
  raw_status text, -- preserve original status from upload
  customer_name text,
  address text,
  
  -- Dates
  job_created_at timestamptz,
  scheduled_start_at timestamptz,
  job_date date, -- derived from scheduled_start_at::date, fallback to job_created_at::date
  
  -- Employee/tech assignment
  assigned_employees_raw text, -- comma-separated list from upload
  primary_tech text, -- first employee in list
  
  -- Financial
  job_amount numeric(12, 2),
  due_amount numeric(12, 2),
  
  -- Raw data
  raw jsonb -- store full row for reference
);

-- ============================================================================
-- 2) Create unique constraint for deduplication
-- ============================================================================
-- This allows re-uploads to update existing records by (created_by, job_number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_jobs_created_by_job_number 
  ON public.service_jobs(created_by, job_number);

-- ============================================================================
-- 3) Create trigger for updated_at
-- ============================================================================
-- Reuse existing handle_updated_at function from delivery_tickets migration
DROP TRIGGER IF EXISTS service_jobs_updated_at ON public.service_jobs;
CREATE TRIGGER service_jobs_updated_at
  BEFORE UPDATE ON public.service_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 4) Create indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_service_jobs_job_date ON public.service_jobs(job_date);
CREATE INDEX IF NOT EXISTS idx_service_jobs_primary_tech ON public.service_jobs(primary_tech);
CREATE INDEX IF NOT EXISTS idx_service_jobs_status ON public.service_jobs(status);
CREATE INDEX IF NOT EXISTS idx_service_jobs_created_by ON public.service_jobs(created_by);

-- ============================================================================
-- 5) Enable Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.service_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6) RLS Policies for service_jobs
-- ============================================================================

-- SELECT: Authenticated users can read all service jobs (like delivery_tickets)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'service_jobs' 
      AND policyname = 'service_jobs_select_authenticated'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY service_jobs_select_authenticated
        ON public.service_jobs
        FOR SELECT
        TO authenticated
        USING (true);
    $sql$;
  END IF;
END$$;

-- INSERT: Authenticated users can insert; created_by must be their own uid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'service_jobs' 
      AND policyname = 'service_jobs_insert_authenticated'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY service_jobs_insert_authenticated
        ON public.service_jobs
        FOR INSERT
        TO authenticated
        WITH CHECK (created_by = auth.uid());
    $sql$;
  END IF;
END$$;

-- UPDATE: Owner can update their jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'service_jobs' 
      AND policyname = 'service_jobs_update_owner'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY service_jobs_update_owner
        ON public.service_jobs
        FOR UPDATE
        TO authenticated
        USING (created_by = auth.uid())
        WITH CHECK (created_by = auth.uid());
    $sql$;
  END IF;
END$$;

-- UPDATE: Admin/Manager can update any jobs (mirrors delivery_tickets admin pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'service_jobs' 
      AND policyname = 'service_jobs_update_admin_manager'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY service_jobs_update_admin_manager
        ON public.service_jobs
        FOR UPDATE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND LOWER(role) IN ('admin', 'manager')
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND LOWER(role) IN ('admin', 'manager')
          )
        );
    $sql$;
  END IF;
END$$;

-- DELETE: Owner can delete their jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'service_jobs' 
      AND policyname = 'service_jobs_delete_owner'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY service_jobs_delete_owner
        ON public.service_jobs
        FOR DELETE
        TO authenticated
        USING (created_by = auth.uid());
    $sql$;
  END IF;
END$$;

-- DELETE: Admin/Manager can delete any jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'service_jobs' 
      AND policyname = 'service_jobs_delete_admin_manager'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY service_jobs_delete_admin_manager
        ON public.service_jobs
        FOR DELETE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND LOWER(role) IN ('admin', 'manager')
          )
        );
    $sql$;
  END IF;
END$$;

-- ============================================================================
-- 7) Create view for per-tech analysis (split assigned_employees_raw)
-- ============================================================================
CREATE OR REPLACE VIEW public.service_job_techs AS
SELECT 
  sj.id,
  sj.job_number,
  sj.job_date,
  sj.status,
  sj.job_amount,
  sj.due_amount,
  TRIM(tech.value) AS tech_name,
  sj.created_by
FROM public.service_jobs sj
CROSS JOIN LATERAL (
  SELECT unnest(string_to_array(sj.assigned_employees_raw, ',')) AS value
) AS tech
WHERE sj.assigned_employees_raw IS NOT NULL 
  AND sj.assigned_employees_raw != '';

-- ============================================================================
-- 8) Create view for daily metrics rollup
-- ============================================================================
CREATE OR REPLACE VIEW public.view_service_metrics_daily AS
SELECT 
  job_date,
  status,
  COUNT(*) AS job_count,
  SUM(job_amount) AS total_revenue,
  SUM(due_amount) AS total_due,
  created_by
FROM public.service_jobs
WHERE job_date IS NOT NULL
GROUP BY job_date, status, created_by
ORDER BY job_date DESC, status;

-- ============================================================================
-- 9) Create view for monthly metrics rollup
-- ============================================================================
CREATE OR REPLACE VIEW public.view_service_metrics_monthly AS
SELECT 
  DATE_TRUNC('month', job_date) AS month,
  status,
  COUNT(*) AS job_count,
  SUM(job_amount) AS total_revenue,
  SUM(due_amount) AS total_due,
  created_by
FROM public.service_jobs
WHERE job_date IS NOT NULL
GROUP BY DATE_TRUNC('month', job_date), status, created_by
ORDER BY month DESC, status;

-- ============================================================================
-- 10) Create RPC function for bulk upsert with merge semantics
-- ============================================================================
-- Purpose: Atomic server-side bulk upsert for EOD imports
-- Merge semantics: COALESCE to keep existing values when new file has blanks
-- Deduplication: (created_by, job_number)
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
      merged_raw := COALESCE(existing_row.raw, '{}'::jsonb) || COALESCE((row_data->>'raw')::jsonb, '{}'::jsonb);
    ELSE
      merged_raw := COALESCE((row_data->>'raw')::jsonb, '{}'::jsonb);
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
-- 11) Verification queries (run separately to verify setup)
-- ============================================================================
-- Verify table exists:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name = 'service_jobs';

-- Verify RLS is enabled:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename = 'service_jobs';

-- Verify policies exist:
-- SELECT schemaname, tablename, policyname, cmd 
-- FROM pg_policies 
-- WHERE schemaname = 'public' AND tablename = 'service_jobs'
-- ORDER BY policyname;

-- Verify unique constraint:
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'service_jobs' AND indexname LIKE '%job_number%';

-- Verify RPC function exists:
-- SELECT proname, proargnames, prosrc 
-- FROM pg_proc 
-- WHERE proname = 'service_jobs_bulk_upsert';
