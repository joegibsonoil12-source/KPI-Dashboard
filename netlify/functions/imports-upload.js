/**
 * Netlify Serverless Function: Upload Ticket Import
 * 
 * POST /.netlify/functions/imports-upload
 * Redirected from /api/imports/upload via netlify.toml
 * 
 * Handles direct upload of scanned ticket files (PDF/JPG)
 * Creates ticket_imports record and stores files in Supabase Storage
 * 
 * Environment Variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * 
 * Request Body (multipart/form-data):
 * - files: File(s) to upload
 * - meta: Optional JSON metadata (e.g., { importType: 'service' })
 * 
 * Response:
 * {
 *   success: boolean,
 *   importId: number,
 *   files: string[],
 *   message: string
 * }
 */

const { createClient } = require('@supabase/supabase-js');
const busboy = require('busboy');

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
 * Parse multipart form data
 * @param {Object} event - Netlify event object
 * @returns {Promise<Object>} - { files, fields }
 */
function parseMultipartForm(event) {
  return new Promise((resolve, reject) => {
    const files = [];
    const fields = {};
    
    const bb = busboy({
      headers: {
        'content-type': event.headers['content-type'] || event.headers['Content-Type']
      }
    });
    
    bb.on('file', (fieldname, file, info) => {
      const { filename, encoding, mimeType } = info;
      const chunks = [];
      
      file.on('data', (data) => {
        chunks.push(data);
      });
      
      file.on('end', () => {
        files.push({
          fieldname,
          filename,
          encoding,
          mimeType,
          buffer: Buffer.concat(chunks)
        });
      });
    });
    
    bb.on('field', (fieldname, value) => {
      fields[fieldname] = value;
    });
    
    bb.on('finish', () => {
      resolve({ files, fields });
    });
    
    bb.on('error', (error) => {
      reject(error);
    });
    
    // Parse the body (base64 encoded in Netlify)
    const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
    bb.write(bodyBuffer);
    bb.end();
  });
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
    console.debug('[imports-upload] Starting upload process');
    
    // Parse multipart form data
    const { files, fields } = await parseMultipartForm(event);
    
    if (!files || files.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No files provided',
          message: 'At least one file must be uploaded',
        }),
      };
    }
    
    // Parse metadata if provided
    let meta = {};
    if (fields.meta) {
      try {
        meta = JSON.parse(fields.meta);
      } catch (e) {
        console.warn('[imports-upload] Failed to parse meta field:', e);
      }
    }
    
    console.debug('[imports-upload] Files received:', files.length);
    console.debug('[imports-upload] Meta:', meta);
    
    // Initialize Supabase client
    const supabase = createSupabaseClient();
    
    // Create ticket_imports record
    const { data: importRecord, error: insertError } = await supabase
      .from('ticket_imports')
      .insert({
        src: 'upload',
        status: 'pending',
        meta: meta,
        attached_files: [], // Will be updated after file uploads
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('[imports-upload] Error creating import record:', insertError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Database error',
          message: 'Failed to create import record',
        }),
      };
    }
    
    const importId = importRecord.id;
    console.debug('[imports-upload] Created import record:', importId);
    
    // Upload files to storage
    const uploadedFiles = [];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
    
    for (const file of files) {
      const storagePath = `${importId}/${timestamp}_${file.filename}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ticket-scans')
        .upload(storagePath, file.buffer, {
          contentType: file.mimeType,
          upsert: false,
        });
      
      if (uploadError) {
        console.error('[imports-upload] Error uploading file:', uploadError);
        // Continue with other files even if one fails
        continue;
      }
      
      uploadedFiles.push({
        filename: file.filename,
        path: storagePath,
        mimeType: file.mimeType,
        size: file.buffer.length,
      });
      
      console.debug('[imports-upload] Uploaded file:', storagePath);
    }
    
    // Update import record with file metadata
    const { error: updateError } = await supabase
      .from('ticket_imports')
      .update({
        attached_files: uploadedFiles,
      })
      .eq('id', importId);
    
    if (updateError) {
      console.error('[imports-upload] Error updating import record with files:', updateError);
      // Non-fatal, files are uploaded successfully
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        importId: importId,
        files: uploadedFiles.map(f => f.filename),
        message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
      }),
    };
  } catch (error) {
    console.error('[imports-upload] Error:', error);
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
