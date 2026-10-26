// src/components/bm/LinksPanel.jsx
//
// Who a person works with, or who works with a business: on the
// customer's profile. Link, change the role or the named mark, and, for
// the branch manager, end a link when someone has left. Ended links stay,
// greyed and folded away: the history is kept, not erased.

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { getCustomers } from '../../api/bm'

const ROLES = [['REP', 'Rep'], ['STAFF', 'Staff'], ['OWNER', 'Owner'], ['MEMBER', 'Member']]
const ROLE = Object.fromEntries(ROLES)
const SELECT = 'px-2 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-lg outline-none'

export default function LinksPanel({ customer }) {
  const queryClient = useQueryClient()
  const isOrg = customer.customer_type !== 'INDIVIDUAL'
  const key = ['customer-links', customer.id]
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => client.get(`/api/v1/customers/${customer.id}/links/`).then(r => r.data),
  })
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [pick, setPick] = useState(null)
  const [role, setRole] = useState(isOrg ? 'STAFF' : 'MEMBER')
  const [named, setNamed] = useState(false)
  const [showEnded, setShowEnded] = useState(false)
  const [problem, setProblem] = useState('')

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key })
    queryClient.invalidateQueries({ queryKey: ['customer', customer.id] })
  }
  const fail = err => setProblem(err.response?.data?.detail || 'That didn’t work. Try again.')

  async function search(q) {
    setQuery(q); setPick(null)
    if (q.trim().length < 2) { setResults([]); return }
    try {
      const r = await getCustomers({ search: q.trim(), page_size: 8 })
      const list = Array.isArray(r.data) ? r.data : (r.data?.results || [])
      setResults(list.filter(c => (isOrg ? c.customer_type === 'INDIVIDUAL' : c.customer_type !== 'INDIVIDUAL')))
    } catch { setResults([]) }
  }

  async function link() {
    if (!pick) return
    setProblem('')
    try {
      await client.post(`/api/v1/customers/${customer.id}/links/`, { other: pick.id, role, named })
      setAdding(false); setQuery(''); setResults([]); setPick(null); setNamed(false)
      refresh()
    } catch (err) { fail(err) }
  }

  async function change(id, patch) {
    setProblem('')
    try { await client.patch(`/api/v1/customers/links/${id}/`, patch); refresh() } catch (err) { fail(err) }
  }

  async function end(l) {
    if (!window.confirm(`${l.name} has left? The link ends; every job stays as it was.`)) return
    setProblem('')
    try { await client.post(`/api/v1/customers/links/${l.id}/end/`); refresh() } catch (err) { fail(err) }
  }

  const links = data?.links || []
  const active = links.filter(l => l.active)
  const ended = links.filter(l => !l.active)

  return (
    <div className="rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
          {isOrg ? 'People' : 'Works with'}
        </p>
        {!adding && (
          <button onClick={() => setAdding(true)} className="text-xs font-bold text-blue-700 hover:underline">
            + {isOrg ? 'Add a person' : 'Link to a business or institution'}
          </button>
        )}
      </div>

      {active.length === 0 && !adding && (
        <p className="text-xs text-[var(--text-3)] py-1">
          {isOrg ? 'Nobody linked yet.' : 'Not linked to any business or institution.'}
        </p>
      )}

      {active.map(l => (
        <div key={l.id} className="flex items-center gap-2 py-2 border-b border-[var(--border)] last:border-0">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--text)] truncate">{l.name}</p>
            <p className="text-[11px] text-[var(--text-3)]">{l.phone}</p>
          </div>
          <select value={l.role} onChange={e => change(l.id, { role: e.target.value })} className={SELECT}>
            {ROLES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          <label className="flex items-center gap-1 text-[11px] text-[var(--text-2)] cursor-pointer" title="The business has named them as one who may order for it">
            <input type="checkbox" checked={l.named} onChange={e => change(l.id, { named: e.target.checked })} />
            Named
          </label>
          {data?.can_end && (
            <button onClick={() => end(l)} className="text-[11px] font-bold text-[var(--red-text)] hover:underline ml-1">End</button>
          )}
        </div>
      ))}

      {adding && (
        <div className="mt-2 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
          {!pick ? (
            <div className="relative">
              <input autoFocus value={query} onChange={e => search(e.target.value)}
                     placeholder={isOrg ? 'Search a person by name or number…' : 'Search a business or institution…'}
                     className="w-full px-3 py-2 text-sm bg-[var(--panel)] border border-[var(--border)] rounded-lg outline-none" />
              {results.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-lg overflow-hidden">
                  {results.map(c => (
                    <button key={c.id} onClick={() => { setPick(c); setResults([]) }}
                            className="w-full px-3 py-2 text-left hover:bg-[var(--bg)] border-b border-[var(--border)] last:border-0">
                      <span className="block text-sm font-semibold truncate">{c.company_name || c.full_name}</span>
                      <span className="block text-[11px] text-[var(--text-3)]">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold flex-1 min-w-0 truncate">{pick.company_name || pick.full_name}</span>
              <select value={role} onChange={e => setRole(e.target.value)} className={SELECT}>
                {ROLES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
              <label className="flex items-center gap-1 text-[11px] text-[var(--text-2)]">
                <input type="checkbox" checked={named} onChange={e => setNamed(e.target.checked)} /> Named
              </label>
              <button onClick={link} className="px-3 py-1.5 rounded-lg bg-[var(--text)] text-white text-xs font-bold">Link</button>
            </div>
          )}
          <button onClick={() => { setAdding(false); setPick(null); setQuery(''); setResults([]) }}
                  className="mt-2 text-[11px] text-[var(--text-3)] hover:underline">Cancel</button>
        </div>
      )}

      {ended.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowEnded(s => !s)} className="text-[11px] text-[var(--text-3)] hover:underline">
            {showEnded ? 'Hide' : 'Show'} {ended.length} ended link{ended.length === 1 ? '' : 's'}
          </button>
          {showEnded && ended.map(l => (
            <p key={l.id} className="text-[11px] text-[var(--text-3)] py-1">
              {l.name} · {ROLE[l.role] || l.role} · ended {new Date(l.ended_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          ))}
        </div>
      )}

      {problem && <p className="mt-2 text-[11px] text-[var(--red-text)]">{problem}</p>}
    </div>
  )
}