// src/components/coordinator/StageList.jsx
//
// The jobs in one stage, one row each, one action each. Rows are sorted
// by the promise, soonest first, so the job most likely to go late is
// always at the top of whatever stage is open.
//
// A halted job stays in its own stage, marked and with Resume, rather
// than being pulled into a separate list. Where it stopped is part of
// what the coordinator needs to know about it.

import {
  FINDING_LABEL, TONE_TEXT, channelLabel, clockTime, dueLine, services, waited,
} from './shared'

const EMPTY = {
  press:     ['Nothing on the press', 'Cleared jobs land here'],
  finishing: ['Nothing in finishing', 'Printed work lands here for eyelets, lamination and cutting'],
  ready:     ['Nothing waiting for collection', 'Finished jobs wait here until handed over'],
  held:      ['Nothing held', 'Jobs that cannot proceed as sent wait here for an answer'],
}

function byPromise(a, b) {
  if (!a.promise && !b.promise) return 0
  if (!a.promise) return 1
  if (!b.promise) return -1
  return new Date(a.promise) - new Date(b.promise)
}

function Primary({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="min-h-[44px] px-4 text-sm font-bold bg-[var(--text)] text-white
        rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0">
      {children}
    </button>
  )
}

function Quiet({ children, onClick, disabled, tone = 'hover:text-red-600' }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`min-h-[44px] px-3 text-xs font-bold text-[var(--text-3)]
        ${tone} disabled:opacity-40 transition-colors shrink-0`}>
      {children}
    </button>
  )
}

function Chip({ children, tone }) {
  const tones = {
    halted:   'bg-red-100 text-red-700',
    checking: 'bg-amber-100 text-amber-800',
    held:     'bg-amber-100 text-amber-800',
  }
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${tones[tone]}`}>
      {children}
    </span>
  )
}

function Row({ job, stage, busy, blocked, on }) {
  const due = dueLine(job)
  const stuck = job.is_halted
  const floor = clockTime(job.predicted?.ready_at)
  const checking = job.work_state === 'QUALITY_CHECK'

  return (
    <div className={`bg-[var(--panel)] border rounded-xl px-4 py-3
      flex items-center gap-3
      ${stuck ? 'border-red-300' : 'border-[var(--border)]'}`}>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[11px] text-[var(--text-3)]">{job.job_number}</div>
        <div className="text-sm font-semibold text-[var(--text)] leading-snug truncate">
          {services(job)}
        </div>
        <div className="text-[11px] text-[var(--text-3)] truncate">
          {job.customer_name || 'Walk-in'}
          {job.intake_channel ? ` · ${channelLabel(job.intake_channel)}` : ''}
        </div>
      </div>

      <div className="text-right shrink-0 hidden sm:block">
        {stage === 'held' ? (
          <div className="text-xs text-amber-800 font-semibold">
            {FINDING_LABEL[job.finding] || job.finding || 'Held'}
            <span className="font-normal text-[var(--text-3)]">
              {' · '}{waited(job.halt?.halted_at)}
            </span>
          </div>
        ) : stage === 'ready' ? (
          <div className="text-xs text-[var(--text-2)]">Awaiting collection</div>
        ) : (
          <>
            <div className={`text-xs ${TONE_TEXT[due.tone]}`}>{due.text}</div>
            {floor && !stuck && (
              <div className="text-[11px] text-[var(--text-3)] mt-0.5">
                Floor says {job.predicted.is_next_day ? 'tomorrow ' : ''}{floor}
              </div>
            )}
          </>
        )}
      </div>

      {stuck && <Chip tone="halted">Halted</Chip>}
      {!stuck && checking && <Chip tone="checking">Being checked</Chip>}

      {stage === 'press' && (stuck ? (
        <Primary onClick={() => on.resume(job)} disabled={busy}>Resume</Primary>
      ) : (
        <>
          <Primary onClick={() => on.advance(job, 'FINISHING')} disabled={busy}>
            To finishing
          </Primary>
          <Quiet onClick={() => on.halt(job)} disabled={busy}>Halt</Quiet>
        </>
      ))}

      {stage === 'finishing' && (stuck ? (
        <Primary onClick={() => on.resume(job)} disabled={busy}>Resume</Primary>
      ) : (
        <>
          <Primary onClick={() => on.markReady(job)} disabled={busy}>
            {checking ? 'Continue check' : 'Mark ready'}
          </Primary>
          {!checking && (
            <Quiet onClick={() => on.halt(job)} disabled={busy}>Halt</Quiet>
          )}
        </>
      ))}

      {stage === 'held' && (
        <Primary onClick={() => on.bringBack(job)} disabled={busy || blocked}>
          Bring back
        </Primary>
      )}
    </div>
  )
}

/**
 * stage:   'press' | 'finishing' | 'ready' | 'held'
 * jobs:    rows for that stage
 * busyId:  a job with a request in flight, whose buttons wait
 * blocked: true while this coordinator has a job open; Bring back reopens
 *          into the workspace, so it waits too
 * on:      { advance, markReady, resume, halt, bringBack }
 */
export default function StageList({ stage, jobs, busyId, blocked, on }) {
  if (!jobs.length) {
    const [title, hint] = EMPTY[stage]
    return (
      <div className="max-w-3xl mx-auto bg-[var(--panel)] border border-[var(--border)]
        rounded-2xl px-6 py-14 text-center">
        <p className="text-sm font-semibold text-[var(--text-2)]">{title}</p>
        <p className="text-xs text-[var(--text-3)] mt-1">{hint}</p>
      </div>
    )
  }

  const sorted = stage === 'held' ? jobs : [...jobs].sort(byPromise)

  return (
    <div className="max-w-3xl mx-auto space-y-2">
      {sorted.map(job => (
        <Row key={job.id} job={job} stage={stage}
          busy={busyId === job.id} blocked={blocked} on={on} />
      ))}
    </div>
  )
}