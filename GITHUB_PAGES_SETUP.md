# GitHub Pages Setup Guide

This guide will help you deploy the KPI Dashboard with the Nasdaq-style ticker to GitHub Pages with Supabase integration.

## Prerequisites

1. GitHub repository with Pages enabled
2. Supabase project with the following tables:
   - `service_jobs` (service tracking data)
   - `delivery_tickets` (delivery data)
3. Supabase anon key with Row Level Security (RLS) policies configured

## Step 1: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under **Source**, select:
   - Source: **GitHub Actions** (recommended) OR **Deploy from branch: gh-pages**
4. Save the settings

## Step 2: Configure Supabase Secrets

The ticker fetches data directly from Supabase on the client side. You need to configure your Supabase credentials as GitHub Secrets:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secrets:

   ```
   Name: VITE_SUPABASE_URL
   Value: https://your-project.supabase.co
   
   Name: VITE_SUPABASE_ANON_KEY
   Value: your-anon-key-here
   ```

   **Where to find these values:**
   - Go to your Supabase project dashboard
   - Click **Settings** → **API**
   - Copy **Project URL** → use as `VITE_SUPABASE_URL`
   - Copy **anon/public** key → use as `VITE_SUPABASE_ANON_KEY`

   ⚠️ **Important:** Only use the `anon` key (never the `service_role` key). The anon key is safe for client-side use when protected by RLS policies.

## Step 3: Configure Row Level Security (RLS)

Since the ticker runs client-side, you must protect your data with RLS policies:

### For `service_jobs` table:

```sql
-- Enable RLS
ALTER TABLE service_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to authenticated users
CREATE POLICY "Allow read access for authenticated users"
ON service_jobs FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow read access to anon users (for public dashboard)
-- Only if you want public access
CREATE POLICY "Allow public read access"
ON service_jobs FOR SELECT
TO anon
USING (true);
```

### For `delivery_tickets` table:

```sql
-- Enable RLS
ALTER TABLE delivery_tickets ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to authenticated users
CREATE POLICY "Allow read access for authenticated users"
ON delivery_tickets FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow read access to anon users (for public dashboard)
-- Only if you want public access
CREATE POLICY "Allow public read access"
ON delivery_tickets FOR SELECT
TO anon
USING (true);
```

## Step 4: Deploy to GitHub Pages

### Option A: Automatic Deployment (Recommended)

When you push to the `main` branch, GitHub Actions will automatically:
1. Build the project with Supabase credentials baked in
2. Deploy to GitHub Pages

Just merge your PR or push to main:
```bash
git push origin main
```

### Option B: Manual Deployment

Trigger the workflow manually:
1. Go to **Actions** tab in GitHub
2. Select "Deploy to GitHub Pages" workflow
3. Click **Run workflow** → **Run workflow**

## Step 5: Verify Deployment

1. Go to **Settings** → **Pages** to find your GitHub Pages URL
2. It will be something like: `https://yourusername.github.io/KPI-Dashboard/`
3. Navigate to the Billboard page: `https://yourusername.github.io/KPI-Dashboard/#/billboard`
4. The ticker should display at the top with data from your Supabase tables

## Troubleshooting

### Ticker shows "Sample data - Configure Supabase in Settings"

**Cause:** Supabase credentials are not configured or RLS policies are blocking access.

**Solutions:**
1. Verify secrets are set correctly in GitHub (Step 2)
2. Re-run the GitHub Actions workflow to rebuild with the secrets
3. Check RLS policies in Supabase (Step 3)
4. Open browser console (F12) and check for errors

### Ticker is not scrolling smoothly

**Cause:** The `react-fast-marquee` library may not be installed.

**Solution:**
```bash
npm install react-fast-marquee
```

### Data is not loading from Supabase

**Causes & Solutions:**

1. **Invalid credentials:**
   - Double-check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` secrets
   - Make sure there are no extra spaces or quotes

2. **RLS blocking access:**
   - Run the RLS policy SQL commands from Step 3
   - If you want public access, use the "anon" policies
   - If you want authenticated-only access, users must sign in first

3. **No data in tables:**
   - Verify `service_jobs` table has records with:
     - `job_date` (date field)
     - `status` (e.g., "completed", "scheduled")
     - `job_amount` (numeric)
   - Verify `delivery_tickets` table has records with:
     - `date` (date field)
     - `qty` (gallons, numeric)
     - `amount` (revenue, numeric)
     - `status` (not "void" or "canceled")

4. **CORS issues:**
   - Supabase should handle CORS automatically
   - If you see CORS errors, check your Supabase project settings

### Check the logs

1. **GitHub Actions logs:**
   - Go to **Actions** tab
   - Click on the latest workflow run
   - Check build logs for errors

2. **Browser console:**
   - Open your deployed site
   - Press F12 to open Developer Tools
   - Check Console tab for JavaScript errors
   - Look for messages starting with `[BillboardTopTicker]`

## How It Works

The Billboard ticker is designed for GitHub Pages (static hosting):

1. **Build time:** 
   - Vite build process reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment variables
   - These are baked into the JavaScript bundle

2. **Runtime:**
   - The ticker component (`BillboardTopTicker.jsx`) loads in the browser
   - It uses the Supabase JS client to query data directly from Supabase
   - No server-side API needed - everything runs client-side
   - Data is fetched using the `getBillboardSummary()` function from `fetchMetricsClient.js`

3. **Data flow:**
   ```
   Browser → Supabase Client → Supabase Database → RLS Check → Return Data → Display in Ticker
   ```

## What Data is Displayed

The ticker shows current week metrics from your operations:

- **Total Revenue:** Combined service + delivery revenue with % change vs last week
- **Service Revenue:** Revenue from completed service jobs
- **Delivery Revenue:** Revenue from delivery tickets
- **Delivery Tickets:** Count of delivery tickets
- **Gallons:** Total gallons delivered
- **Completed Jobs:** Count of completed service jobs
- **Scheduled Jobs:** Count of scheduled service jobs

All data is fetched from your Supabase `service_jobs` and `delivery_tickets` tables in real-time.

## Need Help?

1. Check the browser console for detailed error messages
2. Verify your Supabase credentials in GitHub Secrets
3. Ensure RLS policies are configured correctly
4. Make sure your tables have data for the current week
