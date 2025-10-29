# Billboard Deployment Guide

## Overview
This guide explains how the Billboard is wired to **real live data** from Supabase and how to deploy it to Vercel.

## Data Flow Architecture

```
Upload Files → Supabase Tables → Vercel API → Billboard UI (Auto-refresh every 10s)
```

### 1. Data Sources (Supabase Tables)

#### Service Jobs Table: `service_jobs`
Required columns:
- `status` (text): Job status - "completed", "scheduled", "deferred", "in_progress", "unscheduled"
- `job_amount` (numeric): Revenue amount for the service
- `job_date` (date): Date of the service job

#### Delivery Tickets Table: `delivery_tickets`
Required columns:
- `qty` (numeric): Gallons delivered
- `amount` (numeric): Revenue from delivery
- `date` (date): Delivery date

### 2. API Endpoint: `/api/billboard-summary`

Located at: `api/billboard-summary.js` (Vercel serverless function)

**What it does:**
1. Connects to Supabase using `SUPABASE_SERVICE_ROLE_KEY`
2. Queries `service_jobs` for This Week and Last Week
3. Queries `delivery_tickets` for This Week and Last Week
4. Aggregates metrics:
   - Completed Services count and revenue
   - Scheduled Services count and pipeline revenue
   - Deferred Services count
   - Total Delivery Tickets and gallons
   - Week-over-week comparison with percent change
5. Caches results for 15 seconds to reduce database load
6. Returns JSON with all metrics

**Response Format:**
```json
{
  "serviceTracking": {
    "completed": 42,
    "scheduled": 18,
    "deferred": 3,
    "completedRevenue": 125000.00,
    "pipelineRevenue": 45000.00
  },
  "deliveryTickets": {
    "totalTickets": 156,
    "totalGallons": 45230.5,
    "revenue": 89450.75
  },
  "weekCompare": {
    "thisWeekTotalRevenue": 214450.75,
    "lastWeekTotalRevenue": 198320.50,
    "percentChange": 8.1
  },
  "lastUpdated": "2025-10-29T19:30:00.000Z"
}
```

### 3. Billboard UI Components

- **BillboardPage.jsx**: Main orchestrator
  - Calls `getBillboardSummary()` on mount
  - Auto-refreshes every 10 seconds (configurable)
  - Displays loading/error states
  - Passes data to child components

- **BillboardTicker.jsx**: Scrolling marquee
  - Shows: Completed Services, Service Revenue, Delivery Tickets, Gallons, Total Revenue
  - Continuous NASDAQ-style animation

- **BillboardCards.jsx**: Metric cards
  - 5 cards: Completed Services, Delivery Tickets, Total Gallons, Total Revenue, Pipeline

- **WeekCompareMeter.jsx**: Week comparison bar
  - Visual bar chart showing This Week vs Last Week
  - Color-coded: Green (>110%), Amber (90-110%), Red (<90%)

## Deployment to Vercel

### Step 1: Connect Repository
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository: `joegibsonoil12-source/KPI-Dashboard`
4. Vercel will auto-detect the Vite configuration

### Step 2: Configure Environment Variables

Since you've enabled Vercel + Supabase integration, these should be **auto-populated**:

#### Required (Server-side - for API):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (NOT the anon key)

#### Required (Client-side - for frontend):
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Anon key with RLS

#### Optional:
- `VITE_BILLBOARD_REFRESH_SEC=10` - Refresh interval (default: 10 seconds)
- `BILLBOARD_TV_TOKEN` - Secret token for TV mode security

### Step 3: Deploy
Click "Deploy" - Vercel will:
1. Install dependencies (`npm install`)
2. Build the app (`npm run build`)
3. Deploy the static site
4. Configure serverless functions in `/api` directory

### Step 4: Verify Deployment

1. **Check API Endpoint:**
   ```bash
   curl https://your-app.vercel.app/api/billboard-summary
   ```
   Should return JSON with real data from your Supabase tables.

2. **Open Billboard:**
   Navigate to `https://your-app.vercel.app/billboard`
   - Should show real numbers from your service jobs and delivery tickets
   - Ticker should scroll continuously
   - Should auto-refresh every 10 seconds

3. **Test Data Updates:**
   - Upload a service file → Data updates in Supabase → Billboard reflects changes within 10 seconds
   - Upload delivery tickets → Data updates in Supabase → Billboard reflects changes within 10 seconds

## How Data Updates Work

### Upload Service File
1. You upload CSV/file with service jobs
2. Parser processes and inserts into `service_jobs` table
3. Within 10 seconds, Billboard auto-refresh triggers
4. API fetches fresh data from Supabase (or uses 15s cache)
5. Billboard UI updates with new numbers

