import React, { useState } from 'react';

export default function SupabaseSettings({ onClientReady = null }) {
  const [url, setUrl] = useState(localStorage.getItem('SUPABASE_URL') || '');
  const [key, setKey] = useState(localStorage.getItem('SUPABASE_ANON_KEY') || '');
  const [msg, setMsg] = useState('');

  function save() {
    localStorage.setItem('SUPABASE_URL', url);
    localStorage.setItem('SUPABASE_ANON_KEY', key);
    setMsg('Saved to browser localStorage. The Procedures page will use these settings for video uploads.');
    if (onClientReady) onClientReady({ url, key });
  }

  function clear() {
    localStorage.removeItem('SUPABASE_URL');
    localStorage.removeItem('SUPABASE_ANON_KEY');
    setUrl(''); setKey(''); setMsg('Cleared.');
    if (onClientReady) onClientReady(null);
  }

  return (
    <div style={{ 
      background: 'white', 
      border: '1px solid #E5E7EB', 
      borderRadius: 12, 
      padding: 16,
      marginBottom: 16
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>Supabase Settings</h3>
      <p style={{ margin: '0 0 12px 0', fontSize: 14, color: '#6B7280' }}>
        Configure your Supabase connection (stored in browser localStorage)
      </p>
      
      <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
            Supabase URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-project.supabase.co"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              fontSize: 14
            }}
          />
        </div>
        
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
            Anon Key
          </label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              fontSize: 14
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={save}
          style={{
            padding: '8px 16px',
            background: '#111827',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          Save Settings
        </button>
        <button
          onClick={clear}
          style={{
            padding: '8px 16px',
            background: '#F3F4F6',
            color: '#111827',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          Clear
        </button>
      </div>

      {msg && (
        <div style={{
          padding: 8,
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: 8,
          fontSize: 12,
          color: '#166534'
        }}>
          {msg}
        </div>
      )}
    </div>
  );
}