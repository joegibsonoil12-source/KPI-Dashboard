# Billboard Data Flow Diagram

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Executive Dashboard                          │
│                  (ExecutiveDashboard.jsx)                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ loadBillboard()
                      ▼
         ┌────────────────────────────┐
         │  getBillboardSummary()     │
         │  (fetchMetricsClient.js)   │
         └────────┬───────────────────┘
                  │
                  │ Try serverless first
                  ▼
    ┌─────────────────────────────────────┐
    │  /.netlify/functions/billboard-     │
    │         summary                     │
    │                                     │
    │  Uses: SUPABASE_SERVICE_ROLE_KEY   │
    │  Cache: 15 seconds                 │
    └──────┬──────────────────────────────┘
           │
           │ Response
           ▼
    ┌──────────────────┐
    │ Check with       │      ┌──────────┐
    │ isEmptyBillboard │──No──▶ Use data │
    │ helper           │      └──────────┘
    └──────┬───────────┘
           │
           │ Yes (empty)
           ▼
    ┌──────────────────────────────────┐
    │ Fallback to client-side          │
    │ Supabase aggregation             │
    │                                  │
    │ Queries:                         │
    │ - service_jobs                   │
    │ - delivery_tickets               │
    │ - cstore_gallons                 │
    │ - dashboard_kpis                 │
    │                                  │
    │ Uses: VITE_SUPABASE_ANON_KEY    │
    └──────┬───────────────────────────┘
           │
           │ Return to ExecutiveDashboard
           ▼
    ┌──────────────────┐
    │ Check if empty?  │
    └──────┬───────────┘
           │
           ├──No───▶ Use data ✓
           │
           │ Yes (still empty)
           ▼
    ┌──────────────────────────────────┐
    │ Force API fallback:              │
    │ /api/billboard-summary           │
    │                                  │
    │ Uses: Server-side Supabase       │
    └──────┬───────────────────────────┘
           │
           ▼
    ┌──────────────────┐
    │ Check if empty?  │
    └──────┬───────────┘
           │
           ├──No───▶ Use data ✓
           │
           │ Yes (all empty)
           ▼
    ┌──────────────────────────────────┐
    │ Last resort:                     │
    │ Load KPIs only                   │
    │ (dashboard_kpis table)           │
    └──────────────────────────────────┘
```

## Debug Panel Visibility

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser Window                           │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Executive Dashboard Content                   │  │
│  │                                                       │  │
│  │  Cards, Charts, Metrics...                           │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────┐                     │
│  │ 🔍 Billboard Debug Panel     ▼    │  (Lower-left)       │
│  │───────────────────────────────────│                     │
│  │ Data Source: serverless          │                     │
│  │                                   │                     │
│  │ Serverless Payload:               │                     │
│  │ ┌───────────────────────────────┐ │                     │
│  │ │ {                             │ │                     │
│  │ │   "serviceTracking": {        │ │                     │
│  │ │     "completed": 0,           │ │                     │
│  │ │     ...                       │ │                     │
│  │ └───────────────────────────────┘ │                     │
│  │ Fetched: 2:45:23 PM              │                     │
│  │                                   │                     │
│  │ Fallback Payload:                 │                     │
│  │ ┌───────────────────────────────┐ │                     │
│  │ │ {                             │ │                     │
│  │ │   "serviceTracking": {        │ │                     │
│  │ │     "completed": 42,          │ │                     │
│  │ │     ...                       │ │                     │
│  │ └───────────────────────────────┘ │                     │
│  │ Fetched: 2:45:24 PM              │                     │
│  └────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## Empty Detection Logic

### isEmptyBillboard() Function

```javascript
function isEmptyBillboard(payload) {
  if (!payload) return true;
  
  // Check these key metrics:
  const numericChecks = [
    payload.serviceTracking?.completed,
    payload.serviceTracking?.completedRevenue,
    payload.deliveryTickets?.revenue,
    payload.weekCompare?.thisWeekTotalRevenue  // ← Added in fix
  ];
  
  // If ANY is non-zero → NOT empty
  const anyNonZero = numericChecks.some(n => Number(n) !== 0);
  
  // Check for C-Store data
  const hasCStore = 
    Array.isArray(payload.cStoreGallons) && 
    payload.cStoreGallons.length > 0;
  
  // Check for KPI data
  const hasKpis = 
    payload.dashboardKpis && 
    Object.keys(payload.dashboardKpis)
      .some(k => Number(payload.dashboardKpis[k]) !== 0);
  
  // Empty if NO data in any category
  return !anyNonZero && !hasCStore && !hasKpis;
}
```

## Scenario Analysis Flow

```
                    ┌──────────────────┐
                    │ Run Diagnostics  │
                    └────────┬─────────┘
                             │
                   ┌─────────▼──────────┐
                   │ Deploy Debug Panel │
                   │ Take Screenshot    │
                   └─────────┬──────────┘
                             │
                   ┌─────────▼──────────┐
                   │  Run SQL Queries   │
                   │  Check Logs        │
                   └─────────┬──────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌────────────┐   ┌────────────┐   ┌────────────┐
    │ Scenario A │   │ Scenario B │   │ Scenario C │
    └─────┬──────┘   └─────┬──────┘   └─────┬──────┘
          │                │                │
          │                │                │
