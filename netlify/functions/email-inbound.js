/**
 * Netlify Serverless Function: Inbound Email Webhook
 * 
 * POST /.netlify/functions/email-inbound
 * Redirected from /api/email/inbound via netlify.toml
 * 
 * Receives inbound emails with ticket attachments
 * Saves attachments to storage and creates ticket_imports records
 * 
 * Supports various email providers:
 * - SendGrid Inbound Parse
 * - Mailgun Routes
 * - Postmark Inbound
 * 
 * Environment Variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - EMAIL_WEBHOOK_SECRET (optional): Verify webhook authenticity
 * 
 * Request Body (multipart/form-data or JSON depending on provider):
 * SendGrid format:
 * - from: Sender email
 * - subject: Email subject
 * - attachmentN: Attachment files
 * 
 * Response:
 * {
 *   success: boolean,
 *   importIds: number[],
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
 * Verify webhook secret if configured
 * @param {Object} event - Netlify event object
 * @returns {boolean} - Whether webhook is authentic
 */
function verifyWebhook(event) {
  const configuredSecret = process.env.EMAIL_WEBHOOK_SECRET;
  
  // If no secret is configured, allow all
  if (!configuredSecret) {
    return true;
  }
  
  // Check various headers depending on provider
  const providedSecret = 
    event.headers['x-webhook-secret'] ||
    event.headers['X-Webhook-Secret'] ||
    event.queryStringParameters?.secret;
  
  return providedSecret === configuredSecret;
}

/**
 * Parse multipart form data (for SendGrid/Mailgun)
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
      
      // Skip files without proper names (empty attachments)
      if (!filename || filename === '') {
        file.resume();
        return;
      }
      
      const chunks = [];
      
      file.on('data', (data) => {
        chunks.push(data);
      });
      
      file.on('end', () => {
        // Only save files that have content
        if (chunks.length > 0) {
          files.push({
            fieldname,
            filename,
            encoding,
            mimeType,
            buffer: Buffer.concat(chunks)
          });
        }
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
    
    // Parse the body
    const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
    bb.write(bodyBuffer);
    bb.end();
  });
}

/**
 * Filter files to only PDF and image types
 * @param {Array} files - Array of file objects
 * @returns {Array} - Filtered array
 */
function filterSupportedFiles(files) {
  const supportedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
  ];
  
  return files.filter(file => {
    const mimeType = file.mimeType.toLowerCase();
    return supportedTypes.some(type => mimeType.includes(type));
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
    console.debug('[email-inbound] Received webhook');
    
    // Verify webhook authenticity
    if (!verifyWebhook(event)) {
      console.warn('[email-inbound] Webhook verification failed');
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Forbidden',
          message: 'Invalid webhook secret',
        }),
      };
    }
    
    // Parse email data
    const { files, fields } = await parseMultipartForm(event);
    
    const fromEmail = fields.from || fields.sender || 'unknown';
    const subject = fields.subject || '';
    
    console.debug('[email-inbound] Email from:', fromEmail);
    console.debug('[email-inbound] Subject:', subject);
    console.debug('[email-inbound] Attachments:', files.length);
    
    // Filter to supported file types
    const supportedFiles = filterSupportedFiles(files);
    
    if (supportedFiles.length === 0) {
      console.warn('[email-inbound] No supported attachments found');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          importIds: [],
          message: 'No supported attachments found',
        }),
      };
    }
    
    console.debug('[email-inbound] Supported attachments:', supportedFiles.length);
    
    // Initialize Supabase client
    const supabase = createSupabaseClient();
    
    // Create one import record per attachment
    const importIds = [];
    
    for (const file of supportedFiles) {
      // Create ticket_imports record
      const { data: importRecord, error: insertError } = await supabase
        .from('ticket_imports')
        .insert({
          src: 'email',
          src_email: fromEmail,
          status: 'pending',
          meta: {
            subject: subject,
            receivedAt: new Date().toISOString(),
          },
          attached_files: [],
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('[email-inbound] Error creating import record:', insertError);
        continue;
      }
      
      const importId = importRecord.id;
      console.debug('[email-inbound] Created import record:', importId);
      
      // Upload file to storage
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
      const storagePath = `${importId}/${timestamp}_${file.filename}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ticket-scans')
        .upload(storagePath, file.buffer, {
          contentType: file.mimeType,
          upsert: false,
        });
      
      if (uploadError) {
        console.error('[email-inbound] Error uploading file:', uploadError);
        continue;
      }
      
      console.debug('[email-inbound] Uploaded file:', storagePath);
      
      // Update import record with file metadata
      const fileMetadata = [{
        filename: file.filename,
        path: storagePath,
        mimeType: file.mimeType,
        size: file.buffer.length,
      }];
      
      const { error: updateError } = await supabase
        .from('ticket_imports')
        .update({
          attached_files: fileMetadata,
        })
        .eq('id', importId);
      
      if (updateError) {
        console.error('[email-inbound] Error updating import record:', updateError);
      }
      
      importIds.push(importId);
    }
    
    console.debug('[email-inbound] Created imports:', importIds);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        importIds: importIds,
        message: `Successfully processed ${importIds.length} attachment(s)`,
      }),
    };
  } catch (error) {
    console.error('[email-inbound] Error:', error);
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
