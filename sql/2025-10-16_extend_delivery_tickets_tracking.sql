-- Migration: Extend delivery_tickets table with tracking and metrics columns
-- Date: 2025-10-16
-- Safe to run multiple times (idempotent). Run in Supabase SQL editor.
-- Adds columns for ticket tracking, time windows, odometer readings, and computed metrics.

-- ============================================================================
-- 1) Add new columns to delivery_tickets table
-- ============================================================================

-- Add ticket_id for external ticket reference
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'delivery_tickets' 
      AND column_name = 'ticket_id'
  ) THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN ticket_id text;
  END IF;
END $$;

-- Add gallons_delivered (separate from qty if needed, or alias to qty)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'delivery_tickets' 
      AND column_name = 'gallons_delivered'
  ) THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN gallons_delivered numeric;
  END IF;
END $$;

-- Add scheduled_window_start for delivery window tracking
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'delivery_tickets' 
      AND column_name = 'scheduled_window_start'
  ) THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN scheduled_window_start timestamptz;
  END IF;
END $$;

-- Add arrival_time for actual arrival timestamp
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'delivery_tickets' 
      AND column_name = 'arrival_time'
  ) THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN arrival_time timestamptz;
  END IF;
END $$;

-- Add departure_time for departure timestamp
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'delivery_tickets' 
      AND column_name = 'departure_time'
  ) THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN departure_time timestamptz;
  END IF;
END $$;

-- Add odometer_start for starting odometer reading
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'delivery_tickets' 
      AND column_name = 'odometer_start'
  ) THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN odometer_start numeric;
  END IF;
END $$;

-- Add odometer_end for ending odometer reading
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'delivery_tickets' 
      AND column_name = 'odometer_end'
  ) THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN odometer_end numeric;
  END IF;
END $$;

-- Add miles_driven for computed or stored miles driven
-- Using plain numeric column (not generated) for broader Postgres compatibility
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'delivery_tickets' 
      AND column_name = 'miles_driven'
  ) THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN miles_driven numeric;
  END IF;
END $$;

-- Add on_time_flag for on-time delivery tracking (1 = on time, 0 = late, null = not computed)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'delivery_tickets' 
      AND column_name = 'on_time_flag'
  ) THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN on_time_flag smallint;
  END IF;
END $$;

-- ============================================================================
-- 2) Create indexes for performance on new columns
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_delivery_tickets_ticket_id ON public.delivery_tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tickets_scheduled_window_start ON public.delivery_tickets(scheduled_window_start);
CREATE INDEX IF NOT EXISTS idx_delivery_tickets_arrival_time ON public.delivery_tickets(arrival_time);
CREATE INDEX IF NOT EXISTS idx_delivery_tickets_on_time_flag ON public.delivery_tickets(on_time_flag);

-- ============================================================================
-- 3) Optional: Update existing rows with computed on_time_flag
-- ============================================================================
-- Compute on_time_flag for existing rows that have both scheduled_window_start and arrival_time
-- On time if arrival_time <= scheduled_window_start + 5 minutes
UPDATE public.delivery_tickets
SET on_time_flag = CASE 
  WHEN arrival_time <= (scheduled_window_start + INTERVAL '5 minutes') THEN 1
  ELSE 0
END
WHERE scheduled_window_start IS NOT NULL 
  AND arrival_time IS NOT NULL 
  AND on_time_flag IS NULL;

-- ============================================================================
-- 4) Verification queries (commented out, run separately to verify)
-- ============================================================================
-- Verify new columns exist:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'delivery_tickets'
--   AND column_name IN ('ticket_id', 'gallons_delivered', 'scheduled_window_start', 
--                       'arrival_time', 'departure_time', 'odometer_start', 
--                       'odometer_end', 'miles_driven', 'on_time_flag')
-- ORDER BY column_name;

-- Verify indexes exist:
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
--   AND tablename = 'delivery_tickets'
--   AND indexname LIKE '%ticket_id%' 
--    OR indexname LIKE '%scheduled_window%'
--    OR indexname LIKE '%arrival_time%'
--    OR indexname LIKE '%on_time_flag%';
