-- Safe update: populate job_amount from raw $ values only when parsed_amount > 0,
-- record changes into migrations.job_amount_update_log and return changed rows.
-- Run PREVIEW SELECT first (inspect parsed_amount) before running this.

CREATE SCHEMA IF NOT EXISTS migrations;

CREATE TABLE IF NOT EXISTS migrations.job_amount_update_log (
  id uuid PRIMARY KEY,
  job_number text,
  job_date date,
  old_job_amount numeric,
  new_job_amount numeric,
  updated_by text DEFAULT current_user,
  updated_at timestamptz DEFAULT now()
);

BEGIN;

WITH parsed AS (
  SELECT
    id,
    job_number,
    job_date,
    status,
    (regexp_replace(
      (SELECT elem FROM jsonb_array_elements_text(raw) WITH ORDINALITY arr(elem, idx)
       WHERE elem ~ '^\$[0-9]' LIMIT 1),
      '[$,]', '', 'g'
    ))::numeric AS parsed_amount
  FROM public.service_jobs
  WHERE job_amount IS NULL
),
to_update AS (
  SELECT id, job_number, job_date, parsed_amount
  FROM parsed
  WHERE parsed_amount IS NOT NULL AND parsed_amount > 0
),
updated AS (
  UPDATE public.service_jobs s
  SET job_amount = t.parsed_amount
  FROM to_update t
  WHERE s.id = t.id
  RETURNING s.id, s.job_number, s.job_date, NULL::numeric AS old_job_amount, s.job_amount AS new_job_amount
)
INSERT INTO migrations.job_amount_update_log (id, job_number, job_date, old_job_amount, new_job_amount)
SELECT id, job_number, job_date, old_job_amount, new_job_amount FROM updated
RETURNING *;

COMMIT;
