// src/components/DebugPanel.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function DebugPanel() {
  const [email, setEmail] = useState('')
  const [rpcAdmin, setRpcAdmin] = useState(null)
  const [directRole, setDirectRole] = useState(null)

  async function refresh() {
    const { data: { session } } = await supabase.auth.getSession()
    setEmail(session?.user?.email || 'guest')

    const rpc = await supabase.rpc('is_admin')
    setRpcAdmin(rpc.error ? `ERR: ${rpc.error.message}` : rpc.data)

    if (session) {
      const { data, error } = await supabase
        .from('app_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle()
      setDirectRole(error ? `ERR: ${error.message}` : (data?.role ?? null))
    } else {
      setDirectRole(null)
    }
  }

  async function clearSessionAndSignOut() {
    Object.keys(localStorage).forEach(k => { if (k.startsWith('sb-')) localStorage.removeItem(k) })
    await supabase.auth.signOut()
    location.reload()
  }

  useEffect(() => {
    refresh()
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh())
    return () => sub?.subscription?.unsubscribe?.()
  }, [])

  return (
    <div style={{
      position:'fixed', left:12, bottom:12, zIndex:9999, background:'#fff',
      border:'1px solid #ddd', borderRadius:10, padding:10, fontSize:12,
      boxShadow:'0 4px 20px rgba(0,0,0,0.08)'
    }}>
      <div style={{fontWeight:700, marginBottom:6}}>Debug</div>
      <div>Email: {email}</div>
      <div>is_admin() RPC: {String(rpcAdmin)}</div>
      <div>direct app_roles.role: {String(directRole)}</div>
      <div style={{display:'flex', gap:6, marginTop:8}}>
        <button onClick={refresh}>Refresh</button>
        <button onClick={clearSessionAndSignOut}>Clear session & Sign out</button>
      </div>
    </div>
  )
}
