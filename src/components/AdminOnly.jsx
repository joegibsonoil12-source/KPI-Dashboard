// src/components/AdminOnly.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AdminOnly({ children, fallback = null }) {
  const [allowed, setAllowed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        if (!cancelled) { setAllowed(false); setLoaded(true) }
        return
      }
      const { data, error } = await supabase
        .from('app_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!cancelled) {
        if (error) {
          console.warn('AdminOnly app_roles error:', error)
          setAllowed(false)
        } else {
          const isAdmin = (data?.role ?? 'user') === 'admin'
          setAllowed(isAdmin)
          if (!isAdmin) {
            console.warn('AdminOnly: user is not admin; role =', data?.role)
          }
        }
        setLoaded(true)
      }
    }
    check()
  }, [])

  if (!loaded) return <div>Loading…</div>
  return allowed ? children : (fallback ?? null)
}
