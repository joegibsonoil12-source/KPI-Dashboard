-- Full replacement SQL that avoids uuid_generate_v4() by using gen_random_uuid() only.
-- WARNING: drops/recreates many objects. Run in development/test only.
SET search_path = public;

-- 0) Basic check
SELECT 1 AS ok;

-- 1) Extensions: use pgcrypto (gen_random_uuid). uuid-ossp not required.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- If you really need uuid-ossp, you can enable it, but many managed Postgres (including Supabase) use gen_random_uuid().
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2) Defensive cleanup: remove RLS policies on procedures to avoid references to missing columns
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, schemaname, tablename
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'procedures'
  LOOP
    RAISE NOTICE 'Dropping policy % on %.%', r.policyname, r.schemaname, r.tablename;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END$$;

-- 3) Defensive cleanup: drop non-internal triggers on procedures (if any)
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'public.procedures'::regclass
      AND NOT tgisinternal
  LOOP
    RAISE NOTICE 'Dropping trigger % on public.procedures', t.tgname;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.procedures;', t.tgname);
  END LOOP;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'procedures table not found; skipping trigger cleanup';
END$$;

-- 4) (Optional) Drop the procedures table so we recreate it cleanly
DROP TABLE IF EXISTS public.procedures CASCADE;

-- 5) Recreate core schema (uses gen_random_uuid() everywhere)
-- Note: you can remove any DROP TABLE lines you don't want to run.
DROP TABLE IF EXISTS invoice_items, payments, invoices, deliveries, jobs, tank_readings, tanks, addresses, customers, employees, products, expenses CASCADE;

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  address_line text,
  city text,
  state text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz DEFAULT now(),
  is_primary boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS tanks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  address_id uuid REFERENCES addresses(id) ON DELETE SET NULL,
  capacity_gallons numeric,
  installed_at timestamptz,
  sensor_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tank_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id uuid REFERENCES tanks(id) ON DELETE CASCADE,
  reading_ts timestamptz NOT NULL DEFAULT now(),
  pct_full numeric,
  gallons_estimate numeric,
  battery_level numeric,
  raw_payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text,
  name text NOT NULL,
  unit text NOT NULL,
  price numeric NOT NULL,
  cost numeric,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text,
  customer_id uuid REFERENCES customers(id),
  address_id uuid REFERENCES addresses(id),
  tank_id uuid REFERENCES tanks(id),
  assigned_to uuid,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  status text,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  driver_id uuid,
  delivered_gallons numeric,
  start_ts timestamptz,
  end_ts timestamptz,
  distance_miles numeric,
  on_time boolean,
  cost numeric,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text,
  customer_id uuid REFERENCES customers(id),
  issued_at timestamptz DEFAULT now(),
  due_at timestamptz,
  total_amount numeric,
  status text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  qty numeric DEFAULT 1,
  unit_price numeric,
  line_total numeric,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  payment_ts timestamptz DEFAULT now(),
  amount numeric,
  method text,
  provider_ref text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  name text,
  role text,
  phone text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text,
  amount numeric,
  occurred_at timestamptz DEFAULT now(),
  note text,
  created_at timestamptz DEFAULT now()
);

-- 6) Create procedures table WITHOUT user_id, using gen_random_uuid()
CREATE TABLE IF NOT EXISTS public.procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_job ON deliveries(job_id);
CREATE INDEX IF NOT EXISTS idx_tank_readings_tank_time ON tank_readings(tank_id, reading_ts);

-- 7) Recreate views (safe: uses existing tables)
CREATE OR REPLACE VIEW revenue_mtd AS
SELECT
  date_trunc('month', paid.payment_ts)::date AS month,
  SUM(paid.amount) AS revenue_mtd
FROM payments paid
WHERE paid.payment_ts >= date_trunc('month', now())
GROUP BY 1;

CREATE OR REPLACE VIEW revenue_ytd AS
SELECT
  date_trunc('year', paid.payment_ts)::date AS year,
  SUM(paid.amount) AS revenue_ytd
FROM payments paid
WHERE paid.payment_ts >= date_trunc('year', now())
GROUP BY 1;

CREATE OR REPLACE VIEW avg_order_value_mtd AS
SELECT
  date_trunc('month', i.issued_at)::date AS month,
  AVG(i.total_amount) AS avg_invoice
FROM invoices i
WHERE i.issued_at >= date_trunc('month', now())
GROUP BY 1;

CREATE OR REPLACE VIEW gallons_sold_mtd AS
SELECT
  date_trunc('month', d.end_ts)::date AS month,
  SUM(d.delivered_gallons) AS gallons_month
FROM deliveries d
WHERE d.end_ts >= date_trunc('month', now())
GROUP BY 1;

CREATE OR REPLACE VIEW deliveries_on_time_pct_mtd AS
SELECT
  date_trunc('month', d.end_ts)::date AS month,
  COUNT(*) FILTER (WHERE d.on_time) * 100.0 / NULLIF(COUNT(*),0) AS pct_on_time,
  COUNT(*) AS total_deliveries
FROM deliveries d
WHERE d.end_ts >= date_trunc('month', now())
GROUP BY 1;

CREATE OR REPLACE VIEW cost_per_delivery_mtd AS
SELECT
  date_trunc('month', d.end_ts)::date AS month,
  AVG(d.cost) AS avg_cost,
  AVG(d.distance_miles) AS avg_distance,
  SUM(d.cost) AS total_delivery_cost
FROM deliveries d
WHERE d.end_ts >= date_trunc('month', now())
GROUP BY 1;

CREATE OR REPLACE VIEW outstanding_receivables AS
SELECT
  SUM(i.total_amount) FILTER (WHERE i.status IN ('sent','overdue','partial')) - COALESCE(SUM(p.amount),0) AS outstanding
