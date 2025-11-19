# Visual Feature Summary: HCP Estimates Import & Tank KPIs

## What Users Will See

### 1. Service Tracking Tab

#### Before
- Only showed regular jobs
- All items had "JOB" badge
- No way to distinguish estimates

#### After
- **EST badge** for estimates vs **JOB badge** for regular jobs
- Filter buttons: `[All] [Jobs] [Estimates]`
- Amounts correctly calculated from Open/Won/Lost values based on outcome
- Example table row for an estimate:
  ```
  EST-5001 | John Smith | [EST] | [Scheduled] | 2025-11-15 | Bob Jones | $2,500.00
  ```

### 2. HCP Schedule Calendar

#### Before
- No visual distinction between estimates and jobs
- Same solid borders for everything

#### After
- **Estimates have dashed borders**
- **EST pill indicator** on estimate cards
- Filter toggles to show/hide estimates
- Enhanced detail modal shows:
  ```
  Estimate #5001
  ESTIMATE • HVAC Maintenance
  John Smith

  Status: Pending
  Outcome: open
  Open Value: $2,500.00
  Won Value: $0.00
  Lost Value: $0.00
  ```

### 3. Dashboard

#### Before
- Only showed service revenue and job counts
- No estimate metrics
- No tank KPIs

#### After - New KPI Row: Estimates
```
┌─────────────────────┬─────────────────────┬─────────────────────┐
│ 💜 Open Estimates   │ 💚 Won Estimates    │ 🔴 Lost Estimates   │
│ $10,500.00          │ $7,950.50           │ $1,200.00           │
│ 5 total estimates   │ Converted to jobs   │ Not converted       │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

#### After - New KPI Row: Tank Metrics
```
┌─────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┐
│ Current Tanks       │ Customers Lost      │ Customers Gained    │ Tanks Set           │
│ 0                   │ 0                   │ 0                   │ 0                   │
│ In inventory        │ This period         │ This period         │ Installed           │
└─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┘
```

## Sample CSV Import

### Input CSV (HCP Estimates Export)
```csv
Estimate #,Customer name,Employees,Outcome,Open value,Won value,Lost value,Estimate status,Created date
5001,John Smith,Bob Jones,open,"$2,500.00",$0.00,$0.00,Pending,2025-11-15
5002,Sarah Johnson,Alice Davis,won,$0.00,"$4,750.50",$0.00,Accepted,2025-11-14
5003,Michael Brown,Charlie Smith,lost,$0.00,$0.00,"$1,200.00",Declined,2025-11-13
```

### What Gets Imported
```
Estimate 1:
  - job_number: EST-5001
  - customer_name: John Smith
  - is_estimate: true
  - hcp_outcome: open
  - open_value: 2500.00
  - won_value: 0.00
  - lost_value: 0.00
  - job_amount: 2500.00 ← Calculated from open_value because outcome=open

Estimate 2:
  - job_number: EST-5002
  - customer_name: Sarah Johnson
  - is_estimate: true
  - hcp_outcome: won
  - open_value: 0.00
  - won_value: 4750.50
  - lost_value: 0.00
  - job_amount: 4750.50 ← Calculated from won_value because outcome=won

Estimate 3:
  - job_number: EST-5003
  - customer_name: Michael Brown
  - is_estimate: true
  - hcp_outcome: lost
  - open_value: 0.00
  - won_value: 0.00
  - lost_value: 1200.00
  - job_amount: 1200.00 ← Calculated from lost_value because outcome=lost
```

## Database Schema Changes

### New Columns in `service_jobs` table
```sql
ALTER TABLE service_jobs ADD COLUMN:
  hcp_estimate_id text             -- "5001"
  estimate_status text             -- "Pending", "Accepted", "Declined"
  hcp_outcome text                 -- "open", "won", "lost"
  estimate_tags text               -- "HVAC Maintenance"
  location_name text               -- "123 Main St"
  open_value numeric(12, 2)        -- 2500.00
  won_value numeric(12, 2)         -- 0.00
  lost_value numeric(12, 2)        -- 0.00
```

### Example Query Results
```sql
SELECT job_number, customer_name, is_estimate, open_value, won_value, lost_value, job_amount
FROM service_jobs
WHERE is_estimate = true;
```

Result:
```
job_number | customer_name   | is_estimate | open_value | won_value | lost_value | job_amount
-----------+-----------------+-------------+------------+-----------+------------+-----------
EST-5001   | John Smith      | true        | 2500.00    | 0.00      | 0.00       | 2500.00
EST-5002   | Sarah Johnson   | true        | 0.00       | 4750.50   | 0.00       | 4750.50
EST-5003   | Michael Brown   | true        | 0.00       | 0.00      | 1200.00    | 1200.00
```

## UI Flow

### Step 1: Upload Estimates CSV
1. User clicks "Upload Report" in Service Tracking tab
2. Selects HCP estimates export file
3. Preview shows:
   - ✓ All 3 estimates detected
   - ✓ Amounts calculated correctly
   - ✓ EST badges visible

### Step 2: Import to Database
1. User clicks "Import" button
2. System calls `service_jobs_bulk_upsert` RPC
3. Estimates inserted with all fields
4. Success message: "Successfully imported 3 estimates"

### Step 3: View in Service Tracking
1. Table shows all jobs and estimates
2. Click "Estimates" filter to see only estimates
3. See EST badges and correct amounts

### Step 4: View in Schedule
1. Calendar shows estimates with dashed borders
2. EST pill on each estimate card
3. Click estimate to see detail modal with outcome and values

### Step 5: View in Dashboard
1. Scroll to estimate KPI cards
2. See aggregate values:
   - Open Estimates: $10,500.00
   - Won Estimates: $7,950.50
   - Lost Estimates: $1,200.00

## Color Coding

### Dashboard KPI Cards

#### Estimate Cards
- **Open Estimates**: Purple gradient (pipeline)
- **Won Estimates**: Green gradient (success)
- **Lost Estimates**: Red gradient (lost opportunity)

#### Tank Cards
- **Current Tanks**: White with border
- **Customers Lost**: White with red border tint
- **Customers Gained**: White with green border tint
- **Tanks Set**: White with border

### Schedule Calendar
- **Estimates**: Dashed border + EST pill
- **Jobs**: Solid border + color from Google Calendar palette

## Key Metrics Available

### Service Tracking
- Total estimates count
- Estimates by status (Pending, Accepted, Declined)
- Estimates by outcome (open, won, lost)
- Total value by outcome

### Dashboard
- Sum of all open estimates
- Sum of all won estimates
- Sum of all lost estimates
- Win rate potential: won / (won + lost)

### Metrics Views (SQL)
```sql
SELECT 
  estimates_count,
  estimates_open_value,
  estimates_won_value,
  estimates_lost_value
FROM view_service_metrics_daily
WHERE job_date = '2025-11-15';
```

## Success Indicators

Users will know it's working when:
1. ✅ Uploading estimates CSV shows correct preview amounts
2. ✅ EST badges appear in Service Tracking table
3. ✅ Dashboard estimate cards show non-zero values
4. ✅ Schedule calendar has dashed borders for estimates
5. ✅ Detail modal shows Open/Won/Lost values
6. ✅ Filtering by "Estimates" shows only estimates

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| All amounts show $0.00 | Check CSV has "Open value", "Won value", "Lost value" columns |
| Estimates not detected | Verify CSV has "Estimate #" and "Outcome" columns |
| Database errors | Run SQL migrations in Supabase |
| EST badge not showing | Clear browser cache, verify is_estimate field |
| Tank KPIs not zero | Expected - they're placeholders until tracking implemented |
