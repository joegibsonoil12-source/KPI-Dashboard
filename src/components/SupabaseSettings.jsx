import React, { useState } from 'react';

export default function SupabaseSettings({ onClientReady = null }) {
  const [url, setUrl] = useState(localStorage.getItem('SUPABASE_URL') || '');
  const [key, setKey] = useState(localStorage.getItem('SUPABASE_ANON_KEY') || '');
  const [msg, setMsg] = useState('');

  function save() {
    localStorage.setItem('SUPABASE_URL', url);
    localStorage.setItem('SUPABASE_ANON_KEY', key);
    setMsg('Saved to browser localStorage. The Videos page will try to create a client automatically.');
    if (onClientReady) onClientReady({ url, key });
  }

  function clear() {
    localStorage.removeItem('SUPABASE_URL');
    localStorage.removeItem('SUPABASE_ANON_KEY');
    setUrl(''); setKey(''); setMsg('Cleared.');
    if (onClientReady) onClientReady(null);
  }

  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 8, maxWidth: 600, margin: '0 auto' }}>
      <h2>Supabase Settings</h2>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Configure your Supabase project to enable video uploads and cloud storage.
      </p>
      
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4 }}>Project URL</label>
        <input 
          value={url} 
          onChange={e => setUrl(e.target.value)} 
          placeholder="https://your-project.supabase.co"
          style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
        />
      </div>
      
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4 }}>Anonymous Key</label>
        <input 
          value={key} 
          onChange={e => setKey(e.target.value)} 
          placeholder="your-anon-key"
          type="password"
          style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
        />
      </div>
      
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={save} style={{ padding: '8px 16px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 4 }}>
          Save
        </button>
        <button onClick={clear} style={{ padding: '8px 16px', background: '#f3f4f6', color: '#111', border: 'none', borderRadius: 4 }}>
          Clear
        </button>
      </div>
      
      {msg && <p style={{ color: '#059669', fontSize: 14 }}>{msg}</p>}
      
      <div style={{ background: '#f9fafb', padding: 12, borderRadius: 4, fontSize: 14, color: '#4b5563' }}>
        <strong>Setup Instructions:</strong>
        <ol style={{ marginLeft: 16, marginTop: 8 }}>
          <li>Create a Supabase project at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">supabase.com</a></li>
          <li>Get your project URL and anon key from Settings → API</li>
          <li>Create a public storage bucket named "videos"</li>
          <li>Create a "videos" table with id, title, description, url, and created_at columns</li>
        </ol>
      </div>
    </div>
  );
}