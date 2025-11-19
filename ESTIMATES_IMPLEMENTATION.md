# HCP Estimates Import & Tank KPIs Feature

## Overview

This feature adds support for importing Housecall Pro (HCP) estimates into the KPI Dashboard, tracking Open/Won/Lost values, and displaying new tank-related KPIs.

## Features Implemented

### 1. HCP Estimates CSV Import

The system now correctly imports HCP estimates files with the following columns:

- **Estimate #**: Unique identifier from HCP
- **Customer name**: Customer information
- **Employees**: Assigned technicians
- **Estimate status**: Status from HCP (Pending, Accepted, Declined, etc.)
- **Created date**: When estimate was created
- **Scheduled date**: When work is scheduled
- **Outcome**: open / won / lost
- **Open value**: Dollar value for open estimates
- **Won value**: Dollar value for won estimates
- **Lost value**: Dollar value for lost estimates
- **Estimate tags**: Tags from HCP
- **Location name**: Job location
- **Options count**: Number of options in estimate
- **Estimate lead source**: Where the lead came from

#### How Amounts are Calculated

The system calculates the `job_amount` based on the outcome:
- **Outcome = "open"** → Uses Open value
- **Outcome = "won"** → Uses Won value
- **Outcome = "lost"** → Uses Lost value
- **No outcome or other** → Uses the maximum of all three values

### 2. Database Schema

New columns added to `service_jobs` table:

```sql
hcp_estimate_id       -- Unique HCP estimate identifier
estimate_status       -- Raw status from HCP
hcp_outcome          -- open/won/lost
estimate_tags        -- Tags from HCP
location_name        -- Location in addition to address
open_value           -- Open estimate value
won_value            -- Won estimate value
lost_value           -- Lost estimate value
```

#### SQL Migrations Required

Run these SQL files in your Supabase SQL editor (in order):

1. `sql/2025-11-19_add_hcp_estimates_to_service_jobs.sql`
   - Adds estimate columns to service_jobs table
   - Updates service_jobs_bulk_upsert RPC function
   - Creates indexes for estimate filtering
   - Updates metrics views to include estimate aggregations

2. `sql/2025-11-19_add_tank_kpis_metrics.sql`
   - Creates placeholder view for tank metrics
   - Initially returns zeros until tank tracking is implemented

### 3. Service Tracking

Estimates appear in Service Tracking with:
- **EST badge** instead of JOB badge
- Filter options: All / Jobs / Estimates
- All estimate values displayed in table
- Correct amount calculations based on outcome

### 4. HCP Schedule Calendar

Estimates appear in the calendar with:
- **Dashed border** to distinguish from regular jobs
- **EST pill** indicator
- Filter options to show/hide estimates
- Detail modal shows:
  - Outcome (open/won/lost)
  - Open Value
  - Won Value
  - Lost Value

### 5. Dashboard KPIs

#### New Estimate KPI Row

Three new cards showing estimate metrics:

1. **Open Estimates ($)** - Total value of open estimates
2. **Won Estimates ($)** - Total value of won estimates  
3. **Lost Estimates ($)** - Total value of lost estimates

#### New Tank KPI Row

Four new cards for tank tracking (currently showing 0):

1. **Current Tanks** - Tanks in inventory
2. **Customers Lost** - Customers lost this period
3. **Customers Gained** - Customers gained this period
4. **Tanks Set** - Tanks installed this period

*Note: Tank metrics are placeholders. To populate with real data, implement tank tracking tables and update the view.*

## Usage

### Importing HCP Estimates

1. Export estimates from Housecall Pro
   - File should include: Estimate #, Customer name, Outcome, Open/Won/Lost values, etc.

2. Upload via Service Tracking tab
   - Click "Upload Report" button
   - Select your CSV file
   - Preview will show parsed estimates with correct amounts
   - Click "Import" to save to database

3. View imported estimates
   - Service Tracking: Filter by "Estimates" to see only estimates
   - Schedule: Estimates appear with dashed borders and EST badge
   - Dashboard: See aggregate estimate values in new KPI cards

### Testing the Parser

A test script is included to verify estimate parsing:

```bash
node test-estimates-parser.mjs
```

This validates:
- Column mapping is correct
- Currency parsing works
- Amount calculation logic is accurate
- All estimates are detected with is_estimate flag

Sample test file: `sample-hcp-estimates-export.csv`

## Database Views

### Service Metrics Views

The following views now include estimate aggregations:

- `view_service_metrics_daily`: Daily rollup with estimate counts and values
- `view_service_metrics_monthly`: Monthly rollup with estimate counts and values

Fields added:
- `estimates_count`: Number of estimates
- `estimates_open_value`: Total open estimate value
- `estimates_won_value`: Total won estimate value
- `estimates_lost_value`: Total lost estimate value

## Future Enhancements

### Tank KPI Tracking

To populate tank metrics with real data:

1. Create tank inventory table:
```sql
CREATE TABLE tank_inventory (
  id uuid PRIMARY KEY,
  tank_number text,
  status text, -- available, assigned, etc.
  location text,
  created_at timestamptz
);
```

2. Create customer changes table:
```sql
CREATE TABLE customer_changes (
  id uuid PRIMARY KEY,
  customer_id uuid,
  change_type text, -- gained, lost
  change_date date,
  reason text
);
```

3. Update `view_tank_metrics` to aggregate from these tables

### Graphs Integration (Optional)

To add estimate trends to the Graphs tab:

1. Extend the service metrics queries
2. Add new chart series for estimate values over time
3. Show conversion rates (won vs. lost)

## Troubleshooting

### Estimates showing $0.00

- Check that your CSV has the correct columns: "Open value", "Won value", "Lost value"
- Verify the Outcome column contains: "open", "won", or "lost"
- Run the test parser to validate: `node test-estimates-parser.mjs`

### Database errors

- Ensure you ran both SQL migration files
- Check Supabase logs for RLS policy issues
- Verify user has authenticated and has permissions

### Missing KPI cards

- Clear browser cache and reload
- Check that SQL migrations completed successfully
- Verify service_jobs table has new estimate columns

## File Reference

### Parser & Helpers
- `src/lib/parseServiceReport.js` - CSV/XLSX parser with estimate support
- `src/lib/serviceHelpers.js` - Database upsert helpers
- `src/lib/serviceSchedule.js` - Calendar data fetching

### UI Components
- `src/components/ServiceTracking.jsx` - Service tracking table with estimates
- `src/tabs/HcpScheduleCalendar.jsx` - Calendar with estimate indicators
- `src/components/dashboard/ExecutiveDashboard.jsx` - Dashboard with KPI cards

### SQL Migrations
- `sql/2025-11-19_add_hcp_estimates_to_service_jobs.sql` - Main estimate schema
- `sql/2025-11-19_add_tank_kpis_metrics.sql` - Tank KPI placeholders

### Test Files
- `test-estimates-parser.mjs` - Parser validation script
- `sample-hcp-estimates-export.csv` - Sample estimates file

## Support

For issues or questions:
1. Check Supabase logs for database errors
2. Run test parser to validate CSV format
3. Verify SQL migrations ran successfully
4. Review browser console for frontend errors
