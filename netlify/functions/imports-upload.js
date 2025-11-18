/**
 * Netlify Serverless Function: Upload Ticket Import (modified)
 *
 * - Same behavior as before: create ticket_imports and upload files to Supabase storage
 * - New: optionally copy uploaded file to AWS S3 or Google Drive for company folder copy
 *
 * Environment Variables used (existing):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * New optional environment variables:
 * - AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET
 * - GOOGLE_SERVICE_ACCOUNT_JSON (string-ified JSON), GOOGLE_DRIVE_FOLDER_ID
 *
 * Migration note: copying is optional — nothing will fail if the external copy step can't be completed.
 */
const { createClient } = require('@supabase/supabase-js');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { google } = require('googleapis');
const stream = require('stream');

/* ---------- Supabase helper ---------- */
function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/* ---------- S3 helpers ---------- */
function createS3Client() {
  if (!process.env.AWS_S3_BUCKET) return null;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) {
    console.warn('[imports-upload] AWS env vars missing for S3 copy; skipping S3 copy.');
    return null;
  }
  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

async function uploadToS3(buffer, key, mimeType) {
  const client = createS3Client();
  if (!client) throw new Error('S3 client not available');
  const Bucket = process.env.AWS_S3_BUCKET;
  const params = {
    Bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType
  };
  await client.send(new PutObjectCommand(params));
  return `s3://${Bucket}/${key}`;
}

/* ---------- Google Drive helpers ---------- */
function createDriveClient() {
  if (!process.env.GOOGLE_DRIVE_FOLDER_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return null;
  }
  try {
    const cred = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const jwt = new google.auth.JWT(
      cred.client_email,
      null,
      cred.private_key,
      ['https://www.googleapis.com/auth/drive']
    );
    const drive = google.drive({ version: 'v3', auth: jwt });
    return drive;
  } catch (err) {
    console.warn('[imports-upload] Invalid GOOGLE_SERVICE_ACCOUNT_JSON; skipping Drive copy.', err.message);
    return null;
  }
}

async function uploadToDrive(buffer, filename, mimeType) {
  const drive = createDriveClient();
  if (!drive) throw new Error('Drive client not available');
  const parents = [process.env.GOOGLE_DRIVE_FOLDER_ID];
  // Make a stream for the buffer
  const bufferStream = new stream.PassThrough();
  bufferStream.end(buffer);

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents,
    },
    media: {
      mimeType,
      body: bufferStream
    },
    fields: 'id, webViewLink'
  });
  const file = res.data;
  // webViewLink may require drive sharing configuration, but we return id
  return { id: file.id, webViewLink: file.webViewLink };
}

/* ---------- file type validation (kept as original) ---------- */
/* ---------- file type validation (kept as original) ---------- */
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

/* ---------- handler ---------- */
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed', message: 'Only POST supported' })
    };
  }

  try {
    console.debug('[imports-upload] Starting upload');

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid JSON' }) };
    }

    const { files, meta = {} } = body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'No files provided' }) };
    }

    for (const file of files) {
      if (!file.filename || !file.data || !file.mimeType) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid file format' }) };
      }
      if (!isSupportedFileType(file.mimeType)) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Unsupported file type' }) };
      }
    }

    const supabase = createSupabaseClient();

    // Create ticket_imports record
    const { data: importRecord, error: insertError } = await supabase
      .from('ticket_imports')
      .insert({
        src: 'upload',
        status: 'needs_review', // Changed from 'pending' so imports are visible immediately
        meta,
        attached_files: [],
      })
      .select()
      .single();

    if (insertError) {
      console.error('[imports-upload] Error creating import record:', insertError);
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Database error' }) };
    }

    const importId = importRecord.id;
    const uploadedFiles = [];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];

    // For each file: upload to Supabase, then optionally copy to S3/Drive
    for (const file of files) {
      const storagePath = `${importId}/${timestamp}_${file.filename}`;
      const fileBuffer = Buffer.from(file.data, 'base64');

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ticket-scans')
        .upload(storagePath, fileBuffer, {
          contentType: file.mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('[imports-upload] Error uploading file to Supabase:', uploadError);
        // continue with other files
        continue;
      }

      const fileMeta = {
        filename: file.filename,
        path: storagePath,
        mimeType: file.mimeType,
        size: fileBuffer.length,
      };

      // Try external copy(s) but do not block on failure
      // 1) S3
      if (process.env.AWS_S3_BUCKET) {
        try {
          const s3Key = `${storagePath}`; // same path structure for S3
          const s3Location = await uploadToS3(fileBuffer, s3Key, file.mimeType);
          fileMeta.externalCopy = fileMeta.externalCopy || [];
          fileMeta.externalCopy.push({ type: 's3', location: s3Location });
          console.debug('[imports-upload] Copied to S3:', s3Location);
        } catch (e) {
          console.warn('[imports-upload] S3 copy failed (non-fatal):', e.message);
        }
      }

      // 2) Google Drive
      if (process.env.GOOGLE_DRIVE_FOLDER_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        try {
          const driveRes = await uploadToDrive(fileBuffer, file.filename, file.mimeType);
          fileMeta.externalCopy = fileMeta.externalCopy || [];
          fileMeta.externalCopy.push({ type: 'drive', id: driveRes.id, webViewLink: driveRes.webViewLink || null });
          console.debug('[imports-upload] Copied to Drive:', driveRes.id);
        } catch (e) {
          console.warn('[imports-upload] Drive copy failed (non-fatal):', e.message);
        }
      }

      uploadedFiles.push(fileMeta);
      console.debug('[imports-upload] Uploaded file:', storagePath);
    }

    // Update import record with attached_files
    const { error: updateError } = await supabase
      .from('ticket_imports')
      .update({ attached_files: uploadedFiles })
      .eq('id', importId);

    if (updateError) {
      console.error('[imports-upload] Error updating import record with files:', updateError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        importId,
        files: uploadedFiles.map(f => f.filename),
        message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
        uploadedFiles
      })
    };
  } catch (error) {
    console.error('[imports-upload] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error', message: error.message })
    };
  }
};
