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
      const { data, error } = await supabase.rpc('is_admin')
      if (error) {
        console.error('is_admin RPC error:', error)
        setRole('user')
      } else {
        setRole(data ? 'admin' : 'user')
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
    <div style={{position:'fixed', right:12, bottom:12, fontSize:12, opacity:0.85, zIndex:9999}}>
      <span style={{padding:'6px 10px', borderRadius:8, background:'#111', color:'#fff'}}>
        Role: {loading ? '…' : role}
      </span>
    </div>
  )
}