FROM invoices i
LEFT JOIN payments p ON p.invoice_id = i.id;

CREATE OR REPLACE VIEW avg_daily_sales_90 AS
SELECT
  (SUM(p.amount) / 90.0) AS avg_daily
FROM payments p
WHERE p.payment_ts >= now() - interval '90 days';

-- 8) Add procedure_videos table for video management
CREATE TABLE IF NOT EXISTS procedure_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id uuid REFERENCES procedures(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 9) Demo seed data
INSERT INTO customers (id, name, email, phone) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Acme Corp', 'contact@acme.com', '555-0101'),
  ('22222222-2222-2222-2222-222222222222', 'Smith Residence', 'john@smith.com', '555-0102'),
  ('33333333-3333-3333-3333-333333333333', 'Jones Farm', 'mary@jones.com', '555-0103')
ON CONFLICT (id) DO NOTHING;

INSERT INTO addresses (customer_id, address_line, city, state, postal_code, latitude, longitude) VALUES 
  ('11111111-1111-1111-1111-111111111111', '123 Business Ave', 'Commerce City', 'CO', '80022', 39.8083, -104.9342),
  ('22222222-2222-2222-2222-222222222222', '456 Oak Street', 'Denver', 'CO', '80202', 39.7392, -104.9903),
  ('33333333-3333-3333-3333-333333333333', '789 Farm Road', 'Brighton', 'CO', '80601', 39.9853, -104.8206);

INSERT INTO products (sku, name, unit, price, cost) VALUES 
  ('PROP-500', 'Propane 500gal', 'gallon', 2.89, 2.15),
  ('TANK-120', 'Tank Installation 120gal', 'each', 450.00, 320.00),
  ('SERVICE-MAINT', 'Tank Maintenance', 'hour', 85.00, 65.00);

-- Sample tanks
INSERT INTO tanks (customer_id, capacity_gallons, sensor_id) VALUES 
  ('11111111-1111-1111-1111-111111111111', 500, 'SENSOR_001'),
  ('22222222-2222-2222-2222-222222222222', 120, 'SENSOR_002'),
  ('33333333-3333-3333-3333-333333333333', 1000, 'SENSOR_003');

-- Sample jobs and deliveries for the current month
INSERT INTO jobs (job_number, customer_id, scheduled_at, status) VALUES 
  ('JOB-2024-001', '11111111-1111-1111-1111-111111111111', date_trunc('month', now()) + interval '5 days', 'completed'),
  ('JOB-2024-002', '22222222-2222-2222-2222-222222222222', date_trunc('month', now()) + interval '10 days', 'completed'),
  ('JOB-2024-003', '33333333-3333-3333-3333-333333333333', date_trunc('month', now()) + interval '15 days', 'scheduled');

INSERT INTO deliveries (job_id, delivered_gallons, start_ts, end_ts, distance_miles, on_time, cost)
SELECT 
  j.id,
  CASE 
    WHEN j.job_number = 'JOB-2024-001' THEN 450
    WHEN j.job_number = 'JOB-2024-002' THEN 95
    ELSE 850
  END,
  j.scheduled_at,
  j.scheduled_at + interval '2 hours',
  CASE 
    WHEN j.job_number = 'JOB-2024-001' THEN 12.5
    WHEN j.job_number = 'JOB-2024-002' THEN 8.3
    ELSE 22.1
  END,
  true,
  CASE 
    WHEN j.job_number = 'JOB-2024-001' THEN 185.50
    WHEN j.job_number = 'JOB-2024-002' THEN 125.75
    ELSE 295.80
  END
FROM jobs j 
WHERE j.status = 'completed';

-- Sample invoices and payments
INSERT INTO invoices (invoice_number, customer_id, issued_at, total_amount, status) VALUES 
  ('INV-2024-001', '11111111-1111-1111-1111-111111111111', date_trunc('month', now()) + interval '5 days', 1300.50, 'paid'),
  ('INV-2024-002', '22222222-2222-2222-2222-222222222222', date_trunc('month', now()) + interval '10 days', 274.55, 'paid'),
  ('INV-2024-003', '33333333-3333-3333-3333-333333333333', date_trunc('month', now()) + interval '15 days', 2456.50, 'sent');

INSERT INTO payments (invoice_id, payment_ts, amount, method)
SELECT 
  i.id,
  i.issued_at + interval '7 days',
  i.total_amount,
  'credit_card'
FROM invoices i 
WHERE i.status = 'paid';

-- Sample employees
INSERT INTO employees (name, role, phone) VALUES 
  ('Admin User', 'admin', '555-0001'),
  ('Driver Joe', 'driver', '555-0002'),
  ('Tech Sarah', 'technician', '555-0003');

-- Sample expenses for the current month
INSERT INTO expenses (category, amount, occurred_at, note) VALUES 
  ('Fuel', 245.67, date_trunc('month', now()) + interval '3 days', 'Truck fuel'),
  ('Maintenance', 125.00, date_trunc('month', now()) + interval '8 days', 'Vehicle maintenance'),
  ('Equipment', 89.50, date_trunc('month', now()) + interval '12 days', 'Tools and supplies');

-- 10) Set up RLS policies for procedures
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to insert procedures" 
ON procedures 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read procedures" 
ON procedures 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to update procedures" 
ON procedures 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete procedures" 
ON procedures 
FOR DELETE 
TO authenticated 
USING (true);

-- RLS for procedure_videos
ALTER TABLE procedure_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage procedure videos" 
ON procedure_videos 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Success message
SELECT 'KPI Dashboard schema and demo data created successfully!' AS result;