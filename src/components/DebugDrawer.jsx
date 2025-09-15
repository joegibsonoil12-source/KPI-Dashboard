// src/components/DebugDrawer.jsx
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function DebugDrawer() {
  const [open, setOpen] = useState(false)

  // basics
  const [supabaseUrl] = useState(import.meta?.env?.VITE_SUPABASE_URL || '')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState(null)
  const [roleErr, setRoleErr] = useState(null)

  // procedures
  const [procedures, setProcedures] = useState([])
  const [procsErr, setProcsErr] = useState(null)

  // videos for selected
  const [selProc, setSelProc] = useState('')
  const [videos, setVideos] = useState([])
  const [videosErr, setVideosErr] = useState(null)

  // test add video
  const [testUrl, setTestUrl] = useState('')
  const [confirmWrite, setConfirmWrite] = useState(false)
  const [writeResult, setWriteResult] = useState(null)

  // component versions (reads from DOM so you can verify the bundle)
  const [procVersion, setProcVersion] = useState(null)
  useEffect(() => {
    const v = document.querySelector('[data-proc-version]')?.getAttribute('data-proc-version')
    setProcVersion(v || null)
  }, [open])

  async function refreshAuth() {
    setRoleErr(null)
    const { data: { session } } = await supabase.auth.getSession()
    setEmail(session?.user?.email || '')
    setUserId(session?.user?.id || '')
    if (session?.user?.id) {
      const { data, error } = await supabase
        .from('app_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (error) { setRole(null); setRoleErr(error.message) }
      else setRole(data?.role ?? null)
    } else {
      setRole(null)
    }
  }

  async function refreshProcedures() {
    setProcsErr(null)
    const { data, error } = await supabase
      .from('procedures')
      .select('id,title,created_at')
      .order('created_at', { ascending: false })
    if (error) { setProcedures([]); setProcsErr(error.message) }
    else setProcedures(data || [])
  }

  async function refreshVideos(pid) {
    setVideosErr(null)
    setVideos([])
    if (!pid) return
    const { data, error } = await supabase
      .from('procedure_videos')
      .select('id,url,created_at')
      .eq('procedure_id', pid)
      .order('created_at', { ascending: false })
    if (error) { setVideosErr(error.message) }
    else setVideos(data || [])
  }

  useEffect(() => {
    if (!open) return
    ;(async () => {
      await refreshAuth()
      await refreshProcedures()
      if (selProc) await refreshVideos(selProc)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (open && selProc) refreshVideos(selProc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selProc])

  const isAdmin = role === 'admin'
  const procOpts = useMemo(
    () => procedures.map(p => ({ value: p.id, label: p.title || '(untitled)' })),
    [procedures]
  )

  async function clearSessionAndSignOut() {
    try {
      Object.keys(localStorage).forEach(k => { if (k.startsWith('sb-')) localStorage.removeItem(k) })
      await supabase.auth.signOut()
    } finally {
      location.reload()
    }
  }

  async function testAddVideo() {
    setWriteResult(null)
    if (!confirmWrite) {
      setWriteResult({ ok:false, detail:'Please check the box to confirm this will create a test row.' })
      return
    }
    if (!isAdmin) {
      setWriteResult({ ok:false, detail:'Blocked: your role is not admin.' })
      return
    }
    if (!selProc) {
      setWriteResult({ ok:false, detail:'Pick a procedure to attach the test video to.' })
      return
    }
    const url = testUrl.trim()
    if (!url) {
      setWriteResult({ ok:false, detail:'Enter a YouTube or Loom URL.' })
      return
    }
    const { error } = await supabase.from('procedure_videos').insert({ procedure_id: selProc, url })
    if (error) setWriteResult({ ok:false, detail:error.message })
    else {
      setWriteResult({ ok:true, detail:'Inserted successfully. Reloading videos…' })
      setTestUrl('')
      await refreshVideos(selProc)
    }
  }

  // styles
  const btn = { padding:'6px 10px', borderRadius:8, border:'1px solid #ddd', background:'#fff', cursor:'pointer' }
  const tag = (v) => <span style={{ padding:'2px 6px', border:'1px solid #eee', borderRadius:6 }}>{String(v ?? '—')}</span>
  const row = { display:'grid', gridTemplateColumns:'160px 1fr', gap:8, alignItems:'center' }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position:'fixed', right:12, bottom:60, zIndex:9999,
          padding:'8px 12px', borderRadius:10, background:'#111', color:'#fff',
          border:'none', boxShadow:'0 4px 18px rgba(0,0,0,0.2)'
        }}
        title="Open debug"
      >
        🛠 Debug
      </button>

      {/* Drawer */}
      <div
        style={{
          position:'fixed', top:0, right:0, height:'100vh', width: open ? 380 : 0,
          background:'#fff', borderLeft:'1px solid #e5e7eb', boxShadow:'-8px 0 24px rgba(0,0,0,0.06)',
          overflow:'hidden', transition:'width .25s ease', zIndex:9998
        }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:12, borderBottom:'1px solid #eee' }}>
          <strong>Debug</strong>
          <button onClick={() => setOpen(false)} style={btn}>Close</button>
        </div>

        <div style={{ padding:12, display:'grid', gap:12 }}>
          {/* App / Build */}
          <div style={{ ...row }}>
            <div>Component ver</div>
            <div>{tag(procVersion ?? 'not found')}</div>
          </div>
          <div style={{ ...row }}>
            <div>Location</div>
            <div style={{ wordBreak:'break-all' }}>{tag(window.location.href)}</div>
          </div>
          <div style={{ ...row }}>
            <div>Supabase URL</div>
            <div style={{ wordBreak:'break-all' }}>{tag(supabaseUrl || '(unset)')}</div>
          </div>

          <hr />

          {/* Auth */}
          <div style={{ ...row }}>
            <div>Signed in</div>
            <div>{tag(email || 'guest')}</div>
          </div>
          <div style={{ ...row }}>
            <div>User ID</div>
            <div style={{ wordBreak:'break-all' }}>{tag(userId || '—')}</div>
          </div>

          {/* Role */}
          <div style={{ ...row }}>
            <div>app_roles.role</div>
            <div>
              {tag(role ?? '—')}
              {roleErr && <div style={{ color:'#b91c1c', fontSize:12, marginTop:4 }}>Error: {roleErr}</div>}
            </div>
          </div>

          <hr />

          {/* Procedures overview */}
          <div style={{ ...row }}>
            <div>Procedures</div>
            <div>
              {tag(procedures?.length ?? 0)}
              {procsErr && <div style={{ color:'#b91c1c', fontSize:12, marginTop:4 }}>Error: {procsErr}</div>}
            </div>
          </div>
          {procedures.slice(0,5).map(p => (
            <div key={p.id} style={{ fontSize:12, opacity:0.8, paddingLeft:8 }}>
              • {p.title || '(untitled)'} <span style={{ opacity:0.6 }}>({p.id.slice(0,8)}…)</span>
            </div>
          ))}

          {/* Videos for selected procedure */}
          <div style={{ ...row }}>
            <div>Pick procedure</div>
            <div>
              <select value={selProc} onChange={e => setSelProc(e.target.value)} style={{ width:'100%' }}>
                <option value="">—</option>
                {procOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {videosErr && <div style={{ color:'#b91c1c', fontSize:12, marginTop:4 }}>Error: {videosErr}</div>}
            </div>
          </div>
          {selProc && (
            <div style={{ fontSize:12, display:'grid', gap:6 }}>
              <div style={{ opacity:0.7 }}>Videos attached:</div>
              {(videos || []).map(v => (
                <div key={v.id} style={{ wordBreak:'break-all' }}>• {v.url}</div>
              ))}
              {videos?.length === 0 && <div style={{ opacity:0.6 }}>(none)</div>}
            </div>
          )}

          <hr />

          {/* Write test */}
          <div style={{ fontWeight:600 }}>Test add video</div>
          <div style={{ fontSize:12, opacity:0.75, marginTop:-6, marginBottom:6 }}>
            (Uses your current role & RLS. Great for screenshots.)
          </div>
          <div style={{ ...row }}>
            <div>Video URL</div>
            <div><input value={testUrl} onChange={e => setTestUrl(e.target.value)} placeholder="https://youtu.be/..." style={{ width:'100%' }} /></div>
          </div>
          <div style={{ ...row }}>
            <div>Confirm</div>
            <label style={{ display:'flex', gap:6, alignItems:'center' }}>
              <input type="checkbox" checked={confirmWrite} onChange={e => setConfirmWrite(e.target.checked)} />
              <span style={{ fontSize:12 }}>I understand this will create a test row.</span>
            </label>
          </div>
          <div>
            <button style={{ ...btn, background:'#111', color:'#fff' }} onClick={testAddVideo}>Run test add</button>
          </div>
          {writeResult && (
            <div style={{ padding:8, border:'1px solid #eee', borderRadius:8, background: writeResult.ok ? '#ecfdf5' : '#fef2f2', color: writeResult.ok ? '#065f46' : '#991b1b' }}>
              {writeResult.ok ? 'OK: ' : 'Error: '}{writeResult.detail}
            </div>
          )}

          <hr />

          {/* Session controls */}
          <div style={{ display:'flex', gap:8 }}>
            <button style={btn} onClick={refreshAuth}>Refresh</button>
            <button style={btn} onClick={clearSessionAndSignOut}>Clear session & Sign out</button>
            <button style={btn} onClick={() => location.reload()}>Hard reload</button>
          </div>
        </div>
      </div>
    </>
  )
}
