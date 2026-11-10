// src/components/hr/Applications.jsx
// HR's recruitment pipeline: applicants on the left, the selected candidate on
// the right with the action for their stage. Everything up to sending the
// onboarding link lives here; verifying their information (which creates the
// staff account) and the offer letter stay in the classic portal for now.

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getApplications, getApplication, getVacancies,
  screenApplication, inviteToInterview, scoreInterview, decideApplication, recordAcceptance,
  cvUrl, onboardingUrl, CLASSIC_HR_URL,
} from '../../api/hr'

// ── Look ─────────────────────────────────────────────────────

const PANEL = 'bg-[var(--panel)] border border-[var(--border)] rounded-xl'
const BTN = 'rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--panel)] px-3.5 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg)] transition-colors disabled:opacity-50'
const INPUT = 'w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--border-dark)]'
const LABEL = 'block text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-1'

// One colour per pipeline stage, used on chips, stepper, header and action card
const STAGE = {
  received:  { label: 'Received',  solid: '#185FA5', bg: '#E6F1FB', border: '#B5D4F4', text: '#0C447C', soft: '#185FA5' },
  screening: { label: 'Screening', solid: '#BA7517', bg: '#FAEEDA', border: '#FAC775', text: '#633806', soft: '#854F0B' },
  interview: { label: 'Interview', solid: '#534AB7', bg: '#EEEDFE', border: '#CECBF6', text: '#3C3489', soft: '#534AB7' },
  decision:  { label: 'Decision',  solid: '#0F6E56', bg: '#E1F5EE', border: '#9FE1CB', text: '#085041', soft: '#0F6E56' },
  hired:     { label: 'Hired',     solid: '#3B6D11', bg: '#EAF3DE', border: '#C0DD97', text: '#27500A', soft: '#3B6D11' },
  closed:    { label: 'Closed',    solid: '#5F5E5A', bg: '#F1EFE8', border: '#D3D1C7', text: '#444441', soft: '#5F5E5A' },
}
const PIPELINE = ['received', 'screening', 'interview', 'decision', 'hired']

// Backend status → stage
const STATUS_STAGE = {
  RECEIVED: 'received',
  SCREENING: 'screening',
  INTERVIEW_SCHEDULED: 'interview',
  INTERVIEW_DONE: 'decision', FINAL_REVIEW: 'decision', APPOINTED: 'decision',
  AWAITING_ACCEPTANCE: 'hired', ACCEPTED: 'hired', ONBOARDING: 'hired', INFORMATION_SUBMITTED: 'hired',
  INFORMATION_VERIFIED: 'hired', OFFER_ISSUED: 'hired', HIRED: 'hired', ACTIVE: 'hired',
  REJECTED: 'closed', WITHDRAWN: 'closed', DECLINED: 'closed',
}
const stageOf = (status) => STATUS_STAGE[status] || 'received'

const STATUS_TEXT = {
  RECEIVED: 'New application', SCREENING: 'CV screened', INTERVIEW_SCHEDULED: 'Interview scheduled',
  INTERVIEW_DONE: 'Interview scored', FINAL_REVIEW: 'Final review', APPOINTED: 'Appointed',
  AWAITING_ACCEPTANCE: 'Offered, awaiting their answer', ACCEPTED: 'Accepted', ONBOARDING: 'Onboarding form sent',
  INFORMATION_SUBMITTED: 'Onboarding form submitted', INFORMATION_VERIFIED: 'Information verified',
  OFFER_ISSUED: 'Offer letter issued', HIRED: 'Hired', ACTIVE: 'Active employee',
  REJECTED: 'Rejected', WITHDRAWN: 'Withdrawn', DECLINED: 'Declined the offer',
}

// Avatar tints, picked from the name so a person keeps their colour
const AVATAR = [['#E6F1FB', '#185FA5'], ['#FAEEDA', '#854F0B'], ['#FBEAF0', '#993556'], ['#E1F5EE', '#0F6E56'], ['#EEEDFE', '#534AB7'], ['#EAF3DE', '#3B6D11']]
function avatarFor(name = '') {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR[h % AVATAR.length]
}
const initials = (name = '') => name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'

function waited(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000)
  if (days <= 0) return 'today'
  return days === 1 ? '1 day' : `${days} days`
}
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—')

