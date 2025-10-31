/**
 * Netlify Serverless Function: Accept Ticket Import
 * 
 * POST /.netlify/functions/imports-accept
 * URL format: /api/imports/accept/:id
 * 
 * Accepts a parsed import and creates actual delivery_tickets or service_jobs
 * Marks the import as 'accepted'
 * 
 * Environment Variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * 
 * Request Body:
 * {
 *   importId: number
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   importId: number,
 *   created: { deliveryTickets?: number[], serviceJobs?: number[] },
 *   message: string
 * }
 */

const { createClient } = require('@supabase/supabase-js');

/**
 * Create Supabase client with service role key
 * @returns {Object} - Supabase client instance
 */
function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Determine import type from metadata or parsed data
 * @param {Object} importRecord - Import record
 * @returns {string} - 'delivery' or 'service'
 */
function determineImportType(importRecord) {
  // Check meta.importType first
  if (importRecord.meta && importRecord.meta.importType) {
    return importRecord.meta.importType;
  }
  
  // Try to infer from parsed data
  const parsed = importRecord.parsed;
  if (!parsed || !parsed.rows || parsed.rows.length === 0) {
    return 'service'; // Default to service
  }
  
  // Check if any rows have 'gallons' field (indicates delivery)
  const hasGallons = parsed.rows.some(row => 
    row.gallons !== undefined || row.qty !== undefined
  );
  
  return hasGallons ? 'delivery' : 'service';
}

/**
 * Query delivery_tickets table schema
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Array>} - Array of column names
 */
