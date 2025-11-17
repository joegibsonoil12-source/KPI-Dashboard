# KPI Dashboard — GitHub Pages (React + Vite)

Upload these files to your repo root. The GitHub Actions workflow will build and publish automatically to GitHub Pages.

## GitHub Pages + Supabase Setup

This application is designed to run on GitHub Pages with client-side Supabase integration. No server-side deployment (like Vercel) is required.

### Required GitHub Secrets

Set these secrets in your GitHub repository settings (`Settings > Secrets and variables > Actions`):

#### For GitHub Pages Deployment:
- `VITE_SUPABASE_URL`: Your Supabase project URL (e.g., `https://jskajkwulaaakhaolzdu.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous/public key

#### For CI/CD Database Migrations:
- `SUPABASE_ACCESS_TOKEN`: Personal access token for Supabase CLI ([Get it here](https://supabase.com/dashboard/account/tokens))
- `SUPABASE_PROJECT_REF`: Your project reference ID (20-char ID from your Supabase URL, e.g., `jskajkwulaaakhaolzdu`)
- `SUPABASE_DB_URL`: PostgreSQL connection string (optional, for psql-based migrations)

**📚 For detailed setup instructions, see [docs/CI_SUPABASE.md](docs/CI_SUPABASE.md)**

These secrets are automatically injected during the GitHub Actions build and deployment process.

### Security & Network Configuration

⚠️ **Important**: Supabase database connections from GitHub Actions require network allowlist configuration.

**Option 1: Allow GitHub Actions IPs (Recommended)**
1. Go to [Supabase Dashboard → Database → Network Restrictions](https://supabase.com/dashboard/project/_/settings/database)
2. Add `0.0.0.0/0` to allow all IPs (or specific GitHub Actions IP ranges)

**Option 2: Self-Hosted Runner**
- Use a self-hosted runner with static IP
- Add the static IP to Supabase allowlist
- More secure for enterprise deployments

**Auth Schema Migrations**:
- Migrations that modify the `auth` schema (e.g., `auth.users`, `auth.identities`) **must** be run manually via Supabase SQL Editor
- These require superuser privileges and cannot run via CI workflows
- Store such migrations in `sql/ADMIN_ONLY/` directory
- See [QUICKSTART_AUTH_RESTORE.md](QUICKSTART_AUTH_RESTORE.md) for auth setup instructions

### Database Setup

After creating your Supabase project, run the migration file to create the required views:

1. Go to Supabase SQL Editor
2. Run the migration: `migrations/001_create_metrics_views.sql`

This creates daily, weekly, and monthly aggregation views for service jobs and delivery tickets that power the Billboard and Graphs features.

**Note:** The application includes automatic fallback behavior if views are not present. If the views are missing, the Graphs page will display a warning and aggregate data from base tables in real-time. For best performance, run the migration. See [migrations/README.md](migrations/README.md) for detailed instructions.

### Row-Level Security (RLS)

The migration automatically enables RLS and creates policies to allow anonymous read access to the aggregated views. If you need to adjust security:

- Views are read-only and safe for anonymous access
- Modify policies in the migration file if stricter security is needed
- For production, consider implementing authentication-based policies

## Features

### Video Management
The dashboard includes video management functionality through the **Procedures** tab only. The standalone Videos tab has been removed from the application. Video management features include:

- **Procedure-integrated videos**: Add training videos directly to specific procedures
- **URL-based videos**: Add external video links (YouTube, Vimeo, Loom, etc.)
- **File uploads**: Upload video files directly through the Procedures tab (requires Supabase configuration)
- **Embedded video players**: YouTube, Vimeo, and Loom videos are automatically embedded
- **Supabase integration**: Videos are stored and managed through Supabase with the procedures they belong to

**Note**: Video management is now exclusively available through the Procedures tab. The standalone Videos tab has been removed to consolidate video management with procedure documentation.

To configure Supabase uploads, ensure your Supabase client is properly configured and you have a public storage bucket named 'videos'.

## Supabase Configuration

### Row-Level Security (RLS) for Procedures Table

The application requires proper Supabase Row-Level Security (RLS) configuration for the procedures table to function correctly. Without proper RLS policies, users may encounter permission errors when trying to add procedures.

#### Required Database Setup

1. **Enable RLS on the procedures table:**
```sql
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;
```

2. **Create a policy to allow authenticated users to insert procedures:**
```sql
CREATE POLICY "Allow authenticated users to insert procedures" 
ON procedures 
FOR INSERT 
TO authenticated 
WITH CHECK (true);
```

3. **Create a policy to allow authenticated users to read procedures:**
```sql
CREATE POLICY "Allow authenticated users to read procedures" 
ON procedures 
FOR SELECT 
TO authenticated 
USING (true);
```

4. **Create a policy to allow authenticated users to update their procedures:**
```sql
CREATE POLICY "Allow authenticated users to update procedures" 
ON procedures 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);
```

5. **Create a policy to allow authenticated users to delete procedures:**
```sql
CREATE POLICY "Allow authenticated users to delete procedures" 
ON procedures 
FOR DELETE 
TO authenticated 
USING (true);
```

#### Similar setup for procedure_videos table:
```sql
ALTER TABLE procedure_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage procedure videos" 
ON procedure_videos 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
```

### Troubleshooting Common Supabase Permission Errors

#### Error: "new row violates row-level security policy"
**Cause:** RLS is enabled but no INSERT policy exists for the current user role.
**Solution:** 
- Ensure you have created the INSERT policy shown above
- Verify the user is authenticated (check `supabase.auth.getUser()`)
- Check that the policy conditions match your use case

#### Error: "permission denied for table procedures"
**Cause:** RLS is not properly configured or user lacks table permissions.
**Solution:**
- Enable RLS on the table: `ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;`
- Create appropriate policies for SELECT, INSERT, UPDATE, DELETE operations
- Ensure your Supabase service role has proper permissions

#### Error: "Failed to add procedure: [supabase error]"
**Cause:** Various Supabase configuration issues.
**Solution:**
- Check browser console for detailed error messages
- Verify Supabase URL and anon key in environment variables
- Test database connection using Supabase dashboard
- Ensure the procedures table exists with correct schema

#### Error: Video upload failures
**Cause:** Storage bucket not configured or RLS issues.
**Solution:**
- Create a public storage bucket named 'videos'
- Configure storage RLS policies if needed
- Verify storage URL configuration

#### General debugging steps:
1. Open browser developer tools and check console for errors
2. Verify authentication status in the application
3. Test queries directly in Supabase SQL editor
4. Check RLS policies in Supabase dashboard under Authentication > Policies
5. Ensure environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are correctly set

## Service Tracking

The Service Tracking feature allows you to import Housecall Pro service job reports and track job status, revenue, and technician assignments.

### Database Setup

Apply the Service Tracking migration:
```
sql/2025-10-16_service_tracking.sql
```

This migration:
- Creates the `service_jobs` table with all required fields
- Sets up RLS policies (SELECT for authenticated, INSERT/UPDATE/DELETE for owner or admin/manager)
- Creates unique constraint on `(created_by, job_number)` for deduplication
- Adds indexes for performance
- Creates views for per-tech and daily/monthly metrics rollups
- Is idempotent and safe to re-run multiple times

### Features

- **Housecall Pro Import**: Upload CSV or XLSX files from Housecall Pro
- **Robust Parsing**: 
  - Handles Excel-quoted numbers (="678")
  - Normalizes headers with BOM/NBSP/quote removal
  - Parses currency correctly ($1,234.56 → 1234.56)
  - Maps status variants (Pending → scheduled, Pro canceled → canceled)
- **Smart Deduplication**: Re-uploads update existing jobs by (user, job_number)
- **Preview Before Import**: Review parsed data with summary statistics
- **Color-Coded Status**: completed (green), scheduled (blue), in_progress (orange), unscheduled (gray), canceled (red)
- **Filtering**: By date range, technician, and status
- **Summary Analytics**: Revenue and job counts by status

### Usage

1. Click **Upload Report** button
2. Select a Housecall Pro CSV or XLSX export
3. Review the preview with parsed data and summary statistics
4. Click **Import to Database** to save jobs
5. Use filters to analyze by date, tech, or status
6. Click **🔄 Reload** to manually refresh saved jobs from database

## Delivery Tickets Tracking

The Delivery Tickets feature has been enhanced with comprehensive tracking capabilities:

### New Features

- **Ticket ID tracking**: Reference external ticket numbers
- **Gallons Delivered**: Track exact gallons delivered per ticket
- **Time Windows**: Record scheduled delivery windows, arrival, and departure times
- **Odometer Tracking**: Log starting and ending odometer readings
- **Computed Metrics**:
  - **Miles Driven**: Automatically calculated from odometer readings
  - **On-Time Flag**: Auto-computed based on arrival vs. scheduled time (5-minute grace period)
- **Summary Dashboard**: Real-time metrics showing:
  - Total Gallons Delivered
  - Average Miles per Ticket
  - On-Time Delivery Percentage
- **Full-Scope Metrics**: Summary/Analytics reflect ALL filtered tickets across all pages, not just the current page
- **Pagination**: Table displays 15 rows per page for clean, focused viewing

### Database Migration

Apply the tracking enhancement migration:
```
sql/2025-10-16_extend_delivery_tickets_tracking.sql
```

This migration:
- Adds 9 new columns to delivery_tickets table
- Creates performance indexes
- Is idempotent and safe to re-run
- Performs no destructive operations
- See `sql/README.md` for detailed documentation

### On-Time Calculation

A delivery is marked "on time" (✅) if:
```
arrival_time <= scheduled_window_start + 5 minutes
```

Otherwise, it's marked as late (⏱️).

## Local dev
```bash
npm install
npm run dev
```

## Deployment

### GitHub Pages (Automatic via CI)
This repository is configured to automatically build and deploy to GitHub Pages whenever changes are pushed to the `main` branch. The GitHub Actions workflow (`.github/workflows/gh-pages-deploy.yml`) handles the build and deployment process, including creating a 404.html fallback for SPA routing.

**Manual Trigger**: You can also manually trigger a deployment from the Actions tab in GitHub by running the "Build and Deploy to GitHub Pages" workflow.

### Local Deployment to GitHub Pages
To manually deploy from your local machine:
```bash
npm run build    # Builds the site and creates dist/404.html fallback
npm run deploy   # Deploys dist/ to gh-pages branch using gh-pages CLI
```

The `postbuild` script automatically copies `dist/index.html` to `dist/404.html` to enable SPA routing for direct links like `/billboard`.

**Note**: GitHub Pages serves the site from the `/KPI-Dashboard/` subpath. The Billboard component includes logic to open the Vercel-hosted version when the "Pop Out TV" button is clicked on the GitHub Pages deployment.

## Fuel Budgets & Roles Migration

A new additive migration file is provided at:
```
sql/2025-10-16_safe_roles_permissions_extension.sql
```

Apply it in the Supabase SQL Editor (copy/paste entire file). It is idempotent and safe to re-run.

### Verification

After applying the migration, verify the setup:
```sql
SELECT system_health_summary();
```

### Objects Created (only if missing)

The migration creates the following objects conditionally:

- **app_roles table** - User role assignments (admin, manager, editor, viewer)
- **audit_log table** - Audit trail for delivery_tickets changes
- **Audit triggers** - Automatic logging of INSERT/UPDATE/DELETE on delivery_tickets
- **dim_product table** - Product dimension with baseline seeds (PROPANE, OFF_DIESEL, HWY_DIESEL, FUEL_OIL_2, UNLEADED)
- **mapping_ticket_product table** - Maps raw product names to normalized products
- **fuel_budgets table** - Monthly fuel budgets by store and product with RLS enabled
- **Views**:
  - `ticket_products_normalized` - Delivery tickets with normalized product names
  - `view_ticket_metrics_monthly` - Monthly aggregated ticket metrics
  - `fuel_budget_vs_actual` - Budget vs actual comparison with variance calculations
- **RLS Policies**:
  - fuel_budgets: SELECT (all), INSERT (admin/manager), UPDATE (admin/manager/owner), DELETE (admin only)
  - delivery_tickets: SELECT (all), INSERT (role-based), UPDATE (role/owner), DELETE (admin/manager)
- **Function**: `system_health_summary()` - Returns JSON snapshot of system status

### No Destructive Operations

This migration performs **no destructive operations**:
- No DROP TABLE or TRUNCATE
- No ALTER TABLE DROP COLUMN
- No data deletion
- All changes are additive and backward compatible

## Applying Migrations via GitHub Actions

Add secret `SUPABASE_DB_URL` (Postgres connection string) in repository settings. Then run the "Apply Supabase Migrations" workflow (Actions > Apply Supabase Migrations > Run workflow). Provide a specific `migration_file` for a single file or leave blank to apply all. The workflow blocks if it detects potentially destructive `DROP TABLE` or `ALTER TABLE ... DROP` statements.

## Environment Variables

### Supabase Configuration (Client-side)

These environment variables are required for the client-side Supabase connection:

- `VITE_SUPABASE_URL` - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key (safe for client-side use with RLS enabled)

**Note:** These are set at build time for static hosting. For development, create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Supabase Configuration (Server-side)

**For serverless function deployments only** (Vercel, Netlify, etc.):

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (server-side only, bypasses RLS)

**⚠️ IMPORTANT:** Never commit `SUPABASE_SERVICE_ROLE_KEY` to source code. Set it as a secret in your deployment platform.

### QuickBooks Integration (Server-side only)

**For serverless function deployments only**. These are required for the QuickBooks OAuth integration in the Budget feature:

- `QUICKBOOKS_CLIENT_ID` - Your QuickBooks app client ID
- `QUICKBOOKS_CLIENT_SECRET` - Your QuickBooks app client secret (never commit to source)
- `QUICKBOOKS_REDIRECT_URI` - OAuth callback URL (e.g., `https://yourdomain.com/api/quickbooks/callback`)
- `QUICKBOOKS_ENV` - Either `sandbox` (for testing) or `production`

