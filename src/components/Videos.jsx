import React, { useEffect, useState } from 'react';

export default function Videos({ supabase = null, bucket = 'videos' }) {
  const [list, setList] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceType, setSourceType] = useState('url');
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('videos').select('*').order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) { setList(data); return; }
      } catch (err) { console.warn('Supabase load failed, falling back to localStorage', err); }
    }
    const local = JSON.parse(localStorage.getItem('site_videos') || '[]');
    setList(local);
  }

  function resetForm() { setTitle(''); setDescription(''); setSourceType('url'); setVideoUrl(''); setFile(null); }
  function isVideoFileUrl(url) { return /\.(mp4|webm|ogg|m3u8)(\?.*)?$/i.test(url); }

  async function uploadFileToSupabase(fileToUpload) {
    if (!supabase) throw new Error('Supabase client not provided');
    const filename = `${Date.now()}_${fileToUpload.name.replace(/\s+/g, '_')}`;
    const { data, error } = await supabase.storage.from(bucket).upload(filename, fileToUpload, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filename);
    return publicData.publicUrl;
  }

  async function saveMetadata(item) {
    if (supabase) {
      try {
        const { error } = await supabase.from('videos').insert([item]);
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
        if (!supabase) { alert('File upload requires a Supabase client. Configure the component prop `supabase`.'); setLoading(false); return; }
        url = await uploadFileToSupabase(file);
      }
      const item = { id: `vid_${Date.now()}`, title: title.trim(), description: description.trim(), url, created_at: new Date().toISOString() };
      await saveMetadata(item);
      resetForm();
    } catch (err) { console.error(err); alert('Save failed (see console).'); } finally { setLoading(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this video?')) return;
    if (supabase) {
      try { const { error } = await supabase.from('videos').delete().eq('id', id); if (!error) { await load(); return; } } catch (err) { console.warn('Supabase deletion failed, falling back to localStorage', err); }
    }
    const arr = JSON.parse(localStorage.getItem('site_videos') || '[]').filter(v => v.id !== id);
    localStorage.setItem('site_videos', JSON.stringify(arr));
    setList(arr);
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h1>Videos</h1>
      <p style={{ color: '#666' }}>Add videos by URL or upload (if Supabase client supplied).</p>

      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 12, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <div>
          <label>Title<br />
            <input value={title} onChange={e => setTitle(e.target.value)} required style={{ width: '100%', padding: 8, boxSizing: 'border-box' }} />
          </label>
        </div>

        <div style={{ marginTop: 8 }}>
          <label>Description<br />
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ width: '100%', padding: 8 }} />
          </label>
        </div>

        <div style={{ marginTop: 8 }}>
          <label>Source type<br />
            <select value={sourceType} onChange={e => setSourceType(e.target.value)} style={{ width: '100%', padding: 8 }}>
              <option value="url">External URL</option>
              <option value="file">Upload file (Supabase required)</option>
            </select>
          </label>
        </div>

        {sourceType === 'url' ? (
          <div style={{ marginTop: 8 }}>
            <label>Video URL<br />
              <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://example.com/video.mp4" style={{ width: '100%', padding: 8 }} />
            </label>
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <label>File (mp4/webm)<br />
              <input type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        )}

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading} style={{ padding: '8px 12px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 6 }}>{loading ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={resetForm} style={{ padding: '8px 12px', background: '#e5e7eb', color: '#111', border: 'none', borderRadius: 6 }}>Clear</button>
        </div>
        <p style={{ color: '#444', marginTop: 8, fontSize: 13 }}>Tip: Configure a Supabase client and public bucket to enable uploads. Without Supabase data is stored only in this browser.</p>
      </form>

      <hr style={{ margin: '24px 0' }} />

      <section>
        <h2>Your videos</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {list && list.length ? list.map(item => (
            <div key={item.id} style={{ background: '#fff', padding: 10, borderRadius: 8, width: 320, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
              <h3 style={{ margin: '0 0 8px 0' }}>{item.title}</h3>
              {isVideoFileUrl(item.url) ? (
                <video controls src={item.url} style={{ width: '100%', borderRadius: 6 }} />
              ) : (
                <div style={{ background: '#000', color: '#fff', padding: 8, borderRadius: 6 }}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#fff' }}>{item.url || 'Open link'}</a>
                </div>
              )}
              {item.description ? <p style={{ color: '#666' }}>{item.description}</p> : null}
              <p style={{ fontSize: 12, color: '#999' }}>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleDelete(item.id)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6 }}>Delete</button>
              </div>
            </div>
          )) : <p style={{ color: '#666' }}>No videos yet.</p>}
        </div>
      </section>
    </div>
  );
}