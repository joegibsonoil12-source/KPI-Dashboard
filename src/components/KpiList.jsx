import React, { useEffect, useState } from 'react'
import supabase from '../lib/supabaseClient'

export default function KpiList() {
  const [kpis, setKpis] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [name, setName] = useState('')
  const [value, setValue] = useState('')

  async function loadKpis() {
    setLoading(true)
    const { data, error } = await supabase
      .from('kpis')
      .select('*')
      .order('id', { ascending: true })
    if (error) {
      setError(error.message)
      setKpis([])
    } else {
      setKpis(data || [])
      setError(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true
    loadKpis()

    const channel = supabase
      .channel('public:kpis')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kpis' },
        () => {
          if (mounted) loadKpis()
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!name || value === '') return
    const numeric = Number(value)
    await supabase.from('kpis').insert([{ name, value: numeric }])
    setName('')
    setValue('')
    await loadKpis()
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error loading KPIs: {error}</div>
  if (!kpis || kpis.length === 0)
    return (
      <div>
        <h3>KPIs</h3>
        <div>No KPIs found</div>
        <form onSubmit={handleAdd} style={{ marginTop: 12 }}>
          <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} />
          <button type="submit">Add KPI</button>
        </form>
      </div>
    )

  return (
    <div>
      <h3>KPIs</h3>
      <ul>
        {kpis.map((k) => (
          <li key={k.id}>
            <strong>{k.name}</strong>: {k.value} {k.updated_at ? <small> (updated {k.updated_at})</small> : null}
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} style={{ marginTop: 12 }}>
        <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="submit">Add KPI</button>
      </form>
    </div>
  )
}