# Billboard Data Verification Guide

## Purpose
This guide helps verify that the Billboard is displaying the correct numbers from your Service Jobs and Delivery Tickets data uploads.

## Data Flow

```
Your Uploads → Supabase Tables → Billboard Display
```

### Tables Used
1. **service_jobs** - Data from Service Tracking uploads
   - Fields used: `job_date`, `job_amount`, `status`
   - Filters: Completed jobs only (status = 'completed')
   
2. **delivery_tickets** - Data from Delivery Tickets uploads
   - Fields used: `date`, `qty` (gallons), `amount` (revenue)
   - Filters: Non-void, non-canceled tickets

### Aggregate Views (Optimization)
- `service_jobs_daily` - Pre-aggregated daily service job totals
- `delivery_tickets_daily` - Pre-aggregated daily delivery ticket totals

The Billboard tries to use these views first for better performance, then falls back to direct table queries if views don't exist.

## How to Verify Data on Live Website

### Step 1: Upload Test Data
1. Go to **Service Tracking** tab
2. Upload a CSV file with service jobs
3. Note the number of completed jobs and their total revenue
4. Go to **Delivery Tickets** tab
5. Upload or enter delivery ticket data
6. Note the number of tickets, total gallons, and revenue

### Step 2: Check Billboard Display
1. Navigate to the **Billboard** tab
2. Look at the displayed metrics:
   - **Completed Services** - Should match completed jobs from Service Tracking
   - **Delivery Tickets** - Should match ticket count from Delivery Tickets
   - **Total Gallons** - Should match sum of qty field from Delivery Tickets
   - **Total Revenue** - Should match combined revenue from both sources

### Step 3: Open Browser Console
1. Press F12 (or Cmd+Option+I on Mac) to open Developer Tools
2. Click the **Console** tab
3. Look for the log message: `📊 Billboard Data Fetch:`
4. Expand this message to see:
   ```
   {
     timestamp: "..."
     dataSource: "Aggregate Views" or "Direct Tables"
     serviceTracking: {
       completed: <number>
       completedRevenue: <number>
       ...
     }
     deliveryTickets: {
       totalTickets: <number>
       totalGallons: <number>
       revenue: <number>
     }
   }
   ```

### Step 4: Verify Numbers Match
Compare the console output with:
1. Your uploaded data in Service Tracking
2. Your uploaded data in Delivery Tickets
3. The numbers displayed on the Billboard

### Step 5: Check Data Source Indicator
Look at the footer of the Billboard page:
- You should see: `📊 Source: Service Jobs & Delivery Tickets`
- Hover over it to see the tooltip confirming the table names

## Common Issues and Solutions

### Issue: Billboard shows zero or old data
**Solution:** 
- Check that data was successfully uploaded to Service Tracking and Delivery Tickets
- Verify the date range - Billboard shows THIS WEEK's data (Monday-Sunday)
- Click the 🔄 Refresh button to force a refresh

### Issue: Numbers don't match between tabs
**Solution:**
- Billboard filters by date range (current week)
- Service Tracking and Delivery Tickets may show all data or different filters
- Check the console logs to see exactly what date range is being queried

### Issue: Console shows "Mock data" or errors
**Solution:**
- Verify Supabase credentials are configured correctly
- Check that tables exist: `service_jobs` and `delivery_tickets`
- Ensure Row Level Security (RLS) policies allow read access

### Issue: Data appears but seems incomplete
**Solution:**
- Check status filters - Billboard only shows completed service jobs
- Delivery tickets exclude void/canceled items
- Verify the `status` field in your uploaded data

## Technical Details

### Date Filtering
- Week starts on **Monday** at 00:00:00
- Week ends on **Sunday** at 23:59:59.999
- "This Week" = current Monday through Sunday
- "Last Week" = previous Monday through Sunday

### Status Filtering
**Service Jobs:**
- Included: `status = 'completed'` (case-insensitive)
- Excluded: Any status containing 'cancel'

**Delivery Tickets:**
- Included: All tickets except those with status containing 'void' or 'cancel'

### Revenue Calculation
- **Service Revenue**: Sum of `job_amount` for completed jobs
- **Delivery Revenue**: Sum of `amount` for non-void tickets
- **Total Revenue**: Service Revenue + Delivery Revenue

## Debugging Console Logs

The Billboard now includes enhanced logging to help verify data:

```javascript
// Look for this in the console (every 30 seconds by default):
📊 Billboard Data Fetch: {
  timestamp: "2025-10-28T21:30:00.000Z",
  dataSource: "Aggregate Views",  // or "Direct Tables"
  serviceTracking: {
    completed: 42,              // Count of completed jobs
    scheduled: 18,
    deferred: 3,
    completedRevenue: 125000,   // Revenue from completed jobs
    pipelineRevenue: 45000
  },
  deliveryTickets: {
    totalTickets: 156,          // Count of tickets
    totalGallons: 45230.5,      // Sum of qty field
    revenue: 89450.75           // Sum of amount field
  },
  weekCompare: {
    thisWeek: 214450.75,        // This week's total revenue
    lastWeek: 198320.50,        // Last week's total revenue
    percentChange: 8.1          // Percentage change
  }
}
```

## Need Help?

If the numbers still don't match after following this guide:
1. Take screenshots of:
   - Service Tracking data table
   - Delivery Tickets data table
   - Billboard display
   - Browser console output
2. Check that your upload dates are within the current week
3. Verify that status fields are set correctly ('completed' for service jobs)
