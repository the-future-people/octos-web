// src/components/bm/BMInfoStrip.jsx
//
// The strip across the top of the BM portal. Region, belt and date, then
// three real figures from the server (15 Nov 2026, jobs/selectors/branch_pulse.py):
//   Floor load     machine work waiting, against the time the working machines have left today
//   Machines up    active machines that are available; hover to see why any are down
//   Promises kept  jobs ready by the first time promised, over the last 7 days
//
// No scrollbar: when the strip is too wide for the window, an arrow sits at
// the edge with more to see, and goes once you reach the end.
import { useRef, useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'

const getPulse = () => client.get('/api/v1/jobs/pulse/').then(r => r.data)

// Pill colours, translucent so they read in dark mode too.
const TONE = {
  good: { background: 'rgba(99, 153, 34, 0.16)', color: '#3B6D11' },
  warn: { background: 'rgba(239, 159, 39, 0.20)', color: '#854F0B' },
  bad:  { background: 'rgba(226, 75, 74, 0.16)', color: '#A32D2D' },
}

function hoursAndMinutes(total) {
  const h = Math.floor(total / 60), m = total % 60
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}

function floorItem(floor) {
  if (!floor) return { value: '—' }
  if (floor.state === 'closed') {
    return { value: floor.queued_minutes ? `Closed · ${hoursAndMinutes(floor.queued_minutes)} queued` : 'Closed', muted: true }
  }
  if (floor.percent == null) return { value: '—', title: 'No machine is up to measure against' }
  const tone = floor.percent > 100 ? 'bad' : floor.percent >= 70 ? 'warn' : 'good'
  return {
    value: `${floor.percent}%`, tone,
    title: `${hoursAndMinutes(floor.queued_minutes)} of machine work waiting${floor.percent > 100 ? ": more than today's time left" : ''}`,
  }
}

function machinesItem(m) {
  if (!m || !m.total) return { value: '—' }
  return {
    value: `${m.up} of ${m.total}`,
    tone: m.down.length ? 'warn' : null,
    title: m.down.length ? m.down.map(d => `${d.name}: ${d.reason || 'down'}`).join('\n') : 'Every machine is up',
  }
}

function promisesItem(p) {
  if (!p || p.percent == null) return { value: '—', title: `No promised job turned ready in the last ${p?.days || 7} days` }
  return {
    value: `${p.percent}%`,
    tone: p.percent < 75 ? 'bad' : p.percent < 90 ? 'warn' : null,
    note: `${p.kept} of ${p.total}, ${p.days} days`,
    title: `${p.kept} of ${p.total} jobs ready by the time first promised, over the last ${p.days} days`,
  }
}

export default function BMInfoStrip({ user }) {
  const branch = user?.branch_detail || {}
  const today  = new Date().toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })

  const { data: pulse } = useQuery({
    queryKey: ['branchPulse'],
    queryFn: getPulse,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const scrollRef = useRef(null)
  const [canLeft,  setCanLeft]  = useState(false)
  const [canRight, setCanRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 0)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [checkScroll])
  // The figures change width when they arrive: check again.
  useEffect(() => { checkScroll() }, [pulse, checkScroll])

  const scroll = (dir) => scrollRef.current?.scrollBy({ left: dir * 160, behavior: 'smooth' })

  const items = [
    { label: 'REGION', value: branch.region_name || '—' },
    { label: 'BELT',   value: branch.belt_name   || '—' },
    { label: 'DATE',   value: today },
    { label: 'FLOOR LOAD',    ...floorItem(pulse?.floor) },
    { label: 'MACHINES UP',   ...machinesItem(pulse?.machines) },
    { label: 'PROMISES KEPT', ...promisesItem(pulse?.promises) },
  ]

  const arrow = 'absolute top-0 bottom-0 w-8 grid place-items-center bg-[var(--panel)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors'

  return (
    <div className="bg-[var(--panel)] border-b border-[var(--border)] shrink-0">
      <div className="max-w-6xl mx-auto relative">
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex items-center gap-5 px-4 py-2.5 text-xs overflow-x-auto whitespace-nowrap
            [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {items.map(item => (
            <div key={item.label} className="flex items-center gap-1.5 shrink-0" title={item.title}>
              <span className="font-bold text-[var(--text-3)] uppercase tracking-wider">{item.label}</span>
              {item.tone
                ? <span className="font-semibold px-2 py-px rounded-full" style={TONE[item.tone]}>{item.value}</span>
                : <span className={`font-semibold ${item.muted ? 'text-[var(--text-3)]' : 'text-[var(--text)]'}`}>{item.value}</span>}
              {item.note && <span className="text-[var(--text-3)]">· {item.note}</span>}
            </div>
          ))}
        </div>

        {/* Edge arrows, only when there's more that way */}
        {canLeft && (
          <button onClick={() => scroll(-1)} aria-label="Show earlier figures"
            className={`${arrow} left-0 border-r border-[var(--border)]`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
        {canRight && (
          <button onClick={() => scroll(1)} aria-label="Show more figures"
            className={`${arrow} right-0 border-l border-[var(--border)]`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
