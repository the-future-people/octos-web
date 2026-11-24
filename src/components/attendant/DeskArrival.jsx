// src/components/attendant/DeskArrival.jsx
// A front-desk job has landed (14 Nov 2026): hot and striking, but never at
// the cost of her work.
//
//   Idle  → a full modal with a chime: what it is, whose, the promise, the
//           files. The only way out is "Take it".
//   Busy  → (New Job, Register Customer or sign-off open) a pulsing bar
//           pinned above everything, so her cart is never covered or lost.
//           The modal opens the moment she closes what she was doing.
//   5 min → nobody has taken it: it turns red and chimes again, louder.
//           At 10 minutes the server tells the BM.
//
// Every attendant on shift sees it. The first to press "Take it" owns the
// job; for everyone else it disappears.

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LATE_MINUTES, chime, clock, deskQuery, errorText, minutesSince, needsHands, takeDeskJob,
} from '../../api/desk'

// Re-draw every 15 seconds so "waiting 6 min" and the red state keep up.
function useTick(ms = 15_000) {
  const [, set] = useState(0)
  useEffect(() => {
    const t = setInterval(() => set(n => n + 1), ms)
    return () => clearInterval(t)
  }, [ms])
}

function waitedText(iso) {
  const m = minutesSince(iso)
  return m < 1 ? 'just now' : `waiting ${m} min`
}

