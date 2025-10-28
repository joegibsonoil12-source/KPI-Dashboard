CREATE SCHEMA IF NOT EXISTS migrations;

CREATE TABLE IF NOT EXISTS migrations.job_amount_update_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text,
  job_date date,
  old_job_amount numeric,
  new_job_amount numeric,
  updated_by text DEFAULT current_user,
  updated_at timestamptz DEFAULT now()
);
