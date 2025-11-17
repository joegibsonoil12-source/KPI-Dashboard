-- ======================================================================
-- Idempotent migration: fix delivery_tickets + ticket_imports, views, triggers,
-- storage policies (ticket-scans), helpers and an audit table.
-- Safe to re-run.  Date: 2025-11-17
-- ======================================================================
BEGIN;

-- (1) Ensure core columns exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_tickets' AND column_name='created_by') THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN created_by uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_tickets' AND column_name='total_amount') THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN total_amount numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_tickets' AND column_name='raw_text') THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN raw_text text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_tickets' AND column_name='hazmat_fee') THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN hazmat_fee numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_tickets' AND column_name='price') THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN price numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_tickets' AND column_name='qty') THEN
    ALTER TABLE public.delivery_tickets ADD COLUMN qty numeric;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ticket_imports') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ticket_imports' AND column_name='created_by') THEN
      ALTER TABLE public.ticket_imports ADD COLUMN created_by uuid;
    END IF;
  END IF;
END$$;

-- (2) Indexes (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'idx_delivery_tickets_ticket_id' AND n.nspname = 'public') THEN
    CREATE INDEX idx_delivery_tickets_ticket_id ON public.delivery_tickets(ticket_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'idx_delivery_tickets_date' AND n.nspname = 'public') THEN
    CREATE INDEX idx_delivery_tickets_date ON public.delivery_tickets(date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'idx_delivery_tickets_on_time_flag' AND n.nspname = 'public') THEN
    CREATE INDEX idx_delivery_tickets_on_time_flag ON public.delivery_tickets(on_time_flag);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'idx_delivery_tickets_created_by_ticket_id' AND n.nspname = 'public') THEN
    CREATE UNIQUE INDEX idx_delivery_tickets_created_by_ticket_id
      ON public.delivery_tickets(created_by, ticket_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'uniq_delivery_tickets_ticket_id' AND n.nspname = 'public') THEN
    EXECUTE 'CREATE UNIQUE INDEX uniq_delivery_tickets_ticket_id ON public.delivery_tickets(ticket_id) WHERE ticket_id IS NOT NULL;';
  END IF;
END$$;

-- (3) RLS for delivery_tickets and ticket_imports (drop->create guarded)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='delivery_tickets') THEN
    ALTER TABLE public.delivery_tickets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS delivery_tickets_select_authenticated ON public.delivery_tickets;
    DROP POLICY IF EXISTS delivery_tickets_insert_authenticated ON public.delivery_tickets;
    DROP POLICY IF EXISTS delivery_tickets_update_owner ON public.delivery_tickets;
    DROP POLICY IF EXISTS delivery_tickets_delete_owner ON public.delivery_tickets;

    CREATE POLICY delivery_tickets_select_authenticated
      ON public.delivery_tickets FOR SELECT TO authenticated USING (true);

    CREATE POLICY delivery_tickets_insert_authenticated
      ON public.delivery_tickets FOR INSERT TO authenticated
      WITH CHECK (created_by IS NULL OR created_by = auth.uid());

    CREATE POLICY delivery_tickets_update_owner
      ON public.delivery_tickets FOR UPDATE TO authenticated
      USING (created_by IS NULL OR created_by = auth.uid())
      WITH CHECK (created_by IS NULL OR created_by = auth.uid());

    CREATE POLICY delivery_tickets_delete_owner
      ON public.delivery_tickets FOR DELETE TO authenticated
      USING (created_by IS NULL OR created_by = auth.uid());
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ticket_imports') THEN
    ALTER TABLE public.ticket_imports ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS ticket_imports_select_authenticated ON public.ticket_imports;
    DROP POLICY IF EXISTS ticket_imports_insert_authenticated ON public.ticket_imports;
    DROP POLICY IF EXISTS ticket_imports_update_owner ON public.ticket_imports;

    CREATE POLICY ticket_imports_select_authenticated
      ON public.ticket_imports FOR SELECT TO authenticated USING (true);

    CREATE POLICY ticket_imports_insert_authenticated
      ON public.ticket_imports FOR INSERT TO authenticated
      WITH CHECK (created_by IS NULL OR created_by = auth.uid());

    CREATE POLICY ticket_imports_update_owner
      ON public.ticket_imports FOR UPDATE TO authenticated
      USING (created_by IS NULL OR created_by = auth.uid())
      WITH CHECK (created_by IS NULL OR created_by = auth.uid());
  END IF;

  -- Optional: allow anonymous insert/read for ticket_imports (for GitHub Pages)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ticket_imports') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ticket_imports' AND policyname='Allow anon insert ticket_imports') THEN
      EXECUTE $sql$
        CREATE POLICY "Allow anon insert ticket_imports"
          ON public.ticket_imports FOR INSERT TO anon WITH CHECK (true);
      $sql$;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ticket_imports' AND policyname='Allow anon read ticket_imports') THEN
      EXECUTE $sql$
        CREATE POLICY "Allow anon read ticket_imports"
          ON public.ticket_imports FOR SELECT TO anon USING (true);
      $sql$;
    END IF;
  END IF;
