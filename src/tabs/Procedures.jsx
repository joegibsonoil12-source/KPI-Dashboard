// src/tabs/Procedures.jsx
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminOnly from '../components/AdminOnly'

function VideoEmbed({ url }) {
  if (!url) return null
  try {
    const u = new URL(url)
    // YouTube
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.searchParams.get('v') || u.pathname.replace('/', '')
      if (!id) return null
      return (
        <iframe
          width="560" height="315"
          src={`https://www.youtube.com/embed/${id}`}
          title="YouTube video"
          frameBorder="0"
          allowFullScreen
          style={{ maxWidth: '100%' }}
        />
      )
    }
    // Loom
    if (u.hostname.includes('loom.com')) {
      return (
        <iframe
          width="560" height="315"
          src={url.replace('/share/', '/embed/')}
          title="Loom video"
          frameBorder="0"
          allowFullScreen
          style={{ maxWidth: '100%' }}
        />
      )
    }
  } catch {}
  return null
}

export default function Procedures() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Top form state
  const [mode, setMode] = useState('procedure') // 'procedure' | 'video'
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [attachToId, setAttachToId] = useState('') // procedure_id when adding a video

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('procedures')
      .select('id,title,body,created_at,procedure_videos(id,url,created_at)')
      .order('created_at', { ascending: false })
    if (!error) setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Convenience: options for the “Video for …” dropdown
  const procedureOptions = useMemo(
    () => items.map(p => ({ value: p.id, label: p.title || '(untitled)' })),
    [items]
  )

  async function onAdd(e) {
    e.preventDefault()
    if (mode === 'procedure') {
      if (!title.trim()) return alert('Title is required.')
      const { error } = await supabase.from('procedures').insert({
        title: title.trim(),
        body: body.trim() || null,
      })
      if (error) return alert(error.message)
      setTitle(''); setBody('')
      load()
    } else {
      if (!attachToId) return alert('Choose a procedure to attach the video to.')
      if (!videoUrl.trim()) return alert('Paste a YouTube or Loom URL.')
      const { error } = await supabase.from('procedure_videos').insert({
        procedure_id: attachToId,
        url: videoUrl.trim(),
      })
      if (error) return alert(error.message)
      setVideoUrl('')
      load()
    }
  }

  async function deleteProcedure(id) {
    const { error } = await supabase.from('procedures').delete().eq('id', id)
    if (error) return alert(error.message)
    load()
  }

  async function deleteVideo(videoId) {
    const { error } = await supabase.from('procedure_videos').delete().eq('id', videoId)
    if (error) return alert(error.message)
    load()
  }

  return (
    <div className="p-4" style={{ maxWidth: 1000 }}>
      <h1>Procedures</h1>

      {/* Top composer */}
      <AdminOnly>
        <form onSubmit={onAdd}
          style={{
            display: 'grid',
            gridTemplateColumns: '220px 1fr 1fr 96px',
            gap: 10,
            alignItems: 'center',
            marginBottom: 16
          }}
        >
          <select value={mode} onChange={e => setMode(e.target.value)}>
            <option value="procedure">Procedure (Text)</option>
            <option value="video">Video for… (attach to procedure)</option>
          </select>

          {mode === 'procedure' ? (
            <>
              <input
                placeholder="Title"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
              <input
                placeholder="Short description / steps"
                value={body}
                onChange={e => setBody(e.target.value)}
              />
            </>
          ) : (
            <>
              <select
                value={attachToId}
                onChange={e => setAttachToId(e.target.value)}
              >
                <option value="">Choose procedure…</option>
                {procedureOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                placeholder="Paste YouTube or Loom URL…"
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
              />
            </>
          )}

          <button type="submit">Add</button>
        </form>
      </AdminOnly>

      <h2 style={{ fontSize: 16, margin: '12px 0' }}>Procedures & Training</h2>

      {loading ? <div>Loading…</div> : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 14 }}>
          {items.map(p => (
            <li key={p.id} style={{ border: '1px solid #e6e6e6', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.title}</div>
                  {p.body && <div style={{ opacity: 0.8 }}>{p.body}</div>}
                </div>
                <AdminOnly>
                  <button
                    onClick={() => deleteProcedure(p.id)}
                    style={{ background: '#e33', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 8 }}
                  >
                    Remove
                  </button>
                </AdminOnly>
              </div>

              {/* Videos attached to this procedure */}
              <div style={{ marginTop: 10, display: 'grid', gap: 12 }}>
                {(p.procedure_videos || []).map(v => (
                  <div key={v.id} style={{ display: 'grid', gap: 6 }}>
                    <VideoEmbed url={v.url} />
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Video URL: {v.url}</div>
                    <AdminOnly>
                      <div>
                        <button
                          onClick={() => deleteVideo(v.id)}
                          style={{ background: '#444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 6 }}
                        >
                          Remove video
                        </button>
                      </div>
                    </AdminOnly>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
