// src/tabs/Procedures.jsx
import { useEffect, useState } from 'react'
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
          title="YouTube video" frameBorder="0" allowFullScreen
          style={{maxWidth:'100%'}}
        />
      )
    }
    // Loom
    if (u.hostname.includes('loom.com')) {
      return (
        <iframe
          width="560" height="315"
          src={url.replace('/share/', '/embed/')}
          title="Loom video" frameBorder="0" allowFullScreen
          style={{maxWidth:'100%'}}
        />
      )
    }
  } catch {}
  return null
}

export default function Procedures() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title:'', body:'' })
  const [videoForm, setVideoForm] = useState({}) // { [procedure_id]: url }

  async function load() {
    setLoading(true)
    // fetch procedures with their videos
    const { data, error } = await supabase
      .from('procedures')
      .select('id,title,body,created_at,procedure_videos(id,url,created_at)')
      .order('created_at', { ascending: false })
    if (!error) setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addProcedure(e) {
    e.preventDefault()
    const { error } = await supabase.from('procedures').insert(form)
    if (error) return alert(error.message)
    setForm({ title:'', body:'' })
    load()
  }

  async function deleteProcedure(id) {
    const { error } = await supabase.from('procedures').delete().eq('id', id)
    if (error) return alert(error.message)
    load()
  }

  async function addVideo(procedureId) {
    const url = (videoForm[procedureId] || '').trim()
    if (!url) return
    const { error } = await supabase.from('procedure_videos').insert({ procedure_id: procedureId, url })
    if (error) return alert(error.message)
    setVideoForm(v => ({ ...v, [procedureId]: '' }))
    load()
  }

  async function deleteVideo(videoId) {
    const { error } = await supabase.from('procedure_videos').delete().eq('id', videoId)
    if (error) return alert(error.message)
    load()
  }

  return (
    <div className="p-4" style={{maxWidth:1000}}>
      <h1>Procedures</h1>
      <p>Write the steps as text and attach one or more videos. Anyone signed in can view; only admins can add or delete.</p>

      <AdminOnly>
        <form onSubmit={addProcedure} className="mb-6" style={{display:'grid', gap:8}}>
          <input
            required placeholder="Title"
            value={form.title}
            onChange={e=>setForm(v=>({...v, title:e.target.value}))}
          />
          <textarea
            rows={5} placeholder="Body (steps, notes…) — optional"
            value={form.body}
            onChange={e=>setForm(v=>({...v, body:e.target.value}))}
          />
          <button type="submit">Add Procedure</button>
        </form>
      </AdminOnly>

      {loading ? <div>Loading…</div> : (
        <ul style={{listStyle:'none', padding:0, display:'grid', gap:14}}>
          {items.map(p => (
            <li key={p.id} style={{border:'1px solid #ddd', borderRadius:10, padding:14}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12}}>
                <h3 style={{margin:0}}>{p.title}</h3>
                <AdminOnly>
                  <button
                    onClick={()=>deleteProcedure(p.id)}
                    style={{background:'#e33', color:'#fff', border:'none', padding:'6px 10px', borderRadius:6}}
                  >
                    Delete
                  </button>
                </AdminOnly>
              </div>

              {p.body && <p style={{whiteSpace:'pre-wrap', marginTop:8}}>{p.body}</p>}

              {/* videos */}
              <div style={{marginTop:10, display:'grid', gap:10}}>
                {(p.procedure_videos || []).map(v => (
                  <div key={v.id} style={{display:'grid', gap:6}}>
                    <VideoEmbed url={v.url} />
                    <div style={{fontSize:12, opacity:0.7}}>Video URL: {v.url}</div>
                    <AdminOnly>
                      <div>
                        <button
                          onClick={()=>deleteVideo(v.id)}
                          style={{background:'#444', color:'#fff', border:'none', padding:'4px 8px', borderRadius:6}}
                        >
                          Remove video
                        </button>
                      </div>
                    </AdminOnly>
                  </div>
                ))}
              </div>

              <AdminOnly>
                <div style={{marginTop:10, display:'flex', gap:8}}>
                  <input
                    placeholder="Paste YouTube or Loom URL…"
                    value={videoForm[p.id] || ''}
                    onChange={e=>setVideoForm(x => ({ ...x, [p.id]: e.target.value }))}
                    style={{flex:1}}
                  />
                  <button onClick={()=>addVideo(p.id)} type="button">Add video</button>
                </div>
              </AdminOnly>

              <div style={{fontSize:12, opacity:0.7, marginTop:8}}>
                Created {new Date(p.created_at).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