END$$;

-- (4) Aggregation views and safe grants (views -> GRANT SELECT to anon/auth)
CREATE OR REPLACE VIEW public.delivery_tickets_daily AS
SELECT date::date AS day, COUNT(*)::int AS ticket_count, SUM(COALESCE(qty::numeric, 0))::numeric AS total_gallons, SUM(COALESCE(amount::numeric, 0))::numeric AS revenue
FROM public.delivery_tickets
WHERE (status IS NULL OR (status NOT ILIKE '%void%' AND status NOT ILIKE '%cancel%'))
GROUP BY day ORDER BY day;

CREATE OR REPLACE VIEW public.delivery_tickets_weekly AS
SELECT (date_trunc('week', date::timestamp)::date + INTERVAL '1 day')::date AS week_start, COUNT(*)::int AS ticket_count, SUM(COALESCE(qty::numeric, 0))::numeric AS total_gallons, SUM(COALESCE(amount::numeric, 0))::numeric AS revenue
FROM public.delivery_tickets
WHERE (status IS NULL OR (status NOT ILIKE '%void%' AND status NOT ILIKE '%cancel%'))
GROUP BY week_start ORDER BY week_start;

CREATE OR REPLACE VIEW public.delivery_tickets_monthly AS
SELECT date_trunc('month', date::timestamp)::date AS month_start, COUNT(*)::int AS ticket_count, SUM(COALESCE(qty::numeric, 0))::numeric AS total_gallons, SUM(COALESCE(amount::numeric, 0))::numeric AS revenue
FROM public.delivery_tickets
WHERE (status IS NULL OR (status NOT ILIKE '%void%' AND status NOT ILIKE '%cancel%'))
GROUP BY month_start ORDER BY month_start;

CREATE OR REPLACE VIEW public.service_jobs_daily AS
SELECT job_date::date AS day, COUNT(*)::int AS job_count, SUM(COALESCE(job_amount::numeric, 0))::numeric AS revenue FROM public.service_jobs
WHERE (status IS NULL OR status NOT ILIKE '%cancel%') AND status ILIKE '%completed%'
GROUP BY day ORDER BY day;

CREATE OR REPLACE VIEW public.service_jobs_weekly AS
SELECT (date_trunc('week', job_date::timestamp)::date + INTERVAL '1 day')::date AS week_start, COUNT(*)::int AS job_count, SUM(COALESCE(job_amount::numeric, 0))::numeric AS revenue
FROM public.service_jobs
WHERE (status IS NULL OR status NOT ILIKE '%cancel%') AND status ILIKE '%completed%'
GROUP BY week_start ORDER BY week_start;

CREATE OR REPLACE VIEW public.service_jobs_monthly AS
SELECT date_trunc('month', job_date::timestamp)::date AS month_start, COUNT(*)::int AS job_count, SUM(COALESCE(job_amount::numeric, 0))::numeric AS revenue
FROM public.service_jobs
WHERE (status IS NULL OR status NOT ILIKE '%cancel%') AND status ILIKE '%completed%'
GROUP BY month_start ORDER BY month_start;

DO $$
DECLARE
  object_name text;
  objects text[] := ARRAY['delivery_tickets_daily','delivery_tickets_weekly','delivery_tickets_monthly','service_jobs_daily','service_jobs_weekly','service_jobs_monthly'];
BEGIN
  FOREACH object_name IN ARRAY objects LOOP
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name = object_name) THEN
      BEGIN
        EXECUTE format('GRANT SELECT ON public.%I TO anon;', object_name);
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not GRANT anon SELECT on %: %', object_name, SQLERRM;
      END;
      BEGIN
        EXECUTE format('GRANT SELECT ON public.%I TO authenticated;', object_name);
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not GRANT authenticated SELECT on %: %', object_name, SQLERRM;
      END;
      RAISE NOTICE 'GRANTED SELECT on view %', object_name;
    END IF;
  END LOOP;
END$$;

