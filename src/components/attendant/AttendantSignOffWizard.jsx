// src/components/attendant/AttendantSignOffWizard.jsx
//
// The attendant's end-of-day sign-off (13 Nov 2026). Four steps:
//
//   1. Unpaid jobs   each unpaid instant job she recorded today: coming back,
//                    left without paying, or never printed. The only gate,
//                    since instant work is printed before the customer pays.
//   2. Shelf check   every ready job awaiting collection: on the shelf or not.
//   3. Handover      an optional note, beside what is in production and
//                    waiting on deposits (read-only: those aren't hers tonight).
//   4. Confirm       the day in buckets, then sign off.
//
// The server works the lists out again on submit, so what she answered is
// always checked against the facts as they are at that moment.

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSignOffPreview, submitSignOff } from '../../api/attendant'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function fmtWhen(iso) {
  if (!iso) return 'no time set'
  return new Date(iso).toLocaleString('en-GH', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

const UNPAID_CHOICES = [
  { value: 'COMING_BACK',  label: 'Coming back' },
  { value: 'LEFT_UNPAID',  label: 'Left without paying' },
  { value: 'NOT_PRODUCED', label: 'Not printed' },
]

const SHELF_CHOICES = [
  { value: 'ON_SHELF', label: 'On shelf' },
  { value: 'MISSING',  label: "Can't find it" },
]

const STEP_LABELS = ['Unpaid jobs', 'Shelf check', 'Handover', 'Confirm']

function ProgressBar({ step, total }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`flex-1 h-1 rounded-full transition-colors
          ${i < step ? 'bg-[var(--text)]' : 'bg-[var(--border)]'}`} />
      ))}
    </div>
  )
}

