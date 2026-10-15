// src/components/coordinator/ArrivalQueue.jsx
//
// The arrivals queue, strict by design. The job at the head is sharp and
// the only one that can be opened; the jobs behind it are blurred and
// faded the further back they wait, with arrows pointing up toward the
// head. Nobody chooses. Choosing lets the awkward file wait while easier
// ones go through, and the job left behind is the one that goes late.
//
// The order and which job is next come from the server (is_next), so this
// list and the claim that opens a job can never disagree.
//
// Clearing sends a job straight to press; there is no second step to
// start it. When a job is cleared the board marks it leaving, it slides
// out toward In press, and the queue is then refreshed. Every row that
// moved glides from where it was to where it now is, measured before and
// after, so the same glide covers another coordinator taking a job too.

import { useLayoutEffect, useRef } from 'react'
import { Chip, ChannelChip, DueChip, isOnline, services, waited } from './shared'

const FADE = [
  { opacity: 1,    filter: 'none' },
  { opacity: 0.66, filter: 'blur(0.5px)' },
  { opacity: 0.44, filter: 'blur(1px)' },
  { opacity: 0.3,  filter: 'blur(1.5px)' },
]

function fadeFor(i) {
  return FADE[Math.min(i, FADE.length - 1)]
}

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    className="shrink-0 text-[var(--text-3)]">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)

const InspectIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <circle cx="11.5" cy="14.5" r="2.5" />
    <path d="M13.3 16.3 15 18" />
  </svg>
)

function useGlide() {
  const nodes = useRef(new Map())
  const before = useRef(new Map())

  useLayoutEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const now = new Map()
    nodes.current.forEach((el, id) => now.set(id, el.offsetTop))

    if (!reduce) {
      now.forEach((top, id) => {
        const was = before.current.get(id)
        if (was !== undefined && was !== top) {
          nodes.current.get(id).animate(
            [{ transform: `translateY(${was - top}px)` }, { transform: 'translateY(0)' }],
            { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)' },
          )
        }
      })
    }
    before.current = now
  })

  return (id) => (el) => {
    if (el) nodes.current.set(id, el)
    else nodes.current.delete(id)
  }
}

function Head({ job, onInspect, claiming, blocked }) {
  const mine = job.inspecting_is_me
  const paidOnline = isOnline(job) && job.payment_state === 'SETTLED'

  return (
    <div className="bg-[var(--panel)] border-2 border-blue-300 rounded-2xl px-5 py-4
      shadow-[0_6px_20px_-12px_rgba(29,78,216,0.35)]">
      <div className="flex items-center gap-2">
        <Chip className="bg-blue-600 text-white">{mine ? 'You are inspecting' : 'Next'}</Chip>
        <ChannelChip channel={job.intake_channel} />
        <span className="ml-auto font-mono text-xs text-[var(--text-3)]">{job.job_number}</span>
      </div>

      <div className="flex items-end gap-4 mt-3.5">
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold text-[var(--text)] leading-snug">
            {services(job)}
          </div>
          <div className="text-sm text-[var(--text-2)] mt-0.5">
            {job.customer_name || 'Walk-in'}
            {paidOnline ? ' · paid online' : ''}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <DueChip row={job} />
            <Chip>Waiting {waited(job.created_at)}</Chip>
          </div>
        </div>
        <button
          onClick={() => onInspect(job.id)}
          disabled={!!claiming || blocked}
          className="min-h-[48px] px-6 text-sm font-bold bg-[var(--text)] text-white
            rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0">
          {claiming === job.id ? 'Opening…' : mine ? 'Continue' : 'Inspect'}
        </button>
      </div>
    </div>
  )
}

function Waiting({ job, position }) {
  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl
      px-4 py-3 flex items-center gap-3">
      <span className="w-5 text-center text-xs font-bold text-[var(--text-3)] shrink-0">
        {position}
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-semibold text-[var(--text)] truncate">
          {services(job)}
        </span>
        <span className="hidden sm:inline-flex"><ChannelChip channel={job.intake_channel} /></span>
      </div>
      <DueChip row={job} />
      <LockIcon />
    </div>
  )
}

/**
 * queue:     rows from the verification queue, in server order
 * onInspect: called with the head job's id
 * claiming:  id being claimed right now, or null
 * leavingId: id of a job just cleared, which slides out before it goes
 * blocked:   true while this coordinator has another job open
 */
export default function ArrivalQueue({ queue, onInspect, claiming, leavingId, blocked }) {
  const refFor = useGlide()

  // Jobs another coordinator holds are not in the line. They are being
  // dealt with; showing them as waiting would make the queue look longer
  // than the work actually left.
  const elsewhere = queue.filter(j => j.inspecting_by_name && !j.inspecting_is_me)
  const line = queue.filter(j => !(j.inspecting_by_name && !j.inspecting_is_me))

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center
          justify-center">
          <InspectIcon />
        </span>
        <span className="text-sm font-semibold text-[var(--text)]">To inspect</span>
        <Chip>{line.length}</Chip>
      </div>

      {line.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          px-6 py-12 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 mx-auto
            flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="m8 12 3 3 5-6" />
            </svg>
          </div>
          <p className="text-base font-bold text-[var(--text)] mt-3">All caught up</p>
          <p className="text-sm text-[var(--text-2)] mt-1">
            Every file that arrived has been checked. New orders land here.
          </p>
        </div>
      ) : (
        <div className="relative">
          {line.map((job, i) => {
            const leaving = job.id === leavingId
            const fade = fadeFor(i)
            return (
              <div key={job.id} ref={refFor(job.id)}
                style={{
                  opacity:   leaving ? 0 : fade.opacity,
                  filter:    leaving ? 'none' : fade.filter,
                  transform: leaving ? 'translateX(80px)' : undefined,
                }}
                className="transition-[opacity,filter,transform] duration-500 ease-out
                  motion-reduce:transition-none">
                {i > 0 && (
                  <div aria-hidden="true"
                    className="text-center text-sm leading-none text-[var(--text-3)] py-2">
                    ↑
                  </div>
                )}
                {i === 0 ? (
                  <Head job={job} onInspect={onInspect}
                    claiming={claiming} blocked={blocked} />
                ) : (
                  <Waiting job={job} position={i + 1} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {elsewhere.map(job => (
        <div key={job.id}
          className="mt-3 flex items-center gap-2 text-sm text-[var(--text-2)]
            bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-2.5">
          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {job.inspecting_by_name} is inspecting {job.job_number} · {services(job)}
          </span>
        </div>
      ))}
    </div>
  )
}