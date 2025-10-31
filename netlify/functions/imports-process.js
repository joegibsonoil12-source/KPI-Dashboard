/**
 * Netlify Serverless Function: Process Ticket Import
 * 
 * POST /.netlify/functions/imports-process
 * URL format: /api/imports/process/:id
 * 
 * Downloads files from storage, performs OCR and parsing
 * Updates ticket_imports record with parsed data
 * 
 * Environment Variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - GOOGLE_VISION_API_KEY (optional)
 * - AUTO_ACCEPT_HIGH_CONFIDENCE (optional)
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
 *   parsed: object,
 *   confidence: number,
 *   status: string
 * }
 */

const { createClient } = require('@supabase/supabase-js');
const ocrParser = require('../../server/lib/ocrParser');

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
 * Download file from Supabase Storage
 * @param {Object} supabase - Supabase client
 * @param {string} path - Storage path
 * @returns {Promise<Buffer>} - File buffer
 */
async function downloadFile(supabase, path) {
  const { data, error } = await supabase.storage
    .from('ticket-scans')
    .download(path);
  
  if (error) {
    throw new Error(`Failed to download file: ${error.message}`);
  }
  
  // Convert Blob to Buffer
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Merge parsed results from multiple pages
 * @param {Array} pageResults - Array of parsed results, one per page
 * @returns {Object} - Merged result
 */
function mergeMultiPageResults(pageResults) {
  if (!pageResults || pageResults.length === 0) {
    return {
      columnMap: {},
      rows: [],
      summary: { totalRows: 0, scheduledJobs: 0, scheduledRevenue: 0, salesTotal: 0 },
      confidence: 0,
      status: 'needs_review',
    };
  }
  
  // Use first page's column map
  const columnMap = pageResults[0].parsed.columnMap || {};
  
  // Merge all rows, preserving page order
  const allRows = [];
  pageResults.forEach((result, pageIdx) => {
    const pageRows = result.parsed.rows || [];
    pageRows.forEach(row => {
      row.page = pageIdx + 1;
      allRows.push(row);
    });
  });
  
  // Calculate overall confidence (average)
  const avgConfidence = pageResults.reduce((sum, r) => sum + (r.parsed.confidence || 0), 0) / pageResults.length;
  
  // Recalculate summary from merged rows
  const summary = ocrParser.calculateSummary(allRows);
  
  // Determine status
  const autoAccept = process.env.AUTO_ACCEPT_HIGH_CONFIDENCE === 'true';
  const status = (avgConfidence >= 0.95 && autoAccept) ? 'accepted' : 'needs_review';
  
  return {
    columnMap,
    rows: allRows,
    summary,
    confidence: avgConfidence,
    status,
  };
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
    console.debug('[imports-process] Starting processing');
    
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
    
    console.debug('[imports-process] Processing import:', importId);
    
    // Initialize Supabase client
    const supabase = createSupabaseClient();
    
    // Fetch import record
    const { data: importRecord, error: fetchError } = await supabase
      .from('ticket_imports')
      .select('*')
      .eq('id', importId)
      .single();
    
    if (fetchError || !importRecord) {
      console.error('[imports-process] Import not found:', fetchError);
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
    
    const attachedFiles = importRecord.attached_files || [];
    
    if (attachedFiles.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No files attached',
          message: 'Import has no attached files to process',
        }),
      };
    }
    
    console.debug('[imports-process] Processing files:', attachedFiles.length);
    
    // Process each file
    const pageResults = [];
    let fullOcrText = '';
    
    for (const file of attachedFiles) {
      console.debug('[imports-process] Processing file:', file.filename);
      
      try {
        // Download file
        const buffer = await downloadFile(supabase, file.path);
        
        // Perform OCR and parsing
        const result = await ocrParser.parse(buffer, file.mimeType);
        
        if (!result.success) {
          console.warn('[imports-process] Parse failed for file:', file.filename, result.error);
          continue;
        }
        
        pageResults.push(result);
        fullOcrText += result.ocrText + '\n\n';
        
        console.debug('[imports-process] Parsed file:', file.filename, 'rows:', result.parsed.rows.length);
      } catch (error) {
        console.error('[imports-process] Error processing file:', file.filename, error);
        // Continue with other files
      }
    }
    
    if (pageResults.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Processing failed',
          message: 'Failed to process any files',
        }),
      };
    }
    
    // Merge results from all pages
    const merged = mergeMultiPageResults(pageResults);
    
    console.debug('[imports-process] Merged results:', {
      rows: merged.rows.length,
      confidence: merged.confidence,
      status: merged.status,
      scheduledJobs: merged.summary.scheduledJobs,
      scheduledRevenue: merged.summary.scheduledRevenue,
    });
    
    // Run import type inference
    const detection = ocrParser.inferImportType(merged.columnMap, merged.rows);
    
    console.debug(`[imports/process] importId=${importId}, detection=${detection.type}, confidence=${(detection.confidence || 0).toFixed(2)}, hits=${detection.hits.length}`);
    
    console.debug('[imports-process] Detection result:', {
      type: detection.type,
      confidence: detection.confidence,
      hits: detection.hits,
    });
    
    // Update meta with import type if detected as delivery
    const updatedMeta = importRecord.meta || {};
    if (detection.type === 'delivery') {
      updatedMeta.importType = 'delivery';
    }
    updatedMeta.detection = {
      type: detection.type,
      confidence: detection.confidence,
      hits: detection.hits,
      tokenCount: detection.tokenCount,
      detectedAt: new Date().toISOString(),
    };
    
    // Update import record
    const { error: updateError } = await supabase
      .from('ticket_imports')
      .update({
        ocr_text: fullOcrText,
        parsed: merged,
        confidence: merged.confidence,
        status: merged.status,
        meta: updatedMeta,
        processed_at: new Date().toISOString(),
      })
      .eq('id', importId);
    
    if (updateError) {
      console.error('[imports-process] Error updating import:', updateError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Database update failed',
          message: 'Failed to save parsed results',
        }),
      };
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        importId: importId,
        parsed: merged,
        confidence: merged.confidence,
        status: merged.status,
        message: `Successfully processed ${pageResults.length} file(s)`,
      }),
    };
  } catch (error) {
    console.error('[imports-process] Error:', error);
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
