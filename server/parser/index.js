const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Environment variables for Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Target schemas for KPI data mapping
const TARGET_SCHEMAS = {
  kpis: {
    table: 'kpis',
    columns: {
      metric_name: 'TEXT',
      value: 'NUMERIC',
      period: 'TEXT',
      date_recorded: 'TIMESTAMP'
    }
  },
  revenue: {
    table: 'revenue',
    columns: {
      source: 'TEXT',
      amount: 'NUMERIC',
      date: 'DATE',
      category: 'TEXT'
    }
  },
  operations: {
    table: 'operations',
    columns: {
      operation_type: 'TEXT',
      quantity: 'NUMERIC',
      unit: 'TEXT',
      date: 'DATE',
      location: 'TEXT'
    }
  },
  customers: {
    table: 'customers',
    columns: {
      customer_type: 'TEXT',
      count: 'INTEGER',
      state: 'TEXT',
      date: 'DATE'
    }
  }
};

/**
 * Suggest target table based on data structure
 */
function suggestTargetTable(data) {
  if (!data || !data.length) return 'kpis';
  
  const headers = Object.keys(data[0]).map(h => h.toLowerCase());
  
  // Check for revenue indicators
  if (headers.some(h => h.includes('amount') || h.includes('revenue') || h.includes('sales'))) {
    return 'revenue';
  }
  
  // Check for operations indicators
  if (headers.some(h => h.includes('quantity') || h.includes('gallons') || h.includes('units'))) {
    return 'operations';
  }
  
  // Check for customer indicators
  if (headers.some(h => h.includes('customer') || h.includes('count') || h.includes('state'))) {
    return 'customers';
  }
  
  // Default to kpis
  return 'kpis';
}

/**
 * Propose column mapping between uploaded data and target schema
 */
function proposeMapping(data, targetTable) {
  if (!data || !data.length) return {};
  
  const headers = Object.keys(data[0]);
  const targetSchema = TARGET_SCHEMAS[targetTable];
  if (!targetSchema) return {};
  
  const mapping = {};
  
  headers.forEach(header => {
    const lowerHeader = header.toLowerCase();
    
    // Find best match in target schema
    Object.keys(targetSchema.columns).forEach(targetCol => {
      const lowerTargetCol = targetCol.toLowerCase();
      
      if (lowerHeader.includes(lowerTargetCol) || lowerTargetCol.includes(lowerHeader)) {
        mapping[header] = targetCol;
      } else {
        // Semantic matching
        if ((lowerHeader.includes('metric') || lowerHeader.includes('name')) && targetCol === 'metric_name') {
          mapping[header] = targetCol;
        } else if (lowerHeader.includes('value') && targetCol === 'value') {
          mapping[header] = targetCol;
        } else if (lowerHeader.includes('amount') && targetCol === 'amount') {
          mapping[header] = targetCol;
        } else if (lowerHeader.includes('date') && targetCol.includes('date')) {
          mapping[header] = targetCol;
        } else if (lowerHeader.includes('quantity') && targetCol === 'quantity') {
          mapping[header] = targetCol;
        } else if (lowerHeader.includes('count') && targetCol === 'count') {
          mapping[header] = targetCol;
        }
      }
    });
  });
  
  return mapping;
}

/**
 * Save rows to Supabase table
 */
async function saveToSupabaseRows(tableName, rows) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase configuration missing');
  }
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(rows)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${error}`);
  }
  
  return true;
}

/**
 * Generate SQL INSERT statements as fallback
 */
function generateSQL(tableName, rows, schema) {
  if (!rows || !rows.length) return '';
  
  const columns = Object.keys(rows[0]);
  const values = rows.map(row => {
    const vals = columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      return val;
    });
    return `(${vals.join(', ')})`;
  });
  
  return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n${values.join(',\n')};`;
}

// Routes

/**
 * POST /preview - Parse data and return preview with suggested mapping
 */
app.post('/preview', (req, res) => {
  try {
    const { data, filename } = req.body;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty data provided' });
    }
    
    // Suggest target table
    const suggestedTable = suggestTargetTable(data);
    
    // Propose mapping
    const mapping = proposeMapping(data, suggestedTable);
    
    // Preview first few rows
    const preview = data.slice(0, 10);
    
    res.json({
      success: true,
      filename: filename || 'uploaded_data',
      rowCount: data.length,
      previewRows: preview,
      suggestedTable,
      availableSchemas: Object.keys(TARGET_SCHEMAS),
      proposedMapping: mapping,
      targetSchema: TARGET_SCHEMAS[suggestedTable]
    });
    
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /save - Save data to Supabase or return SQL
 */
app.post('/save', async (req, res) => {
  try {
    const { data, tableName, mapping, returnSQL = false } = req.body;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty data provided' });
    }
    
    if (!tableName) {
      return res.status(400).json({ error: 'Table name is required' });
    }
    
    // Apply mapping if provided
    let mappedData = data;
    if (mapping && Object.keys(mapping).length > 0) {
      mappedData = data.map(row => {
        const mappedRow = {};
        Object.keys(row).forEach(key => {
          const targetKey = mapping[key] || key;
          mappedRow[targetKey] = row[key];
        });
        return mappedRow;
      });
    }
    
    // Add timestamps if schema requires them
    const schema = TARGET_SCHEMAS[tableName];
    if (schema && schema.columns.date_recorded) {
      mappedData = mappedData.map(row => ({
        ...row,
        date_recorded: row.date_recorded || new Date().toISOString()
      }));
    }
    
    // Return SQL if requested or if Supabase not configured
    if (returnSQL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      const sql = generateSQL(tableName, mappedData, schema);
      return res.json({
        success: true,
        method: 'sql',
        rowCount: mappedData.length,
        sql: sql,
        message: 'SQL generated successfully. Execute this in your database.'
      });
    }
    
    // Try to save to Supabase
    try {
      await saveToSupabaseRows(tableName, mappedData);
      res.json({
        success: true,
        method: 'supabase',
        rowCount: mappedData.length,
        message: `Successfully saved ${mappedData.length} rows to ${tableName}`
      });
    } catch (supabaseError) {
      console.error('Supabase save failed:', supabaseError);
      
      // Fallback to SQL
      const sql = generateSQL(tableName, mappedData, schema);
      res.json({
        success: true,
        method: 'sql_fallback',
        rowCount: mappedData.length,
        sql: sql,
        message: `Supabase save failed: ${supabaseError.message}. Generated SQL instead.`,
        error: supabaseError.message
      });
    }
    
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    supabaseConfigured: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`KPI Data Parser service running on port ${PORT}`);
  console.log(`Supabase configured: ${!!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)}`);
  console.log(`Available endpoints:`);
  console.log(`  POST /preview - Parse and preview data`);
  console.log(`  POST /save - Save data to Supabase or generate SQL`);
  console.log(`  GET /health - Health check`);
});