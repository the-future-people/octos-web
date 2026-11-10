// src/components/hr/Applications.jsx
// Two ways to see applications:
//   Focus — pick a task lane, work through it one applicant at a time, oldest first.
//   List  — everyone, for looking things up. You look in List, you act in Focus.
// Verifying a new hire's information and the offer letter stay in the classic portal for now.

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getApplications, getVacancies } from '../../api/hr'
import { LANES, laneOf, queueOrder, errorText } from './applications/shared'
import Focus from './applications/Focus'
import List from './applications/List'

export default function Applications() {
  const [params, setParams] = useSearchParams()
  const mode = params.get('mode') === 'list' ? 'list' : 'focus'
  const vacancy = params.get('vacancy') || ''

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next, { replace: true })
  }

  const appsQ = useQuery({ queryKey: ['hrApplications'], queryFn: () => getApplications().then((r) => r.data), refetchInterval: 60_000 })
  const vacsQ = useQuery({ queryKey: ['hrVacancies'], queryFn: () => getVacancies().then((r) => r.data) })
  const apps = appsQ.data || []

  // Focus state for this session: chosen lane, people skipped (sent to the back),
  // and someone pulled to the front with "Work on this now"
  const [laneChoice, setLaneChoice] = useState(null)
  const [skipped, setSkipped] = useState([])
  const [pinned, setPinned] = useState(null)
  const [flash, setFlash] = useState('')

  const byLane = useMemo(() => {
    const m = Object.fromEntries(LANES.map((l) => [l.key, []]))
    apps.forEach((a) => { const l = laneOf(a); if (l) m[l.key].push(a) })
    return m
  }, [apps])
  const counts = Object.fromEntries(LANES.map((l) => [l.key, byLane[l.key].length]))

  // Default lane: the first with anyone waiting
  const lane = laneChoice || LANES.find((l) => counts[l.key] > 0)?.key || 'screen'

  const queue = useMemo(() => {
    const rows = [...byLane[lane]].sort(queueOrder)
    const rank = (a) => (a.id === pinned ? -1 : skipped.includes(a.id) ? 1 + skipped.indexOf(a.id) : 0)
    return rows.sort((x, y) => rank(x) - rank(y))   // stable: keeps queue order within each rank
  }, [byLane, lane, skipped, pinned])

  const pickLane = (k) => { setLaneChoice(k); setFlash('') }
  const done = (msg) => { setFlash(msg); setPinned(null) }
  const skip = () => {
    const id = queue[0]?.id
    if (!id) return
    setFlash('')
    if (pinned === id) setPinned(null)
    setSkipped((s) => [...s.filter((x) => x !== id), id])
  }
  const workNow = (a, laneKey) => {
    setPinned(a.id)
    setSkipped((s) => s.filter((x) => x !== a.id))
    setLaneChoice(laneKey)
    setFlash('')
    setParam('mode', '')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-[var(--text)]">Applications</h1>
          <p className="text-sm text-[var(--text-3)]">
            {mode === 'focus' ? 'Pick a task. One person at a time, oldest first.' : 'Everyone who applied. Look here, act in Focus.'}
          </p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-[var(--border)] text-sm font-semibold">
          {[['focus', 'Focus'], ['list', 'List']].map(([m, l]) => (
            <button key={m} type="button" onClick={() => setParam('mode', m === 'list' ? 'list' : '')}
                    className="px-4 py-1.5 transition-colors"
                    style={mode === m ? { background: 'var(--text)', color: 'var(--panel)' } : { background: 'var(--panel)', color: 'var(--text-2)' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {appsQ.isLoading && <p className="py-10 text-center text-sm text-[var(--text-3)]">Loading applications…</p>}
      {appsQ.error && <p className="py-10 text-center text-sm">{errorText(appsQ.error, "Couldn't load applications.")}</p>}

      {appsQ.data && mode === 'focus' && (
        <Focus lane={lane} onPickLane={pickLane} counts={counts} queue={queue} flash={flash} onDone={done} onSkip={skip} />
      )}
      {appsQ.data && mode === 'list' && (
        <List apps={apps} vacancies={vacsQ.data || []} vacancy={vacancy} setVacancy={(v) => setParam('vacancy', v)} onWorkNow={workNow} />
      )}
    </div>
  )
}

// For the sidebar badge: how many people are waiting on HR in any lane
export const waitingCount = (apps = []) => apps.filter((a) => laneOf(a)).length
