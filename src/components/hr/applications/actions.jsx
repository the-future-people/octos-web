// The one action each lane asks for. Every action calls onDone(message) when it
// lands; the parent refreshes, and the applicant moves on to their next lane.

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  screenApplication, inviteToInterview, scoreInterview, decideApplication, recordAcceptance,
  cvUrl, onboardingUrl,
} from '../../../api/hr'
import { BTN, INPUT, LABEL, STAGE, Notice, errorText, fmtDate } from './shared'

function useRefresh(id) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['hrApplications'] })
    qc.invalidateQueries({ queryKey: ['hrApplication', id] })
  }
}

const solidBtn = (bg) => ({ className: 'rounded-lg px-4 py-2 text-sm font-semibold text-white whitespace-nowrap disabled:opacity-50', style: { background: bg } })

// ── CV ───────────────────────────────────────────────────────
export function CvPanel({ app, s, tall = 460 }) {
  const isPdf = /\.pdf($|\?)/i.test(app.cv || '')
  if (!app.cv) {
    return <div className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] p-10 text-sm text-[var(--text-3)]">No CV on file</div>
  }
  return (
    <div className="flex flex-col gap-2">
      {isPdf ? (
        <iframe title="CV" src={cvUrl(app.id)} className="w-full rounded-lg border bg-[var(--bg)]" style={{ height: tall, borderColor: s.border }} />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-[var(--bg)] p-10 text-sm text-[var(--text-2)]" style={{ borderColor: s.border }}>
          Word CVs can't show here.
        </div>
      )}
      <div className="flex flex-wrap gap-4 text-sm">
        <a href={cvUrl(app.id)} target="_blank" rel="noreferrer" className="font-semibold underline" style={{ color: STAGE.info.solid }}>
          {isPdf ? 'Open full size' : 'Download CV'}
        </a>
        {app.cover_letter && <a href={app.cover_letter} target="_blank" rel="noreferrer" className="underline" style={{ color: STAGE.info.solid }}>Cover letter</a>}
      </div>
    </div>
  )
}

// ── Reject (any stage before hiring) ─────────────────────────
export function RejectLink({ app, onDone }) {
  const refresh = useRefresh(app.id)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const reject = useMutation({
    mutationFn: () => decideApplication(app.id, { decision: 'REJECT', rejection_reason: reason }),
    onSuccess: () => { refresh(); onDone(`${app.full_name} rejected.`) },
    onError: (err) => setError(errorText(err, "Couldn't reject. Try again.")),
  })
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold underline" style={{ color: '#A32D2D' }}>Reject instead</button>
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-white p-3" style={{ borderColor: '#F09595' }}>
      <label><span className={LABEL}>Reason (kept on record, optional)</span>
        <textarea className={INPUT + ' min-h-[52px]'} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex gap-2">
        <button type="button" className={BTN} onClick={() => setOpen(false)}>Back</button>
        <button type="button" disabled={reject.isPending} onClick={() => reject.mutate()} {...solidBtn('#A32D2D')}>
          {reject.isPending ? 'Rejecting…' : 'Confirm rejection'}
        </button>
      </div>
    </div>
  )
}

// ── Scoring ──────────────────────────────────────────────────
function scoreColour(n) {
  if (n <= 2) return { bg: '#E24B4A', fg: '#fff' }
  if (n === 3) return { bg: '#EF9F27', fg: '#412402' }
  return { bg: '#639922', fg: '#fff' }
}

