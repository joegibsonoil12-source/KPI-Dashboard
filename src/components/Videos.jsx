import React, { useEffect, useState } from 'react';
import SupabaseSettings from './SupabaseSettings';

/*
  Videos.jsx (minimal version)
  - Improved UI and accessibility
  - Embeds YouTube/Vimeo when possible
  - Reads optional Supabase config from localStorage keys SUPABASE_URL and SUPABASE_ANON_KEY
  - Keeps localStorage fallback for metadata
  - Includes SupabaseSettings component for configuration
*/

export default function Videos({ supabase = null, bucket = 'videos', embedded = false }) {
  const [list, setList] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceType, setSourceType] = useState('url');
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [supabaseClient, setSupabaseClient] = useState(supabase);

  useEffect(() => {
    // If no supabase prop provided, check localStorage for stored client details
    if (!supabaseClient) {
      const url = localStorage.getItem('SUPABASE_URL') || '';
      const key = localStorage.getItem('SUPABASE_ANON_KEY') || '';
      if (url && key) {
        // lazy import to avoid bundling requirement for servers without supabase
        import('@supabase/supabase-js').then(({ createClient }) => {
          try { setSupabaseClient(createClient(url, key)); } catch (e) { console.warn('Failed to create supabase client', e); }
        }).catch(() => console.warn('supabase-js not available'));
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const client = supabaseClient || supabase;
    if (client) {
      try {
        const { data, error } = await client.from('videos').select('*').order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) { setList(data); return; }
      } catch (err) { console.warn('Supabase load failed, falling back to localStorage', err); }
    }
    const local = JSON.parse(localStorage.getItem('site_videos') || '[]');
    setList(local);
  }

  function resetForm() {
    setTitle('');
    setDescription('');
    setSourceType('url');
    setVideoUrl('');
    setFile(null);
  }

  function isVideoFileUrl(url) {
    return /\.(mp4|webm|ogg|m3u8)(\?.*)?$/i.test(url);
  }

  function parseEmbeddable(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      const host = u.hostname.replace('www.', '');
      // YouTube
      if (host.includes('youtube.com')) {
        const v = u.searchParams.get('v');
        if (v) return { type: 'youtube', id: v };
      }
      if (host === 'youtu.be') {
        const id = u.pathname.slice(1);
        if (id) return { type: 'youtube', id };
      }
      // Vimeo
      if (host.includes('vimeo.com')) {
        const id = u.pathname.split('/').filter(Boolean).pop();
        if (id && /^\d+$/.test(id)) return { type: 'vimeo', id };
      }
    } catch (e) {
      // ignore error
    }
    return null;
  }

  function getEmbedElement(url, title) {
    const emb = parseEmbeddable(url);
    if (!emb) return null;
    if (emb.type === 'youtube') {
      const src = `https://www.youtube.com/embed/${emb.id}`;
      return (
        <iframe
          width="100%"
          height="315"
          src={src}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ borderRadius: 8, aspectRatio: '16/9' }}
        />
      );
    }
    if (emb.type === 'vimeo') {
      const src = `https://player.vimeo.com/video/${emb.id}`;
      return (
        <iframe
          width="100%"
          height="315"
          src={src}
          title={title}
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          style={{ borderRadius: 8, aspectRatio: '16/9' }}
        />
      );
    }
    return null;
  }

  async function uploadFileToSupabase(fileToUpload) {
    const client = supabaseClient || supabase;
    if (!client) {
      throw new Error('Supabase client not provided');
    }
    const filename = `${Date.now()}_${fileToUpload.name.replace(/\s+/g, '_')}`;
    const { data, error } = await client.storage.from(bucket).upload(filename, fileToUpload, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data: publicData } = client.storage.from(bucket).getPublicUrl(filename);
    return publicData.publicUrl;
  }

  async function saveMetadata(item) {
    const client = supabaseClient || supabase;
    if (client) {
      try {
        const { error } = await client.from('videos').insert([item]);
        if (!error) { await load(); return; }
      } catch (err) { console.warn('Supabase insert failed, falling back to localStorage', err); }
    }
    const arr = JSON.parse(localStorage.getItem('site_videos') || '[]');
    arr.unshift(item);
    localStorage.setItem('site_videos', JSON.stringify(arr));
    setList(arr);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { alert('Please add a title.'); return; }
    setLoading(true);
    try {
      let url = '';
      if (sourceType === 'url') {
        if (!videoUrl.trim()) { alert('Please add a video URL.'); setLoading(false); return; }
        url = videoUrl.trim();
      } else {
        if (!file) { alert('Select a file to upload.'); setLoading(false); return; }
        const client = supabaseClient || supabase;
        if (!client) {
          alert('File upload requires a Supabase client. Please configure Supabase settings or provide the `supabase` prop.');
          setLoading(false);
          return;
        }
        url = await uploadFileToSupabase(file);
      }
      const item = { id: `vid_${Date.now()}`, title: title.trim(), description: description.trim(), url, created_at: new Date().toISOString() };
      await saveMetadata(item);
      resetForm();
    } catch (err) { console.error(err); alert('Save failed (see console).'); } finally { setLoading(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this video?')) return;
    const client = supabaseClient || supabase;
    if (client) {
      try {
        const { error } = await client.from('videos').delete().eq('id', id);
        if (!error) { await load(); return; }
      } catch (err) { 
        console.warn('Supabase deletion failed, falling back to localStorage', err); 
      }
    }
    const arr = JSON.parse(localStorage.getItem('site_videos') || '[]').filter(v => v.id !== id);
    localStorage.setItem('site_videos', JSON.stringify(arr));
    setList(arr);
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20 }}>
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.6rem' }}>Videos</h1>
        <p style={{ margin: '0 0 12px 0', color: '#444' }}>
          Manage video content with YouTube/Vimeo embed support
        </p>
      </div>

      {/* Supabase Settings */}
      <SupabaseSettings onClientReady={({ url, key }) => {
        if (url && key) {
          import('@supabase/supabase-js').then(({ createClient }) => {
            try { setSupabaseClient(createClient(url, key)); } catch (e) { console.warn('Failed to create supabase client', e); }
          }).catch(() => console.warn('supabase-js not available'));
        } else {
          setSupabaseClient(null);
        }
      }} />

      {/* Add Video Form */}
      <div style={{ marginBottom: 18 }}>
        <form onSubmit={handleSubmit} style={{ 
          background: '#fff', 
          padding: 12, 
          borderRadius: 8, 
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          border: '1px solid #E5E7EB'
        }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 8 }}>
                Title
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: 8,
                    marginTop: 6,
                    boxSizing: 'border-box',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6
                  }}
                />
              </label>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 8 }}>
                Description (optional)
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 8,
                    marginTop: 6,
                    boxSizing: 'border-box',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6
                  }}
                />
              </label>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 8 }}>
                Source Type
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 8,
                    marginTop: 6,
                    boxSizing: 'border-box',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6
                  }}
                >
                  <option value="url">URL (YouTube, Vimeo, or direct video)</option>
                  <option value="file">Upload File (requires Supabase)</option>
                </select>
              </label>
            </div>

            {sourceType === 'url' ? (
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 8 }}>
                  Video URL
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                    style={{
                      width: '100%',
                      padding: 8,
                      marginTop: 6,
                      boxSizing: 'border-box',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6
                    }}
                  />
                </label>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 8 }}>
                  Video File
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setFile(e.target.files[0])}
                    style={{
                      width: '100%',
                      padding: 8,
                      marginTop: 6,
                      boxSizing: 'border-box',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 12px',
                background: '#0070f3',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Adding...' : 'Add Video'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: '8px 12px',
                background: '#f3f4f6',
                color: '#111',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #e6eef8', margin: '18px 0' }} />

      {/* Videos List */}
      <h2 style={{ margin: '0 0 12px 0' }}>Videos ({list.length})</h2>
      
      {list.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No videos yet. Add one above to get started.</p>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
          gap: 16 
        }}>
          {list.map(video => {
            const embed = getEmbedElement(video.url, video.title);
            const isVideoFile = isVideoFileUrl(video.url);
            
            return (
              <div
                key={video.id}
                style={{
                  background: '#fff',
                  padding: 12,
                  borderRadius: 8,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  border: '1px solid #E5E7EB'
                }}
              >
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>{video.title}</h3>
                
                <div style={{ marginBottom: 8 }}>
                  {embed ? (
                    embed
                  ) : isVideoFile ? (
                    <video
                      controls
                      style={{ width: '100%', borderRadius: 6 }}
                      src={video.url}
                    >
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div style={{
                      background: '#000',
                      color: '#fff',
                      padding: 8,
                      borderRadius: 6,
                      textAlign: 'center'
                    }}>
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#fff', textDecoration: 'none' }}
                      >
                        View Video
                      </a>
                    </div>
                  )}
                </div>

                {video.description && (
                  <p style={{ color: '#4b5563', margin: '8px 0' }}>{video.description}</p>
                )}

                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
                  {new Date(video.created_at).toLocaleDateString()}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleDelete(video.id)}
                    style={{
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 12
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}