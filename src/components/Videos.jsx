import React, { useEffect, useState } from 'react';
import styles from './Videos.module.css';

/*
  Videos.jsx (updated)
  - Improved UI and accessibility
  - Embeds YouTube/Vimeo when possible
  - Reads optional Supabase config from localStorage keys SUPABASE_URL and SUPABASE_ANON_KEY
  - Keeps localStorage fallback for metadata
  - Responsive grid using CSS module
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
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.from('videos').select('*').order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) { setList(data); return; }
      } catch (err) { console.warn('Supabase load failed, falling back to localStorage', err); }
    }
    const local = JSON.parse(localStorage.getItem('site_videos') || '[]');
    setList(local);
  }

  function resetForm() {
    setTitle(''); setDescription(''); setSourceType('url'); setVideoUrl(''); setFile(null);
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
        // playlist or short links handled elsewhere
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
    } catch (e) { /* ignore */ }
    return null;
  }

  function getEmbedElement(url, title) {
    const emb = parseEmbeddable(url);
    if (!emb) return null;
    if (emb.type === 'youtube') {
      const src = `https://www.youtube.com/embed/${emb.id}`;
      return (
        <iframe
          title={title || 'YouTube video'}
          src={src}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className={styles.embed}
        />
      );
    }
    if (emb.type === 'vimeo') {
      const src = `https://player.vimeo.com/video/${emb.id}`;
      return (
        <iframe
          title={title || 'Vimeo video'}
          src={src}
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className={styles.embed}
        />
      );
    }
    return null;
  }

  async function uploadFileToSupabase(fileToUpload) {
    if (!supabaseClient) throw new Error('Supabase client not provided');
    const filename = `${Date.now()}_${fileToUpload.name.replace(/\s+/g, '_')}`;
    const { data, error } = await supabaseClient.storage.from(bucket).upload(filename, fileToUpload, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data: publicData } = supabaseClient.storage.from(bucket).getPublicUrl(filename);
    return publicData.publicUrl;
  }

  async function saveMetadata(item) {
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('videos').insert([item]);
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
        if (!supabaseClient) { alert('File upload requires a Supabase client. Configure the Supabase settings.'); setLoading(false); return; }
        url = await uploadFileToSupabase(file);
      }
      const item = { id: `vid_${Date.now()}`, title: title.trim(), description: description.trim(), url, created_at: new Date().toISOString() };
      await saveMetadata(item);
      resetForm();
    } catch (err) { console.error(err); alert('Save failed (see console).'); } finally { setLoading(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this video?')) return;
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('videos').delete().eq('id', id);
        if (!error) { await load(); return; }
      } catch (err) { console.warn('Supabase deletion failed, falling back to localStorage', err); }
    }
    const arr = JSON.parse(localStorage.getItem('site_videos') || '[]').filter(v => v.id !== id);
    localStorage.setItem('site_videos', JSON.stringify(arr));
    setList(arr);
  }

  return (
    <div className={styles.wrapper}>
      {!embedded && (
        <header className={styles.header}>
          <h1 className={styles.h1}>Videos</h1>
          <p className={styles.lead}>Add videos by URL or upload (uploads require Supabase configuration).</p>
        </header>
      )}

      <section className={styles.controls} aria-labelledby="add-video">
        <h2 id="add-video" className={styles.srOnly}>Add video</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>Title
            <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} required aria-required="true" />
          </label>

          <label className={styles.label}>Description
            <textarea className={styles.input} value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </label>

          <label className={styles.label}>Source type
            <select className={styles.input} value={sourceType} onChange={e => setSourceType(e.target.value)}>
              <option value="url">External URL</option>
              <option value="file">Upload file (Supabase required)</option>
            </select>
          </label>

          {sourceType === 'url' ? (
            <label className={styles.label}>Video URL
              <input className={styles.input} value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://example.com/video.mp4" />
            </label>
          ) : (
            <label className={styles.label}>File (mp4/webm)
              <input className={styles.input} type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          )}

          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
            <button type="button" className={styles.tertiary} onClick={resetForm}>Clear</button>
          </div>
          <p className={styles.hint}>Tip: Configure Supabase in settings to enable uploads. Without Supabase data is stored only in this browser.</p>
        </form>
      </section>

      <hr className={styles.sep} />

      <section>
        <h2 className={styles.sectionTitle}>Your videos</h2>
        <div className={styles.grid} role="list">
          {list && list.length ? list.map(item => (
            <article key={item.id} className={styles.card} role="listitem" aria-label={item.title}>
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <div className={styles.media}>
                {getEmbedElement(item.url, item.title) || (
                  isVideoFileUrl(item.url) ? (
                    <video controls src={item.url} className={styles.video} />
                  ) : (
                    <div className={styles.linkBox}><a href={item.url} target="_blank" rel="noopener noreferrer">Open link</a></div>
                  )
                )}
              </div>
              {item.description ? <p className={styles.desc}>{item.description}</p> : null}
              <div className={styles.cardMeta}>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</div>
              <div className={styles.cardActions}>
                <button onClick={() => handleDelete(item.id)} className={styles.delete}>Delete</button>
              </div>
            </article>
          )) : <p className={styles.empty}>No videos yet.</p>}
        </div>
      </section>
    </div>
  );
}