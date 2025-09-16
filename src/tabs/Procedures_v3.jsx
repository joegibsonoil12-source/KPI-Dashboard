// src/tabs/Procedures_v3.jsx
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminOnly from '../components/AdminOnly'

const PROC_COMPONENT_VERSION = 'v3.1'
console.log('[Procedures.jsx]', PROC_COMPONENT_VERSION)

function VideoEmbed({ url }) {
  if (!url) return null
  
  // Helper function to check if URL is a direct video file
  const isVideoFileUrl = (url) => /\.(mp4|webm|ogg|m3u8)(\?.*)?$/i.test(url)
  
  try {
    const u = new URL(url)
    
    // YouTube
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      let id = u.searchParams.get('v')
      if (!id && u.hostname.includes('youtu.be')) {
        id = u.pathname.replace('/', '')
      }
      if (!id) return null
      return (
        <iframe
          width="560" height="315"
          src={`https://www.youtube.com/embed/${id}`}
          title="YouTube video" frameBorder="0" allowFullScreen
          style={{ maxWidth: '100%', borderRadius: 8 }}
        />
      )
    }
    
    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').pop()
      if (!id) return null
      return (
        <iframe
          width="560" height="315"
          src={`https://player.vimeo.com/video/${id}`}
          title="Vimeo video" frameBorder="0" allowFullScreen
          style={{ maxWidth: '100%', borderRadius: 8 }}
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
          style={{ maxWidth: '100%', borderRadius: 8 }}
        />
      )
    }
    
    // Direct video files
    if (isVideoFileUrl(url)) {
      return (
        <video 
          controls 
          src={url} 
          style={{ width: '100%', maxWidth: 560, height: 315, borderRadius: 8 }}
        />
      )
    }
  } catch {}
  
  // Fallback for other URLs - display as link
  return (
    <div style={{ 
      background: '#f8f9fa', 
      border: '1px solid #e9ecef', 
      borderRadius: 8, 
      padding: 12, 
      textAlign: 'center' 
    }}>
      <p style={{ margin: 0, color: '#666', fontSize: 14 }}>Video Link:</p>
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        style={{ color: '#0066cc', textDecoration: 'none' }}
      >
        {url}
      </a>
    </div>
  )
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
  const [videoFile, setVideoFile] = useState(null)
  const [videoSourceType, setVideoSourceType] = useState('url') // 'url' | 'file'
  const [uploadingVideo, setUploadingVideo] = useState(false)

  // Inline per-procedure add state
  const [inlineVideo, setInlineVideo] = useState({})
  const [inlineVideoFile, setInlineVideoFile] = useState({})
  const [inlineVideoSourceType, setInlineVideoSourceType] = useState({})

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

  // Helper function to upload video file to Supabase storage
  async function uploadVideoToSupabase(fileToUpload) {
    const filename = `${Date.now()}_${fileToUpload.name.replace(/\s+/g, '_')}`
    const { data, error } = await supabase.storage
      .from('videos')
      .upload(filename, fileToUpload, { cacheControl: '3600', upsert: false })
    if (error) throw error
    const { data: publicData } = supabase.storage.from('videos').getPublicUrl(filename)
    return publicData.publicUrl
  }

  async function addProcedure(e) {
    e.preventDefault()
    if (!title.trim()) return alert('Title is required.')
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
    
    setUploadingVideo(true)
    try {
      let finalUrl = ''
      
      if (videoSourceType === 'url') {
        if (!videoUrl.trim()) return alert('Paste a YouTube, Vimeo, or Loom URL.')
        finalUrl = videoUrl.trim()
      } else {
        if (!videoFile) return alert('Select a video file to upload.')
        finalUrl = await uploadVideoToSupabase(videoFile)
      }
      
      const { error } = await supabase.from('procedure_videos').insert({
        procedure_id: attachToId, 
        url: finalUrl,
      })
      if (error) return alert(error.message)
      
      setVideoUrl('')
      setVideoFile(null)
      load()
    } catch (err) {
      console.error(err)
      alert('Failed to add video: ' + err.message)
    } finally {
      setUploadingVideo(false)
    }
  }

  async function addVideoInline(pid) {
    const sourceType = inlineVideoSourceType[pid] || 'url'
    
    try {
      let finalUrl = ''
      
      if (sourceType === 'url') {
        const url = (inlineVideo[pid] || '').trim()
        if (!url) return
        finalUrl = url
      } else {
        const file = inlineVideoFile[pid]
        if (!file) return
        finalUrl = await uploadVideoToSupabase(file)
      }
      
      const { error } = await supabase.from('procedure_videos').insert({
        procedure_id: pid, 
        url: finalUrl
      })
      if (error) return alert(error.message)
      
      setInlineVideo(v => ({ ...v, [pid]: '' }))
      setInlineVideoFile(v => ({ ...v, [pid]: null }))
      load()
    } catch (err) {
      console.error(err)
      alert('Failed to add video: ' + err.message)
    }
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
    <div className="p-4" style={{ maxWidth: 1000 }} data-proc-version={PROC_COMPONENT_VERSION}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <h1 style={{margin:0}}>Procedures</h1>
        <span style={{fontSize:12, padding:'2px 6px', border:'1px solid #e5e7eb', borderRadius:999}}>
          {PROC_COMPONENT_VERSION}
        </span>
      </div>

      {/* TOP COMPOSER */}
      <AdminOnly>
        <div style={{ marginTop: 12, marginBottom: 16, border: '1px solid #eee', borderRadius: 10, padding: 12, background: '#fafbfd' }}>
          <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10 }}>
            <select value={mode} onChange={e=>setMode(e.target.value)} style={{ minWidth: 220 }}>
              <option value="procedure">Procedure (Text)</option>
              <option value="video">Video for… (attach to procedure)</option>
            </select>
            <div style={{ opacity:0.7, fontSize:12 }}>
              Tip: You can also add videos inline on each procedure card below. Supports YouTube, Vimeo, Loom, and file uploads.
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
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <select value={attachToId} onChange={e=>setAttachToId(e.target.value)} required>
                  <option value="">Choose procedure…</option>
                  {procedureOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select value={videoSourceType} onChange={e=>setVideoSourceType(e.target.value)}>
                  <option value="url">URL (YouTube, Vimeo, Loom)</option>
                  <option value="file">Upload File</option>
                </select>
              </div>
              
              <form onSubmit={addVideoTop} style={{ display:'grid', gridTemplateColumns:'1fr 96px', gap:10 }}>
                {videoSourceType === 'url' ? (
                  <input 
                    placeholder="Paste YouTube, Vimeo, or Loom URL…" 
                    value={videoUrl} 
                    onChange={e=>setVideoUrl(e.target.value)} 
                    required 
                  />
                ) : (
                  <input 
                    type="file" 
                    accept="video/*" 
                    onChange={e=>setVideoFile(e.target.files?.[0] || null)} 
                    required
                    style={{ padding: '8px' }}
                  />
                )}
                <button type="submit" disabled={uploadingVideo}>
                  {uploadingVideo ? 'Adding...' : 'Add'}
                </button>
              </form>
            </div>
          )}
        </div>
      </AdminOnly>

      <h2 style={{ fontSize: 16, margin: '12px 0' }}>Procedures & Training</h2>

      {loading ? <div>Loading…</div> : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 14 }}>
          {items.map(p => (
            <li key={p.id} style={{ border: '1px solid #e6e6e6', borderRadius: 12, padding: 16, background: '#fff' }}>
              {/* header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, marginBottom: 4, fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>
                    {p.title}
                  </h3>
                  {p.body && (
                    <div style={{ 
                      color: '#666', 
                      lineHeight: 1.5, 
                      fontSize: 14,
                      padding: '8px 12px',
                      background: '#f8f9fa',
                      borderRadius: 6,
                      border: '1px solid #e9ecef'
                    }}>
                      {p.body}
                    </div>
                  )}
                </div>
                <AdminOnly>
                  <button onClick={()=>deleteProcedure(p.id)}
                    style={{ 
                      background:'#dc3545', 
                      color:'#fff', 
                      border:'none', 
                      padding:'8px 12px', 
                      borderRadius:6,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}>
                    Remove Procedure
                  </button>
                </AdminOnly>
              </div>

              {/* existing videos */}
              {(p.procedure_videos && p.procedure_videos.length > 0) && (
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600, color: '#555' }}>
                    Attached Videos ({p.procedure_videos.length})
                  </h4>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {p.procedure_videos.map(v => (
                      <div key={v.id} style={{ 
                        border: '1px solid #dee2e6', 
                        borderRadius: 8, 
                        padding: 12,
                        background: '#ffffff'
                      }}>
                        <VideoEmbed url={v.url} />
                        <div style={{ fontSize:12, opacity:0.7, marginTop: 8 }}>
                          Added: {new Date(v.created_at).toLocaleDateString()}
                        </div>
                        <AdminOnly>
                          <div style={{ marginTop: 8 }}>
                            <button onClick={()=>deleteVideo(v.id)}
                              style={{ 
                                background:'#6c757d', 
                                color:'#fff', 
                                border:'none', 
                                padding:'4px 8px', 
                                borderRadius:4,
                                fontSize: 11,
                                cursor: 'pointer'
                              }}>
                              Remove Video
                            </button>
                          </div>
                        </AdminOnly>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* inline add video */}
              <AdminOnly>
                <div style={{ marginTop: 10, border: '1px solid #e9ecef', borderRadius: 8, padding: 10, background: '#f8f9fa' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                    Add Video to this Procedure:
                  </div>
                  
                  <div style={{ marginBottom: 8 }}>
                    <select 
                      value={inlineVideoSourceType[p.id] || 'url'} 
                      onChange={e=>setInlineVideoSourceType(x => ({ ...x, [p.id]: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', fontSize: 12 }}
                    >
                      <option value="url">URL (YouTube, Vimeo, Loom)</option>
                      <option value="file">Upload File</option>
                    </select>
                  </div>
                  
                  <div style={{ display:'flex', gap:8 }}>
                    {(inlineVideoSourceType[p.id] || 'url') === 'url' ? (
                      <input
                        placeholder="Paste video URL…"
                        value={inlineVideo[p.id] || ''}
                        onChange={e=>setInlineVideo(x => ({ ...x, [p.id]: e.target.value }))}
                        style={{ flex:1, padding: '6px 8px' }}
                      />
                    ) : (
                      <input
                        type="file"
                        accept="video/*"
                        onChange={e=>setInlineVideoFile(x => ({ ...x, [p.id]: e.target.files?.[0] || null }))}
                        style={{ flex:1, padding: '6px 8px' }}
                      />
                    )}
                    <button type="button" onClick={()=>addVideoInline(p.id)}>Add video</button>
                  </div>
                </div>
              </AdminOnly>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