**Getting QuickBooks Credentials:**

1. Go to [QuickBooks Developer Portal](https://developer.intuit.com/)
2. Create an app or use an existing one
3. Get your Client ID and Client Secret from the app's Keys & credentials section
4. Configure the Redirect URI in your app settings

**⚠️ SECURITY:** Keep `QUICKBOOKS_CLIENT_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` in secure environment variables only. Never commit these to source control.

### Static Hosting Limitations

This project is currently configured for static hosting (GitHub Pages). The QuickBooks integration and server-side API endpoints require a serverless function runtime (Vercel, Netlify, etc.) to work properly. 

For static hosting:
- Billboard component fetches data directly from Supabase using client-side RLS
- QuickBooks integration will show placeholders until serverless functions are deployed
- Mark Completed functionality calls Supabase RPC directly from the browser

To enable full functionality, deploy to a platform that supports serverless functions (Vercel, Netlify, AWS Amplify, etc.).

## Vercel Deployment

This project is configured for Vercel deployment with serverless functions. The `vercel.json` file configures:
- Static site build from the Vite output (`dist/` directory)
- Serverless functions for `api/` and `src/pages/api/` directories
- Proper routing for API endpoints

### Required Environment Variables

In your Vercel project settings, add the following environment variables:

**Supabase Configuration:**
- `SUPABASE_URL` - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (server-side only, bypasses RLS)
- `VITE_SUPABASE_URL` - Same as `SUPABASE_URL` (used for client-side build)
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key (safe for client-side use)

**QuickBooks Integration (Optional):**
- `QUICKBOOKS_CLIENT_ID` - Your QuickBooks app client ID
- `QUICKBOOKS_CLIENT_SECRET` - Your QuickBooks app client secret
- `QUICKBOOKS_REDIRECT_URI` - OAuth callback URL (e.g., `https://yourdomain.vercel.app/api/quickbooks/callback`)
- `QUICKBOOKS_ENV` - Either `sandbox` or `production`

**Billboard Feature (Optional):**
- `BILLBOARD_TV_TOKEN` - Secret token for TV mode access control (optional)

### Deployment Steps

1. Install the Vercel CLI: `npm i -g vercel`
2. Link your project: `vercel link`
3. Set environment variables in Vercel dashboard or via CLI: `vercel env add`
4. Deploy: `vercel --prod`

Alternatively, connect your GitHub repository to Vercel for automatic deployments on push.

## Deploying Upload Backend

The upload feature requires a backend (Netlify or Vercel) to handle file uploads to Supabase Storage and process OCR/parsing. This section explains how to deploy the backend functions.

### Why a Backend is Needed

GitHub Pages only serves static files and cannot execute server-side code. The upload flow needs server-side operations to:
- Create signed upload URLs for Supabase Storage
- Process uploaded files with OCR (Google Vision API)
- Parse ticket data and save to database

### Option 1: Deploy to Netlify (Recommended)

#### Step 1: Create Supabase Storage Bucket

In your Supabase Dashboard:
1. Go to Storage → New bucket
2. Create a bucket named **`ticket-scans`**
3. Set to **Private** (not public)
4. Apply default storage policies or use custom RLS

#### Step 2: Connect Repository to Netlify

1. Sign up at [netlify.com](https://netlify.com) if you haven't already
2. Click **"New site from Git"**
3. Connect your GitHub repository
4. Netlify will auto-detect `netlify.toml` configuration

#### Step 3: Configure Environment Variables

In Netlify Site Settings → Build & Deploy → Environment:

**Required:**
- `SUPABASE_URL` = Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` = Your Supabase service role key (⚠️ server-side only, never commit!)
- `SUPABASE_ANON_KEY` = Your Supabase anon key (for client-side operations)

**For Client Configuration:**
- `VITE_SUPABASE_URL` = Same as `SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` = Same as `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE` = Your Netlify site URL (e.g., `https://your-site.netlify.app`)
- `VITE_API_BASE` = Same as `NEXT_PUBLIC_API_BASE` (alternative naming)

**Optional (for Google Vision OCR):**
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` = Your Google Cloud service account JSON key
- `AUTO_ACCEPT_HIGH_CONFIDENCE` = `true` to auto-accept high-confidence imports

#### Step 4: Deploy

1. Netlify will automatically deploy when you push to `main` branch
2. Or manually trigger deploy from Netlify dashboard

#### Step 5: Update Frontend Configuration

If your frontend is on GitHub Pages (or separate hosting):

1. Add environment variable to your frontend deployment:
   - `NEXT_PUBLIC_API_BASE=https://your-netlify-site.netlify.app`
   - Or `VITE_API_BASE=https://your-netlify-site.netlify.app`

2. The client will automatically use this backend for uploads instead of trying to POST to GitHub Pages

#### Step 6: Apply Database Migration

Run the delivery tickets migration in Supabase SQL Editor:
```bash
db/migrations/20251117_delivery_tickets_helpers_triggers.sql
```

This creates:
- Triggers to auto-compute `total_amount` from `price * qty + tax + hazmat_fee`
- Triggers to generate readable `raw_text` summary if OCR doesn't provide it
- Helper functions `delivery_tickets_bulk_upsert` and `accept_ticket_import`

#### Step 7: Verify Upload Flow

1. Open your site and navigate to the delivery tickets upload page
2. Upload a sample PDF or image
3. Check browser console - should see:
   ```
   [UploadServiceScanButton] Upload endpoint: https://your-netlify-site.netlify.app/api/imports/upload
   [UploadServiceScanButton] Process endpoint: https://your-netlify-site.netlify.app/api/imports/process
   ```
4. Verify in Supabase:
   - Storage bucket `ticket-scans` has the uploaded file
   - `ticket_imports` table has new row with `status: 'pending'` or `'accepted'`
   - After processing, `ticket_imports.parsed` contains extracted data
   - If auto-accept enabled, `delivery_tickets` table has new rows

### Option 2: Deploy to Vercel

Vercel deployment is similar, but requires creating API route handlers instead of Netlify Functions:

1. Create API routes in `api/imports/upload.js` and `api/imports/process/[id].js`
2. Set same environment variables in Vercel dashboard
3. Deploy to Vercel (see Vercel deployment section above)

**Note:** Netlify Functions are already implemented in this repository (`netlify/functions/`), so Netlify is the faster option.

### Fallback Behavior

The client includes automatic fallback behavior:
1. **Try API Backend First:** If `NEXT_PUBLIC_API_BASE` or `VITE_API_BASE` is set, use that
2. **Fall Back to Netlify Functions:** If no API base set, use `/.netlify/functions/*`
3. **Fall Back to Local Storage:** If uploads fail completely, save to browser localStorage

### Security Notes

⚠️ **Never expose `SUPABASE_SERVICE_ROLE_KEY` client-side!**
- Only set it in Netlify/Vercel environment secrets
- It bypasses RLS and has full database access
- Client-side code should only use `SUPABASE_ANON_KEY`

### Troubleshooting

**Upload returns 405 Method Not Allowed:**
- Frontend is trying to POST to GitHub Pages
- Solution: Set `NEXT_PUBLIC_API_BASE` to point to your Netlify/Vercel backend

**Upload returns 404 Bucket Not Found:**
- Storage bucket `ticket-scans` doesn't exist
- Solution: Create bucket in Supabase Dashboard → Storage

**Upload succeeds but processing fails:**
- Check Netlify function logs for errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check if `ticket_imports` table exists and has RLS policies

**OCR/Parsing not working:**
- Google Vision API key may be missing or invalid
- Check Netlify function logs for API errors
- Verify `GOOGLE_APPLICATION_CREDENTIALS_JSON` is valid JSON

## Billboard Runtime Notes

The Billboard feature (`/billboard`) is designed to work on both static hosting (GitHub Pages) and server-side deployments (Vercel). It provides real-time KPI updates through multiple mechanisms.

### Required Migrations

Before using the Billboard feature, run the following migration in your Supabase SQL Editor:

```sql
-- Create aggregated views for fast billboard queries
-- File: migrations/001_create_metrics_views.sql
```

This creates daily, weekly, and monthly aggregation views (`service_jobs_daily`, `delivery_tickets_daily`, etc.) that power the Billboard feature. The application includes automatic fallback to base table aggregation if these views are missing, but the views provide significantly better performance.

### Row-Level Security (RLS)

The Billboard requires anonymous (unauthenticated) read access to the aggregated views. Add these policies in Supabase SQL Editor:

```sql
-- Enable RLS on aggregated views
ALTER TABLE public.service_jobs_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tickets_daily ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access
CREATE POLICY "Allow anon to read service_jobs_daily" 
  ON public.service_jobs_daily 
  FOR SELECT 
  TO anon 
  USING (true);

CREATE POLICY "Allow anon to read delivery_tickets_daily" 
  ON public.delivery_tickets_daily 
  FOR SELECT 
  TO anon 
  USING (true);
```

Repeat for weekly and monthly views if you're using those aggregation levels.

### Runtime Configuration

The Billboard uses a runtime-aware configuration system that prefers `window.__ENV` values (loaded from `public/runtime-config.js`) over build-time environment variables. This enables post-build configuration for static deployments.

#### GitHub Pages Deployment

For GitHub Pages, the build process generates `public/runtime-config.js` with your environment variables:

```bash
npm run build:with-runtime
```

This script reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your environment and generates the runtime config file that gets deployed with your static site.

**Required GitHub Secrets:**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key

The `index.html` automatically loads `/runtime-config.js` at startup, making these values available to the application via `window.__ENV`.

#### Vercel Deployment (Optional)

If you want server-side features (TV token authentication, QuickBooks integration, service role operations), deploy to Vercel with these additional environment variables:

- `SUPABASE_SERVICE_ROLE_KEY` - Server-side operations (bypasses RLS)
- `BILLBOARD_TV_TOKEN` - Optional TV mode access control
- `QUICKBOOKS_*` - QuickBooks integration credentials

The Billboard will prefer the server API (`/api/billboard-summary`) if available, but always falls back to client-side Supabase queries.

### Billboard Refresh Configuration

Configure the Billboard refresh intervals via environment variables:

```bash
# Refresh interval in seconds (default: 30)
VITE_BILLBOARD_REFRESH_SEC=30
```

The Billboard components read this value at runtime from `window.__ENV.VITE_BILLBOARD_REFRESH_SEC` or fall back to build-time `import.meta.env.VITE_BILLBOARD_REFRESH_SEC`.

### Real-time Updates

The Billboard includes Supabase Realtime subscriptions that listen for `INSERT` and `UPDATE` events on:
- `delivery_tickets` table
- `service_jobs` table

When changes occur, the Billboard automatically refreshes to show the latest data. If Realtime is unavailable or fails, the application continues using polling as a fallback.

**Note:** Realtime requires the Supabase Realtime feature to be enabled in your project settings. If it's disabled, the Billboard will still work via polling.

### Forced Refresh After RPC Calls

After any RPC operation that modifies service or delivery data (e.g., `markCustomerCompleted`), the application dispatches a `billboard-refresh` custom event that triggers an immediate refresh of all Billboard components. This ensures data is always up-to-date after user actions.

### Testing the Billboard

1. **With Supabase configured** (via runtime-config or build-time env):
   - Open `/billboard` in your browser
   - Add a delivery ticket or mark a service job completed
   - Verify the top scroller, marquee ticker, and week comparison bar update automatically

2. **Without server API** (GitHub Pages):
   - The UI should show live numbers from Supabase client-side queries
   - No blank areas or zeros should appear if data exists in your database

3. **Real-time updates**:
   - Insert a delivery ticket in Supabase SQL Editor
   - The Billboard should update within seconds (or immediately via Realtime)

### Console Logging

The Billboard components log their data source and fetch behavior to the console:
- `[BillboardTicker] Fetched from server API` - Server API was used
- `[BillboardTicker] Fetched from client aggregator` - Client-side Supabase was used
- `[BillboardTicker] Realtime subscription active` - Realtime is working
- `[BillboardTicker] Realtime subscription failed, continuing with polling` - Fallback to polling

Check your browser console for these messages when debugging Billboard behavior.
