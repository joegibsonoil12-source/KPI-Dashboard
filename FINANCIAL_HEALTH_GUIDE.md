# Financial Health Module - Setup & Usage Guide

## Overview

The Financial Health module provides comprehensive financial tracking and KPI monitoring using standard QuickBooks report exports. No QuickBooks API integration required - simply export reports from QuickBooks and upload them to the dashboard.

## Features

### 📤 Monthly Uploads
- Upload QuickBooks reports in Excel (.xlsx, .xls) or CSV format
- Auto-detection of report type and period
- Upload history with metadata tracking
- Support for 10 standard QuickBooks report types

### 💰 Financial KPIs Dashboard
- **Revenue & Profit**: Total revenue, gross margin %, net income
- **Segment Profitability**: Revenue and margins by business unit (from P&L by Class)
- **Cash & Liquidity**: Cash balance, AR, AP
- **AR Health**: Accounts receivable with aging breakdown
- **Company Health Score**: 0-100 composite score visible on main dashboard

### 📈 Trends
- Period-over-period comparison
- Monthly/quarterly/yearly trends
- Key metrics tracking across time periods

## Supported QuickBooks Reports

The module parses these 10 standard QuickBooks reports:

1. **Profit and Loss** - Revenue, COGS, expenses, net income
2. **Profit and Loss by Class** - Segment profitability (e.g., Delivery, Service, Store)
3. **Profit and Loss by Location** - Performance by location
4. **Balance Sheet** - Assets, liabilities, equity, cash, AR, AP
5. **Statement of Cash Flows** - Operating, investing, financing cash flows
6. **Accounts Receivable Aging Summary** - AR with aging buckets (0-30, 31-60, etc.)
7. **Accounts Payable Aging Summary** - AP with aging buckets
8. **Sales by Product/Service Summary** - Revenue by product/fuel type
9. **Expenses by Vendor Summary** - Top vendors and expenses
10. **Payroll Summary** - Total payroll costs

## Setup Instructions

### 1. Database Migration

Run the migration to create the `financial_imports` table:

```bash
# Using Supabase CLI
supabase migration up

# Or manually in Supabase SQL Editor
# Execute: supabase/migrations/0020_create_financial_imports.sql
```

### 2. Storage Bucket

Create the `financial-docs` storage bucket in Supabase:

```sql
-- In Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('financial-docs', 'financial-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Admin/Manager can upload financial docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'financial-docs' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND LOWER(role) IN ('admin', 'manager')
    )
  );

CREATE POLICY "Authenticated users can view financial docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'financial-docs');

CREATE POLICY "Admin can delete financial docs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'financial-docs' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND LOWER(role) = 'admin'
    )
  );
```

### 3. Netlify Function Configuration

Ensure these environment variables are set in Netlify:

```
SUPABASE_URL=your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Usage Guide

### Exporting Reports from QuickBooks

1. Log into QuickBooks Online
2. Navigate to **Reports** section
3. Search for and select the desired report (e.g., "Profit and Loss")
4. Set the date range (month, quarter, or year)
5. Click **Export** → **Export to Excel**
6. Save the file

### Uploading Reports to Dashboard

1. Navigate to **Financial Health** → **Monthly Uploads** tab
2. (Optional) Select report type and period - the system will auto-detect if left blank
3. Click **Choose File** and select your QuickBooks export
4. Wait for upload and parsing to complete
5. Review the success message

### Viewing Financial KPIs

1. Navigate to **Financial Health** → **Financial KPIs** tab
2. Select period from dropdown (defaults to "Latest")
3. View key metrics:
   - Revenue & Profit cards
   - Segment Profitability (if P&L by Class uploaded)
   - Cash & Liquidity metrics
   - Company Health Score

### Analyzing Trends

1. Navigate to **Financial Health** → **Trends** tab
2. View period-over-period comparison table
3. Review summary cards for averages and totals

### Company Health Score

The Company Health Score (0-100) appears on the main dashboard and is calculated from:

- **Profitability (30 pts)**: Net income margin
- **Liquidity (25 pts)**: Cash-to-AP ratio
- **AR Health (25 pts)**: Percentage of AR over 60 days (lower is better)
- **Gross Margin (20 pts)**: Gross profit margin percentage

**Score Interpretation:**
- 80-100: 💪 Excellent - Strong financials
- 65-79: 👍 Good - Solid performance
- 50-64: ⚠️ Fair - Some areas need attention
- <50: 🔴 Needs Improvement

Click the health score card to navigate to detailed Financial KPIs.

## Parser Details

### Auto-Detection

The parser automatically detects:
- Report type from header text patterns
- Period/date range from report headers
- Column structure and data rows

### Supported File Formats

- **Excel**: .xlsx, .xls
- **CSV**: Standard comma-separated values
- **PDF**: Not yet supported for parsing (can upload as attachment)

### Data Normalization

The parser:
- Removes currency symbols and formatting
- Handles parentheses as negative values
- Skips total rows and header/footer content
- Normalizes account names and categories
- Calculates summary metrics automatically

## Troubleshooting

### Upload Fails

**Error: "Could not detect QuickBooks report type"**
- Ensure you're uploading a standard QuickBooks report export
- Try manually selecting the report type in the upload form
- Verify the file is Excel or CSV format

**Error: "Parse failed"**
- Check that the QuickBooks export is in standard format
- Ensure there are no manual edits to the exported file
- Try exporting the report again from QuickBooks

### Missing Data

**"No financial data available" in Health Score**
- Upload at least a Profit and Loss report
- Upload a Balance Sheet for cash/AR/AP metrics
- Ensure reports are for the same period

### Permissions

**"Permission denied" errors**
- Verify user role is Admin or Manager
- Check RLS policies are applied correctly
- Confirm storage bucket policies are set up

## Best Practices

1. **Consistent Periods**: Upload all report types for the same period (e.g., all for "2025-01")
2. **Monthly Cadence**: Upload reports monthly for accurate trends
3. **Standard Exports**: Always use QuickBooks' standard export feature - don't manually edit files
4. **Backup Original Files**: Keep original QuickBooks exports for reference
5. **Review Summaries**: After upload, review the calculated summaries for accuracy

## Future Enhancements

Potential improvements for future versions:
- PDF report parsing support
- Additional report types (Inventory, Job Costing, etc.)
- Chart visualizations in Trends tab
- Budget vs. actual comparisons
- Custom KPI definitions
- Automated email upload from QuickBooks

## Security Summary

✅ **No security vulnerabilities detected** by CodeQL scanner.

Security considerations:
- All uploads require authentication
- Admin/Manager role required for uploads
- RLS policies protect financial data
- Files stored in private Supabase bucket
- Service role key required for Netlify functions
- No sensitive data logged or exposed

## Support

For issues or questions:
1. Check this guide for common solutions
2. Review Supabase logs for error details
3. Verify environment variables and permissions
4. Contact system administrator for access issues
