# KPI Data Parser Backend

This small Express backend receives parsed spreadsheet data (JSON) and:

- Suggests target table mappings (/preview)
- Saves rows into Supabase via REST if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set (/save)
- Otherwise returns SQL INSERT statements for manual import

Environment variables:
- SUPABASE_URL (optional if you only want SQL)
- SUPABASE_SERVICE_ROLE_KEY (required to write directly to Supabase)

Run:
1. Install dependencies: `npm ci`
2. Start: `SUPABASE_URL='https://<ref>.supabase.co' SUPABASE_SERVICE_ROLE_KEY='<key>' node index.js`

Endpoints:
- POST /preview  — body: { filename, sheets: [{ name, headers, rows }] }
- POST /save     — body: { filename, sheetName, mapping, targetTable, rows }