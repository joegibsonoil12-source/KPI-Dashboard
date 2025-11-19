# Estimate vs Job Distinction Feature - Implementation Summary

## Overview
This implementation adds the ability to distinguish estimates from jobs in both the Service Tracking and Schedule (HCP) views of the KPI Dashboard application.

## Changes Made

### 1. Database Schema (`sql/2025-11-19_add_is_estimate_to_service_jobs.sql`)
- Added `is_estimate` boolean column to `service_jobs` table (default: false)
- Created index on `is_estimate` for efficient filtering
- Backfilled existing records by detecting "estimate" in job_description, status, or raw_status
- Updated `service_jobs_bulk_upsert` RPC function to handle the new field

### 2. Data Parsing (`src/lib/parseServiceReport.js`)
- Added automatic detection of estimates during file parsing
- Detection logic checks for "estimate" keyword (case-insensitive) in:
  - `job_description`
  - `status`
  - `raw_status`
- Sets `is_estimate = true` when any of these fields contain "estimate"

### 3. Service Helpers (`src/lib/serviceHelpers.js`)
- Updated `upsertServiceJobs` to include `is_estimate` field when upserting to database
- Ensures the field is properly passed to the RPC function

### 4. Service Schedule (`src/lib/serviceSchedule.js`)
- Updated `fetchServiceJobsForRange` to map `is_estimate` from database to `isEstimate` in job objects
- Ensures the field is available for the Schedule calendar view

### 5. Service Tracking UI (`src/components/ServiceTracking.jsx`)

#### Added Features:
- **Type Column**: New column in jobs table showing EST (purple) or JOB (gray) pill
- **Type Filter**: Three-button filter (All/Jobs/Estimates) above the table
- **Filter Logic**: Jobs are filtered by type selection before rendering

#### Visual Design:
- Estimates: Purple bordered pill with "EST" text
- Jobs: Gray bordered pill with "JOB" text
- Consistent styling with existing UI components

#### Implementation Details:
- Added `typeFilter` state variable (all | jobs | estimates)
- Modified filter chain to include type filtering after status filtering
- Updated both main table and preview table to show Type column
- Updated colspan in empty state message to account for new column

### 6. Schedule Calendar UI (`src/tabs/HcpScheduleCalendar.jsx`)

#### Added Features:
- **EST Badge**: Small purple badge on estimate cards showing "EST"
- **Dashed Border**: Estimates have dashed border (1px dashed rgba(0,0,0,0.35))
- **Type Filter**: Three-button filter (All/Jobs/Estimates) in search/filter section
- **Enhanced Modal**: Job detail modal shows "Estimate" or "Job" label

#### Visual Design:
- EST badge: Purple border with white/transparent background, positioned in top-right of card
- Dashed border: Subtle visual indicator without changing existing color scheme
- Original color coding maintained for job types/statuses
- Filter buttons: Consistent styling with existing UI

#### Implementation Details:
- Added `scheduleTypeFilter` state variable (all | jobs | estimates)
- Extended `filteredJobs` useMemo to include type filtering
- Modified `DayColumn` component to conditionally render EST badge and dashed border
- Updated `JobDetailModal` to display estimate/job type with job type in header

## Testing

### Build Status
✅ Project builds successfully with no errors
✅ No TypeScript/JavaScript errors
✅ Vite build completes without warnings

### Security Scan
✅ CodeQL security scan completed with 0 alerts
✅ No security vulnerabilities introduced

## Migration Instructions

To enable this feature in a Supabase environment:

1. Run the SQL migration: `sql/2025-11-19_add_is_estimate_to_service_jobs.sql`
2. The migration is idempotent and safe to run multiple times
3. Existing records will be automatically backfilled based on detection logic
4. New uploads will automatically detect and flag estimates

## Backward Compatibility

- ✅ Existing data remains unchanged (except for backfill of `is_estimate`)
- ✅ No breaking changes to existing APIs or functions
- ✅ Default value of `false` for `is_estimate` ensures compatibility
- ✅ Filter defaults to "All" showing both jobs and estimates

## Future Enhancements (Optional)

As noted in the requirements, optional enhancements could include:
- Import/Export support to preserve estimate flag when syncing with Housecall Pro
- Additional detection patterns if other estimate indicators are found
- Analytics/reporting on estimates vs jobs conversion rates

## Files Changed

1. `sql/2025-11-19_add_is_estimate_to_service_jobs.sql` - Database migration
2. `src/lib/parseServiceReport.js` - Parsing logic
3. `src/lib/serviceHelpers.js` - Database helpers
4. `src/lib/serviceSchedule.js` - Schedule data mapping
5. `src/components/ServiceTracking.jsx` - Service Tracking UI
6. `src/tabs/HcpScheduleCalendar.jsx` - Schedule Calendar UI

Total changes: 6 files modified, 305 lines added, 13 lines removed