### Upload Delivery Tickets
1. You upload CSV/file with delivery tickets
2. Parser processes and inserts into `delivery_tickets` table
3. Within 10 seconds, Billboard auto-refresh triggers
4. API fetches fresh data from Supabase (or uses 15s cache)
5. Billboard UI updates with new numbers

## Laptop to TV Setup

Since you're using HDMI from laptop to TV:

### Option 1: Extended Display
1. Connect HDMI cable from laptop to TV
2. Configure as extended display (not mirrored)
3. Open Billboard in browser on laptop
4. Drag browser window to TV screen
5. Click "⛶ Fullscreen" button
6. Billboard will auto-refresh every 10 seconds

### Option 2: TV Mode Pop-out
1. Open Billboard on laptop
2. Click "📺 TV Mode" button
3. A new window opens (optimized for TV)
4. Drag that window to TV screen
5. Click "⛶ Fullscreen" on TV window
6. Billboard auto-refreshes every 10 seconds

### Option 3: Dedicated Browser on TV Screen
1. Open a separate browser window
2. Navigate to: `https://your-app.vercel.app/billboard?tv=1`
3. Drag to TV screen
4. Press F11 for fullscreen
5. Auto-refreshes every 10 seconds - no manual refresh needed!

## Customizing Refresh Interval

### For Specific Display:
Add query parameter:
```
https://your-app.vercel.app/billboard?refresh=15
```
This will refresh every 15 seconds instead of 10.

### For All Displays (Environment):
Set in Vercel environment variables:
```
VITE_BILLBOARD_REFRESH_SEC=15
```

### Min/Max Limits:
- Minimum: 5 seconds
- Maximum: 300 seconds (5 minutes)
- Default: 10 seconds

## Troubleshooting

### Billboard Shows Mock/Placeholder Data
**Cause:** API endpoint not working or environment variables not set

**Fix:**
1. Check Vercel environment variables are set correctly
2. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured
3. Test API endpoint: `curl https://your-app.vercel.app/api/billboard-summary`
4. Check Vercel function logs for errors

### Billboard Not Auto-Refreshing
**Cause:** Browser tab is inactive or JavaScript error

**Fix:**
1. Keep browser tab active (browsers throttle inactive tabs)
2. Check browser console for errors (F12)
3. Verify `VITE_BILLBOARD_REFRESH_SEC` is set correctly
4. Try manual refresh to see if data loads

### Data Not Updating After Upload
**Cause:** Caching or delay

**Fix:**
1. Wait up to 25 seconds (10s refresh + 15s server cache)
2. Verify data was actually inserted into Supabase tables
3. Check API response to see if it has updated data
4. Manual refresh should show new data immediately

### Content Doesn't Fit on Screen
**Cause:** Non-standard laptop/TV resolution

**Fix:**
1. Use browser zoom (Ctrl + -) to zoom out 10-20%
2. Update CSS in `src/styles/billboard.css` for your specific resolution
3. Hide summary sections if needed

## Verifying Real Data vs Mock Data

**Mock Data (Fallback):**
The client-side code (`src/pages/api/billboard-summary.js`) has mock data as a fallback when the API is unreachable. This is only for development/demos.

**Real Data (Production):**
When deployed to Vercel with proper environment variables:
- API endpoint queries Supabase directly
- Returns real numbers from your tables
- Updates automatically as you upload files
- No mock data is used

**How to Verify:**
1. Check browser Network tab (F12)
2. Look for request to `/api/billboard-summary`
3. Inspect the response - should have your real numbers
4. Compare with direct Supabase query to confirm accuracy

## Week-over-Week Calculation

The API calculates weeks as **Monday to Sunday**:

- **This Week:** Current Monday 00:00:00 to Sunday 23:59:59
- **Last Week:** Previous Monday 00:00:00 to Sunday 23:59:59

Percent change formula:
```
percentChange = ((thisWeek - lastWeek) / lastWeek) * 100
```

Special cases:
- If last week is $0 and this week > $0: shows 100% growth
- If both weeks are $0: shows 0% change

## Support

For issues with:
- **Data not showing:** Check Supabase table structure matches expected columns
- **API errors:** Check Vercel function logs
- **Authentication errors:** Verify service role key has proper permissions
- **Performance:** Adjust cache TTL in `api/billboard-summary.js` (line 38)

## Summary

✅ Billboard is **fully wired** to real Supabase data
✅ Automatically refreshes every **10 seconds**
✅ Updates within 10-25 seconds when you upload files
✅ No manual refresh needed for TV displays
✅ Scales to fit on laptop screen → HDMI → TV
