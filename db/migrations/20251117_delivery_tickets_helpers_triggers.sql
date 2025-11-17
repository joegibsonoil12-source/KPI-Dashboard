-- Migration: Delivery Tickets Helper Triggers and Functions
-- Date: 2025-11-17
-- Purpose: Add triggers and helper functions to ensure delivery_tickets always
--          have sensible total_amount and raw_text defaults if parser doesn't provide them

-- ============================================================================
-- 1) Create trigger function to compute total_amount if missing
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_delivery_ticket_total()
RETURNS TRIGGER AS $$
BEGIN
  -- If total_amount is NULL or zero, try to compute from components
  IF NEW.amount IS NULL OR NEW.amount = 0 THEN
    -- Compute total from price * qty + tax + hazmat_fee (if columns exist)
    NEW.amount := COALESCE(NEW.price, 0) * COALESCE(NEW.qty, 0) + 
                  COALESCE(NEW.tax, 0);
    
    -- Add hazmat_fee if column exists (check if column is present)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'delivery_tickets' 
        AND column_name = 'hazmat_fee'
    ) THEN
      NEW.amount := NEW.amount + COALESCE(NEW.hazmat_fee, 0);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2) Create trigger to ensure raw_text has a default value
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_delivery_ticket_raw_text()
RETURNS TRIGGER AS $$
BEGIN
  -- If raw_text is NULL or empty, create a concise summary
  IF NEW.raw_text IS NULL OR TRIM(NEW.raw_text) = '' THEN
    NEW.raw_text := format(
      'Delivery Ticket: %s | Store: %s | Product: %s | Driver: %s | Qty: %s | Amount: $%s',
      COALESCE(NEW.date::text, 'N/A'),
      COALESCE(NEW.store, 'N/A'),
      COALESCE(NEW.product, 'N/A'),
      COALESCE(NEW.driver, 'N/A'),
      COALESCE(NEW.qty::text, 'N/A'),
      COALESCE(NEW.amount::text, '0.00')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3) Create triggers on delivery_tickets table (if table exists)
-- ============================================================================
DO $$
BEGIN
  -- Only create triggers if delivery_tickets table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'delivery_tickets'
  ) THEN
    -- Drop existing triggers if they exist
    DROP TRIGGER IF EXISTS trigger_ensure_total_amount ON public.delivery_tickets;
    DROP TRIGGER IF EXISTS trigger_ensure_raw_text ON public.delivery_tickets;
    
    -- Create trigger for total_amount computation
    CREATE TRIGGER trigger_ensure_total_amount
      BEFORE INSERT OR UPDATE ON public.delivery_tickets
      FOR EACH ROW
      EXECUTE FUNCTION public.ensure_delivery_ticket_total();
    
    -- Create trigger for raw_text default
    -- Only if raw_text column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'delivery_tickets' 
        AND column_name = 'raw_text'
    ) THEN
      CREATE TRIGGER trigger_ensure_raw_text
        BEFORE INSERT OR UPDATE ON public.delivery_tickets
        FOR EACH ROW
        EXECUTE FUNCTION public.ensure_delivery_ticket_raw_text();
    END IF;
    
    RAISE NOTICE 'Delivery ticket triggers created successfully';
  ELSE
    RAISE NOTICE 'delivery_tickets table does not exist, skipping trigger creation';
  END IF;
END$$;

-- ============================================================================
-- 4) Create helper function for bulk upsert (if not exists)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delivery_tickets_bulk_upsert(
  tickets jsonb
)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  inserted_count int := 0;
  updated_count int := 0;
BEGIN
  -- This is a placeholder for bulk upsert logic
  -- Implementation depends on specific business rules for matching existing tickets
  
  -- Example: Insert new tickets from parsed data
  -- Actual implementation would need to handle conflicts/updates
  
  RAISE NOTICE 'Bulk upsert called with % tickets', jsonb_array_length(tickets);
  
  RETURN jsonb_build_object(
    'success', true,
    'inserted', inserted_count,
    'updated', updated_count
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5) Create helper function to accept ticket import
-- ============================================================================
CREATE OR REPLACE FUNCTION public.accept_ticket_import(
  import_id bigint
)
RETURNS jsonb AS $$
DECLARE
  import_record record;
  parsed_data jsonb;
  rows_array jsonb;
  result jsonb;
BEGIN
  -- Fetch the import record
  SELECT * INTO import_record 
  FROM public.ticket_imports 
  WHERE id = import_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Import not found'
    );
  END IF;
  
  -- Extract parsed rows
  parsed_data := import_record.parsed;
  rows_array := parsed_data->'rows';
  
  IF rows_array IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No parsed rows found'
    );
  END IF;
  
  -- Call bulk upsert
  result := public.delivery_tickets_bulk_upsert(rows_array);
  
  -- Update import status to accepted
  UPDATE public.ticket_imports
  SET 
    status = 'accepted',
    processed_at = now()
  WHERE id = import_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6) Grant execute permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.ensure_delivery_ticket_total() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_delivery_ticket_raw_text() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_tickets_bulk_upsert(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_ticket_import(bigint) TO authenticated;

-- ============================================================================
-- Verification
-- ============================================================================
-- Check if triggers are created:
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE event_object_schema = 'public' 
--   AND event_object_table = 'delivery_tickets'
--   AND trigger_name LIKE 'trigger_ensure%';

-- Check if functions exist:
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
--   AND routine_name LIKE '%delivery%ticket%';