export default function DeskArrival({ busy, onTaken }) {
  useTick()
  const queryClient = useQueryClient()
  const { data } = useQuery(deskQuery)
  const [problem, setProblem] = useState('')
  // A print-on-arrival order alerts when its customer arrives, not before (24 Nov 2026).
  const waiting = (data?.jobs || []).filter(needsHands)
  const job = waiting[0]
  const late = job ? minutesSince(job.landed_at) >= LATE_MINUTES : false

  // A chime for each job the first time it is seen, and a loud one once
  // when any job crosses five minutes untaken.
  const seen = useRef(new Set())
  const rungLate = useRef(new Set())
  useEffect(() => {
    let fresh = false
    let overdue = false
    waiting.forEach(j => {
      if (!seen.current.has(j.id)) { seen.current.add(j.id); fresh = true }
      if (minutesSince(j.landed_at) >= LATE_MINUTES && !rungLate.current.has(j.id)) {
        rungLate.current.add(j.id); overdue = true
      }
    })
    if (overdue) chime(true)
    else if (fresh) chime(false)
  })

  const take = useMutation({
    mutationFn: takeDeskJob,
    onSuccess: () => {
      setProblem('')
      queryClient.invalidateQueries({ queryKey: ['deskQueue'] })
      onTaken?.({ fromBar: busy })
    },
    onError: e => {
      // Usually: another attendant took it a moment earlier.
      setProblem(errorText(e, 'Could not take it. Try again.'))
      queryClient.invalidateQueries({ queryKey: ['deskQueue'] })
    },
  })

  useEffect(() => { setProblem('') }, [job?.id])

  if (!job) return null

  const more = waiting.length - 1
  const counter = job.counter
  const heading = counter?.here ? `HERE NOW · CODE ${counter.code}` : counter ? `PAYS AT THE COUNTER · ${counter.code}` : 'NEW FRONT-DESK JOB'
  const promise = job.promise ? clock(job.promise) : null
  const tone = late
    ? { band: 'bg-[#B42318]', text: 'text-white', soft: 'text-white/80' }
    : { band: 'bg-[#16181D]', text: 'text-white', soft: 'text-white/70' }

  // On the dark or red bar the button is white; in the modal it carries the colour.
  const takeButton = (size = 'lg') => {
    const look = size === 'lg'
      ? `w-full h-12 text-[15px] text-white ${late ? 'bg-[#B42318] hover:bg-[#912018]' : 'bg-[#16181D] hover:bg-black'}`
      : `h-8 px-4 text-[13px] bg-white hover:bg-white/90 ${late ? 'text-[#B42318]' : 'text-[#16181D]'}`
    return (
      <button type="button" onClick={() => take.mutate(job.id)} disabled={take.isPending}
        className={`rounded-xl font-extrabold disabled:opacity-60 transition-colors shrink-0 ${look}`}>
        {take.isPending ? 'Taking…' : 'Take it'}
      </button>
    )
  }

  // ── Busy: the bar, above every overlay ──────────────────────────
  if (busy) {
    return (
      <div role="status" aria-live="assertive"
        className={`fixed top-0 inset-x-0 z-[200] ${tone.band} ${tone.text} shadow-lg`}>
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 py-2">
          <span className="relative flex w-2.5 h-2.5 shrink-0" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-white opacity-75 animate-ping" />
            <span className="relative w-2.5 h-2.5 rounded-full bg-white" />
          </span>
          <span className="text-[11px] font-black tracking-wider shrink-0">
            {late ? 'NOBODY HAS TAKEN THIS' : heading}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
            {job.title} · {job.customer}{promise ? ` · promised ${promise}` : ''}
            <span className={tone.soft}> · {waitedText(job.landed_at)}{more > 0 ? ` · +${more} more` : ''}</span>
          </span>
          {problem && <span className="text-[12px] font-semibold shrink-0">{problem}</span>}
          {takeButton('sm')}
        </div>
      </div>
    )
  }

  // ── Idle: the modal ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[150] bg-black/55 flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-labelledby="desk-arrival-title">
      <div className="w-full max-w-md bg-[var(--panel)] rounded-2xl shadow-2xl overflow-hidden">
        <div className={`${tone.band} ${tone.text} px-5 py-3 flex items-center justify-between`}>
          <span className="text-[11px] font-black tracking-wider">
            {late ? `NOBODY HAS TAKEN THIS · ${minutesSince(job.landed_at)} MIN` : heading}
          </span>
          <span className={`text-[12px] ${tone.soft}`}>{job.source}</span>
        </div>

        <div className="px-5 pt-4 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="desk-arrival-title" className="text-[18px] font-black text-[var(--text)] leading-snug">
                {job.title}
              </h2>
              <div className="text-[12.5px] text-[var(--text-3)] mt-0.5">
                {job.job_number} · {job.customer}
              </div>
            </div>
            {promise && (
              <div className="text-right shrink-0">
                <div className="text-[10.5px] font-bold text-[var(--text-3)] tracking-wider">PROMISED</div>
                <div className="text-[16px] font-black text-[var(--text)]">{promise}</div>
              </div>
            )}
          </div>

          <ul className="mt-3 rounded-xl bg-[var(--bg)] divide-y divide-[var(--border)]">
            {job.lines.map((line, i) => (
              <li key={i} className={`flex items-center justify-between gap-3 px-3 py-2 text-[13px]
                ${line.addon ? 'pl-7 text-[var(--text-2)]' : 'font-semibold text-[var(--text)]'}`}>
                <span className="min-w-0 truncate">{line.addon ? '+ ' : ''}{line.name}</span>
                <span className="shrink-0 text-[var(--text-3)] font-medium">
                  {line.quantity > 1 ? `× ${line.quantity}` : ''}{line.pages > 1 ? ` · ${line.pages} pages` : ''}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-center justify-between text-[12px] text-[var(--text-3)]">
            <span>{job.files.length} file{job.files.length === 1 ? '' : 's'} · {counter ? `pays at the counter · code ${counter.code}` : 'paid online'}</span>
            <span>{waitedText(job.landed_at)}</span>
          </div>

          {problem && (
            <div className="mt-3 rounded-lg bg-amber-50 text-amber-800 text-[12.5px] font-semibold px-3 py-2">
              {problem}
            </div>
          )}

          <div className="mt-4">{takeButton('lg')}</div>
          <p className="mt-2 text-center text-[11.5px] text-[var(--text-3)]">
            Every attendant on shift sees this. The first to take it does it.
            {more > 0 ? ` ${more} more waiting after this one.` : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
