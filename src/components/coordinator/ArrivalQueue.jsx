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
// Movement: when a job is cleared the board marks it leaving, it slides
// out toward In press, and the queue is then refreshed. Every row that
// moved glides from where it was to where it now is, measured before and
// after, so the same glide covers another coordinator taking a job too.

import { useLayoutEffect, useRef } from 'react'
import {
  TONE_TEXT, channelLabel, dueLine, services, waited,
} from './shared'

const FADE = [
  { opacity: 1,    filter: 'none' },
  { opacity: 0.62, filter: 'blur(0.6px)' },
  { opacity: 0.42, filter: 'blur(1.2px)' },
  { opacity: 0.28, filter: 'blur(1.6px)' },
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
  const due = dueLine(job)
  const mine = job.inspecting_is_me

  return (
    <div className="bg-[var(--panel)] border-2 border-[var(--border-dark)] rounded-2xl
      px-5 py-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-[var(--text-3)]">
          {mine ? 'You are inspecting' : 'Next'}
        </div>
        <div className="font-mono text-xs text-[var(--text-3)] mt-0.5">{job.job_number}</div>
        <div className="text-base font-semibold text-[var(--text)] leading-snug mt-0.5">
          {services(job)}
        </div>
        <div className="text-xs text-[var(--text-2)] mt-0.5">
          {job.customer_name || 'Walk-in'}
          {job.intake_channel ? ` · ${channelLabel(job.intake_channel)}` : ''}
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className={`text-xs ${TONE_TEXT[due.tone]}`}>{due.text}</div>
        <div className="text-[11px] text-[var(--text-3)] mt-0.5">
          Waiting {waited(job.created_at)}
        </div>
        <button
          onClick={() => onInspect(job.id)}
          disabled={!!claiming || blocked}
          className="mt-2.5 min-h-[44px] px-5 text-sm font-bold bg-[var(--text)]
            text-white rounded-xl hover:opacity-90 disabled:opacity-40
            transition-opacity">
          {claiming === job.id ? 'Opening…' : mine ? 'Continue' : 'Inspect'}
        </button>
      </div>
    </div>
  )
}

function Waiting({ job, position }) {
  const due = dueLine(job)
  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl
      px-4 py-3 flex items-center gap-3">
      <span className="w-5 text-center text-xs font-semibold text-[var(--text-3)] shrink-0">
        {position}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--text)] truncate">
          {services(job)}
        </div>
        <div className="text-[11px] text-[var(--text-3)] truncate">
          {job.customer_name || 'Walk-in'}
          {job.intake_channel ? ` · ${channelLabel(job.intake_channel)}` : ''}
        </div>
      </div>
      <span className={`text-[11px] shrink-0 ${TONE_TEXT[due.tone]}`}>{due.text}</span>
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
    <div className="max-w-2xl mx-auto">
      {elsewhere.map(job => (
        <div key={job.id}
          className="flex items-center gap-2 text-xs text-[var(--text-2)] mb-2 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {job.inspecting_by_name} is inspecting {job.job_number} · {services(job)}
          </span>
        </div>
      ))}

      {line.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          px-6 py-14 text-center">
          <p className="text-sm font-semibold text-[var(--text-2)]">Nothing waiting</p>
          <p className="text-xs text-[var(--text-3)] mt-1">
            Everything that arrived has been looked at
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
                    className="text-center text-sm leading-none text-[var(--text-3)] py-1.5">
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
    </div>
  )
}