/**
 * Netlify Serverless Function: Migrate local imports
 *
 * POST /.netlify/functions/imports-migrate-local
 *
 * Body:
 * {
 *   "localImports": [
 *     {
 *       "id": "local_...",
 *       "src": "...",
 *       "attached_files": [
 *         { "name": "x.pdf", "mimetype": "application/pdf", "base64": "..." }
 *       ],
 *       "meta": {...}
 *     },
 *     ...
 *   ]
 * }
 *
 * Header:
 * x-migrate-secret: <MIGRATE_SECRET>
 *
 * Requires:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - MIGRATE_SECRET
 */
const { createClient } = require('@supabase/supabase-js');

function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-migrate-secret',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const secretHeader = (event.headers && (event.headers['x-migrate-secret'] || event.headers['X-Migrate-Secret'])) || '';
    if (!process.env.MIGRATE_SECRET || secretHeader !== process.env.MIGRATE_SECRET) {
      return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Unauthorized' }) };
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid JSON' }) };
    }

    const { localImports } = body;
    if (!Array.isArray(localImports) || localImports.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'No localImports provided' }) };
    }

    const supabase = createSupabaseClient();
    const results = [];

    for (const imp of localImports) {
      // Create ticket_import record
      const { data: importRecord, error: insertError } = await supabase
        .from('ticket_imports')
        .insert({
          src: imp.src || 'local_migrated',
          status: 'pending',
          meta: imp.meta || {},
          attached_files: []
        })
        .select()
        .single();

      if (insertError) {
        console.error('[imports-migrate-local] Failed creating import record', insertError);
        results.push({ id: imp.id, success: false, error: insertError.message });
        continue;
      }

      const importId = importRecord.id;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
      const uploadedFiles = [];

      if (Array.isArray(imp.attached_files)) {
        for (const file of imp.attached_files) {
          try {
            const storagePath = `${importId}/${timestamp}_${file.name}`;
            const buffer = Buffer.from(file.base64, 'base64');

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('ticket-scans')
              .upload(storagePath, buffer, { contentType: file.mimetype || 'application/octet-stream', upsert: false });

            if (uploadError) {
              console.error('[imports-migrate-local] Supabase upload error', uploadError);
              uploadedFiles.push({ name: file.name, error: uploadError.message });
              continue;
            }

            uploadedFiles.push({
              filename: file.name,
              path: storagePath,
              mimeType: file.mimetype,
              size: buffer.length
            });
          } catch (err) {
            console.error('[imports-migrate-local] Error handling file', err);
            uploadedFiles.push({ name: file.name, error: err.message });
          }
        }
      }

      // Update import record with files
      const { error: updateError } = await supabase
        .from('ticket_imports')
        .update({ attached_files: uploadedFiles })
        .eq('id', importId);

      if (updateError) {
        console.error('[imports-migrate-local] Failed updating import record with files', updateError);
        results.push({ id: imp.id, success: false, importId, error: updateError.message });
        continue;
      }

      results.push({ id: imp.id, success: true, importId, files: uploadedFiles.map(f => f.filename || f.name) });
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, results }) };
  } catch (err) {
    console.error('[imports-migrate-local] Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
