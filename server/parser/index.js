// Simple backend to accept parsed data previews and save to Supabase or return SQL.
// Endpoints:
//   POST /preview  -> body: { filename, sheets: [{ name, headers, rows: [..] }] }
//   POST /save     -> body: { filename, sheetName, mapping: { columnName -> targetColumn }, targetTable, rows: [...] }
//
// Environment variables:
//   SUPABASE_URL (optional — required for direct DB writes)
//   SUPABASE_SERVICE_ROLE_KEY (required for direct DB writes)
//
// Run: npm ci && SUPABASE_URL='https://iskajkwulaaakhoalzdu.supabase.co' SUPABASE_SERVICE_ROLE_KEY='your_key' node index.js

const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

app.post('/preview', (req, res) => {
  try {
    const { filename, sheets } = req.body;
    if (!sheets || !Array.isArray(sheets)) {
      return res.status(400).json({ error: 'Invalid sheets data' });
    }

    const previews = sheets.map(sheet => {
      const { name, headers } = sheet;
      
      // Simple table name suggestion based on filename/sheet name
      const suggestedTable = (name || filename || 'data')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_|_$/g, '');

      // Simple column mapping suggestions
      const suggestedMapping = {};
      headers.forEach(h => {
        const cleanHeader = h.toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/_{2,}/g, '_')
          .replace(/^_|_$/g, '');
        suggestedMapping[h] = cleanHeader || 'column';
      });

      return {
        sheetName: name,
        suggestedTable,
        suggestedMapping,
        rowCount: sheet.rows ? sheet.rows.length : 0
      };
    });

    return res.json({ previews });
  } catch (err) {
    console.error('Preview error', err);
    return res.status(500).json({ error: String(err) });
  }
});

async function saveToSupabaseRows(targetTable, rowsArray) {
  const url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(targetTable)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(rowsArray)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase insert failed: ${res.status} ${txt}`);
  }
  return res.json();
}

app.post('/save', async (req, res) => {
  try {
    const { filename, sheetName, mapping, targetTable, rows } = req.body;
    if (!mapping || !rows || !targetTable) {
      return res.status(400).json({ error: 'Missing mapping, rows, or targetTable' });
    }

    const insertRows = rows.map(r => {
      const out = {};
      for (const srcCol of Object.keys(mapping)) {
        const targetCol = mapping[srcCol];
        out[targetCol] = r[srcCol];
      }
      return out;
    });

    if (SUPABASE_URL && SERVICE_ROLE_KEY) {
      const inserted = await saveToSupabaseRows(targetTable, insertRows);
      return res.json({ success: true, saved: inserted });
    } else {
      const columns = Object.values(mapping).map(c => `"${c}"`).join(', ');
      const sqlRows = insertRows.map(r => {
        const vals = Object.values(mapping).map(c => {
          const v = r[c];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return v;
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');
        return `INSERT INTO ${targetTable} (${columns}) VALUES (${vals});`;
      }).join('\n');
      return res.json({ success: true, sql: sqlRows });
    }
  } catch (err) {
    console.error('Save error', err);
    return res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`KPI parser server listening on ${PORT}`));