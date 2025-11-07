/**
 * Local Upload Server for Development
 * 
 * Express server that handles server-signed uploads to Supabase storage
 * Uses service role credentials to bypass RLS and upload to ticket-scans bucket
 * 
 * IMPORTANT: Do NOT commit SUPABASE_SERVICE_ROLE_KEY to version control
 * Set environment variables before running:
 *   - SUPABASE_URL or VITE_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 * 
 * Usage:
 *   node server/local_upload_server.js
 *   # Or with explicit env vars:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node server/local_upload_server.js
 */

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 4001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

/**
 * Create Supabase admin client with service role key
 */
function createAdminClient() {
  const supabaseUrl = 
    process.env.SUPABASE_URL || 
    process.env.VITE_SUPABASE_URL;
  
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.'
    );
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Helper function to generate timestamp for file paths
 */
function generateTimestamp() {
  return new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
}

/**
 * Helper function to sanitize file names
 */
function sanitizeFileName(fileName) {
  return fileName
    .replace(/\.\./g, '')
    .replace(/[\/\\]/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * POST /uploads/signed
 * 
 * Upload file to Supabase storage using service role credentials
 * 
 * Request body (JSON):
 *   - filename: string (required)
 *   - contentType: string (required)
 *   - base64: string (required) - base64 encoded file content
 * 
 * Response: 
 *   - storagePath: string - Path in storage bucket
 *   - signedViewUrl: string - Signed URL for viewing (expires in 1 hour)
 */
app.post('/uploads/signed', async (req, res) => {
  try {
    console.log('[local-upload-server] Received upload request');
    
    // Validate request body
    const { filename, contentType, base64 } = req.body;
    
    if (!filename || !contentType || !base64) {
      console.error('[local-upload-server] Missing required fields');
      return res.status(400).json({
        error: 'Missing required fields: filename, contentType, base64',
      });
    }
    
    console.log(`[local-upload-server] Uploading file: ${filename} (${contentType})`);
    
    // Create admin client
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
    } catch (configError) {
      console.error('[local-upload-server] Configuration error:', configError.message);
      return res.status(500).json({
        error: 'Server configuration error',
        details: configError.message,
      });
    }
    
    // Generate destination path
    const timestamp = generateTimestamp();
    const sanitizedName = sanitizeFileName(filename);
    const dest = `upload_${timestamp}/${sanitizedName}`;
    
    console.log(`[local-upload-server] Destination: ${dest}`);
    
    // Convert base64 to buffer
    let buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
      console.log(`[local-upload-server] Buffer size: ${buffer.length} bytes`);
    } catch (decodeError) {
      console.error('[local-upload-server] Failed to decode base64:', decodeError.message);
      return res.status(400).json({
        error: 'Invalid base64 encoding',
        details: decodeError.message,
      });
    }
    
    // Upload to ticket-scans bucket
    console.log('[local-upload-server] Uploading to Supabase storage...');
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('ticket-scans')
      .upload(dest, buffer, {
        contentType: contentType,
        cacheControl: '3600',
        upsert: false,
      });
    
    if (uploadError) {
      console.error('[local-upload-server] Upload error:', uploadError);
      return res.status(500).json({
        error: `Failed to upload ${filename}`,
        details: uploadError.message,
      });
    }
    
    console.log('[local-upload-server] Upload successful, creating signed URL...');
    
    // Create signed URL for viewing (expires in 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('ticket-scans')
      .createSignedUrl(dest, 3600);
    
    if (signedUrlError) {
      console.error('[local-upload-server] Signed URL error:', signedUrlError);
      return res.status(500).json({
        error: 'Failed to create signed URL',
        details: signedUrlError.message,
      });
    }
    
    console.log('[local-upload-server] Upload complete!');
    
    // Return success response
    return res.status(200).json({
      storagePath: dest,
      signedViewUrl: signedUrlData.signedUrl,
      filename: filename,
      contentType: contentType,
    });
    
  } catch (error) {
    console.error('[local-upload-server] Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'local-upload-server',
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('Local Upload Server for Development');
  console.log('='.repeat(60));
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Upload endpoint: POST http://localhost:${PORT}/uploads/signed`);
  console.log(`Health check: GET http://localhost:${PORT}/health`);
  console.log('='.repeat(60));
  console.log('Environment:');
  console.log(`  SUPABASE_URL: ${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'NOT SET'}`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'}`);
  console.log('='.repeat(60));
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  WARNING: SUPABASE_SERVICE_ROLE_KEY not set!');
    console.warn('⚠️  Server will not be able to upload files.');
    console.warn('⚠️  Set environment variables before starting:');
    console.warn('⚠️    SUPABASE_SERVICE_ROLE_KEY=xxx node server/local_upload_server.js');
  }
});
