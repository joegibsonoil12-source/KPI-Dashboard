# Supabase Setup Guide - Getting Live Data Working

## Current Status

✅ **Code is Ready**: The application is fully connected to Supabase and will display live data once:
1. The database views are created
2. The tables have data in them

## Your Supabase Project

- **Project ID**: `jskajkwulaaakhaolzdu`
- **Project URL**: `https://jskajkwulaaakhaolzdu.supabase.co`
- **Required Tables**: `service_jobs`, `delivery_tickets`

## Steps to Get Live Data Working

### Option 1: Run Migrations via GitHub Actions (Recommended)

1. **Trigger the Migration Workflow**:
   - Go to: https://github.com/joegibsonoil12-source/KPI-Dashboard/actions/workflows/supabase-push.yml
   - Click "Run workflow"
   - This will apply all migrations in `supabase/migrations/`

2. **Verify the Views Were Created**:
   - Go to your Supabase Dashboard: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu
   - Go to SQL Editor
   - Run this query:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_type = 'VIEW'
   ORDER BY table_name;
   ```
   - You should see: `service_jobs_daily`, `service_jobs_weekly`, `service_jobs_monthly`, `delivery_tickets_daily`, `delivery_tickets_weekly`, `delivery_tickets_monthly`

### Option 2: Run Migrations Manually in Supabase SQL Editor

1. **Go to Supabase SQL Editor**:
   - Navigate to: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/sql/new

2. **Copy and Run This SQL**:
   ```sql
   -- Service jobs daily
   CREATE OR REPLACE VIEW public.service_jobs_daily AS
   SELECT
     job_date::date AS day,
     COUNT(*)::int AS job_count,
     SUM(COALESCE(job_amount::numeric, 0))::numeric AS revenue
   FROM public.service_jobs
   WHERE (status IS NULL OR status NOT ILIKE '%cancel%') AND status ILIKE '%completed%'
   GROUP BY day
   ORDER BY day;

   -- Service jobs weekly (week starting Monday)
   CREATE OR REPLACE VIEW public.service_jobs_weekly AS
   SELECT
     (date_trunc('week', job_date::timestamp)::date + INTERVAL '1 day')::date AS week_start,
     COUNT(*)::int AS job_count,
     SUM(COALESCE(job_amount::numeric, 0))::numeric AS revenue
   FROM public.service_jobs
   WHERE (status IS NULL OR status NOT ILIKE '%cancel%') AND status ILIKE '%completed%'
   GROUP BY week_start
   ORDER BY week_start;

   -- Service jobs monthly
   CREATE OR REPLACE VIEW public.service_jobs_monthly AS
   SELECT
     date_trunc('month', job_date::timestamp)::date AS month_start,
     COUNT(*)::int AS job_count,
     SUM(COALESCE(job_amount::numeric, 0))::numeric AS revenue
   FROM public.service_jobs
   WHERE (status IS NULL OR status NOT ILIKE '%cancel%') AND status ILIKE '%completed%'
   GROUP BY month_start
   ORDER BY month_start;

   -- Delivery tickets daily
   CREATE OR REPLACE VIEW public.delivery_tickets_daily AS
   SELECT
     date::date AS day,
     COUNT(*)::int AS ticket_count,
     SUM(COALESCE(qty::numeric, 0))::numeric AS total_gallons,
     SUM(COALESCE(amount::numeric, 0))::numeric AS revenue
   FROM public.delivery_tickets
   WHERE (status IS NULL OR (status NOT ILIKE '%void%' AND status NOT ILIKE '%cancel%'))
   GROUP BY day
   ORDER BY day;

   -- Delivery tickets weekly
   CREATE OR REPLACE VIEW public.delivery_tickets_weekly AS
   SELECT
     (date_trunc('week', date::timestamp)::date + INTERVAL '1 day')::date AS week_start,
     COUNT(*)::int AS ticket_count,
     SUM(COALESCE(qty::numeric, 0))::numeric AS total_gallons,
     SUM(COALESCE(amount::numeric, 0))::numeric AS revenue
   FROM public.delivery_tickets
   WHERE (status IS NULL OR (status NOT ILIKE '%void%' AND status NOT ILIKE '%cancel%'))
   GROUP BY week_start
   ORDER BY week_start;

   -- Delivery tickets monthly
   CREATE OR REPLACE VIEW public.delivery_tickets_monthly AS
   SELECT
     date_trunc('month', date::timestamp)::date AS month_start,
     COUNT(*)::int AS ticket_count,
     SUM(COALESCE(qty::numeric, 0))::numeric AS total_gallons,
     SUM(COALESCE(amount::numeric, 0))::numeric AS revenue
   FROM public.delivery_tickets
   WHERE (status IS NULL OR (status NOT ILIKE '%void%' AND status NOT ILIKE '%cancel%'))
   GROUP BY month_start
   ORDER BY month_start;
   ```

3. **Click "Run"** to create all the views

## Checking If You Have Data

### Check Service Jobs Table

Run this in Supabase SQL Editor:
```sql
SELECT COUNT(*) as total_jobs,
       COUNT(CASE WHEN status ILIKE '%completed%' THEN 1 END) as completed,
       COUNT(CASE WHEN status ILIKE '%scheduled%' THEN 1 END) as scheduled,
       MIN(job_date) as earliest_job,
       MAX(job_date) as latest_job
FROM service_jobs;
```

### Check Delivery Tickets Table

```sql
SELECT COUNT(*) as total_tickets,
       MIN(date) as earliest_ticket,
       MAX(date) as latest_ticket,
       SUM(qty) as total_gallons,
       SUM(amount) as total_revenue
