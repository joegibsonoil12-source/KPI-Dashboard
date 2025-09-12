// src/tabs/Procedures.jsx
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminOnly from '../components/AdminOnly'

function VideoEmbed({ url }) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.searchParams.get('v') || u.pathname.replace('/', '')
      if (!id) return null
      return (
        <iframe
          width="560" height="315"
          src={`https://www.youtube.com/embed/${id}`}
          title="YouTube video" frameBorder="0" allowFullScreen
          style={{ maxWidth: '100%' }}
        />
      )
    }
    if (u.hostname.includes('loom.com')) {
      return (
        <iframe
          width="560" height="315"
          src={url.replace('/share/', '/embed/')}
          title="Loom video" frameBorder="0" allowFullScreen
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

  // Composer state
  const [mode, setMode] = useState('procedure') // 'procedure' | 'video'
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [attachToId, setAttachToId] = useState('')

  // Inline per-procedure add state: { [procedureId]: url }
  const [inlineVideo, setInlineVideo] = useState({})

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

  const procedureOptions = useMemo(
    () => items.map(p => ({ value: p.id, label: p.title || '(untitled)' })),
    [items]
  )

  async function addProcedure(e) {
    e.preventDefault()
    const { error } = await supabase.from('procedures').insert({
      title: title.trim(),
      body: body.trim() || null,
    })
    if (error) return alert(error.message)
    setTitle(''); setBody('')
    load()
  }

  async function addVideoTop(e) {
    e.preventDefault()
    if (!attachToId) return alert('Choose a procedure to attach the video to.')
    if (!videoUrl.trim()) return alert('Paste a YouTube or Loom URL.')
    const { error } = await supabase.from('procedure_videos').insert({
      procedure_id: attachToId, url: videoUrl.trim(),
    })
    if (error) return alert(error.message)
    setVideoUrl('')
    load()
  }

  async function addVideoInline(pid) {
    const url = (inlineVideo[pid] || '').trim()
    if (!url) return
    const { error } = await supabase.from('procedure_videos').insert({
      procedure_id: pid, url
    })
    if (error) return alert(error.message)
    setInlineVideo(v => ({ ...v, [pid]: '' }))
    load()
  }

  async function deleteProcedure(id) {
    const { error } = await supabase.from('procedures').delete().eq('id', id)
    if (error) return alert(error.message)
    load()
  }
  async function deleteVideo(vid) {
    const { error } = await supabase.from('procedure_videos').delete().eq('id', vid)
    if (error) return alert(error.message)
    load()
  }

  return (
    <div className="p-4" style={{ maxWidth: 1000 }}>
      <h1>Procedures</h1>

      {/* TOP COMPOSER */}
      <AdminOnly>
        <div style={{ marginBottom: 16, border: '1px solid #eee', borderRadius: 10, padding: 12, background: '#fafbfd' }}>
          <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10 }}>
            <select value={mode} onChange={e=>setMode(e.target.value)} style={{ minWidth: 210 }}>
              <option value="procedure">Procedure (Text)</option>
              <option value="video">Video for… (attach to procedure)</option>
            </select>
            <div style={{ opacity:0.7, fontSize:12 }}>
              Tip: You can also add videos inline on each procedure card below.
            </div>
          </div>

          {mode === 'procedure' ? (
            <form onSubmit={addProcedure}
              style={{ display:'grid', gridTemplateColumns:'1fr 1fr 96px', gap:10 }}>
              <input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} required />
              <input placeholder="Short description / steps" value={body} onChange={e=>setBody(e.target.value)} />
              <button type="submit">Add</button>
            </form>
          ) : (
            <form onSubmit={addVideoTop}
              style={{ display:'grid', gridTemplateColumns:'1fr 1fr 96px', gap:10 }}>
              <select value={attachToId} onChange={e=>setAttachToId(e.target.value)} required>
                <option value="">Choose procedure…</option>
                {procedureOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input placeholder="Paste YouTube or Loom URL…" value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} required />
              <button type="submit">Add</button>
            </form>
          )}
        </div>
      </AdminOnly>

      <h2 style={{ fontSize: 16, margin: '12px 0' }}>Procedures & Training</h2>

      {loading ? <div>Loading…</div> : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 14 }}>
          {items.map(p => (
            <li key={p.id} style={{ border: '1px solid #e6e6e6', borderRadius: 12, padding: 14 }}>
              {/* header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.title}</div>
                  {p.body && <div style={{ opacity: 0.8 }}>{p.body}</div>}
                </div>
                <AdminOnly>
                  <button onClick={()=>deleteProcedure(p.id)}
                    style={{ background:'#e33', color:'#fff', border:'none', padding:'6px 10px', borderRadius:8 }}>
                    Remove
                  </button>
                </AdminOnly>
              </div>

              {/* existing videos */}
              <div style={{ marginTop: 10, display: 'grid', gap: 12 }}>
                {(p.procedure_videos || []).map(v => (
                  <div key={v.id} style={{ display:'grid', gap: 6 }}>
                    <VideoEmbed url={v.url} />
                    <div style={{ fontSize:12, opacity:0.7 }}>Video URL: {v.url}</div>
                    <AdminOnly>
                      <div>
                        <button onClick={()=>deleteVideo(v.id)}
                          style={{ background:'#444', color:'#fff', border:'none', padding:'4px 8px', borderRadius:6 }}>
                          Remove video
                        </button>
                      </div>
                    </AdminOnly>
                  </div>
                ))}
              </div>

              {/* inline add video */}
              <AdminOnly>
                <div style={{ marginTop: 10, display:'flex', gap:8 }}>
                  <input
                    placeholder="Add video to this procedure (YouTube or Loom URL)…"
                    value={inlineVideo[p.id] || ''}
                    onChange={e=>setInlineVideo(x => ({ ...x, [p.id]: e.target.value }))}
                    style={{ flex:1 }}
                  />
                  <button type="button" onClick={()=>addVideoInline(p.id)}>Add video</button>
                </div>
              </AdminOnly>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
