import React, { useState } from 'react';

/*
Minimal VideoUploader example (React). Uses fetch to upload to Supabase Storage
and then updates the procedures row via Supabase REST or supabase-js.

Props:
- procedureId: id of the procedure (uuid or numeric) to update
- supabaseUrl: https://<project>.supabase.co
- supabaseAnonKey: anon key from project settings
- transcoderWebhook: optional URL to POST transcode job { bucket, object_path, procedure_id }
- onSuccess: optional callback when upload is complete
*/
export default function VideoUploader({
  procedureId,
  supabaseUrl,
  supabaseAnonKey,
  transcoderWebhook = null,
  onSuccess = null
}) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);

  if (!procedureId || !supabaseUrl || !supabaseAnonKey) {
    return (
      <div style={{ color: 'red', padding: 8 }}>
        VideoUploader requires procedureId, supabaseUrl, and supabaseAnonKey props.
      </div>
    );
  }

  async function handleUpload() {
    if (!file) {
      setStatus('Please select a video file.');
      return;
    }

    setUploading(true);
    setStatus('Uploading...');
    
    try {
      const bucket = 'videos';
      const objectPath = `uploads/${Date.now()}-${file.name}`;

      // Upload via Storage API (client-side) using anon key, or you can upload from server-side.
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(objectPath)}`;

      const resp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: file
      });

      if (!resp.ok) {
        const text = await resp.text();
        setStatus(`Upload failed: ${resp.status} ${text}`);
        return;
      }

      setStatus('Saved original path to DB...');

      // Update the procedures row to set video_original_path
      // Using Supabase REST: PATCH /rest/v1/procedures?id=eq.{procedureId}
      const patchUrl = `${supabaseUrl}/rest/v1/procedures?id=eq.${encodeURIComponent(procedureId)}`;
      const patchResp = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`, // If RLS prevents anon patch, you must do this server-side with service role
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({ video_original_path: `${bucket}/${objectPath}` })
      });

      if (!patchResp.ok) {
        const text = await patchResp.text();
        setStatus(`DB update failed: ${patchResp.status} ${text}`);
        return;
      }

      setStatus('Original saved. Triggering transcoder...');

      // Trigger server-side transcoder webhook (optional)
      if (transcoderWebhook) {
        try {
          await fetch(transcoderWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bucket, object_path: objectPath, procedure_id: procedureId })
          });
          setStatus('Transcoder triggered.');
        } catch (e) {
          setStatus('Uploaded, but failed to trigger transcoder: ' + e.message);
        }
      } else {
        setStatus('Uploaded. No transcoder webhook configured.');
      }

      if (onSuccess) {
        onSuccess({ bucket, objectPath, procedureId });
      }
    } catch (error) {
      setStatus('Upload error: ' + error.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ border: '1px solid #ccc', padding: 16, borderRadius: 8 }}>
      <h4>Upload Video (Procedure {procedureId})</h4>
      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        disabled={uploading}
      />
      <br />
      <button onClick={handleUpload} disabled={uploading || !file}>
        {uploading ? 'Uploading...' : 'Upload Video'}
      </button>
      {status && <div style={{ marginTop: 8, fontSize: 14 }}>{status}</div>}
    </div>
  );
}