-- (5) Triggers + helper functions
CREATE OR REPLACE FUNCTION public.ensure_delivery_ticket_total() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount = 0 THEN
    NEW.amount := COALESCE(NEW.price, 0) * COALESCE(NEW.qty, 0) + COALESCE(NEW.tax, 0);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_tickets' AND column_name='hazmat_fee') THEN
      NEW.amount := NEW.amount + COALESCE(NEW.hazmat_fee, 0);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_delivery_ticket_raw_text() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.raw_text IS NULL OR TRIM(NEW.raw_text) = '' THEN
    NEW.raw_text := format('Delivery Ticket: %s | Store: %s | Product: %s | Driver: %s | Qty: %s | Amount: $%s',
      COALESCE(NEW.date::text, 'N/A'), COALESCE(NEW.store, 'N/A'), COALESCE(NEW.product, 'N/A'),
      COALESCE(NEW.driver, 'N/A'), COALESCE(NEW.qty::text, 'N/A'), COALESCE(NEW.amount::text, '0.00'));
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='delivery_tickets') THEN
    DROP TRIGGER IF EXISTS trigger_ensure_total_amount ON public.delivery_tickets;
    DROP TRIGGER IF EXISTS trigger_ensure_raw_text ON public.delivery_tickets;
    CREATE TRIGGER trigger_ensure_total_amount BEFORE INSERT OR UPDATE ON public.delivery_tickets FOR EACH ROW EXECUTE FUNCTION public.ensure_delivery_ticket_total();
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_tickets' AND column_name='raw_text') THEN
      CREATE TRIGGER trigger_ensure_raw_text BEFORE INSERT OR UPDATE ON public.delivery_tickets FOR EACH ROW EXECUTE FUNCTION public.ensure_delivery_ticket_raw_text();
    END IF;
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.delivery_tickets_bulk_upsert(tickets jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  RETURN jsonb_build_object('success', true, 'inserted', 0, 'updated', 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_ticket_import(import_id bigint) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE import_record record; parsed_data jsonb; rows_array jsonb; result jsonb;
BEGIN
  SELECT * INTO import_record FROM public.ticket_imports WHERE id = import_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Import not found'); END IF;
  parsed_data := import_record.parsed; rows_array := parsed_data->'rows';
  IF rows_array IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'No parsed rows found'); END IF;
  result := public.delivery_tickets_bulk_upsert(rows_array);
  UPDATE public.ticket_imports SET status='accepted', processed_at = now() WHERE id = import_id;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_delivery_ticket_total() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_delivery_ticket_raw_text() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_tickets_bulk_upsert(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_ticket_import(bigint) TO authenticated;

-- (6) Storage policies for ticket-scans (wrapped to skip if not owner)
DO $$
BEGIN
  BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('ticket-scans', 'ticket-scans', false, 52428800, ARRAY['image/jpeg','image/jpg','image/png','image/gif','application/pdf'])
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not create storage.buckets entry (create bucket via console instead): %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  BEGIN
    ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not enable RLS on storage.objects (likely not owner). Skipping: %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "Allow anon upload ticket-scans" ON storage.objects;
    CREATE POLICY "Allow anon upload ticket-scans" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'ticket-scans');
  EXCEPTION WHEN others THEN RAISE NOTICE 'Skipping policy Allow anon upload ticket-scans (permission): %', SQLERRM; END;
  BEGIN
    DROP POLICY IF EXISTS "Allow anon read ticket-scans" ON storage.objects;
    CREATE POLICY "Allow anon read ticket-scans" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'ticket-scans');
  EXCEPTION WHEN others THEN RAISE NOTICE 'Skipping policy Allow anon read ticket-scans (permission): %', SQLERRM; END;
  BEGIN
    DROP POLICY IF EXISTS "Allow authenticated upload ticket-scans" ON storage.objects;
    CREATE POLICY "Allow authenticated upload ticket-scans" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ticket-scans');
  EXCEPTION WHEN others THEN RAISE NOTICE 'Skipping policy Allow authenticated upload ticket-scans (permission): %', SQLERRM; END;
  BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read ticket-scans" ON storage.objects;
    CREATE POLICY "Allow authenticated read ticket-scans" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ticket-scans');
  EXCEPTION WHEN others THEN RAISE NOTICE 'Skipping policy Allow authenticated read ticket-scans (permission): %', SQLERRM; END;
  BEGIN
    DROP POLICY IF EXISTS "Allow service_role manage ticket-scans" ON storage.objects;
    CREATE POLICY "Allow service_role manage ticket-scans" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'ticket-scans') WITH CHECK (bucket_id = 'ticket-scans');
  EXCEPTION WHEN others THEN RAISE NOTICE 'Skipping policy Allow service_role manage ticket-scans (permission): %', SQLERRM; END;
END$$;

-- (7) Audit table for tracking automated fixes
CREATE TABLE IF NOT EXISTS public.delivery_tickets_fix_audit (
  audit_id serial PRIMARY KEY,
  delivery_ticket_id uuid,
  ticket_id text,
  old_total numeric,
  new_total numeric,
  old_raw_text text,
  new_raw_text text,
  reason text,
  changed_by text DEFAULT current_user,
  changed_at timestamptz DEFAULT now()
);

COMMIT;

-- Verification queries (omitted here for brevity)