function errorText(err, fallback) {
  const data = err?.response?.data
  if (!data || typeof data === 'string') return fallback
  if (data.detail) return data.detail
  const first = Object.values(data)[0]
  return Array.isArray(first) ? first[0] : String(first || fallback)
}

function Avatar({ name, size = 30 }) {
  const [bg, fg] = avatarFor(name)
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ width: size, height: size, background: bg, color: fg }}>
      {initials(name)}
    </span>
  )
}

function Notice({ tone, children }) {
  const t = tone === 'error'
    ? { bg: 'var(--red-bg, #fddde0)', fg: 'var(--red-text, #cc1a2e)', bd: 'var(--red-border, #f5a0aa)' }
    : { bg: '#EAF3DE', fg: '#27500A', bd: '#C0DD97' }
  return <p className="rounded-lg px-3 py-2 text-sm" style={{ background: t.bg, color: t.fg, border: `1px solid ${t.bd}` }}>{children}</p>
}

// ── List ─────────────────────────────────────────────────────

function ApplicantRow({ a, selected, onSelect }) {
  const s = STAGE[stageOf(a.status)]
  const recommended = a.track === 'RECOMMENDATION'
  return (
    <button onClick={onSelect}
            className="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg)]"
            style={selected ? { background: s.bg, borderColor: s.solid, borderWidth: 1.5 } : { borderColor: 'var(--border)' }}>
      <Avatar name={a.full_name} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-bold" style={{ color: selected ? s.text : 'var(--text)' }}>
            {a.full_name}{a.is_priority && <span className="ml-1" style={{ color: '#BA7517' }}>★</span>}
          </span>
          <span className="shrink-0 text-[11px] text-[var(--text-3)]">{waited(a.created_at)}</span>
        </span>
        <span className="block truncate text-xs text-[var(--text-2)]">
          {a.vacancy_title || 'General application'}{a.branch_name ? ` · ${a.branch_name.replace(/ Branch$/, '')}` : ''}
        </span>
        <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={recommended ? { background: '#FAEEDA', color: '#854F0B' } : { background: '#E6F1FB', color: '#185FA5' }}>
          {recommended ? 'Recommended' : a.track === 'APPOINTMENT' ? 'Appointed' : 'Website'}
        </span>
      </span>
    </button>
  )
}

// ── Scoring (screening and interview) ────────────────────────

function scoreColour(n) {
  if (n <= 2) return { bg: '#E24B4A', fg: '#fff' }
  if (n === 3) return { bg: '#EF9F27', fg: '#412402' }
  return { bg: '#639922', fg: '#fff' }
}

