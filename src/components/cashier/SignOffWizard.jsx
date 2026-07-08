// src/components/cashier/SignOffWizard.jsx
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'

const DENOMS = [
  { label: 'GHS 200', value: 200 },
  { label: 'GHS 100', value: 100 },
  { label: 'GHS 50',  value: 50  },
  { label: 'GHS 20',  value: 20  },
  { label: 'GHS 10',  value: 10  },
  { label: 'GHS 5',   value: 5   },
  { label: 'GHS 2',   value: 2   },
  { label: 'GHS 1',   value: 1   },
  { label: '50p',     value: 0.5 },
  { label: '20p',     value: 0.2 },
]

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

// ── Step components ───────────────────────────────────────────────────────────

function Step1QueueStatus({ pendingCount, ackQueue, setAckQueue, onNext }) {
  return (
    <div>
      <h3 className="text-base font-black text-[var(--text)] mb-1">Queue Status</h3>
      <p className="text-xs text-[var(--text-3)] mb-5">
        Confirm the state of the payment queue before signing off.
      </p>

      <div className={`px-4 py-4 rounded-xl border mb-5 ${
        pendingCount === 0
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-amber-50 border-amber-200'
      }`}>
        {pendingCount === 0 ? (
          <p className="text-sm font-semibold text-emerald-700">
            ✓ Queue is clear — no jobs pending payment.
          </p>
        ) : (
          <p className="text-sm font-semibold text-amber-700">
            ⚠ {pendingCount} job{pendingCount !== 1 ? 's' : ''} still pending payment.
            These will carry forward to the next session.
          </p>
        )}
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={ackQueue} onChange={e => setAckQueue(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-zinc-900" />
        <p className="text-xs text-[var(--text-2)] leading-relaxed">
          I acknowledge the current queue state and confirm any pending jobs will carry forward.
        </p>
      </label>

      <div className="mt-6 flex justify-end">
        <button onClick={onNext} disabled={!ackQueue}
          className="px-5 py-2.5 bg-[var(--text)] text-white text-sm font-bold
            rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
          Continue →
        </button>
      </div>
    </div>
  )
}

function Step2CashCount({ expectedCash, openingFloat, counts, setCounts, onNext, onBack }) {
  const setCount = (denom, val) =>
    setCounts(c => ({ ...c, [denom]: Math.max(0, parseInt(val) || 0) }))

  const computedTotal = DENOMS.reduce((s, d) => s + (counts[d.value] || 0) * d.value, 0)
  const variance = computedTotal - parseFloat(expectedCash || 0)
  const hasCount = computedTotal > 0

  return (
    <div>
      <h3 className="text-base font-black text-[var(--text)] mb-1">Cash Count</h3>
      <p className="text-xs text-[var(--text-3)] mb-4">
        Count the cash in your drawer and enter the denominations below.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-0.5">Opening Float</div>
          <div className="font-mono font-bold text-sm text-[var(--text)]">{fmt(openingFloat)}</div>
        </div>
        <div className="px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-0.5">Expected Cash</div>
          <div className="font-mono font-bold text-sm text-blue-700">{fmt(expectedCash)}</div>
        </div>
      </div>

      <div className="space-y-1.5 mb-4 max-h-52 overflow-y-auto pr-1">
        {DENOMS.map(d => {
          const count  = counts[d.value] || 0
          const subtot = count * d.value
          return (
            <div key={d.value} className="flex items-center gap-2.5 px-3 py-2
              bg-[var(--bg)] border border-[var(--border)] rounded-lg">
              <span className="w-12 text-xs font-bold text-[var(--text)]">{d.label}</span>
              <span className="text-[var(--text-3)] text-xs">×</span>
              <input type="number" min="0" value={count || ''}
                onChange={e => setCount(d.value, e.target.value)}
                placeholder="0"
                className="w-14 px-2 py-1 text-xs font-mono text-center bg-white border
                  border-[var(--border)] rounded-lg outline-none focus:border-zinc-400"
              />
              <span className="text-[var(--text-3)] text-xs">=</span>
              <span className={`flex-1 text-right font-mono text-xs font-bold
                ${subtot > 0 ? 'text-[var(--text)]' : 'text-[var(--text-3)]'}`}>
                {subtot > 0 ? fmt(subtot) : '—'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Running total */}
      <div className={`px-4 py-3 rounded-xl border flex items-center justify-between
        ${!hasCount ? 'bg-[var(--bg)] border-[var(--border)]'
          : Math.abs(variance) < 0.01 ? 'bg-emerald-50 border-emerald-200'
          : 'bg-amber-50 border-amber-200'}`}>
        <span className="text-sm font-bold text-[var(--text-2)]">Your count</span>
        <div className="text-right">
          <div className={`font-mono font-black text-lg ${
            !hasCount ? 'text-[var(--text-3)]'
            : Math.abs(variance) < 0.01 ? 'text-emerald-600'
            : 'text-amber-700'}`}>{fmt(computedTotal)}</div>
          {hasCount && (
            <div className={`text-[10px] font-bold ${Math.abs(variance) < 0.01 ? 'text-emerald-600' : 'text-amber-700'}`}>
              {Math.abs(variance) < 0.01 ? '✓ Exact match'
                : variance > 0 ? `+${fmt(variance)} over`
                : `${fmt(Math.abs(variance))} short`}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-between">
        <button onClick={onBack} className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)]
          border border-[var(--border)] rounded-xl hover:border-[var(--border-dark)] transition-colors">
          ← Back
        </button>
        <button onClick={() => onNext(computedTotal, variance)}
          disabled={!hasCount}
          className="px-5 py-2.5 bg-[var(--text)] text-white text-sm font-bold
            rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
          Continue →
        </button>
      </div>
    </div>
  )
}

function Step3Variance({ closingCash, expectedCash, variance, varianceNotes, setVarianceNotes, onNext, onBack }) {
  const hasVariance = Math.abs(variance) >= 0.01
  const canContinue = !hasVariance || varianceNotes.trim().length >= 10

  return (
    <div>
      <h3 className="text-base font-black text-[var(--text)] mb-1">Variance Review</h3>
      <p className="text-xs text-[var(--text-3)] mb-5">
        Review your cash variance before completing sign-off.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: 'Expected', value: fmt(expectedCash), color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Counted',  value: fmt(closingCash),  color: 'text-[var(--text)]', bg: 'bg-[var(--bg)] border-[var(--border)]' },
          { label: 'Variance', value: (variance >= 0 ? '+' : '') + fmt(variance),
            color: Math.abs(variance) < 0.01 ? 'text-emerald-600' : 'text-red-500',
            bg: Math.abs(variance) < 0.01 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200' },
        ].map(c => (
          <div key={c.label} className={`px-3 py-3 rounded-xl border ${c.bg}`}>
            <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">{c.label}</div>
            <div className={`font-mono font-bold text-sm ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {!hasVariance ? (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-5">
          <p className="text-sm font-semibold text-emerald-700">
            ✓ No variance — your cash count matches perfectly.
          </p>
        </div>
      ) : (
        <div className="mb-5">
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl mb-3">
            <p className="text-sm font-semibold text-red-700">
              ⚠ Variance detected — please explain below.
            </p>
          </div>
          <label className="block text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
            Variance Explanation (required, min 10 chars)
          </label>
          <textarea rows={3} value={varianceNotes} onChange={e => setVarianceNotes(e.target.value)}
            placeholder="Explain the reason for the cash variance…"
            className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)]
              rounded-xl outline-none focus:border-[var(--border-dark)] resize-none" />
          <p className="text-[10px] text-[var(--text-3)] mt-1">{varianceNotes.length} / 10 minimum characters</p>
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)]
          border border-[var(--border)] rounded-xl hover:border-[var(--border-dark)] transition-colors">
          ← Back
        </button>
        <button onClick={onNext} disabled={!canContinue}
          className="px-5 py-2.5 bg-[var(--text)] text-white text-sm font-bold
            rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
          Continue →
        </button>
      </div>
    </div>
  )
}

function Step4ShiftNotes({ shiftNotes, setShiftNotes, onNext, onBack }) {
  return (
    <div>
      <h3 className="text-base font-black text-[var(--text)] mb-1">Shift Notes</h3>
      <p className="text-xs text-[var(--text-3)] mb-5">
        Add any notes about today's shift — incidents, observations, handover info.
      </p>

      <textarea rows={5} value={shiftNotes} onChange={e => setShiftNotes(e.target.value)}
        placeholder="Optional — describe anything notable from your shift…"
        className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)]
          rounded-xl outline-none focus:border-[var(--border-dark)] resize-none mb-6" />

      <div className="flex justify-between">
        <button onClick={onBack} className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)]
          border border-[var(--border)] rounded-xl hover:border-[var(--border-dark)] transition-colors">
          ← Back
        </button>
        <button onClick={onNext}
          className="px-5 py-2.5 bg-[var(--text)] text-white text-sm font-bold
            rounded-xl hover:opacity-90 transition-opacity">
          Continue →
        </button>
      </div>
    </div>
  )
}

function Step5Confirm({ closingCash, variance, shiftNotes, varianceNotes, isPending, onSubmit, onBack, error }) {
  const [confirmed, setConfirmed] = useState(false)
  const hasVariance = Math.abs(variance) >= 0.01

  return (
    <div>
      <h3 className="text-base font-black text-[var(--text)] mb-1">Confirm Sign-Off</h3>
      <p className="text-xs text-[var(--text-3)] mb-5">
        Review your sign-off details and confirm to end your shift.
      </p>

      <div className="space-y-2 mb-5">
        {[
          { label: 'Closing Cash',    value: fmt(closingCash) },
          { label: 'Variance',        value: (variance >= 0 ? '+' : '') + fmt(variance),
            color: Math.abs(variance) < 0.01 ? 'text-emerald-600' : 'text-red-500' },
          ...(varianceNotes ? [{ label: 'Variance Notes', value: varianceNotes }] : []),
          ...(shiftNotes ? [{ label: 'Shift Notes', value: shiftNotes }] : []),
        ].map(item => (
          <div key={item.label} className="flex items-start gap-3 px-4 py-3
            bg-[var(--bg)] border border-[var(--border)] rounded-xl">
            <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider shrink-0 mt-0.5 w-24">
              {item.label}
            </span>
            <span className={`text-sm font-semibold ${item.color || 'text-[var(--text)]'}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <label className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer mb-5 transition-colors
        bg-[var(--bg)] border-[var(--border)] hover:border-[var(--border-dark)]">
        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-zinc-900" />
        <p className="text-xs text-[var(--text-2)] leading-relaxed">
          I confirm that the information above is accurate and complete. I am ready to sign off my shift.
        </p>
      </label>

      {error && (
        <div className="mb-4 px-3 py-2.5 bg-[var(--red-bg)] border border-[var(--red-border)]
          rounded-xl text-xs text-[var(--red-text)]">{error}</div>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)]
          border border-[var(--border)] rounded-xl hover:border-[var(--border-dark)] transition-colors">
          ← Back
        </button>
        <button onClick={onSubmit} disabled={!confirmed || isPending}
          className="px-5 py-2.5 bg-[var(--text)] text-white text-sm font-bold
            rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-2">
          {isPending ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Signing off…
            </>
          ) : '✓ Complete Sign-Off'}
        </button>
      </div>
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ step, total }) {
  return (
    <div className="flex gap-1 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`flex-1 h-1 rounded-full transition-colors
          ${i < step ? 'bg-[var(--text)]' : 'bg-[var(--border)]'}`} />
      ))}
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function SignOffWizard({ floatId, expectedCash, openingFloat, pendingJobs, firstName, onLogout }) {
  const queryClient = useQueryClient()
  const [step,          setStep]          = useState(1)
  const [ackQueue,      setAckQueue]      = useState(false)
  const [counts,        setCounts]        = useState({})
  const [closingCash,   setClosingCash]   = useState(0)
  const [variance,      setVariance]      = useState(0)
  const [varianceNotes, setVarianceNotes] = useState('')
  const [shiftNotes,    setShiftNotes]    = useState('')
  const [error,         setError]         = useState('')

  const breakdown = Object.fromEntries(
    DENOMS.map(d => [d.value, counts[d.value] || 0])
  )

  const [done, setDone] = useState(false)
  const [phase, setPhase] = useState('message') // 'message' -> 'countdown'
  const [secondsLeft, setSecondsLeft] = useState(10)

  const { mutate, isPending } = useMutation({
    mutationFn: () => client.post(`/api/v1/finance/floats/${floatId}/sign-off/`, {
      closing_cash:   closingCash,
      breakdown,
      variance_notes: varianceNotes,
      shift_notes:    shiftNotes,
    }),
    onSuccess: () => {
      // Don't invalidate shiftStatus here — the parent polls it and an
      // immediate refetch flips isSignedOff -> showPortalLocked -> true
      // mid-animation, unmounting this wizard before its own 5s message
      // + 10s countdown finish and before onLogout ever fires. Invalidate
      // only once the wizard's own lifecycle actually completes, right
      // before logging out.
      setDone(true)
    },
    onError: (err) => {
      setError(err.response?.data?.detail || 'Sign-off failed. Please try again.')
    },
  })

  // Phase 1: plain success message, held for 5s before the countdown
  // even appears. Phase 2: countdown from 10, reaching 0 logs out.
  useEffect(() => {
    if (!done || phase !== 'message') return
    const t = setTimeout(() => setPhase('countdown'), 5000)
    return () => clearTimeout(t)
  }, [done, phase])

  useEffect(() => {
    if (!done || phase !== 'countdown') return
    if (secondsLeft <= 0) {
      queryClient.invalidateQueries({ queryKey: ['shiftStatus'] })
      onLogout?.()
      return
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [done, phase, secondsLeft, onLogout, queryClient])

  const TOTAL_STEPS = 5

  const STEP_LABELS = [
    'Queue Status',
    'Cash Count',
    'Variance',
    'Shift Notes',
    'Confirm',
  ]

  if (done) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-10 text-center animate-slideUp">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="text-2xl font-black text-zinc-900 mb-2">
            Sign Off Successful{firstName ? `, ${firstName}` : ''}!
          </h2>
          <p className="text-sm text-zinc-500 mb-1">Your shift has ended for today.</p>
          {phase === 'countdown' && (
            <p className="text-xs text-zinc-400 mt-3">
              Logging off in <span className="font-bold text-zinc-600">{secondsLeft}</span>…
            </p>
          )}
        </div>
      </div>,
      document.body
    )
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 animate-fadeIn"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-slideUp">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-1">
            <div className="font-black text-lg text-[var(--text)]">End of Shift Sign-Off</div>
            <span className="text-xs text-[var(--text-3)]">Step {step} of {TOTAL_STEPS}</span>
          </div>
          <p className="text-xs text-[var(--text-3)] mb-3">{STEP_LABELS[step - 1]}</p>
          <ProgressBar step={step} total={TOTAL_STEPS} />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <Step1QueueStatus
              pendingCount={pendingJobs}
              ackQueue={ackQueue}
              setAckQueue={setAckQueue}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <Step2CashCount
              expectedCash={expectedCash}
              openingFloat={openingFloat}
              counts={counts}
              setCounts={setCounts}
              onNext={(total, vari) => { setClosingCash(total); setVariance(vari); setStep(3) }}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3Variance
              closingCash={closingCash}
              expectedCash={expectedCash}
              variance={variance}
              varianceNotes={varianceNotes}
              setVarianceNotes={setVarianceNotes}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <Step4ShiftNotes
              shiftNotes={shiftNotes}
              setShiftNotes={setShiftNotes}
              onNext={() => setStep(5)}
              onBack={() => setStep(3)}
            />
          )}
          {step === 5 && (
            <Step5Confirm
              closingCash={closingCash}
              variance={variance}
              shiftNotes={shiftNotes}
              varianceNotes={varianceNotes}
              isPending={isPending}
              error={error}
              onSubmit={() => mutate()}
              onBack={() => setStep(4)}
            />
          )}
        </div>

      </div>
    </div>
  )

  return createPortal(modal, document.body)
}