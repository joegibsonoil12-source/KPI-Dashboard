// src/components/RoleBadge.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function RoleBadge() {
  const [role, setRole] = useState('guest')
  const [loading, setLoading] = useState(true)

  async function readRoleDirect() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return 'guest'
    const { data, error } = await supabase
      .from('app_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (error) {
      console.warn('direct role read error:', error)
      return 'user'
    }
    return data?.role ?? 'user'
  }

  async function refreshRole() {
    setLoading(true)
    try {
      // 1) Try RPC
      const { data, error } = await supabase.rpc('is_admin')
      if (!error && data === true) {
        setRole('admin')
        return
      }
      if (error) console.warn('is_admin RPC error:', error)

      // 2) Fallback: direct table read
      const direct = await readRoleDirect()
      setRole(direct === 'admin' ? 'admin' : 'user')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => refreshRole())
    refreshRole()
    return () => sub?.subscription?.unsubscribe?.()
  }, [])

  return (
    <div style={{position:'fixed', right:12, bottom:12, fontSize:12, opacity:0.9, zIndex:9999}}>
      <span style={{padding:'6px 10px', borderRadius:8, background:'#111', color:'#fff'}}>
        Role: {loading ? '…' : role}
      </span>
    </div>
  )
}
