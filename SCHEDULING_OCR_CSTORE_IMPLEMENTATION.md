# Scheduling Rules, OCR Fixes, C-Store Gallons Import, and Dashboard Square Config

This document describes the new features added to the KPI Dashboard system.

## Table of Contents
1. [Scheduling Rules](#1-scheduling-rules)
2. [Service Tracking Estimates](#2-service-tracking-estimates)
3. [Delivery Tickets OCR Normalization](#3-delivery-tickets-ocr-normalization)
4. [C-Store Gallons Import](#4-c-store-gallons-import)
5. [Dashboard Square Config](#5-dashboard-square-config)
6. [Setup Instructions](#setup-instructions)

---

## 1. Scheduling Rules

### Overview
Automatically recommend scheduled dates for service jobs based on ZIP code and job type (install/service/estimate).

### Configuration
Edit `src/config/schedulingRules.js` to define your routing rules:

```javascript
export const SCHEDULING_RULES = [
  {
    id: 'route-fayetteville-service',
    name: 'Fayetteville Service Route',
    zips: ['28301','28302','28303'],
    jobTypes: ['service'],
    dayOfWeek: 1, // Monday
    defaultStartTime: '08:00',
  },
  {
    id: 'route-fayetteville-installs',
    name: 'Fayetteville Installs',
    zips: ['28301','28302'],
    jobTypes: ['install'],
    dayOfWeek: 3, // Wednesday
    defaultStartTime: '09:00',
  },
  // Add more routes...
];
```

### Features
- **Future-only recommendations**: Rules only apply to unscheduled jobs
- **Conflict detection**: Existing scheduled jobs are not moved on re-import
- **ZIP + Job Type routing**: Assign different days based on location and job type
- **Default start times**: Optionally suggest start times per route

### Usage
```javascript
import { recommendDate, recommendTime } from '../config/schedulingRules';

// Get recommended date for a ZIP + job type
const suggestedDate = recommendDate('28301', 'service'); // Returns "2025-11-25" (next Monday)
const suggestedTime = recommendTime('28301', 'service'); // Returns "08:00"
```

---

## 2. Service Tracking Estimates

### Overview
Detect and display estimate jobs (e.g., EST-205) with a distinct badge and enable filtering.

### Features
- **Auto-detection**: Jobs with `EST-` prefix or "estimate" in description are flagged
- **Visual badge**: Shows "ESTIMATE" instead of "JOB" in the Service Tracking table
- **Working filter**: "Estimates only" filter correctly returns estimate records
- **Database field**: `is_estimate` boolean flag in `service_jobs` table

### Job Type Detection
The `src/lib/jobs/jobType.js` helper provides:

```javascript
import { deriveJobTypeFromNumber, isEstimate } from '../lib/jobs/jobType';

// Derive job type from job number and description
const jobType = deriveJobTypeFromNumber('EST-205', 'Annual inspection estimate');
// Returns: 'estimate'

// Check if a job is an estimate
const isEst = isEstimate(job);
// Returns: true if job.is_estimate, job.job_number starts with 'EST-', etc.
```

### Supported Job Types
- `estimate` - Estimate jobs (EST-xxx)
- `install` - Installation jobs
- `service` - Service/maintenance jobs (default)

---

## 3. Delivery Tickets OCR Normalization

### Overview
Normalize OCR output into the Supabase `delivery_tickets` schema with validation.

### Features
- **Field parsing**: Converts OCR strings to proper date/numeric types
- **Validation**: Rejects rows missing required fields (date, qty, amount)
- **Flexible field names**: Handles variations like `gallons`/`qty`, `amount`/`total`
- **Logging**: Warns about skipped tickets in console

### Usage
```javascript
import { normalizeOcrTicket } from '../lib/imports/normalizeDeliveryTicket';

const ocrRow = {
  date: '2025-11-19',
  gallons: '1,234.5',
  amount: '$567.89',
  customer: 'ABC Oil Co',
};

const normalized = normalizeOcrTicket(ocrRow);
// Returns:
// {
//   date: '2025-11-19',
//   qty: 1234.5,
//   amount: 567.89,
//   customer: 'ABC Oil Co',
//   ticket_number: null
// }
```

### Integration
To integrate into the OCR import flow, call `normalizeOcrTicket()` before inserting into Supabase.

---

## 4. C-Store Gallons Import

### Overview
Parse the "NEW STORE SPREADSHEET" Excel file to extract weekly gallon totals per store.

### File Format
- **Multi-sheet Excel**: Each store has its own sheet (e.g., "Laurel Hill Food Mart", "Old Wire")
- **Total Gallons row**: Each sheet contains a row with "Total Gallons" label and numeric value
- **W/E Date header**: Week ending date (e.g., "W/E 11/17/2025")

### Configuration
Edit `src/config/cStoreConfig.js` to map sheet names to store IDs:

```javascript
export const CSTORE_SHEETS = [
  { sheetName: 'Laurel Hill Food Mart', storeId: 'LAUREL_HILL', dashboardKey: 'laurelHillGallons' },
  { sheetName: 'Old Wire',              storeId: 'OLD_WIRE',    dashboardKey: 'oldWireGallons' },
  { sheetName: "Sam's",                 storeId: 'SAMS',        dashboardKey: 'samsGallons' },
  // Add all your stores...
];
```

### Database Schema
The `cstore_gallons` table stores:
- `store_id` (text): Store identifier
- `week_ending` (date): Week ending date
- `total_gallons` (numeric): Gallon total for the week
- Unique constraint on `(store_id, week_ending)`

### Usage
In the **C-Stores (Gallons)** tab:
1. Click "Upload Weekly Gallons Data"
2. Select the Excel file (e.g., "Copy of NEW STORE SPREADSHEET 11.17.25.xlsx")
3. Data is automatically parsed and saved to Supabase
4. View summary cards and data table

### API Integration
The Billboard API now includes C-Store gallons:

```javascript
// GET /.netlify/functions/billboard-summary
{
  "serviceTracking": { ... },
  "deliveryTickets": { ... },
  "weekCompare": { ... },
  "cStoreGallons": [
    { "storeId": "LAUREL_HILL", "weekEnding": "2025-11-17", "totalGallons": 1577 },
    { "storeId": "OLD_WIRE", "weekEnding": "2025-11-17", "totalGallons": 892 },
    ...
  ],
  "lastUpdated": "2025-11-19T20:00:00Z"
}
```

---

## 5. Dashboard Square Config

### Overview
Define dashboard KPI "squares" (cards) in a config file instead of hardcoding in JSX.

### Configuration
Edit `src/config/dashboardSquares.js` to add new metrics:

```javascript
export const DASHBOARD_SQUARES = [
  {
    key: 'totalGallonsAllStores',
    label: 'Total Gallons (All C-Stores)',
    compute: (data) => {
      const list = data.cStoreGallons || [];
      return list.reduce((sum, row) => sum + (Number(row.totalGallons) || 0), 0);
    },
    format: 'gallons',
  },
  {
    key: 'weeklyServiceRevenue',
    label: 'Service Revenue (This Week)',
    compute: (data) => Number(data.serviceTracking?.completedRevenue || 0),
    format: 'currency',
  },
  // Add your custom squares here...
];
```

### Supported Formats
- `currency` - Formats as USD (e.g., "$1,234.56")
- `gallons` - Formats with "gal" suffix (e.g., "1,234 gal")
- `number` - Formats with thousands separator (e.g., "1,234")

### Usage
To integrate into your dashboard:

```javascript
import { DASHBOARD_SQUARES } from '../../config/dashboardSquares';

function formatValue(value, format) {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    case 'gallons':
      return `${Number(value || 0).toLocaleString()} gal`;
    default:
      return Number(value || 0).toLocaleString();
  }
}

export default function ExecutiveDashboard({ data }) {
  return (
    <div className="dashboard-grid">
      {DASHBOARD_SQUARES.map(square => {
        const raw = square.compute(data || {});
        const display = formatValue(raw, square.format);
        return (
          <DashboardCard key={square.key} title={square.label}>
            <span className="dashboard-card-value">{display}</span>
          </DashboardCard>
        );
      })}
    </div>
  );
}
```

---

## Setup Instructions

### 1. Database Setup

Run the SQL migration to create the `cstore_gallons` table:

```sql
-- In Supabase SQL Editor, run:
-- sql/2025-11-19_create_cstore_gallons.sql
```

The `service_jobs` table should already have the `is_estimate` column. If not, run:

```sql
-- sql/2025-11-19_add_is_estimate_to_service_jobs.sql
```

### 2. Configure Scheduling Rules

Edit `src/config/schedulingRules.js` with your actual routes:
- Add ZIP codes for each route
- Assign job types (`install`, `service`, `estimate`)
- Set day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
- Optionally set default start times

### 3. Configure C-Store Mapping

Edit `src/config/cStoreConfig.js`:
- Map each Excel sheet name to a `storeId`
- Use the same `storeId` values consistently across your app
- Optional: set `dashboardKey` for dashboard squares

### 4. Test C-Store Import

1. Navigate to the **C-Stores (Gallons)** tab
2. Upload your Excel file (e.g., "NEW STORE SPREADSHEET 11.17.25.xlsx")
3. Verify data appears in the table
4. Check Supabase `cstore_gallons` table to confirm persistence

### 5. Verify Billboard API

```bash
curl https://your-domain.netlify.app/.netlify/functions/billboard-summary
```

Response should include `cStoreGallons` array with your imported data.

---

## Troubleshooting

### C-Store Import: "Skipping sheet (missing data)"

**Cause**: Sheet does not have "Total Gallons" row or "W/E" date header.

**Solution**: 
- Verify the sheet contains a row with "Total Gallons" label
- Verify there's a cell containing "w/e" (case-insensitive) with a date in the next column
- Check `src/config/cStoreConfig.js` to ensure the sheet name is mapped

### Scheduling Rules: Not working

**Cause**: Rules are configured but not integrated into the import pipeline.

**Solution**: 
- The config is ready to use, but the Service Tracking import needs to be updated to call `recommendDate(zip, jobType)`
- This integration is planned but not yet complete in this PR

### Estimate Filter: Returns 0 rows

**Cause**: Jobs don't have `is_estimate` flag set.

**Solution**:
- Re-upload your Service Tracking reports
- The parser automatically detects estimates (EST-xxx or "estimate" in description)
- Check `service_jobs` table in Supabase to verify `is_estimate` column values

---

## Files Added/Modified

### New Files
- `src/config/schedulingRules.js` - Scheduling rules configuration
- `src/config/cStoreConfig.js` - C-Store sheet-to-store mapping
- `src/config/dashboardSquares.js` - Dashboard KPI square definitions
- `src/lib/jobs/jobType.js` - Job type detection helpers
- `src/lib/imports/normalizeDeliveryTicket.js` - OCR normalization
- `src/lib/imports/cStoreGallonsImport.js` - C-Store Excel parser
- `sql/2025-11-19_create_cstore_gallons.sql` - Database migration

### Modified Files
- `src/components/ServiceTracking.jsx` - Updated estimate badge to show "ESTIMATE"
- `src/tabs/CStoresGallons.jsx` - Updated to save to Supabase instead of localStorage
- `netlify/functions/billboard-summary.js` - Added `cStoreGallons` to API response

---

## Next Steps

To complete the implementation:

1. **Integrate scheduling rules into Service Tracking import**:
   - Update `src/lib/parseServiceReport.js` or import flow
   - Call `recommendDate(zip, jobType)` for unscheduled jobs
   - Set `suggestedDate` field on job records
   - Detect conflicts when re-importing scheduled jobs

2. **Update OCR import to use normalization**:
   - Modify `netlify/functions/imports-accept.js`
   - Call `normalizeOcrTicket()` before inserting to `delivery_tickets`

3. **Update dashboard to use square config**:
   - Modify `src/components/dashboard/ExecutiveDashboard.jsx` (or similar)
   - Replace hardcoded squares with iteration over `DASHBOARD_SQUARES`

4. **Add admin UI for scheduling rules**:
   - Create a new admin page to add/edit/delete routing rules
   - Store rules in Supabase instead of config file (optional)

---

## License

Same as the main KPI Dashboard project.
