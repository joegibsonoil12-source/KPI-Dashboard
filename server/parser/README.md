# KPI Data Parser Service

A backend service for parsing uploaded spreadsheets/CSVs and saving KPI data to Supabase (or returning SQL as fallback).

## Purpose

This service provides a REST API to:

1. **Parse uploaded data** - Analyze CSV/spreadsheet data structure
2. **Suggest table mappings** - Automatically suggest appropriate database schemas
3. **Preview data** - Show parsed data before saving
4. **Save to database** - Direct writes to Supabase or generate SQL for manual execution

## Environment Variables

### Required for Direct Database Writes

To enable direct writes to Supabase, set these environment variables:

```bash
export SUPABASE_URL="https://your-project-ref.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

**Important Security Notes:**
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret and secure
- Never commit these values to version control
- The service role key has full database access

### Optional Variables

```bash
export PORT=4000  # Default port (optional)
```

## Installation & Setup

```bash
# Navigate to the parser directory
cd server/parser

# Install dependencies
npm ci

# Set environment variables (if you want direct DB writes)
export SUPABASE_URL="https://your-project-ref.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Start the service
npm start
```

## Quick Start (SQL Mode)

If you don't have Supabase configured, the service will automatically generate SQL statements:

```bash
cd server/parser
npm ci
npm start
```

The service will run on `http://localhost:4000` and generate SQL for manual database execution.

## API Endpoints

### POST /preview

Parse and preview uploaded data with suggested table mapping.

**Request:**
```json
{
  "data": [
    { "metric": "Revenue", "value": 150000, "date": "2024-01-01" },
    { "metric": "Customers", "value": 1250, "date": "2024-01-01" }
  ],
  "filename": "kpi_data.csv"
}
```

**Response:**
```json
{
  "success": true,
  "filename": "kpi_data.csv",
  "rowCount": 2,
  "previewRows": [...],
  "suggestedTable": "kpis",
  "availableSchemas": ["kpis", "revenue", "operations", "customers"],
  "proposedMapping": {
    "metric": "metric_name",
    "value": "value",
    "date": "date_recorded"
  },
  "targetSchema": {
    "table": "kpis",
    "columns": {
      "metric_name": "TEXT",
      "value": "NUMERIC",
      "period": "TEXT",
      "date_recorded": "TIMESTAMP"
    }
  }
}
```

### POST /save

Save data to Supabase or generate SQL.

**Request:**
```json
{
  "data": [...],
  "tableName": "kpis",
  "mapping": {
    "metric": "metric_name",
    "value": "value",
    "date": "date_recorded"
  },
  "returnSQL": false
}
```

**Response (Supabase mode):**
```json
{
  "success": true,
  "method": "supabase",
  "rowCount": 2,
  "message": "Successfully saved 2 rows to kpis"
}
```

**Response (SQL mode):**
```json
{
  "success": true,
  "method": "sql",
  "rowCount": 2,
  "sql": "INSERT INTO kpis (metric_name, value, date_recorded) VALUES ('Revenue', 150000, '2024-01-01'), ('Customers', 1250, '2024-01-01');",
  "message": "SQL generated successfully. Execute this in your database."
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "supabaseConfigured": true
}
```

## Supported Data Schemas

The service automatically detects and maps to these schemas:

### KPIs Table
```sql
CREATE TABLE kpis (
  metric_name TEXT,
  value NUMERIC,
  period TEXT,
  date_recorded TIMESTAMP
);
```

### Revenue Table
```sql
CREATE TABLE revenue (
  source TEXT,
  amount NUMERIC,
  date DATE,
  category TEXT
);
```

### Operations Table
```sql
CREATE TABLE operations (
  operation_type TEXT,
  quantity NUMERIC,
  unit TEXT,
  date DATE,
  location TEXT
);
```

### Customers Table
```sql
CREATE TABLE customers (
  customer_type TEXT,
  count INTEGER,
  state TEXT,
  date DATE
);
```

## Example Usage

### 1. Parse CSV Data

```bash
curl -X POST http://localhost:4000/preview \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {"metric": "Propane Sales", "value": 125000, "period": "monthly"},
      {"metric": "New Customers", "value": 45, "period": "monthly"}
    ],
    "filename": "monthly_kpis.csv"
  }'
```

### 2. Save with Custom Mapping

```bash
curl -X POST http://localhost:4000/save \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {"revenue_source": "Propane", "total": 125000, "report_date": "2024-01-01"}
    ],
    "tableName": "revenue",
    "mapping": {
      "revenue_source": "source",
      "total": "amount",
      "report_date": "date"
    }
  }'
```

### 3. Generate SQL Only

```bash
curl -X POST http://localhost:4000/save \
  -H "Content-Type: application/json" \
  -d '{
    "data": [...],
    "tableName": "kpis",
    "returnSQL": true
  }'
```

## Error Handling

The service handles various error scenarios:

- **Invalid data format** - Returns 400 with error message
- **Missing Supabase config** - Automatically falls back to SQL generation
- **Supabase API errors** - Returns SQL fallback with error details
- **Server errors** - Returns 500 with error details

## Development

```bash
# Install dependencies
npm ci

# Start in development mode
npm start

# The service will automatically reload on file changes
```

## Security Considerations

1. **Service Role Key** - Keep your Supabase service role key secure
2. **CORS** - Configure CORS appropriately for production
3. **Rate Limiting** - Consider adding rate limiting for production use
4. **Input Validation** - The service validates JSON input but consider additional sanitization
5. **File Size Limits** - JSON body is limited to 50MB

## Troubleshooting

### Service won't start
- Check that Node.js is installed
- Verify all dependencies are installed (`npm ci`)
- Check for port conflicts (default: 4000)

### Supabase connection issues
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check Supabase project status
- Verify network connectivity
- Review API key permissions

### Data parsing issues
- Ensure data is in JSON array format
- Check column names match expected patterns
- Verify data types are compatible with target schema

## Integration

This service is designed to work with frontend upload components:

```javascript
// Frontend example
const uploadData = async (csvData) => {
  // First, preview the data
  const previewResponse = await fetch('/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: csvData })
  });
  
  const preview = await previewResponse.json();
  
  // Then save with user-confirmed mapping
  const saveResponse = await fetch('/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: csvData,
      tableName: preview.suggestedTable,
      mapping: preview.proposedMapping
    })
  });
  
  return await saveResponse.json();
};
```