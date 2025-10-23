-- Migration: Create mark_customer_completed RPC function
-- Date: 2025-10-23
-- Safe to run multiple times (idempotent).
-- Purpose: Server function to mark a service job as completed and return updated status

-- ============================================================================
-- Create or replace the mark_customer_completed RPC function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_customer_completed(service_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the service job status to 'completed'
  UPDATE public.service_jobs
  SET 
    status = 'completed',
    updated_at = now()
  WHERE id = service_id;
  
  -- If no rows were affected, raise an exception
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service job not found: %', service_id;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.mark_customer_completed(uuid) TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION public.mark_customer_completed(uuid) IS 
'Marks a service job as completed by updating its status to "completed". 
Used by the Billboard component when users click "Mark Completed" button.
Requires authenticated user. Returns void on success, raises exception if job not found.';
