/**
 * Netlify Serverless Function: Upload Financial Report
 * 
 * POST /.netlify/functions/financial-upload
 * 
 * Uploads QuickBooks report files, parses them, and stores in financial_imports table
 * 
 * Environment Variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * 
 * Request Body:
 * {
 *   files: [{ filename, data (base64), mimeType }],
 *   reportType: string (optional - will auto-detect),
 *   period: string (optional - will auto-extract, format: YYYY-MM)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   importId: number,
 *   type: string,
 *   period: string,
 *   summary: object
 * }
 */

const { createClient } = require('@supabase/supabase-js');
const qbParser = require('../../server/lib/quickbooksParser');

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
 * Validate file type for financial reports
 * @param {string} mimeType - MIME type
 * @returns {boolean}
 */
function isSupportedFileType(mimeType) {
  const supportedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv', // .csv
    'application/pdf', // .pdf (attachment only for now)
  ];
  return supportedTypes.some(type => mimeType.toLowerCase().includes(type));
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
    console.debug('[financial-upload] Starting upload');
    
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
    
    const { files, reportType, period } = body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No files provided',
          message: 'At least one file is required',
        }),
      };
    }
    
    // Validate first file
    const file = files[0]; // For now, process only first file
    if (!file.filename || !file.data || !file.mimeType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid file format',
          message: 'File must have filename, data (base64), and mimeType',
        }),
      };
    }
    
    if (!isSupportedFileType(file.mimeType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Unsupported file type',
          message: 'Only Excel (.xlsx, .xls) and CSV files are supported for parsing',
        }),
      };
    }
    
    const supabase = createSupabaseClient();
    const fileBuffer = Buffer.from(file.data, 'base64');
    
    // Parse QuickBooks report
    let parseResult;
    try {
      // PDFs are attachment-only for now
      if (file.mimeType.includes('pdf')) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'PDF parsing not supported',
            message: 'Please export reports as Excel or CSV for automatic parsing. PDFs can be added as attachments in future versions.',
          }),
        };
      }
      
      parseResult = qbParser.parseQuickBooksReport(fileBuffer, file.mimeType, reportType);
      console.debug('[financial-upload] Parse result:', {
        type: parseResult.type,
        period: parseResult.period,
        rows: parseResult.parsed.length,
      });
    } catch (parseError) {
      console.error('[financial-upload] Parse error:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Parse failed',
          message: `Could not parse QuickBooks report: ${parseError.message}`,
        }),
      };
    }
    
    // Upload file to storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
    const storagePath = `financial/${parseResult.type}/${timestamp}_${file.filename}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('financial-docs')
      .upload(storagePath, fileBuffer, {
        contentType: file.mimeType,
        upsert: false,
      });
    
    if (uploadError) {
      console.error('[financial-upload] Storage upload error:', uploadError);
      // Continue anyway - we can save without storage
    }
    
    // Use parsed period or provided period
    const finalPeriod = period || parseResult.period || new Date().toISOString().substring(0, 7);
    
    // Insert financial_imports record
    const { data: importRecord, error: insertError } = await supabase
      .from('financial_imports')
      .insert({
        type: parseResult.type,
        period: finalPeriod,
        period_start: parseResult.periodStart,
        period_end: parseResult.periodEnd,
        source: 'quickbooks',
        file_metadata: {
          filename: file.filename,
          size: fileBuffer.length,
          mimeType: file.mimeType,
          storagePath: uploadData?.path || null,
        },
        parsed: parseResult.parsed,
        summary: parseResult.summary,
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('[financial-upload] Insert error:', insertError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Database error',
          message: `Failed to save financial import: ${insertError.message}`,
        }),
      };
    }
    
    console.debug('[financial-upload] Import created:', importRecord.id);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        importId: importRecord.id,
        type: parseResult.type,
        period: finalPeriod,
        summary: parseResult.summary,
        message: `Successfully uploaded and parsed ${parseResult.type} report for ${finalPeriod}`,
      }),
    };
  } catch (error) {
    console.error('[financial-upload] Error:', error);
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
