# EOD Service Tracking Auto-Update Implementation

## Overview
This implementation enables end-of-day (EOD) Service Tracking uploads to automatically update job statuses and other fields without creating duplicates. Each new file updates existing jobs by Job #, preserving latest non-empty values.

## Key Features

### 1. Server-Side Bulk Upsert RPC
**File**: `sql/2025-10-16_service_tracking.sql`

New function: `public.service_jobs_bulk_upsert(rows jsonb)`

**Features**:
- Atomic server-side processing for better performance
- COALESCE merge semantics: latest file wins for non-null values
- Preserves existing values when new file has blanks
- Automatic job_date derivation from scheduled_start_at or job_created_at
- Raw JSON merging for traceability (old + new)
- Returns count of inserted and updated records

**Security**:
- SECURITY DEFINER function
- Validates auth.uid() before processing
- Respects RLS policies on service_jobs table
- Granted to authenticated users only

### 2. Client-Side Deduplication
**File**: `src/lib/serviceHelpers.js`

New function: `dedupeByJobNumber(rows)`

**Behavior**:
- Removes duplicate job_numbers within a single file
- Last occurrence wins (as per requirements)
- Handles whitespace trimming
- Filters out rows without valid job_number

### 3. Updated Upsert Logic
**File**: `src/lib/serviceHelpers.js`

Modified function: `upsertServiceJobs(rows, userId)`

**Changes**:
- Now calls server-side RPC instead of client-side loop
- Deduplicates rows before sending to server
- Returns detailed counts: inserted, updated, total
- Better error handling with specific messages

### 4. Enhanced UI Feedback
**File**: `src/components/ServiceTracking.jsx`

Modified function: `handleImport()`

**Improvements**:
- Shows detailed import results (X new, Y updated)
- Clears preview on successful import
- Automatically calls Reload to refresh UI
- Summary and Saved Jobs update immediately

## Status Normalization

Status values are normalized during parsing (in `parseServiceReport.js`) and stored as:
- `completed`
- `scheduled`
- `in_progress`
- `unscheduled`
- `canceled`

The RPC uses the normalized status provided by the client.

## Merge Semantics

When a job already exists (by created_by + job_number):

1. **Latest file wins** for non-null values
2. **COALESCE preserves** existing values when new file has blanks/nulls
3. **job_date** is recomputed from scheduled_start_at or job_created_at
4. **raw JSON** is merged (old + new) for complete audit trail
5. **updated_at** timestamp is refreshed

## Testing

### Deduplication Tests
Run: `node /tmp/test-dedupe.mjs`

Tests cover:
- Basic deduplication (last wins)
- Empty/null input handling
- Filtering rows without job_number
- Multiple duplicates (3+)
- Whitespace handling

### Integration Testing Checklist
- [ ] Upload EOD file: confirm statuses, dates, techs update for existing jobs
- [ ] Re-upload with changed data: verify latest file wins, blanks don't erase
- [ ] Import multiple times: counts remain stable
- [ ] Check UI: Saved Jobs and Summary reflect updates immediately
- [ ] Verify no duplicate job_numbers per user

## Database Setup

Users must run the migration file to enable this feature:

```sql
-- Run in Supabase SQL Editor
-- File: sql/2025-10-16_service_tracking.sql
```

This creates/updates:
- `service_jobs` table with unique constraint on (created_by, job_number)
- `service_jobs_bulk_upsert` RPC function
- RLS policies for authenticated users
- Indexes for performance

## Non-Goals (Future Work)

This PR focuses on EOD auto-updates. Future enhancements:
- Dashboard rollups tying Service + Delivery + Store Invoicing
- Advanced analytics per-tech or per-customer
- Scheduled automatic imports

## Files Modified

1. `sql/2025-10-16_service_tracking.sql` - Added RPC function
2. `src/lib/serviceHelpers.js` - Added deduplication, updated upsert
3. `src/components/ServiceTracking.jsx` - Enhanced import flow and feedback
