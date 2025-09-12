// src/components/DebugPanel.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function DebugPanel() {
  const [projectUrl, setProjectUrl] = useState('')
  const [email, setEmail] = useState('')
  const [admin, setAdmin] = useState(null)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setBusy(true)
    try {
      setProjectUrl(import.meta?.env?.VITE_SUPABASE_URL || '')
      const { data: { session } } = await supabase.auth.getSession()
      setEmail(session?.user?.email || '')
      const { data, error } = await supabase.rpc('is_admin')
      setAdmin(error ? `ERR: ${error.message}` : data)
    } finally {
      setBusy(false)
    }
  }

  async function clearSessionAndSignOut() {
    // Clear Supabase cached session (keys start with 'sb-')
    Object.keys(localStorage).forEach(k => { if (k.startsWith('sb-')) localStorage.removeItem(k) })
    await supabase.auth.signOut()
    location.reload()
  }

  async function signIn() {
    const e = prompt('Enter your email for a magic link:')
    if (!e) return
    const { error } = await supabase.auth.signInWithOtp({ email: e })
    if (error) alert(error.message); else alert('Check your email for the sign-in link.')
  }

  useEffect(() => {
    refresh()
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh())
    return () => sub?.subscription?.unsubscribe?.()
  }, [])

  const box = {
    position:'fixed', left:12, bottom:12, zIndex:9999,
    background:'#fff', color:'#111', border:'1px solid #ddd',
    borderRadius:10, padding:10, fontSize:12, boxShadow:'0 4px 20px rgba(0,0,0,0.08)'
  }

  const tag = (v) => (
    <span style={{padding:'2px 6px', borderRadius:6, border:'1px solid #eee', background:'#f7f7f7', marginLeft:6}}>
      {String(v)}
    </span>
  )

  return (
    <div style={box}>
      <div style={{fontWeight:700, marginBottom:6}}>Debug</div>
      <div>Project URL: {tag(projectUrl || '—')}</div>
      <div>Signed in as: {tag(email || 'guest')}</div>
      <div>is_admin(): {tag(admin === null ? '…' : admin)}</div>
      <div style={{display:'flex', gap:6, marginTop:8}}>
        <button onClick={refresh} disabled={busy}>Refresh</button>
        <button onClick={clearSessionAndSignOut}>Clear session & Sign out</button>
        <button onClick={signIn}>Sign in</button>
      </div>
    </div>
  )
}
