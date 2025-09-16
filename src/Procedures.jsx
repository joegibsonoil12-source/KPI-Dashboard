/**
 * src/Procedures.jsx
 * Component to upload files to the private 'procedures' bucket, insert rows into public.procedures
 * with created_by set, and fetch signed URLs for rendering videos/doc previews (with simple caching).
 *
 * Usage:
 * - Place this file in src/Procedures.jsx
 * - Ensure environment variables are set if you don't provide a supabase client prop:
 *   REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY (or adapt to your build system).
 * - You can pass an existing supabase client instance via the `supabase` prop.
 */

import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Helper to get/create a Supabase client if not provided via props
function getSupabaseClient() {
  // Prefer an existing client exported from your app at ../supabaseClient
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    // If you already have an exported client, change the path below and remove fallback logic.
    // const { supabase } = require('../supabaseClient');
    // if (supabase) return supabase;
  } catch (e) {
    // ignore
  }

  const url = process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !key) {
    throw new Error('Supabase client not provided and environment variables are missing. Please provide a supabase prop or set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.');
  }
  return createClient(url, key);
}

export default function Procedures({ supabase: supabaseProp }) {
  const supabase = supabaseProp || getSupabaseClient();
  const [items, setItems] = useState([]); // rows from procedures table
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const signedUrlTtl = 120; // seconds
  const signedUrlBuffer = 5 * 1000; // ms, refresh before expiry
  const signedUrlCacheRef = useRef({}); // { [storage_path]: { url, expiresAt } }

  useEffect(() => {
    fetchItems();
    // Optionally, subscribe to realtime changes if you want live updates (not included here)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchItems() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('procedures')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching procedures:', error);
        setItems([]);
        return;
      }
      const rows = data || [];
      // For private bucket, fetch signed urls for items that have storage_path
      const withUrls = await Promise.all(rows.map(async (row) => {
        if (row.type === 'video' || row.storage_path) {
          const view_url = await getCachedSignedUrl(row.storage_path);
          return { ...row, view_url };
        }
        return row;
      }));
      setItems(withUrls);
    } finally {
      setLoading(false);
    }
  }

  async function getCachedSignedUrl(storagePath) {
    if (!storagePath) return null;
    const cache = signedUrlCacheRef.current[storagePath];
    const now = Date.now();
    if (cache && cache.url && cache.expiresAt - signedUrlBuffer > now) {
      return cache.url;
    }
    // create a new signed url
    const { data, error } = await supabase.storage
      .from('procedures')
      .createSignedUrl(storagePath, signedUrlTtl);
    if (error) {
      console.error('Error creating signed URL for', storagePath, error);
      return null;
    }
    const signedUrl = data?.signedUrl ?? null;
    const expiresAt = now + signedUrlTtl * 1000;
    signedUrlCacheRef.current[storagePath] = { url: signedUrl, expiresAt };
    return signedUrl;
  }

  async function handleUploadAndInsert(file, { title = '', body = '', type = 'video' } = {}) {
    if (!file) return;
    setUploading(true);
    try {
      // Ensure the user is signed in and get their id
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) {
        console.error('Error getting user', userError);
      }
      const userId = user?.id ?? null;

      const uniquePath = `procedures/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('procedures')
        .upload(uniquePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) {
        console.error('Upload error', uploadError);
        alert('Upload failed: ' + uploadError.message);
        return;
      }

      // Create a short-lived signed URL so we can preview immediately (optional)
      const { data: signedData } = await supabase.storage.from('procedures').createSignedUrl(uniquePath, signedUrlTtl);
      const view_url = signedData?.signedUrl ?? null;
      signedUrlCacheRef.current[uniquePath] = { url: view_url, expiresAt: Date.now() + signedUrlTtl * 1000 };

      // Insert DB row linking to stored file and record created_by
      const payload = {
        title: title || file.name,
        body: body || null,
        type: type === 'video' ? 'video' : 'doc',
        storage_bucket: 'procedures',
        storage_path: uploadData.path,
        public_url: null,
        created_by: userId,
      };

      const { error: insertError } = await supabase.from('procedures').insert([payload]);
      if (insertError) {
        console.error('Insert error', insertError);
        alert('Failed to save procedure metadata: ' + insertError.message);
        return;
      }

      // refresh list
      setFileInputKey(Date.now());
      await fetchItems();
    } finally {
      setUploading(false);
    }
  }

  // simple file input handler
  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const kind = file.type.startsWith('video/') ? 'video' : 'doc';
    handleUploadAndInsert(file, { type: kind, title: file.name });
  }

  return (
    <div>
      <h2>Procedures</h2>
      <div>
        <label htmlFor="file-input">Upload a file (private bucket)</label>
        <input key={fileInputKey} id="file-input" type="file" onChange={onFileChange} />
        {uploading && <div>Uploading...</div>}
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Recent items</h3>
        {loading && <div>Loading...</div>}
        {!loading && items.length === 0 && <div>No procedures yet.</div>}
        <ul>
          {items.map((it) => (
            <li key={it.id} style={{ marginBottom: 12 }}>
              <strong>{it.title}</strong> <small>({it.type})</small>
              <div>{it.body}</div>
              {it.type === 'video' && it.view_url && (
                <div style={{ marginTop: 8 }}>
                  <video src={it.view_url} controls width={480} />
                </div>
              )}
              {it.type !== 'video' && it.storage_path && (
                <div style={{ marginTop: 8 }}>
                  <a href={it.view_url ?? '#'} target="_blank" rel="noreferrer">Open file</a>
                </div>
              )}
              <div style={{ fontSize: 12, color: '#666' }}>Uploaded at: {new Date(it.created_at).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}