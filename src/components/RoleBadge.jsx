// src/components/RoleBadge.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function RoleBadge() {
  const [role, setRole] = useState('guest')
  const [loading, setLoading] = useState(true)

  async function refreshRole() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setRole('guest'); return }

      // 🔹 Direct read from app_roles (no RPC)
      const { data, error } = await supabase
        .from('app_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (error) {
        console.error('app_roles read error:', error)
        setRole('user')
      } else {
        setRole((data?.role ?? 'user') === 'admin' ? 'admin' : 'user')
      }
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
