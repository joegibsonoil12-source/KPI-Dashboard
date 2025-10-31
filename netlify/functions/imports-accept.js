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
 * Create delivery tickets from parsed rows
 * @param {Object} supabase - Supabase client
 * @param {Array} rows - Parsed data rows
 * @param {number} importId - Import ID for reference
 * @returns {Promise<Array>} - Array of created ticket IDs
 */
async function createDeliveryTickets(supabase, rows, importId) {
  const tickets = [];
  
  for (const row of rows) {
    const ticket = {
      // Map parsed fields to delivery_tickets schema
      customer: row.customer || '',
      address: row.address || '',
      date: row.date || new Date().toISOString().split('T')[0],
      qty: row.gallons || row.qty || 0,
      amount: row.amount || 0,
      status: row.status || 'pending',
      // Add reference to import
      meta: {
        importId: importId,
        importedAt: new Date().toISOString(),
        page: row.page,
        y: row.y,
      },
    };
    
    tickets.push(ticket);
  }
  
  if (tickets.length === 0) {
    return [];
  }
  
  const { data, error } = await supabase
    .from('delivery_tickets')
    .insert(tickets)
    .select('id');
  
  if (error) {
    console.error('[imports-accept] Error creating delivery tickets:', error);
    throw new Error(`Failed to create delivery tickets: ${error.message}`);
  }
  
  return (data || []).map(t => t.id);
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
    
    // Create records based on import type
    if (importType === 'delivery') {
      const ticketIds = await createDeliveryTickets(supabase, rows, importId);
      created.deliveryTickets = ticketIds;
      console.debug('[imports-accept] Created delivery tickets:', ticketIds.length);
    } else {
      const jobIds = await createServiceJobs(supabase, rows, importId);
      created.serviceJobs = jobIds;
      console.debug('[imports-accept] Created service jobs:', jobIds.length);
    }
    
    // Update import status to accepted
    const { error: updateError } = await supabase
      .from('ticket_imports')
      .update({
        status: 'accepted',
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
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        importId: importId,
        created: created,
        message: `Successfully created ${rows.length} record(s)`,
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