function ScoreCard({ app, stage, s, onDone }) {
  const qc = useQueryClient()
  const questions = (app.questions || []).slice(0, 5)
  const [scores, setScores] = useState({})
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const total = Object.values(scores).reduce((n, v) => n + v, 0)
  const scored = Object.keys(scores).length

  const save = useMutation({
    mutationFn: (payload) => (stage === 'SCREENING' ? screenApplication : scoreInterview)(app.id, payload).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['hrApplications'] })
      qc.invalidateQueries({ queryKey: ['hrApplication', app.id] })
      onDone(data.passed
        ? `Passed: ${data.raw_score}/25.${stage === 'SCREENING' ? ' Schedule the interview next.' : ' Ready for your decision.'}`
        : `Did not pass: ${data.raw_score}/25.`)
    },
    onError: (err) => setError(errorText(err, "Couldn't save the scores. Try again.")),
  })

  if (questions.length < 5) {
    return (
      <p className="text-sm" style={{ color: s.text }}>
        Five {stage === 'SCREENING' ? 'screening' : 'interview'} questions aren't set up for this role yet, so it can't be scored here.
        Add them, then come back.
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
            {[1, 2, 3, 4, 5].map(n => {
              const on = scores[i] === n
              const c = scoreColour(n)
              return (
                <button key={n} type="button" onClick={() => { setScores(v => ({ ...v, [i]: n })); setError('') }}
                        className="flex-1 rounded py-1 text-xs font-bold transition-colors"
                        style={on ? { background: c.bg, color: c.fg } : { color: '#5F5E5A' }}>
                  {n}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <textarea className={INPUT + ' min-h-[56px]'} placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
      <div>
        <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full transition-all" style={{ width: `${(total / 25) * 100}%`, background: s.solid }} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs" style={{ color: s.soft }}>{total} / 25 · {scored} of 5 scored</span>
          <button type="button" onClick={submit} disabled={save.isPending}
                  className="shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#0F6E56' }}>
            {save.isPending ? 'Saving…' : 'Save scores'}
          </button>
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  )
}

// ── Stage actions ────────────────────────────────────────────

function ScheduleInterview({ app, onDone }) {
  const qc = useQueryClient()
  const [when, setWhen] = useState('')
  const [where, setWhere] = useState(app.branch_name || '')
  const [error, setError] = useState('')
  const invite = useMutation({
    mutationFn: () => inviteToInterview(app.id, { interview_scheduled_at: when, interview_location: where }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hrApplications'] })
      qc.invalidateQueries({ queryKey: ['hrApplication', app.id] })
      onDone('Interview scheduled. Let the candidate know the date and place.')
    },
    onError: (err) => setError(errorText(err, "Couldn't schedule it. Try again.")),
  })
  return (
    <div className="flex flex-col gap-3">
      <label><span className={LABEL}>Date and time</span>
        <input type="datetime-local" className={INPUT} value={when} onChange={e => { setWhen(e.target.value); setError('') }} /></label>
      <label><span className={LABEL}>Where</span>
        <input className={INPUT} value={where} onChange={e => setWhere(e.target.value)} placeholder="Westland branch" /></label>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="button" disabled={invite.isPending}
              onClick={() => (when ? invite.mutate() : setError('Choose the date and time.'))}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: STAGE.interview.solid }}>
        {invite.isPending ? 'Scheduling…' : 'Schedule interview'}
      </button>
    </div>
  )
}

function Decide({ app, onDone }) {
  const qc = useQueryClient()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const decide = useMutation({
    mutationFn: (payload) => decideApplication(app.id, payload),
    onSuccess: (_, payload) => {
      qc.invalidateQueries({ queryKey: ['hrApplications'] })
      qc.invalidateQueries({ queryKey: ['hrApplication', app.id] })
      onDone(payload.decision === 'HIRE' ? 'Marked as hired. Record their answer once they reply.' : 'Rejected.')
    },
    onError: (err) => setError(errorText(err, "Couldn't save the decision. Try again.")),
  })
  return (
    <div className="flex flex-col gap-3">
      {rejecting ? (
        <>
          <label><span className={LABEL}>Reason (kept on record, optional)</span>
            <textarea className={INPUT + ' min-h-[56px]'} value={reason} onChange={e => setReason(e.target.value)} /></label>
          <div className="flex gap-2">
            <button type="button" className={BTN} onClick={() => setRejecting(false)}>Back</button>
            <button type="button" disabled={decide.isPending}
                    onClick={() => decide.mutate({ decision: 'REJECT', rejection_reason: reason })}
                    className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#A32D2D' }}>
              Confirm rejection
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <button type="button" className={BTN} style={{ color: '#A32D2D', borderColor: '#F09595' }} onClick={() => setRejecting(true)}>Reject</button>
          <button type="button" disabled={decide.isPending}
                  onClick={() => decide.mutate({ decision: 'HIRE', rejection_reason: '' })}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: STAGE.hired.solid }}>
            {decide.isPending ? 'Saving…' : 'Hire'}
          </button>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  )
}

function RecordAnswer({ app, onDone }) {
  const qc = useQueryClient()
  const [error, setError] = useState('')
  const answer = useMutation({
    mutationFn: (accepted) => recordAcceptance(app.id, accepted).then(r => r.data),
    onSuccess: (data, accepted) => {
      qc.invalidateQueries({ queryKey: ['hrApplications'] })
      qc.invalidateQueries({ queryKey: ['hrApplication', app.id] })
      onDone(accepted ? 'Accepted. Send them the onboarding link below.' : 'Recorded that they declined. The vacancy is open again.')
    },
    onError: (err) => setError(errorText(err, "Couldn't record that. Try again.")),
  })
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" style={{ color: STAGE.hired.text }}>Record their answer once they reply.</p>
      <div className="flex gap-2">
        <button type="button" className={BTN} disabled={answer.isPending} onClick={() => answer.mutate(false)}>They declined</button>
        <button type="button" disabled={answer.isPending} onClick={() => answer.mutate(true)}
                className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: STAGE.hired.solid }}>
          They accepted
        </button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  )
}

