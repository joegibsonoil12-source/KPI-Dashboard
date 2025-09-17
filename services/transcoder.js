// services/transcoder.js
// Simple video transcoding service using FFmpeg
const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FormData = require('form-data');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;
const TMP_DIR = process.env.TMP_DIR || '/tmp';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

app.use(express.json());

// Ensure tmp directory exists
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// Helper: download object from storage
async function downloadObject(bucket, objectPath, destPath) {
  const url = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(objectPath)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${await res.text()}`);
  const fileStream = fs.createWriteStream(destPath);
  return new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on('error', reject);
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });
}

// Helper: upload object to storage
async function uploadObject(bucket, objectPath, filePath) {
  const url = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(objectPath)}`;
  const fd = new FormData();
  fd.append('file', fs.createReadStream(filePath));
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: fd
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
  return res.json().catch(() => ({}));
}

// Helper: patch procedures row to set video_playable_path
async function updateProcedurePlayablePath(procedureId, playablePath) {
  // Use Supabase REST: PATCH /rest/v1/procedures?id=eq.{procedureId}
  const url = `${SUPABASE_URL}/rest/v1/procedures?id=eq.${encodeURIComponent(procedureId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({ video_playable_path: playablePath })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update procedure: ${res.status} ${text}`);
  }
  return res.json().catch(() => ({}));
}

// POST /transcode
// Body: { bucket?: string, object_path: string, procedure_id: string }
app.post('/transcode', async (req, res) => {
  try {
    const { bucket = 'videos', object_path: objectPath, procedure_id: procedureId } = req.body;
    
    if (!objectPath || !procedureId) {
      return res.status(400).json({ error: 'Missing object_path or procedure_id' });
    }

    console.log('Starting transcode for', objectPath, 'procedure', procedureId);

    const tmpIn = path.join(TMP_DIR, `in-${uuidv4()}${path.extname(objectPath) || '.in'}`);
    const tmpOut = path.join(TMP_DIR, `out-${uuidv4()}.mp4`);
    console.log('Downloading', objectPath, 'to', tmpIn);

    await downloadObject(bucket, objectPath, tmpIn);

    console.log('Transcoding to mp4:', tmpOut);
    await new Promise((resolve, reject) => {
      ffmpeg(tmpIn)
        .outputOptions([
          '-c:v libx264',
          '-preset veryfast',
          '-crf 23',
          '-c:a aac',
          '-b:a 128k',
          '-movflags +faststart'
        ])
        .on('end', resolve)
        .on('error', reject)
        .save(tmpOut);
    });

    const playablePath = objectPath.replace(/\.[^.]+$/, '') + '.playable.mp4';
    console.log('Uploading playable to', playablePath);
    await uploadObject(bucket, playablePath, tmpOut);

    console.log('Updating DB for procedure', procedureId);
    await updateProcedurePlayablePath(procedureId, `${bucket}/${playablePath}`);

    // cleanup
    try { fs.unlinkSync(tmpIn); } catch (e) {}
    try { fs.unlinkSync(tmpOut); } catch (e) {}

    return res.json({ success: true, playable_path: `${bucket}/${playablePath}` });
  } catch (err) {
    console.error('Transcode error', err);
    return res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => console.log(`Transcoder listening on ${PORT}`));