function Choice({ choices, value, onChange, name }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={name}>
      {choices.map(c => (
        <button key={c.value} type="button" role="radio" aria-checked={value === c.value}
          onClick={() => onChange(c.value)}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors
            ${value === c.value
              ? 'bg-[var(--text)] text-white border-[var(--text)]'
              : 'bg-[var(--panel)] text-[var(--text-2)] border-[var(--border)] hover:border-[var(--border-dark)]'}`}>
          {c.label}
        </button>
      ))}
    </div>
  )
}

function JobLine({ job, extra, children }) {
  return (
    <div className="px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-[var(--text)] truncate">{job.title}</div>
          <div className="text-[11px] text-[var(--text-3)]">
            {job.job_number}{job.customer ? ` · ${job.customer}` : ''}{extra ? ` · ${extra}` : ''}
          </div>
        </div>
        <div className="font-mono text-xs font-bold text-[var(--text)] shrink-0">{fmt(job.amount)}</div>
      </div>
      {children}
    </div>
  )
}

function Footer({ onBack, onNext, nextLabel = 'Continue', disabled, error }) {
  return (
    <div className="mt-6">
      {error && <p className="mb-3 text-xs font-semibold text-red-600" role="alert">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        {onBack ? (
          <button onClick={onBack}
            className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
            Back
          </button>
        ) : <span />}
        <button onClick={onNext} disabled={disabled}
          className="px-5 py-2.5 bg-[var(--text)] text-white text-sm font-bold rounded-xl
            disabled:opacity-40 hover:opacity-90 transition-opacity">
          {nextLabel}
        </button>
      </div>
    </div>
  )
}

export default function AttendantSignOffWizard({ firstName, onClose, onLogout }) {
  const queryClient = useQueryClient()
  const [step, setStep]       = useState(1)
  const [unpaid, setUnpaid]   = useState({})
  const [shelf, setShelf]     = useState({})
  const [note, setNote]       = useState('')
  const [stepError, setStepError] = useState('')
  const [done, setDone]       = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(10)

  const { data: preview, isLoading, isError, refetch } = useQuery({
    queryKey: ['attendantSignoffPreview'],
    queryFn: () => getSignOffPreview().then(r => r.data),
    staleTime: 0,
  })

  const unpaidJobs = preview?.unpaid_instant || []
  const shelfJobs  = preview?.shelf || []

  const { mutate, isPending, error: submitError } = useMutation({
    mutationFn: () => submitSignOff({ unpaid, shelf, handover_note: note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendantSignoff'] })
      setDone(true)
    },
    // The day moved under her (a job paid, a new one ready): show the fresh lists.
    onError: () => refetch(),
  })

  // After signing off: a moment to read it, then she is logged out.
  useEffect(() => {
    if (!done) return
    if (secondsLeft <= 0) { onLogout?.(); return }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [done, secondsLeft, onLogout])

  const go = (next, check) => {
    const problem = check?.()
    if (problem) { setStepError(problem); return }
    setStepError('')
    setStep(next)
  }

  const unansweredUnpaid = () =>
    unpaidJobs.some(j => !unpaid[j.id]) ? 'Choose what happened to every job.' : ''
  const unansweredShelf = () =>
    shelfJobs.some(j => !shelf[j.id]) ? 'Check every job against the shelf.' : ''

  const allOnShelf = () => {
    setShelf(Object.fromEntries(shelfJobs.map(j => [j.id, 'ON_SHELF'])))
    setStepError('')
  }

  if (done) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
        <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-sm p-10 text-center animate-slideUp">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="text-xl font-black text-[var(--text)] mb-2">
            Signed off{firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="text-sm text-[var(--text-3)]">Thank you for today.</p>
          <p className="text-xs text-[var(--text-3)] mt-3">
            Logging out in <span className="font-bold text-[var(--text-2)]">{secondsLeft}</span>
          </p>
        </div>
      </div>,
      document.body,
    )
  }

  const b = preview?.buckets || {}
  const summary = [
    { label: 'Recorded today',        value: b.recorded_total },
    { label: 'Paid',                  value: b.paid },
    { label: 'Handed to production',  value: b.handed_to_production },
    { label: 'Awaiting deposit',      value: b.awaiting_deposit },
    { label: 'Unpaid, carried',       value: unpaidJobs.filter(j => unpaid[j.id] === 'COMING_BACK').length },
    { label: 'Left without paying',   value: unpaidJobs.filter(j => unpaid[j.id] === 'LEFT_UNPAID').length,
      warn: true },
    { label: 'Not printed, cancelled', value: unpaidJobs.filter(j => unpaid[j.id] === 'NOT_PRODUCED').length },
    { label: 'Drafts',                value: b.draft },
    { label: 'Missing from shelf',    value: shelfJobs.filter(j => shelf[j.id] === 'MISSING').length, warn: true },
  ]

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-slideUp"
        role="dialog" aria-modal="true" aria-labelledby="att-signoff-title">

        <div className="px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div id="att-signoff-title" className="font-black text-lg text-[var(--text)]">End of day sign-off</div>
            <button onClick={onClose} aria-label="Close"
              className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors">✕</button>
          </div>
          <p className="text-xs text-[var(--text-3)] mb-3">Step {step} of 4 · {STEP_LABELS[step - 1]}</p>
          <ProgressBar step={step} total={4} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading && <p className="text-sm text-[var(--text-3)]">Loading your day…</p>}
          {isError && (
            <p className="text-sm text-red-600">
              Your day couldn't be loaded. <button className="underline" onClick={() => refetch()}>Try again</button>
            </p>
          )}

          {preview && step === 1 && (
            <div>
              <p className="text-xs text-[var(--text-3)] mb-4">
                Instant jobs you recorded today that haven't been paid. Say what happened to each one.
              </p>
              {unpaidJobs.length === 0 ? (
                <p className="px-4 py-4 rounded-xl border bg-emerald-50 border-emerald-200 text-sm font-semibold text-emerald-700">
                  Every instant job you recorded today has been paid.
                </p>
              ) : (
                <div className="space-y-2">
                  {unpaidJobs.map(j => (
                    <JobLine key={j.id} job={j}>
                      <Choice name={j.job_number} choices={UNPAID_CHOICES} value={unpaid[j.id]}
                        onChange={v => { setUnpaid(a => ({ ...a, [j.id]: v })); setStepError('') }} />
                    </JobLine>
                  ))}
                </div>
              )}
              <Footer onNext={() => go(2, unansweredUnpaid)} error={stepError} />
            </div>
          )}

          {preview && step === 2 && (
            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <p className="text-xs text-[var(--text-3)]">
                  Ready jobs waiting to be collected. Look at the shelf and check each one.
                </p>
                {shelfJobs.length > 1 && (
                  <button onClick={allOnShelf}
                    className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg border border-[var(--border)]
                      text-[var(--text-2)] hover:border-[var(--border-dark)] transition-colors">
                    All on shelf
                  </button>
                )}
              </div>
              {shelfJobs.length === 0 ? (
                <p className="px-4 py-4 rounded-xl border bg-[var(--bg)] border-[var(--border)] text-sm text-[var(--text-2)]">
                  Nothing is waiting to be collected.
                </p>
              ) : (
                <div className="space-y-2">
                  {shelfJobs.map(j => (
                    <JobLine key={j.id} job={j}>
                      <Choice name={j.job_number} choices={SHELF_CHOICES} value={shelf[j.id]}
                        onChange={v => { setShelf(a => ({ ...a, [j.id]: v })); setStepError('') }} />
                    </JobLine>
                  ))}
                </div>
              )}
              <Footer onBack={() => go(1)} onNext={() => go(3, unansweredShelf)} error={stepError} />
            </div>
          )}

          {preview && step === 3 && (
            <div>
              <label htmlFor="att-handover" className="block text-xs text-[var(--text-3)] mb-2">
                Anything tomorrow's attendant should know (optional).
              </label>
              <textarea id="att-handover" rows={3} value={note} onChange={e => setNote(e.target.value)}
                maxLength={2000}
                placeholder="Mr Mensah is coming at 9am for the roll-up banner, he has paid in full"
                className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl
                  outline-none focus:border-[var(--border-dark)] text-[var(--text)]" />

              {(preview.handed_to_production || []).length > 0 && (
                <div className="mt-5">
                  <div className="text-xs font-bold text-[var(--text-2)] mb-2">Handed to production</div>
                  <div className="space-y-1.5">
                    {preview.handed_to_production.map(j => (
                      <div key={j.id} className="flex justify-between gap-3 text-xs text-[var(--text-2)]">
                        <span className="truncate">{j.job_number} · {j.title}</span>
                        <span className="shrink-0 text-[var(--text-3)]">ready {fmtWhen(j.ready_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(preview.awaiting_deposit || []).length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-bold text-[var(--text-2)] mb-2">Waiting on a deposit</div>
                  <div className="space-y-1.5">
                    {preview.awaiting_deposit.map(j => (
                      <div key={j.id} className="flex justify-between gap-3 text-xs text-[var(--text-2)]">
                        <span className="truncate">{j.job_number} · {j.title}</span>
                        <span className="shrink-0 font-mono">{fmt(j.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(preview.drafts || []).length > 0 && (
                <p className="mt-4 text-xs text-[var(--text-3)]">
                  {preview.drafts.length} draft{preview.drafts.length !== 1 ? 's' : ''} will expire on their own.
                </p>
              )}

              <Footer onBack={() => go(2)} onNext={() => go(4)} />
            </div>
          )}

          {preview && step === 4 && (
            <div>
              <p className="text-xs text-[var(--text-3)] mb-4">
                Your day, as you'll sign it. Items marked in red go to the branch manager.
              </p>
              <dl className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl">
                {summary.map(r => (
                  <div key={r.label} className="flex justify-between px-4 py-2 text-sm">
                    <dt className="text-[var(--text-2)]">{r.label}</dt>
                    <dd className={`font-mono font-bold ${r.warn && r.value ? 'text-red-600' : 'text-[var(--text)]'}`}>
                      {r.value ?? 0}
                    </dd>
                  </div>
                ))}
              </dl>
              {note.trim() && (
                <p className="mt-3 text-xs text-[var(--text-2)]">Handover note added.</p>
              )}
              <Footer onBack={() => go(3)} onNext={() => mutate()} nextLabel={isPending ? 'Signing off…' : 'Sign off'}
                disabled={isPending}
                error={submitError ? (submitError.response?.data?.detail || "Sign-off didn't go through. Try again.") : ''} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