function OnboardingLink({ app }) {
  const [copied, setCopied] = useState(false)
  if (!app.onboarding_token) return <p className="text-sm">No onboarding link was generated. Open the classic portal to resend it.</p>
  const link = onboardingUrl(app.onboarding_token)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm" style={{ color: STAGE.hired.text }}>
        Send this link by {app.preferred_channel === 'EMAIL' ? 'email' : 'SMS'}. It expires {fmtDate(app.onboarding_token_expires_at)}.
      </p>
      <div className="flex gap-2">
        <input readOnly value={link} className={INPUT + ' font-mono text-xs'} onFocus={e => e.target.select()} />
        <button type="button" className={BTN + ' shrink-0'}
                onClick={() => navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function StageAction({ app, onDone }) {
  const st = app.status
  const screening = (app.stage_scores || []).find(x => x.stage === 'SCREENING')
  const interview = (app.stage_scores || []).find(x => x.stage === 'INTERVIEW')
  const stageKey = stageOf(st)
  const s = STAGE[stageKey]

  let title = STATUS_TEXT[st] || st
  let body = null

  if (st === 'RECEIVED' || (st === 'SCREENING' && !screening?.passed)) {
    title = 'CV screening'
    body = (
      <>
        {screening && <p className="mb-2 text-sm" style={{ color: s.text }}>Scored {screening.raw_score}/25, below the pass mark. Re-score, or reject later.</p>}
        <ScoreCard app={app} stage="SCREENING" s={STAGE.screening} onDone={onDone} />
      </>
    )
    return <ActionCard s={STAGE.screening} title={title}>{body}</ActionCard>
  }
  if (st === 'SCREENING') {
    return (
      <ActionCard s={STAGE.interview} title="Schedule the interview">
        <p className="mb-3 text-sm" style={{ color: STAGE.interview.text }}>Passed screening with {screening.raw_score}/25.</p>
        <ScheduleInterview app={app} onDone={onDone} />
      </ActionCard>
    )
  }
  if (st === 'INTERVIEW_SCHEDULED') {
    return (
      <ActionCard s={STAGE.interview} title="Interview scoring">
        <p className="mb-3 text-sm" style={{ color: STAGE.interview.text }}>
          {interview?.interview_scheduled_at ? `Scheduled ${fmtDateTime(interview.interview_scheduled_at)}` : 'Scheduled'}
          {interview?.interview_location ? ` · ${interview.interview_location}` : ''}. Score their answers, not the CV.
        </p>
        <ScoreCard app={app} stage="INTERVIEW" s={STAGE.interview} onDone={onDone} />
      </ActionCard>
    )
  }
  if (['INTERVIEW_DONE', 'FINAL_REVIEW', 'APPOINTED'].includes(st)) {
    return (
      <ActionCard s={STAGE.decision} title="Your decision">
        <p className="mb-3 text-sm" style={{ color: STAGE.decision.text }}>
          {screening ? `Screening ${screening.raw_score}/25` : 'No screening score'} · {interview ? `Interview ${interview.raw_score}/25` : 'No interview score'}
        </p>
        <Decide app={app} onDone={onDone} />
      </ActionCard>
    )
  }
  if (st === 'AWAITING_ACCEPTANCE') {
    return <ActionCard s={STAGE.hired} title="Waiting for their answer"><RecordAnswer app={app} onDone={onDone} /></ActionCard>
  }
  if (st === 'ONBOARDING') {
    return <ActionCard s={STAGE.hired} title="Onboarding form"><OnboardingLink app={app} /></ActionCard>
  }
  if (['INFORMATION_SUBMITTED', 'INFORMATION_VERIFIED', 'OFFER_ISSUED'].includes(st)) {
    return (
      <ActionCard s={STAGE.hired} title={STATUS_TEXT[st]}>
        <p className="mb-3 text-sm" style={{ color: STAGE.hired.text }}>
          Verifying their information (which creates their staff account) and the offer letter are still in the classic portal.
        </p>
        <a href={CLASSIC_HR_URL} target="_blank" rel="noreferrer"
           className="inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: STAGE.hired.solid }}>
          Continue in classic portal
        </a>
      </ActionCard>
    )
  }
  if (st === 'REJECTED') {
    return (
      <ActionCard s={STAGE.closed} title="Rejected">
        <p className="text-sm" style={{ color: STAGE.closed.text }}>{app.rejection_reason || 'No reason recorded.'}</p>
      </ActionCard>
    )
  }
  return <ActionCard s={s} title={title}><p className="text-sm" style={{ color: s.text }}>Nothing to do at this stage.</p></ActionCard>
}

function ActionCard({ s, title, children }) {
  return (
    <div className="rounded-xl p-4" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
      <p className="mb-3 text-sm font-bold" style={{ color: s.text }}>{title}</p>
      {children}
    </div>
  )
}

// ── Candidate ────────────────────────────────────────────────

function Stepper({ status }) {
  const current = stageOf(status)
  const idx = PIPELINE.indexOf(current)
  const closed = current === 'closed'
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      {PIPELINE.map((k, i) => {
        const s = STAGE[k]
        const done = !closed && i < idx
        const on = !closed && i === idx
        return (
          <span key={k} className="contents">
            {i > 0 && <span className="h-0.5 flex-1 rounded-full" style={{ background: done || on ? s.solid : 'var(--border)' }} />}
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: done || on ? s.solid : s.border, boxShadow: on ? `0 0 0 3px ${s.border}` : 'none' }} />
              <span className="hidden sm:inline" style={{ color: on ? s.solid : 'var(--text-3)', fontWeight: on ? 700 : 400 }}>{s.label}</span>
            </span>
          </span>
        )
      })}
    </div>
  )
}

