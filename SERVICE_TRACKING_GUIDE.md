# Service Tracking Feature - Implementation Guide

## Overview

The Service Tracking feature allows admin users to upload daily service job reports from Housecall Pro (CSV or XLSX format) and track service revenue, job statuses, and technician assignments.

## Key Features

1. **CSV/XLSX Upload Support**: Accepts daily exports from Housecall Pro
2. **Deduplication**: Re-uploads automatically update existing jobs based on (created_by, job_number)
3. **Status Normalization**: Maps various Housecall Pro statuses to standardized values
4. **Color-Coded UI**: Visual status indicators (green=completed, blue=scheduled, orange=in progress, gray=unscheduled, red=canceled)
5. **Revenue Tracking**: Separates completed revenue from pipeline (scheduled/in-progress)
6. **Date/Tech/Status Filters**: Same filtering patterns as Delivery Tickets for consistency

## Database Setup

### 1. Run the SQL Migration

Execute the migration in your Supabase SQL editor:

```bash
sql/2025-10-16_service_tracking.sql
```

This creates:
- `service_jobs` table with all required fields
- Unique constraint on (created_by, job_number) for deduplication
- RLS policies (authenticated can read, owner/admin/manager can write)
- Indexes on job_date, primary_tech, status
- Views: `service_job_techs`, `view_service_metrics_daily`, `view_service_metrics_monthly`

### 2. Verify Migration

Run these queries to verify setup:

```sql
-- Verify table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'service_jobs';

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'service_jobs';

-- Verify policies
SELECT policyname, cmd FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'service_jobs';
```

## Housecall Pro Export Format

### Expected Columns

The parser auto-maps these Housecall Pro headers:

| Housecall Pro Header | Database Field | Notes |
|---------------------|----------------|-------|
| Job # | job_number | Strips Excel quotes like ="678" |
| Job description | job_description | |
| Job status | raw_status, status | Normalized to standard values |
| Customer name | customer_name | |
| Address | address | |
| Job created date | job_created_at | Parsed to timestamptz |
| Job scheduled start date | scheduled_start_at | Parsed to timestamptz |
| Assigned employees | assigned_employees_raw, primary_tech | First tech becomes primary |
| Job amount | job_amount | Currency parsed to numeric |
| Due amount | due_amount | Currency parsed to numeric |

### Sample CSV Format

```csv
Job #,Job description,Job status,Customer name,Address,Job created date,Job scheduled start date,Assigned employees,Job amount,Due amount
="678",HVAC Repair,Completed,John Doe,123 Main St,2025-10-15,2025-10-16 09:00:00,"Smith, Bob",$1234.56,$0.00
="679",Plumbing Service,Scheduled,Jane Smith,456 Oak Ave,2025-10-15,2025-10-17 14:00:00,"Jones, Alice",$850.00,$850.00
```

### Status Normalization

The parser normalizes various Housecall Pro statuses:

- **completed**: "Completed", "Done", "Finished"
- **canceled**: "Canceled", "Pro canceled", "Void"
- **in_progress**: "In Progress", "Active", "Working"
- **scheduled**: "Scheduled", "Confirmed", "Pending"
- **unscheduled**: Everything else (default)

## Using the Feature

### 1. Access Service Tracking

- Navigate to **Operations** > **Service Tracking** (admin-only)

### 2. Upload a Report

1. Click **Upload Report**
2. Select a CSV or XLSX file from Housecall Pro
3. Review the preview with color-coded statuses and summary statistics

### 3. Review Preview

The preview shows:
- Summary by status (count, revenue, due)
- Total completed revenue vs. pipeline
- Sample rows with mapped fields
- Any parsing warnings

### 4. Import to Database

- Click **Import to Database**
- Jobs are upserted (inserted or updated) based on job_number
- Re-uploading the same job (e.g., after date change) updates the existing record

### 5. Filter and Analyze

Use the filters to analyze jobs:
- **Date**: All, Today, This Week, This Month, This Year, Custom Range
- **Tech**: Filter by technician (primary assignee)
- **Status**: Filter by job status

## Architecture

### Parser (`src/lib/parseServiceReport.js`)

- Handles both CSV and XLSX formats
- Auto-maps Housecall Pro headers to database fields
- Strips Excel formula-quoted strings (="123" -> 123)
- Parses currency ($1,234.56 -> 1234.56)
- Normalizes status values
- Derives job_date from scheduled_start_at or job_created_at
- Extracts primary_tech from comma-separated employee list

### Helpers (`src/lib/serviceHelpers.js`)

- `upsertServiceJobs()`: Bulk upsert with deduplication
- `fetchServiceJobs()`: Fetch with filtering
- `calculateServiceSummary()`: Compute rollups by status
- `getUniqueTechs()`: Extract unique technician names
- `deleteServiceJob()`: Remove a job

### UI (`src/components/ServiceTracking.jsx`)

- Upload interface with file validation
- Preview panel with color-coded status chips
- Summary statistics (overall, by status, completed vs. pipeline)
- Filterable job list table
- Delete functionality with confirmation

## Delivery Tickets Update

The Delivery Tickets page size was reduced from 50 to 15 items per page to reduce clutter. All other functionality (ordering, autosave, RLS, filters) remains unchanged.

## Testing Checklist

- [ ] SQL migration runs successfully in Supabase
- [ ] Service Tracking tab appears under Operations for admin users
- [ ] Upload CSV file previews correctly
- [ ] Upload XLSX file previews correctly
- [ ] Status colors match normalized values
- [ ] Summary rollups calculate correctly
- [ ] Import creates new jobs
- [ ] Re-import same jobs updates instead of duplicating
- [ ] Changing dates in re-upload updates job_date
- [ ] Date filters work (All, Today, Week, Month, Year, Custom)
- [ ] Tech filter works
- [ ] Status filter works
- [ ] Delete job works with confirmation
- [ ] Delivery Tickets shows 15 items per page
- [ ] Delivery Tickets pagination works correctly

## Troubleshooting

### Upload fails with "No recognized columns"

**Cause**: CSV/XLSX headers don't match expected Housecall Pro format

**Solution**: Verify your export has headers like "Job #", "Job status", "Customer name", etc.

### Import fails with "Not authenticated"

**Cause**: User is not logged in

**Solution**: Sign in with a valid user account

### Jobs appear duplicated after import

**Cause**: Unique constraint not working (migration not run)

**Solution**: Run the SQL migration and verify the unique index exists:
```sql
SELECT indexname, indexdef FROM pg_indexes 
WHERE tablename = 'service_jobs' AND indexname LIKE '%job_number%';
```

### RLS denies access

**Cause**: User doesn't have required role

**Solution**: Verify user's role in profiles table:
```sql
SELECT id, email, role FROM auth.users 
JOIN public.profiles ON auth.users.id = public.profiles.id;
```

Admin and Manager roles can update/delete any jobs. Regular users can only manage their own.

## Future Enhancements

Potential improvements for future iterations:
- Export filtered jobs to CSV/Excel
- Bulk edit/update jobs
- Recurring job templates
- Tech performance metrics
- Integration with calendar view
- Email notifications for job status changes
- Mobile-responsive upload interface
