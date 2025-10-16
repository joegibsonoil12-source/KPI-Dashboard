# Service Tracking Import - Visual Validation Guide

## Before vs After

### BEFORE (Broken State)
**Symptoms:**
- Amount column shows identical value for all rows (e.g., "$2025.00")
- The year 2025 from date field was being parsed as currency
- Names appear in wrong columns
- Dates misaligned
- ZIP codes appearing in time fields
- After import, data doesn't appear saved

**Root Cause:**
CSV parser used simple `split(",")` which broke on quoted fields containing commas:
```csv
..., "Smith, Bob", $1,234.56, ...
```
Got split into:
```
[..., "Smith, Bob", "$1", "234.56", ...]
```

### AFTER (Fixed State)
**Expected Results:**
- Amount column shows correct unique values (e.g., "$808.09", "$133.44", "$1448.59")
- Customer names displayed correctly
- Status pills colored correctly (green=completed, blue=scheduled, orange=in progress, red=canceled)
- Dates align properly
- Tech names extracted from first position
- After import, saved jobs table shows all imported records

## How to Test

### 1. Upload Sample File
```bash
# Use the provided sample file
sample-housecall-pro-export.csv
```

### 2. Verify Preview Table
**Check these values from sample file:**

| Job # | Customer      | Status    | Date       | Tech        | Amount     |
|-------|---------------|-----------|------------|-------------|------------|
| 1001  | John Smith    | completed | 2025-10-15 | Bob Smith   | $450.00    |
| 1002  | Sarah Johnson | completed | 2025-10-15 | Alice Jones | $875.50    |
| 1003  | Michael Brown | scheduled | 2025-10-20 | Bob Smith   | $4,250.00  |
| 1004  | Emily Davis   | in_progress | 2025-10-16 | Alice Jones | $325.00    |
| 1009  | James Rodriguez | canceled | 2025-10-12 | Bob Smith | $0.00    |

**Status Badge Colors:**
- ✅ Green: completed
- 🔵 Blue: scheduled
- 🟠 Orange: in_progress
- ⚫ Gray: unscheduled
- 🔴 Red: canceled

### 3. Verify Summary Stats
**Preview Summary should show:**
- Completed: 8 jobs, $4,151.75 revenue
- Scheduled: 5 jobs, $13,485.00 revenue
- In Progress: 2 jobs, $750.00 revenue
- Canceled: 0 jobs (1009 is $0.00)

### 4. Test Import
1. Click "Import to Database"
2. Preview should disappear
3. Success message: "Successfully imported 15 job(s)"
4. Saved Jobs table should show all 15 jobs
5. Jobs sorted by job_date desc

### 5. Test Re-import
1. Upload same file again
2. Preview should show same data
3. Click "Import to Database"
4. Should see "Successfully imported 15 job(s)" (updates, not duplicates)
5. Check database - still 15 jobs (not 30)

### 6. Test with Modified Data
1. Open sample CSV in Excel
2. Change job 1001 amount to $500.00
3. Change job 1001 date to 2025-10-20
4. Save and re-upload
5. Import should update job 1001 in place

## Edge Cases Tested

### Currency Formats
- ✅ `$1,234.56` → 1234.56
- ✅ `$850.00` → 850.00
- ✅ `$0.00` → 0.00
- ✅ `$4,250.00` → 4250.00

### Excel Quotes
- ✅ `="1001"` → "1001"
- ✅ `="1002"` → "1002"

### Status Variants
- ✅ "Completed" → completed
- ✅ "Scheduled" → scheduled
- ✅ "In Progress" → in_progress
- ✅ "Pending" → scheduled
- ✅ "Pro canceled" → canceled

### Tech Names
- ✅ `"Bob Smith"` → "Bob Smith"
- ✅ `"Smith, Bob"` → "Smith"
- ✅ `"Bob Smith, Alice Jones"` → "Bob Smith"
- ✅ `"Smith, Bob; Jones, Alice"` → "Smith"

### Headers with Special Characters
- ✅ BOM (Byte Order Mark) stripped
- ✅ NBSP (Non-Breaking Space) normalized
- ✅ Various quote styles handled
- ✅ Multiple spaces collapsed

## Delivery Tickets Metrics

### Verify Full Set Calculation
1. Navigate to Delivery Tickets
2. Apply date filter (e.g., "This Month")
3. Note the metrics at top (Total Gallons, Revenue, etc.)
4. Change to page 2
5. **Metrics should NOT change** (they reflect full filtered set, not just current page)

### Per-Truck Breakdown
1. Select "All Trucks" view
2. Per-truck breakdown table should show:
   - Total tickets per truck
   - Total gallons per truck
   - Total revenue per truck
   - All based on full filtered set, not paginated

## Success Criteria

### Parser Tests
- ✅ `test-service-parser.mjs` passes
- ✅ `test-sample-file.mjs` passes
- ✅ `npm run build` succeeds

### UI Tests
- [ ] Preview table shows correct columns and values
- [ ] Status badges colored correctly
- [ ] Import creates records in database
- [ ] Saved jobs table displays after import
- [ ] Re-import updates existing records (no duplicates)
- [ ] Delivery metrics computed over full filtered set

### Data Quality
- [ ] All amounts are valid numbers
- [ ] All job numbers clean (no Excel quotes)
- [ ] All statuses normalized
- [ ] All tech names extracted
- [ ] Dates properly formatted (YYYY-MM-DD)

## Troubleshooting

### If amounts still show as $2025.00:
- Check that CSV has currency values in quotes when they contain commas
- Verify header mapping: "Job amount" → job_amount column

### If names are misaligned:
- Check that CSV parser handles quoted fields
- Verify tech names like "Smith, Bob" stay as one field

### If import doesn't show saved jobs:
- Check browser console for errors
- Verify Supabase connection
- Check that loadJobs() is called after import

### If duplicates appear:
- Verify unique constraint exists on (created_by, job_number)
- Check upsert onConflict parameter
- Verify ignoreDuplicates: false

## Browser Testing

Recommended browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

File size limits:
- CSV: Up to 10 MB (approximately 100,000 rows)
- XLSX: Up to 10 MB (approximately 50,000 rows)