FROM delivery_tickets
WHERE (status IS NULL OR (status NOT ILIKE '%void%' AND status NOT ILIKE '%cancel%'));
```

### If Tables Don't Exist

If you get an error that tables don't exist, you need to:

1. **Create the tables first** (if they don't exist):
   ```sql
   -- Service jobs table
   CREATE TABLE IF NOT EXISTS service_jobs (
     id SERIAL PRIMARY KEY,
     job_date DATE NOT NULL,
     status TEXT,
     job_amount NUMERIC(10,2),
     customer_name TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Delivery tickets table
   CREATE TABLE IF NOT EXISTS delivery_tickets (
     id SERIAL PRIMARY KEY,
     date DATE NOT NULL,
     status TEXT,
     qty NUMERIC(10,2),
     amount NUMERIC(10,2),
     customer_name TEXT,
     product TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

2. **Set up Row Level Security (RLS)** to allow anonymous access for reading:
   ```sql
   -- Enable RLS
   ALTER TABLE service_jobs ENABLE ROW LEVEL SECURITY;
   ALTER TABLE delivery_tickets ENABLE ROW LEVEL SECURITY;

   -- Allow anonymous read access
   CREATE POLICY "Allow anonymous read access on service_jobs"
   ON service_jobs FOR SELECT
   TO anon
   USING (true);

   CREATE POLICY "Allow anonymous read access on delivery_tickets"
   ON delivery_tickets FOR SELECT
   TO anon
   USING (true);

   -- Allow authenticated users to read
   CREATE POLICY "Allow authenticated read access on service_jobs"
   ON service_jobs FOR SELECT
   TO authenticated
   USING (true);

   CREATE POLICY "Allow authenticated read access on delivery_tickets"
   ON delivery_tickets FOR SELECT
   TO authenticated
   USING (true);
   ```

## Adding Sample Data (For Testing)

If you want to test with sample data, run this in SQL Editor:

```sql
-- Insert sample service jobs
INSERT INTO service_jobs (job_date, status, job_amount, customer_name) VALUES
  (CURRENT_DATE, 'completed', 1500.00, 'ABC Company'),
  (CURRENT_DATE, 'completed', 2300.00, 'XYZ Corp'),
  (CURRENT_DATE - 1, 'completed', 1800.00, 'Smith LLC'),
  (CURRENT_DATE - 1, 'scheduled', 2500.00, 'Jones Inc'),
  (CURRENT_DATE - 2, 'completed', 3200.00, 'Brown Enterprises'),
  (CURRENT_DATE - 7, 'completed', 1900.00, 'Green Co'),
  (CURRENT_DATE - 7, 'completed', 2100.00, 'Blue Industries');

-- Insert sample delivery tickets
INSERT INTO delivery_tickets (date, status, qty, amount, customer_name, product) VALUES
  (CURRENT_DATE, 'delivered', 500.5, 2250.00, 'ABC Company', 'Propane'),
  (CURRENT_DATE, 'delivered', 750.0, 3375.00, 'XYZ Corp', 'Propane'),
  (CURRENT_DATE - 1, 'delivered', 620.0, 2790.00, 'Smith LLC', 'Propane'),
  (CURRENT_DATE - 1, 'scheduled', 800.0, 3600.00, 'Jones Inc', 'Propane'),
  (CURRENT_DATE - 2, 'delivered', 900.5, 4052.25, 'Brown Enterprises', 'Propane'),
  (CURRENT_DATE - 7, 'delivered', 550.0, 2475.00, 'Green Co', 'Propane'),
  (CURRENT_DATE - 7, 'delivered', 680.0, 3060.00, 'Blue Industries', 'Propane');
```

## Verifying the Site Connection

1. **Check the live site**: https://joegibsonoil12-source.github.io/KPI-Dashboard/billboard
2. **Open browser console** (F12)
3. **Look for the debug log**: You should see `📊 Billboard Data Fetch:` with actual data
4. **If you see mock data in the console**, it means:
   - Either the Supabase connection isn't configured
   - Or the tables are empty
   - Or RLS policies are blocking access

## Environment Variables (Already Set)

These are configured in GitHub Actions secrets:
- ✅ `VITE_SUPABASE_URL` - Set in GitHub workflow
- ✅ `VITE_SUPABASE_ANON_KEY` - Set in GitHub workflow

## What the Code Does Now

1. **Billboard Page** (`/billboard`):
   - Fetches from `service_jobs_daily` and `delivery_tickets_daily` views
   - Falls back to direct table queries if views don't exist
   - Shows live service and delivery metrics
   - Auto-refreshes every 30 seconds

2. **Dashboard** (`/dashboard`):
   - Queries `service_jobs` table directly
   - Queries `delivery_tickets` table directly
   - Shows charts and metrics

3. **All queries use the anon key** - so RLS policies must allow reading for anonymous users

## Troubleshooting

### If you see 400 errors in console:
- Check that RLS policies exist and allow anonymous read access
- Verify tables exist: `SELECT * FROM service_jobs LIMIT 1;`

### If you see "Loading..." forever:
- Check browser console for errors
- Verify Supabase URL and anon key are correct in GitHub secrets

### If you see zeros/empty charts:
- Tables might be empty - add data or use sample data above
- Check table structure matches what code expects

## Next Steps

After migrations are applied and tables have data:
1. Merge this PR to main
2. GitHub Pages will deploy automatically
3. Site will show live data from Supabase
4. Billboard will auto-refresh every 30 seconds

## Need Help?

If you run into issues:
1. Check Supabase logs: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/logs
2. Check GitHub Actions logs for deployment
3. Check browser console for client-side errors
