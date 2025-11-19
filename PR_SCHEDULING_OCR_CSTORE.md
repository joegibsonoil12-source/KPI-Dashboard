# PR Summary: Scheduling Rules, OCR Fixes, C-Store Gallons Import, and Dashboard Square Config

## Overview
This PR adds four major features to the KPI Dashboard:
1. **Scheduling Rules**: Auto-recommend job dates based on ZIP + job type
2. **Estimate Tracking**: Better visibility for estimate jobs (EST-xxx)
3. **OCR Normalization**: Robust delivery ticket import with validation
4. **C-Store Gallons**: Parse and track weekly gallon totals from Excel

## What's Included

### ✅ Fully Implemented
- **Estimate badges**: Service Tracking now shows "ESTIMATE" instead of "EST" for estimate jobs
- **C-Store import**: Upload "NEW STORE SPREADSHEET" Excel files to extract gallon totals
- **C-Store persistence**: Saves to Supabase `cstore_gallons` table (migration included)
- **Billboard API integration**: `/billboard-summary` now includes `cStoreGallons` array
- **Config files**: All configuration is externalized to `src/config/` directory
- **Helper functions**: Reusable utilities for job type detection, OCR normalization, scheduling

### 📝 Configuration Ready (Needs Integration)
- **Scheduling rules config**: Define ZIP + job type → day mapping in `schedulingRules.js`
- **OCR normalization helper**: Ready to integrate into delivery ticket imports
- **Dashboard squares config**: Define KPI cards in code instead of JSX (ready to wire)

### 🔧 Manual Setup Required
1. **Run SQL migration**: `sql/2025-11-19_create_cstore_gallons.sql` in Supabase
2. **Configure scheduling rules**: Edit `src/config/schedulingRules.js` with your ZIP codes and routes
3. **Configure C-Store mapping**: Edit `src/config/cStoreConfig.js` to map your store sheet names

## Files Changed

### New Configuration Files
- `src/config/schedulingRules.js` - Scheduling rules (ZIP → day mapping)
- `src/config/cStoreConfig.js` - C-Store sheet → store ID mapping
- `src/config/dashboardSquares.js` - Dashboard KPI square definitions

### New Helper Libraries
- `src/lib/jobs/jobType.js` - Job type detection (`estimate`, `install`, `service`)
- `src/lib/imports/normalizeDeliveryTicket.js` - OCR ticket normalization
- `src/lib/imports/cStoreGallonsImport.js` - Parse C-Store Excel files

### Database Migration
- `sql/2025-11-19_create_cstore_gallons.sql` - Creates `cstore_gallons` table with RLS

### Modified Components
- `src/components/ServiceTracking.jsx` - Shows "ESTIMATE" badge instead of "EST"
- `src/tabs/CStoresGallons.jsx` - Now saves to Supabase instead of localStorage
- `netlify/functions/billboard-summary.js` - Fetches and returns C-Store gallons

### Documentation
- `SCHEDULING_OCR_CSTORE_IMPLEMENTATION.md` - Complete feature guide

## Testing Checklist

### C-Store Gallons Import
- [ ] Upload "NEW STORE SPREADSHEET" Excel file in C-Stores tab
- [ ] Verify data shows in summary cards and table
- [ ] Check Supabase `cstore_gallons` table has records
- [ ] Verify billboard API includes `cStoreGallons` array

### Estimate Tracking
- [ ] Upload Service Tracking report with estimates (EST-xxx jobs)
- [ ] Verify "ESTIMATE" badge appears in table
- [ ] Click "Estimates" filter button
- [ ] Verify only estimate rows show

### Build & Deploy
- [ ] `npm run build` succeeds
- [ ] No TypeScript/ESLint errors
- [ ] Deploy to staging/production
- [ ] Verify all features work in deployed environment

## Next Steps (Future PRs)

### Integrate Scheduling Rules
- Wire `recommendDate()` into Service Tracking import flow
- Add `suggestedDate` field to job records
- Show suggested dates in UI with accept/override buttons
- Detect conflicts on re-import (existing scheduled jobs)

### Integrate OCR Normalization
- Update `netlify/functions/imports-accept.js`
- Call `normalizeOcrTicket()` before inserting to `delivery_tickets`
- Show rejected tickets in import review UI

### Dashboard Square Config
- Update Executive Dashboard component
- Iterate over `DASHBOARD_SQUARES` config instead of hardcoded JSX
- Add formatting helpers for currency/gallons/numbers

### Admin UI for Scheduling Rules
- Create admin page to manage scheduling rules
- Store rules in Supabase table (optional)
- Allow adding/editing/deleting routes

## Breaking Changes
None. All new features are additive.

## Dependencies
- Existing: `xlsx` (already in package.json)
- No new dependencies required

## Performance Impact
- Billboard API: Adds one additional Supabase query (`cstore_gallons` table)
- C-Store import: Parses Excel file client-side (may take 1-2 seconds for large files)

## Security Considerations
- `cstore_gallons` table has RLS enabled
- Only authenticated users can read/write gallons data
- No sensitive data exposed in Billboard API (data is aggregated)

## Migration Path
1. Deploy code changes
2. Run SQL migration in Supabase
3. Configure scheduling rules and C-Store mapping
4. Test C-Store import with sample Excel file
5. Re-upload Service Tracking reports to populate estimate flags

## Rollback Plan
If issues occur:
1. Revert PR merge
2. Optionally drop `cstore_gallons` table
3. C-Stores tab will fall back to localStorage (no data loss if not dropped)

## Support & Documentation
See `SCHEDULING_OCR_CSTORE_IMPLEMENTATION.md` for:
- Complete feature documentation
- Configuration examples
- Troubleshooting guide
- API integration details
