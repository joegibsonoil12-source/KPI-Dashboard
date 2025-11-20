-- migrations/20251120_add_is_estimate_to_service_jobs.sql
ALTER TABLE service_jobs
ADD COLUMN IF NOT EXISTS is_estimate boolean DEFAULT false;

-- add index for queries
CREATE INDEX IF NOT EXISTS idx_service_jobs_is_estimate ON service_jobs (is_estimate);
