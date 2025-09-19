// src/tabs/Procedures_v3.jsx
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminOnly from '../components/AdminOnly'

const PROC_COMPONENT_VERSION = 'v3.1'
console.log('[Procedures.jsx]', PROC_COMPONENT_VERSION)

// Helper: normalize a user-provided URL (add https:// if missing)
function normalizeUrl(input) {
  if (!input) return ''
  const trimmed = input.trim()
  // If it already has a protocol, return as-is
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) return trimmed
  // Otherwise assume https
  return 'https://' + trimmed
}

// Helper: get current authenticated user ID (compatible with Supabase v1 and v2)
async function getUserId() {
  try {
    // Try v2 method first
    if (supabase.auth.getUser) {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return user?.id || null
    }
    
    // Fallback to v1 method
    if (supabase.auth.user) {
      const user = supabase.auth.user()
      return user?.id || null
    }
    
    // If neither method is available, return null
    return null
  } catch (error) {
    console.error('Error getting user ID:', error)
    return null
  }
}

function VideoEmbed({ url }) {
  if (!url) return null
  
  // Helper function to check if URL is a direct video file
  const isVideoFileUrl = (u) => /\.(mp4|webm|ogg|m3u8)(\?.*)?$/i.test(u)
  
  // Try parsing the original URL first; if that fails try normalized https:// version
  let parsed
  try {
    parsed = new URL(url)
  } catch (err) {
    try {
      parsed = new URL(normalizeUrl(url))
    } catch (err2) {
      parsed = null
    }
  }

  if (parsed) {
    const hostname = parsed.hostname || ''

    // YouTube
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      let id = parsed.searchParams.get('v')
      if (!id && hostname.includes('youtu.be')) {
        id = parsed.pathname.replace('/', '')
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
    if (hostname.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').pop()
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
    if (hostname.includes('loom.com')) {
      // Use normalized href for embedding
      const embedUrl = (parsed.href || url).replace('/share/', '/embed/')
      return (
        <iframe
          width="560" height="315"
          src={embedUrl}
          title="Loom video" frameBorder="0" allowFullScreen
          style={{ maxWidth: '100%', borderRadius: 8 }}
        />
      )
    }
    
    // Direct video files
    if (isVideoFileUrl(parsed.href || url)) {
      return (
        <video 
          controls 
          src={parsed.href || url} 
          style={{ width: '100%', maxWidth: 560, height: 315, borderRadius: 8 }}
        />
      )
    }
  }
  
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
        href={normalizeUrl(url)} 
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
  const [loadError, setLoadError] = useState(null)

  // Composer state
  const [mode, setMode] = useState('procedure') // 'procedure' | 'video'
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [attachToId, setAttachToId] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [videoSourceType, setVideoSourceType] = useState('url') // 'url' | 'file'
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [addError, setAddError] = useState(null)

  // Inline per-procedure add state
  const [inlineVideo, setInlineVideo] = useState({})
  const [inlineVideoFile, setInlineVideoFile] = useState({})
  const [inlineVideoSourceType, setInlineVideoSourceType] = useState({})

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('procedures')
        .select('id,title,body,created_at,procedure_videos(id,url,created_at)')
        .order('created_at', { ascending: false })
      if (error) {
        setLoadError(`Failed to load procedures: ${error.message}`)
        setItems([])
      } else {
        setItems(data || [])
      }
    } catch (err) {
      setLoadError(`Supabase connection error: ${err.message}`)
      setItems([])
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const procedureOptions = useMemo(
    () => items.map(p => ({ value: p.id, label: p.title || '(untitled)' })),
    [items]
  )

  // Helper function to upload video file to Supabase storage
  // Returns { publicUrl, filename } for use in database inserts and cleanup
  async function uploadVideoToSupabase(fileToUpload) {
    const filename = `${Date.now()}_${fileToUpload.name.replace(/\s+/g, '_')}`
    const { data, error } = await supabase.storage
      .from('videos')
      .upload(filename, fileToUpload, { cacheControl: '3600', upsert: false })
    if (error) throw error
    const { data: publicData } = await supabase.storage.from('videos').getPublicUrl(filename)
    // Return both the normalized URL and filename for cleanup purposes
    return {
      publicUrl: normalizeUrl(publicData?.publicUrl || filename),
      filename: filename
    }
  }

  async function addProcedure(e) {
    e.preventDefault()
    setAddError(null) // Clear any previous errors
    
    if (!title.trim()) {
      setAddError('Title is required.')
      return
    }
    
    try {
      const { error } = await supabase.from('procedures').insert({
        title: title.trim(),
        body: body.trim() || null,
      })
      
      if (error) {
        console.error('Supabase error adding procedure:', error)
        setAddError(`Failed to add procedure: ${error.message}`)
        return // Don't clear form on error
      }
      
      // Success - clear form and reload
      setTitle('')
      setBody('')
      setAddError(null)
      load()
    } catch (err) {
      console.error('Unexpected error adding procedure:', err)
      setAddError(`Unexpected error: ${err.message}`)
    }
  }

  async function addVideoTop(e) {
    e.preventDefault()
    if (!attachToId) return alert('Choose a procedure to attach the video to.')
    
    setUploadingVideo(true)
    let uploadedFilename = null // Track uploaded file for cleanup
    
    try {
      // Get current user ID for ownership
      const userId = await getUserId()
      if (!userId) {
        setUploadingVideo(false)
        return alert('You must be logged in to add videos.')
      }
      
      let finalUrl = ''
      
      if (videoSourceType === 'url') {
        if (!videoUrl.trim()) {
          setUploadingVideo(false)
          return alert('Paste a YouTube, Vimeo, or Loom URL.')
        }
        const normalized = normalizeUrl(videoUrl)
        // Basic validation - allow youtube, vimeo, loom or direct video file by extension
        if (!/youtube\.com|youtu\.be|vimeo\.com|loom\.com|\.mp4|\.webm|\.ogg|\.m3u8/i.test(normalized)) {
          // still allow unknown URLs but warn
          if (!confirm('This URL does not look like YouTube/Vimeo/Loom or a direct video file. Add anyway?')) {
            setUploadingVideo(false)
            return
          }
        }
        finalUrl = normalized
      } else {
        if (!videoFile) {
          setUploadingVideo(false)
          return alert('Select a video file to upload.')
        }
        const uploadResult = await uploadVideoToSupabase(videoFile)
        finalUrl = uploadResult.publicUrl
        uploadedFilename = uploadResult.filename // Store for potential cleanup
      }
      
      const { error } = await supabase.from('procedure_videos').insert({
        procedure_id: attachToId, 
        url: finalUrl,
        owner: userId // Include owner field for RLS
      })
      
      if (error) {
        console.error('Supabase error adding procedure video:', error)
        
        // Cleanup uploaded file if DB insert failed
        if (uploadedFilename) {
          try {
            await supabase.storage.from('videos').remove([uploadedFilename])
            console.log('Cleaned up uploaded file after DB error:', uploadedFilename)
          } catch (cleanupError) {
            console.error('Failed to cleanup uploaded file:', cleanupError)
          }
        }
        
        alert(error.message)
        setUploadingVideo(false)
        return
      }
      
      setVideoUrl('')
      setVideoFile(null)
      load()
    } catch (err) {
      console.error(err)
      
      // Cleanup uploaded file if any unexpected error occurred
      if (uploadedFilename) {
        try {
          await supabase.storage.from('videos').remove([uploadedFilename])
          console.log('Cleaned up uploaded file after error:', uploadedFilename)
        } catch (cleanupError) {
          console.error('Failed to cleanup uploaded file:', cleanupError)
        }
      }
      
      alert('Failed to add video: ' + err.message)
    } finally {
      setUploadingVideo(false)
    }
  }

  async function addVideoInline(pid) {
    const sourceType = inlineVideoSourceType[pid] || 'url'
    let uploadedFilename = null // Track uploaded file for cleanup
    
    try {
      // Get current user ID for ownership
      const userId = await getUserId()
      if (!userId) {
        return alert('You must be logged in to add videos.')
      }
      
      let finalUrl = ''
      
      if (sourceType === 'url') {
        const raw = (inlineVideo[pid] || '').trim()
        if (!raw) return
        const normalized = normalizeUrl(raw)
        finalUrl = normalized
      } else {
        const file = inlineVideoFile[pid]
        if (!file) return
        const uploadResult = await uploadVideoToSupabase(file)
        finalUrl = uploadResult.publicUrl
        uploadedFilename = uploadResult.filename // Store for potential cleanup
      }
      
      const { error } = await supabase.from('procedure_videos').insert({
        procedure_id: pid, 
        url: finalUrl,
        owner: userId // Include owner field for RLS
      })
      
      if (error) {
        console.error('Supabase error adding inline video:', error)
        
        // Cleanup uploaded file if DB insert failed
        if (uploadedFilename) {
          try {
            await supabase.storage.from('videos').remove([uploadedFilename])
            console.log('Cleaned up uploaded file after DB error:', uploadedFilename)
          } catch (cleanupError) {
            console.error('Failed to cleanup uploaded file:', cleanupError)
          }
        }
        
        return alert(error.message)
      }
      
      setInlineVideo(v => ({ ...v, [pid]: '' }))
      setInlineVideoFile(v => ({ ...v, [pid]: null }))
      load()
    } catch (err) {
      console.error(err)
      
      // Cleanup uploaded file if any unexpected error occurred
      if (uploadedFilename) {
        try {
          await supabase.storage.from('videos').remove([uploadedFilename])
          console.log('Cleaned up uploaded file after error:', uploadedFilename)
        } catch (cleanupError) {
          console.error('Failed to cleanup uploaded file:', cleanupError)
        }
      }
      
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
            <div>
              <form onSubmit={addProcedure}
                style={{ display:'grid', gridTemplateColumns:'1fr 1fr 96px', gap:10 }}>
                <input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} required />
                <input placeholder="Short description / steps" value={body} onChange={e=>setBody(e.target.value)} />
                <button type="submit">Add</button>
              </form>
              {addError && (
                <div style={{ 
                  background: '#fee', 
                  border: '1px solid #fcc', 
                  color: '#c33', 
                  padding: '8px 12px', 
                  borderRadius: 6, 
                  marginTop: 10,
                  fontSize: 14
                }}>
                  {addError}
                </div>
              )}
            </div>
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

      {/* Error message */}
      {loadError && (
        <div style={{ 
          background: '#fee', 
          border: '1px solid #fcc', 
          color: '#c33', 
          padding: '12px 16px', 
          borderRadius: 8, 
          marginBottom: 16 
        }}>
          {loadError}
        </div>
      )}

      {loading ? <div>Loading…</div> : (
        <>
          {items.length === 0 ? (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#666', 
              background: '#f8f9fa', 
              border: '1px solid #e9ecef', 
              borderRadius: 8 
            }}>
              No procedures found.
            </div>
          ) : (
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
        </>
      )}
    </div>
  )
}