async function getDeliveryTicketsSchema(supabase) {
  console.debug('[imports-accept] Querying delivery_tickets schema');
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'delivery_tickets'
      ORDER BY ordinal_position
    `
  });
  
  // If RPC doesn't work, try direct query
  if (error) {
    const { data: directData, error: directError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'delivery_tickets');
    
    if (directError) {
      console.error('[imports-accept] Schema query failed:', directError);
      return null;
    }
    
    return directData || [];
  }
  
  return data || [];
}

/**
 * Validate and map row to delivery_tickets columns
 * @param {Object} row - Parsed row data
 * @param {Array} schemaColumns - Schema column names
 * @param {number} importId - Import ID
 * @returns {Object|null} - Mapped ticket object or null if invalid
 */
function mapRowToDeliveryTicket(row, schemaColumns, importId) {
  // Check minimal requirements
  const hasDate = row.date || row.delivery_date;
  const hasTicketOrTruck = row.ticket || row.truck || row.driver;
  const hasAmount = (row.amount && row.amount > 0) || (row.gallons && row.gallons > 0) || (row.qty && row.qty > 0);
  
  if (!hasDate || !hasTicketOrTruck || !hasAmount) {
    console.debug('[imports-accept] Row validation failed:', { hasDate, hasTicketOrTruck, hasAmount });
    return null;
  }
  
  // Field mapping heuristics
  const fieldMappings = {
    // date fields
    date: ['date', 'delivery_date', 'deliverydate'],
    // customer fields
    customerName: ['customer', 'customername', 'customer_name', 'account'],
    // product fields
    product: ['product', 'fuel', 'fuel_type'],
    // driver fields
    driver: ['driver', 'tech', 'technician'],
    // truck fields
    truck: ['truck', 'vehicle', 'truck_number'],
    // quantity fields
    qty: ['qty', 'gallons', 'quantity', 'gal'],
    // price fields
    price: ['price', 'unit_price', 'unitprice'],
    // tax fields
    tax: ['tax', 'sales_tax'],
    // amount fields
    amount: ['amount', 'total', 'extension', 'ext'],
    // status fields
    status: ['status', 'state'],
    // notes fields
    notes: ['notes', 'description', 'comments'],
    // store fields
    store: ['store', 'location', 'branch'],
    // account fields
    account: ['account', 'account_number', 'acct'],
  };
  
  const ticket = {};
  
  // Map fields only if they exist in schema
  for (const [dbColumn, possibleFields] of Object.entries(fieldMappings)) {
    // Check if column exists in schema (case-insensitive)
    const schemaColumn = schemaColumns.find(col => 
      col.column_name?.toLowerCase() === dbColumn.toLowerCase()
    );
    
    if (!schemaColumn) {
      continue;
    }
    
    // Try to find value in row using possible field names
    let value = null;
    for (const field of possibleFields) {
      const rowKey = Object.keys(row).find(k => k.toLowerCase() === field);
      if (rowKey && row[rowKey] !== undefined && row[rowKey] !== '') {
        value = row[rowKey];
        break;
      }
    }
    
    // Set value if found
    if (value !== null) {
      ticket[schemaColumn.column_name] = value;
    }
  }
  
  // Add metadata if meta column exists
  const metaColumn = schemaColumns.find(col => 
    col.column_name?.toLowerCase() === 'meta'
  );
  
  if (metaColumn) {
    ticket.meta = {
      importId: importId,
      importedAt: new Date().toISOString(),
      page: row.page,
      y: row.y,
      rawColumns: row.rawColumns,
    };
  }
  
  return ticket;
}

/**
 * Create delivery tickets from parsed rows
 * @param {Object} supabase - Supabase client
 * @param {Array} rows - Parsed data rows
 * @param {number} importId - Import ID for reference
 * @returns {Promise<Object>} - Result with created IDs and failed rows
 */
async function createDeliveryTickets(supabase, rows, importId) {
  console.debug('[imports-accept] Creating delivery tickets for', rows.length, 'rows');
  
  // Query schema
  const schemaColumns = await getDeliveryTicketsSchema(supabase);
  
  if (!schemaColumns || schemaColumns.length === 0) {
    console.error('[imports-accept] delivery_tickets table not found or has no columns');
    throw new Error(
      'STOP: delivery_tickets table schema not found. ' +
      'Please verify the table exists and has proper columns. ' +
      'Expected columns: id, date, customerName, product, driver, truck, qty, price, tax, amount, status, notes, account, store, meta, created_at, updated_at'
    );
  }
  
  console.debug('[imports-accept] delivery_tickets schema columns:', 
    schemaColumns.map(c => c.column_name).join(', ')
  );
  
  // Map and validate rows
  const tickets = [];
  const failedRows = [];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const ticket = mapRowToDeliveryTicket(row, schemaColumns, importId);
    
    if (ticket && Object.keys(ticket).length > 0) {
      tickets.push(ticket);
    } else {
      failedRows.push({
        index: i,
        row: row,
        reason: 'Missing required fields or validation failed',
      });
    }
  }
  
  console.debug('[imports-accept] Mapped tickets:', tickets.length, 'failed:', failedRows.length);
  
  if (tickets.length === 0) {
    return {
      ids: [],
      failed: failedRows,
    };
  }
  
  // Batch insert
  const { data, error } = await supabase
    .from('delivery_tickets')
    .insert(tickets)
    .select('id');
  
  if (error) {
    console.error('[imports-accept] Error creating delivery tickets:', error);
    throw new Error(`Failed to create delivery tickets: ${error.message}`);
  }
  
  const ids = (data || []).map(t => t.id);
  
  console.debug('[imports-accept] Created delivery tickets:', ids.length);
  
  return {
    ids,
    failed: failedRows,
  };
}

/**
 * Create service jobs from parsed rows
 * @param {Object} supabase - Supabase client
 * @param {Array} rows - Parsed data rows
 * @param {number} importId - Import ID for reference
 * @returns {Promise<Array>} - Array of created job IDs
 */
async function createServiceJobs(supabase, rows, importId) {
  const jobs = [];
  
  for (const row of rows) {
    const job = {
      // Map parsed fields to service_jobs schema
      job_number: row.jobNumber || row.job || '',
      customer: row.customer || '',
      address: row.address || '',
      job_date: row.date || new Date().toISOString().split('T')[0],
      job_amount: row.amount || 0,
      status: row.status || 'pending',
      tech: row.tech || row.technician || '',
      description: row.description || row.service || '',
      // Add reference to import
      meta: {
        importId: importId,
        importedAt: new Date().toISOString(),
        page: row.page,
        y: row.y,
      },
    };
    
    jobs.push(job);
  }
  
  if (jobs.length === 0) {
    return [];
  }
  
  const { data, error } = await supabase
    .from('service_jobs')
    .insert(jobs)
    .select('id');
  
  if (error) {
    console.error('[imports-accept] Error creating service jobs:', error);
    throw new Error(`Failed to create service jobs: ${error.message}`);
  }
  
  return (data || []).map(j => j.id);
}

/**
 * Netlify Serverless Handler
 * @param {Object} event - Netlify event object
 * @param {Object} context - Netlify context object
 */
exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed',
        message: 'Only POST requests are supported',
      }),
    };
  }

  try {
    console.debug('[imports-accept] Starting acceptance process');
    
    // Parse request body
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON',
        }),
      };
    }
    
    const { importId } = body;
    
    if (!importId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing importId',
          message: 'importId is required',
        }),
      };
    }
    
    console.debug('[imports-accept] Accepting import:', importId);
    
    // Initialize Supabase client
    const supabase = createSupabaseClient();
    
    // Fetch import record
    const { data: importRecord, error: fetchError } = await supabase
      .from('ticket_imports')
      .select('*')
      .eq('id', importId)
      .single();
    
    if (fetchError || !importRecord) {
      console.error('[imports-accept] Import not found:', fetchError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Import not found',
          message: `No import found with id ${importId}`,
        }),
      };
    }
    
    // Check if already accepted
    if (importRecord.status === 'accepted') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Already accepted',
          message: 'This import has already been accepted',
        }),
      };
    }
    
    // Check if parsed data exists
    if (!importRecord.parsed || !importRecord.parsed.rows) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Not processed',
          message: 'Import must be processed before acceptance',
        }),
      };
    }
    
    const importType = determineImportType(importRecord);
    const rows = importRecord.parsed.rows;
    
    console.debug('[imports-accept] Import type:', importType, 'rows:', rows.length);
    
    const created = {};
    let failedRows = [];
    
    // Create records based on import type
    if (importType === 'delivery') {
      const result = await createDeliveryTickets(supabase, rows, importId);
      created.deliveryTickets = result.ids;
      failedRows = result.failed || [];
      console.debug('[imports-accept] Created delivery tickets:', result.ids.length, 'failed:', failedRows.length);
    } else {
      const jobIds = await createServiceJobs(supabase, rows, importId);
      created.serviceJobs = jobIds;
      console.debug('[imports-accept] Created service jobs:', jobIds.length);
    }
    
    // Update import status to accepted
    // Store parsed data with accepted IDs
    const updatedParsed = {
      ...importRecord.parsed,
      acceptedIds: importType === 'delivery' ? created.deliveryTickets : created.serviceJobs,
      failedRows: failedRows,
    };
    
    const { error: updateError } = await supabase
      .from('ticket_imports')
      .update({
        status: 'accepted',
        parsed: updatedParsed,
        meta: {
          ...importRecord.meta,
          acceptedAt: new Date().toISOString(),
          importType: importType,
          created: created,
        },
      })
      .eq('id', importId);
    
    if (updateError) {
      console.error('[imports-accept] Error updating import status:', updateError);
      // Non-fatal, records were already created
    }
    
    const successCount = importType === 'delivery' 
      ? created.deliveryTickets?.length || 0
      : created.serviceJobs?.length || 0;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        importId: importId,
        created: created,
        inserted: successCount,
        failed: failedRows.length,
        failedRows: failedRows,
        message: `Successfully created ${successCount} record(s)${failedRows.length > 0 ? `, ${failedRows.length} failed` : ''}`,
      }),
    };
  } catch (error) {
    console.error('[imports-accept] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};
