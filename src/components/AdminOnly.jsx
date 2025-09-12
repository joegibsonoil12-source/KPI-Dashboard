// src/components/AdminOnly.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AdminOnly({ children, fallback = null }) {
  const [allowed, setAllowed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      // Get session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { if (!cancelled){ setLoaded(true); setAllowed(false) } ; return }

      // 🔹 Direct role check (no RPC)
      const { data, error } = await supabase
        .from('app_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!cancelled) {
        if (error) {
          console.error('AdminOnly app_roles error:', error)
          setAllowed(false)
        } else {
          setAllowed((data?.role ?? 'user') === 'admin')
        }
        setLoaded(true)
      }
    }
    check()
  }, [])

  if (!loaded) return <div>Loading…</div>
  return allowed ? children : (fallback ?? <div>Admins only</div>)
}
