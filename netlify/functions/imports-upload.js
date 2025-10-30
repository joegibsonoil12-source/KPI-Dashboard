/**
 * Netlify Serverless Function: Upload Ticket Import
 * 
 * POST /.netlify/functions/imports-upload
 * Redirected from /api/imports/upload via netlify.toml
 * 
 * Handles direct upload of scanned ticket files (PDF/JPG)
 * Creates ticket_imports record and stores files in Supabase Storage
 * 
 * Note: For simplicity, this accepts base64-encoded file data in JSON format
 * For production, consider using a client-side direct upload to Supabase Storage
 * 
 * Environment Variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * 
 * Request Body (JSON):
 * {
 *   files: Array<{ filename: string, data: string (base64), mimeType: string }>,
 *   meta: Optional object (e.g., { importType: 'service' })
 * }
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
 * Validate supported file type
 * @param {string} mimeType - MIME type of file
 * @returns {boolean} - Whether file type is supported
 */
function isSupportedFileType(mimeType) {
  const supportedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
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
    console.debug('[imports-upload] Starting upload process');
    
    // Parse JSON body
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
    
    const { files, meta = {} } = body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
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
    
    // Validate files
    for (const file of files) {
      if (!file.filename || !file.data || !file.mimeType) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid file format',
            message: 'Each file must have filename, data (base64), and mimeType',
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
            message: 'Only PDF and image files (JPG, PNG, GIF) are supported',
          }),
        };
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
      
      // Convert base64 to buffer
      const fileBuffer = Buffer.from(file.data, 'base64');
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ticket-scans')
        .upload(storagePath, fileBuffer, {
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
        size: fileBuffer.length,
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