function Candidate({ id }) {
  const [flash, setFlash] = useState('')
  const q = useQuery({
    queryKey: ['hrApplication', id],
    queryFn: () => getApplication(id).then(r => r.data),
  })

  if (q.isLoading) return <div className={PANEL + ' p-10 text-center text-sm text-[var(--text-3)]'}>Loading candidate…</div>
  if (q.error) return <div className={PANEL + ' p-10 text-center text-sm'}>{errorText(q.error, "Couldn't load this candidate.")}</div>

  const a = q.data
  const s = STAGE[stageOf(a.status)]
  const isPdf = /\.pdf($|\?)/i.test(a.cv || '')

  return (
    <div className={PANEL + ' overflow-hidden'}>
      <div className="flex items-center gap-3 px-5 py-4" style={{ background: s.bg }}>
        <Avatar name={a.full_name} size={42} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold" style={{ color: s.text }}>
            {a.full_name}{a.is_priority && <span style={{ color: '#BA7517' }}> ★</span>}
          </p>
          <p className="truncate text-xs" style={{ color: s.soft }}>
            {a.vacancy_title || 'General application'}{a.branch_name ? ` · ${a.branch_name}` : ''} · applied {fmtDate(a.created_at)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold" style={{ color: s.solid }}>{STATUS_TEXT[a.status] || a.status}</span>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <Stepper status={a.status} />

        <div className="grid gap-2 rounded-lg bg-[var(--bg)] px-3 py-2.5 sm:grid-cols-3">
          <div><p className="text-[11px] text-[var(--text-3)]">Phone</p><a href={`tel:${a.phone}`} className="text-sm text-[var(--text)]">{a.phone || '—'}</a></div>
          <div className="min-w-0"><p className="text-[11px] text-[var(--text-3)]">Email</p><a href={`mailto:${a.email}`} className="block truncate text-sm text-[var(--text)]">{a.email || '—'}</a></div>
          <div><p className="text-[11px] text-[var(--text-3)]">Contact by</p><p className="text-sm text-[var(--text)]">{a.preferred_channel === 'EMAIL' ? 'Email' : a.preferred_channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'}</p></div>
        </div>

        {a.recommendation_note && (
          <p className="rounded-lg px-3 py-2 text-sm" style={{ background: '#FAEEDA', color: '#633806' }}>
            <span className="font-bold">Recommended:</span> {a.recommendation_note}
          </p>
        )}

        {flash && <Notice>{flash}</Notice>}

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className={LABEL}>CV</p>
            {!a.cv && <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-3)]">No CV on file</div>}
            {a.cv && isPdf && (
              <iframe title="Candidate CV" src={cvUrl(a.id)} className="h-[420px] w-full rounded-lg border" style={{ borderColor: STAGE.received.border, background: STAGE.received.bg }} />
            )}
            {a.cv && (
              <a href={cvUrl(a.id)} target="_blank" rel="noreferrer" className="text-sm font-semibold underline" style={{ color: STAGE.received.solid }}>
                {isPdf ? 'Open full size' : 'Download CV (Word)'}
              </a>
            )}
            {a.cover_letter && (
              <a href={a.cover_letter} target="_blank" rel="noreferrer" className="text-sm underline" style={{ color: STAGE.received.solid }}>Cover letter</a>
            )}
          </div>
          <StageAction app={a} onDone={(msg) => setFlash(msg)} />
        </div>
      </div>
    </div>
  )
}

// ── The pane ─────────────────────────────────────────────────

const TABS = ['received', 'screening', 'interview', 'decision', 'hired', 'closed']

export default function Applications() {
  const [tab, setTab] = useState('received')
  const [vacancy, setVacancy] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const appsQ = useQuery({ queryKey: ['hrApplications'], queryFn: () => getApplications().then(r => r.data), refetchInterval: 60_000 })
  const vacsQ = useQuery({ queryKey: ['hrVacancies'], queryFn: () => getVacancies().then(r => r.data) })

  const all = appsQ.data || []
  const filtered = vacancy ? all.filter(a => String(a.vacancy) === vacancy) : all
  const counts = useMemo(() => {
    const c = {}
    filtered.forEach(a => { const k = stageOf(a.status); c[k] = (c[k] || 0) + 1 })
    return c
  }, [filtered])
  // Oldest first: whoever has waited longest is seen first. Priority (recommended) on top.
  const shown = filtered
    .filter(a => stageOf(a.status) === tab)
    .sort((x, y) => (y.is_priority - x.is_priority) || (new Date(x.created_at) - new Date(y.created_at)))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-xl font-bold text-[var(--text)]">Applications</h1>
        <p className="text-sm text-[var(--text-3)]">Everyone who applied, stage by stage. Whoever has waited longest is first.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
        <div className={PANEL + ' flex flex-col gap-3 self-start p-4'}>
          <div className="flex flex-wrap gap-1.5">
            {TABS.map(k => {
              const s = STAGE[k]
              const on = tab === k
              return (
                <button key={k} onClick={() => setTab(k)}
                        className="rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
                        style={on ? { background: s.solid, color: '#fff', borderColor: s.solid } : { background: s.bg, color: s.soft, borderColor: s.border }}>
                  {s.label}{counts[k] ? ` ${counts[k]}` : ''}
                </button>
              )
            })}
          </div>
          <select className={INPUT + ' text-xs'} value={vacancy} onChange={e => setVacancy(e.target.value)}>
            <option value="">All vacancies</option>
            {(vacsQ.data || []).map(v => <option key={v.id} value={v.id}>{v.title}{v.branch_name ? ` · ${v.branch_name}` : ''}</option>)}
          </select>

          {appsQ.isLoading && <p className="py-6 text-center text-sm text-[var(--text-3)]">Loading applications…</p>}
          {appsQ.error && <p className="py-6 text-center text-sm">{errorText(appsQ.error, "Couldn't load applications.")}</p>}
          {appsQ.data && shown.length === 0 && <p className="py-6 text-center text-sm text-[var(--text-3)]">No one at this stage.</p>}
          <div className="flex flex-col gap-2">
            {shown.map(a => <ApplicantRow key={a.id} a={a} selected={a.id === selectedId} onSelect={() => setSelectedId(a.id)} />)}
          </div>
        </div>

        {selectedId ? <Candidate key={selectedId} id={selectedId} /> : (
          <div className={PANEL + ' flex items-center justify-center self-start p-10 text-center text-sm text-[var(--text-3)]'}>
            Pick an applicant to see their CV and move them along.
          </div>
        )}
      </div>
    </div>
  )
}