┌─────────▼────────────┐   │   ┌────────────▼─────────────┐
│ Serverless: empty    │   │   │ Both endpoints: empty    │
│ Fallback: has data   │   │   │ DB: has data             │
│ DB: has data         │   │   │                          │
└──────────────────────┘   │   └──────────────────────────┘
          │                │                │
          │                │                │
    ┌─────▼──────┐   ┌─────▼──────┐   ┌────▼────┐
    │ Deploy Fix │   │ Fix Env    │   │ Debug   │
    │ Branch     │   │ Variables  │   │ Further │
    └────────────┘   └────────────┘   └─────────┘
```

## Scenario A: Serverless Empty, Fallback Good ✅

**What you'll see**:
```
DebugPanel:
  Data Source: fallback
  
  Serverless Payload:
  {
    "serviceTracking": { "completed": 0, "completedRevenue": 0, ... },
    "deliveryTickets": { "totalTickets": 0, "revenue": 0, ... },
    ...all zeros...
  }
  
  Fallback Payload:
  {
    "serviceTracking": { "completed": 42, "completedRevenue": 125000, ... },
    "deliveryTickets": { "totalTickets": 156, "revenue": 89450.75, ... },
    ...real data...
  }
```

**Action**: Deploy `fix/billboard-fallback-empty-payload` branch
- The fix improves empty detection
- Forces fallback when serverless is empty
- Already implemented and tested

## Scenario B: Both Empty, DB Has Data ⚠️

**What you'll see**:
```
DebugPanel:
  Data Source: none (both empty)
  
  Serverless Payload:
  { ...all zeros... }
  
  Fallback Payload:
  { ...all zeros... }

SQL Results:
  total_tickets: 156
  revenue: 89450.75
  completed: 42
  ...real data in database...
```

**Root Cause**: Environment variable mismatch
- Deployed functions pointing to wrong database
- Or using wrong credentials
- Or RLS policies blocking reads

**Action**: Fix deployment configuration
1. Check `SUPABASE_URL` in Netlify environment
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
3. Confirm it matches your production Supabase project
4. Check RLS policies allow service role to read

## Scenario C: Serverless Has Data, UI Shows Zeros 🔍

**What you'll see**:
```
DebugPanel:
  Data Source: serverless
  
  Serverless Payload:
  { ...real data... }
  
Dashboard UI:
  All metrics showing: 0
```

**Root Cause**: UI state management issue
- Data fetched but not displayed
- State being overwritten
- Component rendering issue

**Action**: Further debugging needed
- Check browser console for errors
- Review component re-render behavior
- Check for conflicting useEffect calls

## Key Files Reference

```
/home/runner/work/KPI-Dashboard/KPI-Dashboard/
├── src/
│   ├── components/
│   │   └── dashboard/
│   │       ├── DebugPanel.jsx              ← Debug panel component
│   │       └── ExecutiveDashboard.jsx      ← Main dashboard logic
│   ├── lib/
│   │   └── fetchMetricsClient.js           ← Billboard fetch logic
│   └── pages/
│       └── api/
│           └── billboard-summary.js        ← Fallback API endpoint
├── netlify/
│   └── functions/
│       └── billboard-summary.js            ← Serverless aggregator
├── DASHBOARD_ZEROS_DIAGNOSTIC_SUMMARY.md   ← Full diagnostic report
├── DASHBOARD_ZEROS_QUICKSTART.md           ← Quick start guide
└── DASHBOARD_ZEROS_FLOW_DIAGRAM.md         ← This file
```