export function ScoreCard({ app, stage, s, onDone, onSkip }) {
  const refresh = useRefresh(app.id)
  const questions = (app.questions || []).slice(0, 5)
  const [scores, setScores] = useState({})
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const total = Object.values(scores).reduce((n, v) => n + v, 0)
  const scored = Object.keys(scores).length

  const save = useMutation({
    mutationFn: (payload) => (stage === 'SCREENING' ? screenApplication : scoreInterview)(app.id, payload).then((r) => r.data),
    onSuccess: (data) => {
      refresh()
      const first = app.full_name.split(' ')[0]
      onDone(data.passed
        ? `${first} passed with ${data.raw_score}/25 and moves to ${stage === 'SCREENING' ? 'To schedule' : 'To decide'}.`
        : `${first} scored ${data.raw_score}/25, below the pass mark.${stage === 'SCREENING' ? ' Reject, or re-score if that was a mistake.' : ''}`)
    },
    onError: (err) => setError(errorText(err, "Couldn't save the scores. Try again.")),
  })

  if (questions.length < 5) {
    return (
      <p className="text-sm" style={{ color: s.text }}>
        Five {stage === 'SCREENING' ? 'screening' : 'interview'} questions aren't set up for this role yet, so it can't be scored.
        Add them first.
      </p>
    )
  }

  const submit = () => {
    if (scored < 5) { setError('Score all five questions.'); return }
    const payload = { stage, general_comment: notes }
    questions.forEach((_, i) => { payload[`q${i + 1}_score`] = scores[i] })
    save.mutate(payload)
  }

  return (
    <div className="flex flex-col gap-3">
      {questions.map((q, i) => (
        <div key={q.id ?? i}>
          <p className="text-[13px] font-semibold" style={{ color: s.text }}>{i + 1}. {q.question_text}</p>
          {q.guidance && <p className="text-[11px] italic" style={{ color: s.soft }}>{q.guidance}</p>}
          <div className="mt-1 flex gap-1 rounded-md bg-white p-0.5">
            {[1, 2, 3, 4, 5].map((n) => {
              const on = scores[i] === n
              const c = scoreColour(n)
              return (
                <button key={n} type="button" onClick={() => { setScores((v) => ({ ...v, [i]: n })); setError('') }}
                        className="flex-1 rounded py-1 text-xs font-bold transition-colors"
                        style={on ? { background: c.bg, color: c.fg } : { color: '#5F5E5A' }}>
                  {n}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <textarea className={INPUT + ' min-h-[52px]'} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="h-1.5 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full transition-all" style={{ width: `${(total / 25) * 100}%`, background: s.solid }} />
      </div>
      <p className="-mt-2 text-xs" style={{ color: s.soft }}>{total} / 25 · {scored} of 5 scored</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex gap-2">
        {onSkip && <button type="button" className={BTN} onClick={onSkip}>Skip for now</button>}
        <button type="button" onClick={submit} disabled={save.isPending} {...solidBtn('#0F6E56')} className={solidBtn('').className + ' flex-1'}>
          {save.isPending ? 'Saving…' : 'Save and next →'}
        </button>
      </div>
    </div>
  )
}

// ── Schedule ─────────────────────────────────────────────────
export function ScheduleInterview({ app, onDone, onSkip }) {
  const refresh = useRefresh(app.id)
  const [when, setWhen] = useState('')
  const [where, setWhere] = useState(app.branch_name || 'Westland Branch')
  const [error, setError] = useState('')
  const invite = useMutation({
    mutationFn: () => inviteToInterview(app.id, { interview_scheduled_at: when, interview_location: where }),
    onSuccess: () => { refresh(); onDone(`Interview booked for ${app.full_name.split(' ')[0]}. Let them know the date and place by ${app.preferred_channel === 'EMAIL' ? 'email' : 'SMS'}.`) },
    onError: (err) => setError(errorText(err, "Couldn't book it. Try again.")),
  })
  return (
    <div className="flex flex-col gap-3">
      <label><span className={LABEL}>Date and time</span>
        <input type="datetime-local" className={INPUT} value={when} onChange={(e) => { setWhen(e.target.value); setError('') }} /></label>
      <label><span className={LABEL}>Where</span>
        <input className={INPUT} value={where} onChange={(e) => setWhere(e.target.value)} /></label>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex gap-2">
        {onSkip && <button type="button" className={BTN} onClick={onSkip}>Skip for now</button>}
        <button type="button" disabled={invite.isPending} onClick={() => (when ? invite.mutate() : setError('Choose the date and time.'))}
                {...solidBtn(STAGE.interview.solid)} className={solidBtn('').className + ' flex-1'}>
          {invite.isPending ? 'Booking…' : 'Book interview and next →'}
        </button>
      </div>
    </div>
  )
}

// ── Decide ───────────────────────────────────────────────────
export function Decide({ app, onDone, onSkip }) {
  const refresh = useRefresh(app.id)
  const [error, setError] = useState('')
  const hire = useMutation({
    mutationFn: () => decideApplication(app.id, { decision: 'HIRE', rejection_reason: '' }),
    onSuccess: () => { refresh(); onDone(`${app.full_name.split(' ')[0]} offered the job. Record their answer when they reply.`) },
    onError: (err) => setError(errorText(err, "Couldn't save that. Try again.")),
  })
  return (
    <div className="flex flex-col gap-3">
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex gap-2">
        {onSkip && <button type="button" className={BTN} onClick={onSkip}>Skip for now</button>}
        <button type="button" disabled={hire.isPending} onClick={() => hire.mutate()}
                {...solidBtn(STAGE.hired.solid)} className={solidBtn('').className + ' flex-1'}>
          {hire.isPending ? 'Saving…' : 'Offer the job →'}
        </button>
      </div>
    </div>
  )
}

// ── Their answer ─────────────────────────────────────────────
export function RecordAnswer({ app, onDone, onSkip }) {
  const refresh = useRefresh(app.id)
  const [error, setError] = useState('')
  const answer = useMutation({
    mutationFn: (accepted) => recordAcceptance(app.id, accepted).then((r) => r.data),
    onSuccess: (data, accepted) => {
      refresh()
      onDone(accepted
        ? `${app.full_name.split(' ')[0]} accepted. Send the onboarding link: ${data.onboarding_token ? onboardingUrl(data.onboarding_token) : 'see their record'}`
        : `${app.full_name.split(' ')[0]} declined. The vacancy is open again.`)
    },
    onError: (err) => setError(errorText(err, "Couldn't record that. Try again.")),
  })
  return (
    <div className="flex flex-col gap-3">
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        {onSkip && <button type="button" className={BTN} onClick={onSkip}>Skip for now</button>}
        <button type="button" className={BTN} disabled={answer.isPending} onClick={() => answer.mutate(false)}>They declined</button>
        <button type="button" disabled={answer.isPending} onClick={() => answer.mutate(true)}
                {...solidBtn(STAGE.hired.solid)} className={solidBtn('').className + ' flex-1'}>
          They accepted →
        </button>
      </div>
    </div>
  )
}

// ── Onboarding link (shown on the record) ────────────────────
export function OnboardingLink({ app }) {
  const [copied, setCopied] = useState(false)
  if (!app.onboarding_token) return null
  const link = onboardingUrl(app.onboarding_token)
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-[var(--text-2)]">Onboarding link · expires {fmtDate(app.onboarding_token_expires_at)}</p>
      <div className="flex gap-2">
        <input readOnly value={link} className={INPUT + ' font-mono text-xs'} onFocus={(e) => e.target.select()} />
        <button type="button" className={BTN + ' shrink-0'}
                onClick={() => navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
