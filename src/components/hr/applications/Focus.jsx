// Focus: pick a lane, work through it one applicant at a time, oldest first.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getApplication } from '../../../api/hr'
import {
  LANES, STAGE, PANEL, Avatar, Notice, errorText, waited, fmtDateTime, channel,
} from './shared'
import { CvPanel, ScoreCard, ScheduleInterview, Decide, RecordAnswer, RejectLink } from './actions'

function Lanes({ counts, lane, onPick }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {LANES.map((l) => {
        const s = STAGE[l.stage]
        const n = counts[l.key] || 0
        const on = lane === l.key
        const empty = n === 0
        return (
          <button key={l.key} type="button" onClick={() => onPick(l.key)}
                  className="rounded-xl border px-3 py-2.5 text-left transition-colors"
                  style={on ? { background: s.solid, borderColor: s.solid, color: '#fff' }
                    : empty ? { background: 'var(--panel)', borderColor: 'var(--border)', color: 'var(--text-3)' }
                    : { background: s.bg, borderColor: s.border, color: s.text }}>
            <span className="block font-display text-2xl font-bold leading-none">{n}</span>
            <span className="mt-1 block text-xs font-semibold">{l.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function Work({ lane, app, s, onDone, onSkip }) {
  const screening = (app.stage_scores || []).find((x) => x.stage === 'SCREENING')
  const interview = (app.stage_scores || []).find((x) => x.stage === 'INTERVIEW')

  let title, body
  if (lane === 'screen') {
    if (screening && !screening.passed) {
      title = 'Below the pass mark'
      body = (
        <>
          <p className="mb-3 text-sm" style={{ color: s.text }}>Screened {screening.raw_score}/25. Reject them, or re-score if that was a mistake.</p>
          <ScoreCard app={app} stage="SCREENING" s={s} onDone={onDone} onSkip={onSkip} />
        </>
      )
    } else {
      title = 'Score the CV'
      body = <ScoreCard app={app} stage="SCREENING" s={s} onDone={onDone} onSkip={onSkip} />
    }
  } else if (lane === 'schedule') {
    title = 'Book the interview'
    body = (
      <>
        <p className="mb-3 text-sm" style={{ color: s.text }}>Passed screening with {screening?.raw_score ?? '–'}/25.</p>
        <ScheduleInterview app={app} onDone={onDone} onSkip={onSkip} />
      </>
    )
  } else if (lane === 'score') {
    title = 'Score the interview'
    body = (
      <>
        <p className="mb-3 text-sm" style={{ color: s.text }}>
          {interview?.interview_scheduled_at ? fmtDateTime(interview.interview_scheduled_at) : 'Booked'}
          {interview?.interview_location ? ` · ${interview.interview_location}` : ''}. Score their answers, not the CV.
        </p>
        <ScoreCard app={app} stage="INTERVIEW" s={s} onDone={onDone} onSkip={onSkip} />
      </>
    )
  } else if (lane === 'decide') {
    title = 'Your decision'
    body = (
      <>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {[['Screening', screening], ['Interview', interview]].map(([label, sc]) => (
            <div key={label} className="rounded-lg bg-white px-3 py-2">
              <p className="text-[11px]" style={{ color: s.soft }}>{label}</p>
              <p className="font-display text-xl font-bold" style={{ color: s.text }}>{sc ? `${sc.raw_score}/25` : '–'}</p>
            </div>
          ))}
        </div>
        <Decide app={app} onDone={onDone} onSkip={onSkip} />
      </>
    )
  } else {
    title = 'Did they accept?'
    body = (
      <>
        <p className="mb-3 text-sm" style={{ color: s.text }}>Offered the job. Record their answer when they reply.</p>
        <RecordAnswer app={app} onDone={onDone} onSkip={onSkip} />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl p-4" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
      <p className="text-sm font-bold" style={{ color: s.text }}>{title}</p>
      {body}
      {lane !== 'answer' && <div><RejectLink app={app} onDone={onDone} /></div>}
    </div>
  )
}

export default function Focus({ lane, onPickLane, counts, queue, flash, onDone, onSkip }) {
  const [showQueue, setShowQueue] = useState(false)
  const current = queue[0] || null
  const laneDef = LANES.find((l) => l.key === lane)
  const s = STAGE[laneDef.stage]

  const detail = useQuery({
    queryKey: ['hrApplication', current?.id],
    queryFn: () => getApplication(current.id).then((r) => r.data),
    enabled: !!current,
  })

  return (
    <div className="flex flex-col gap-4">
      <Lanes counts={counts} lane={lane} onPick={(k) => { onPickLane(k); setShowQueue(false) }} />

      {flash && <Notice>{flash}</Notice>}

      {!current && (
        <div className={PANEL + ' p-10 text-center'}>
          <p className="font-display text-lg font-bold text-[var(--text)]">Nobody waiting in {laneDef.label.toLowerCase()}</p>
          <p className="mt-1 text-sm text-[var(--text-3)]">Pick another task above, or take a break.</p>
        </div>
      )}

      {current && (
        <div className={PANEL + ' overflow-hidden'}>
          <div className="flex items-center gap-3 px-5 py-3.5" style={{ background: s.bg }}>
            <Avatar name={current.full_name} size={42} solid={s.solid} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold" style={{ color: s.text }}>
                {current.full_name}{current.is_priority && <span style={{ color: '#BA7517' }}> ★</span>}
              </p>
              <p className="truncate text-xs" style={{ color: s.soft }}>
                {current.vacancy_title || 'General application'}
                {current.branch_name ? ` · ${current.branch_name.replace(/ Branch$/, '')}` : ''}
                {` · waited ${waited(current.created_at)} · ${current.phone || ''} · ${channel(current.preferred_channel)}`}
              </p>
              {current.also_applied?.length > 0 && (
                <p className="mt-1 inline-block rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: '#A32D2D' }}>
                  Also applied for {current.also_applied.join(', ')}
                </p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold" style={{ color: s.solid }}>
              1 of {queue.length}
            </span>
          </div>

          {detail.isLoading && <p className="p-10 text-center text-sm text-[var(--text-3)]">Loading…</p>}
          {detail.error && <p className="p-10 text-center text-sm">{errorText(detail.error, "Couldn't load this applicant.")}</p>}
          {detail.data && (
            <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              {/* CV stays in view while the scores beside it scroll */}
              <div className="xl:sticky xl:top-4 xl:self-start"><CvPanel app={detail.data} s={s} /></div>
              <Work key={`${detail.data.id}-${detail.data.status}`} lane={lane} app={detail.data} s={s} onDone={onDone} onSkip={queue.length > 1 ? onSkip : null} />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-5 py-2.5 text-xs text-[var(--text-2)]">
            <span>
              {queue[1]
                ? <>Up next: <span className="font-semibold text-[var(--text)]">{queue[1].full_name}{queue[1].is_priority ? ' ★' : ''}</span>{queue[2] ? ` · then ${queue[2].full_name}` : ''}</>
                : 'Last one in this task.'}
            </span>
            {queue.length > 1 && (
              <button type="button" className="font-semibold underline" onClick={() => setShowQueue((v) => !v)}>
                {showQueue ? 'Hide queue' : `Show queue (${queue.length})`}
              </button>
            )}
          </div>
          {showQueue && (
            <ol className="border-t border-[var(--border)] px-5 py-2.5 text-sm">
              {queue.map((a, i) => (
                <li key={a.id} className="flex justify-between gap-3 py-1" style={{ fontWeight: i === 0 ? 700 : 400 }}>
                  <span>{i + 1}. {a.full_name}{a.is_priority ? ' ★' : ''} <span className="text-[var(--text-3)]">· {a.vacancy_title || 'General'}</span></span>
                  <span className="text-[var(--text-3)]">{waited(a.created_at)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
