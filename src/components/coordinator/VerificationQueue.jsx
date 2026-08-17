// src/components/coordinator/VerificationQueue.jsx
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getVerificationQueue, verifyJob, rejectVerification, haltJob } from '../../api/coordinator'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function waitingFor(iso) {
  if (!iso) return ''
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (mins < 60)   return `${mins}m`
  if (mins < 1440) return `${Math.floor(mins / 60)}h`
  return `${Math.floor(mins / 1440)}d`
}

const OUTCOMES = [
  { value: 'ARTWORK_PROBLEM', label: 'Artwork not usable'      },
  { value: 'SPEC_UNCLEAR',    label: 'Specification unclear'   },
  { value: 'SPEC_IMPOSSIBLE', label: 'Cannot be made as ordered' },
  { value: 'WRONG_FILE',      label: 'Wrong or missing file'   },
  { value: 'OTHER',           label: 'Other'                   },
]

export default function VerificationQueue() {
  const queryClient = useQueryClient()
  const [checking, setChecking] = useState(null)
  const [error, setError]       = useState('')

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['verificationQueue'],
    queryFn:  () => getVerificationQueue().then(r => r.data),
    refetchInterval: 30_000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['verificationQueue'] })
    queryClient.invalidateQueries({ queryKey: ['productionBoard'] })
    setChecking(null)
  }

  return (
    <div className="p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[var(--text)]">To verify</h2>
        <p className="text-xs text-[var(--text-3)] mt-0.5">
          Orders sent in that nobody here has looked at yet. Oldest first.
        </p>
      </div>

      {error && (
        <div className="px-3 py-2 bg-[var(--red-bg)] border border-[var(--red-border)]
          rounded-lg text-xs text-[var(--red-text)] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold ml-3">✕</button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 bg-[var(--panel)] border border-[var(--border)]
              rounded-xl animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          flex flex-col items-center justify-center py-16">
          <p className="text-sm font-semibold text-[var(--text-2)]">Nothing waiting</p>
          <p className="text-xs text-[var(--text-3)] mt-1">
            Everything sent in has been checked
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => {
            const v      = job.verification
            const failed = v?.checked && !v.passed
            return (
              <div key={job.id}
                className={`bg-[var(--panel)] border rounded-xl px-4 py-3
                  ${failed ? 'border-red-200' : 'border-[var(--border)]'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--text)]">
                        {job.job_number}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full
                        bg-zinc-100 text-zinc-600">
                        {job.intake_channel?.replace('_', ' ')}
                      </span>
                      {failed && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full
                          bg-red-100 text-red-700">
                          Sent back
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-2)] mt-1">
                      {job.title}
                    </div>
                    <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                      {job.customer_name || 'Walk-in'} · waiting {waitingFor(job.created_at)}
                    </div>
                    {failed && v.note && (
                      <div className="text-[10px] text-red-600 mt-1">
                        {v.outcome_display}: {v.note}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs font-bold text-[var(--text)]">
                      {fmt(job.estimated_cost)}
                    </span>
                    <button onClick={() => { setError(''); setChecking(job) }}
                      className="px-3 py-1.5 text-[10px] font-bold bg-[var(--text)]
                        text-white rounded-lg hover:opacity-90 transition-opacity">
                      Check
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {checking && (
        <CheckModal
          job={checking}
          onClose={() => setChecking(null)}
          onDone={invalidate}
          onError={setError}
        />
      )}
    </div>
  )
}

/**
 * The check itself. Everything the coordinator needs to decide is here —
 * what was ordered, at what spec — so they are not opening a second screen
 * to read line items while deciding.
 */
function CheckModal({ job, onClose, onDone, onError }) {
  const [mode, setMode]         = useState('pass')     // pass | reject
  const [outcome, setOutcome]   = useState('ARTWORK_PROBLEM')
  const [note, setNote]         = useState('')
  const [called, setCalled]     = useState(false)
  const [response, setResponse] = useState('')
  const [haltToo, setHaltToo]   = useState(true)

  const { mutate: pass, isPending: passing } = useMutation({
    mutationFn: () => verifyJob(job.id, {
      note, customer_contacted: called, customer_response: response,
    }),
    onSuccess: onDone,
    onError:   (e) => onError(e.response?.data?.detail || 'Could not clear that job.'),
  })

  const { mutate: send_back, isPending: rejecting } = useMutation({
    mutationFn: async () => {
      await rejectVerification(job.id, {
        outcome, note,
        customer_contacted: called,
        customer_response:  response,
      })
      // Halting is a separate act deliberately, but a job sent back is
      // almost always waiting on the customer — so it is offered here
      // rather than requiring a second trip to the board.
      if (haltToo) {
        await haltJob(job.id, {
          reason: 'AWAITING_CUSTOMER',
          note:   note || 'Sent back after verification.',
        })
      }
    },
    onSuccess: onDone,
    onError:   (e) => onError(e.response?.data?.detail || 'Could not send that job back.'),
  })

  const busy = passing || rejecting

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-lg
        max-h-[92vh] flex flex-col overflow-hidden animate-slideUp">

        <div className="px-6 py-4 border-b border-[var(--border)] flex items-start justify-between">
          <div>
            <div className="font-bold text-[var(--text)]">{job.job_number}</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">
              {job.customer_name || 'Walk-in'} · {job.intake_channel?.replace('_', ' ')}
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
              hover:bg-[var(--bg)] text-[var(--text-3)] transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
              tracking-wider mb-2">What was ordered</div>
            <div className="space-y-1.5">
              {(job.line_items || []).map(li => (
                <div key={li.id}
                  className="flex items-start justify-between px-3 py-2 bg-[var(--bg)]
                    border border-[var(--border)] rounded-lg">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[var(--text)]">
                      {li.label || li.service_name}
                    </div>
                    <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                      {li.quantity} × {li.pages}pp
                      {li.is_color ? ' · Colour' : ' · B&W'}
                      {li.paper_size ? ` · ${li.paper_size}` : ''}
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-[var(--text)] ml-3">
                    {fmt(li.line_total)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-1 bg-[var(--bg)] p-1 rounded-xl">
            {[
              { value: 'pass',   label: 'Clear for production' },
              { value: 'reject', label: 'Send back'            },
            ].map(m => (
              <button key={m.value} onClick={() => setMode(m.value)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors
                  ${mode === m.value
                    ? 'bg-[var(--text)] text-white shadow-sm'
                    : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
                {m.label}
              </button>
            ))}
          </div>

          {mode === 'reject' && (
            <div>
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                tracking-wider mb-2">What is wrong</div>
              <div className="space-y-1">
                {OUTCOMES.map(o => (
                  <button key={o.value} onClick={() => setOutcome(o.value)}
                    className={`w-full text-left px-3 py-2 text-xs rounded-lg border
                      transition-colors
                      ${outcome === o.value
                        ? 'border-[var(--text)] bg-[var(--bg)] font-semibold'
                        : 'border-[var(--border)] text-[var(--text-2)]'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
              tracking-wider mb-1.5">
              Note {mode === 'pass' && <span className="normal-case font-normal">(optional)</span>}
            </div>
            <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
              placeholder={mode === 'pass'
                ? 'Anything worth recording'
                : 'What you found — the customer may be told this'}
              className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)]
                rounded-lg outline-none resize-none" />
          </div>

          <div className="px-3 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={called}
                onChange={e => setCalled(e.target.checked)} />
              <span className="text-xs font-semibold text-[var(--text)]">
                I contacted the customer
              </span>
            </label>
            {called && (
              <textarea rows={2} value={response} onChange={e => setResponse(e.target.value)}
                placeholder="What they said"
                className="w-full px-3 py-2 text-xs bg-[var(--panel)] border
                  border-[var(--border)] rounded-lg outline-none resize-none" />
            )}
            <p className="text-[10px] text-[var(--text-3)] leading-relaxed">
              Use the branch line, never a personal number. If a spec changes
              after a call, this is the record of why.
            </p>
          </div>

          {mode === 'reject' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={haltToo}
                onChange={e => setHaltToo(e.target.checked)} />
              <span className="text-xs text-[var(--text-2)]">
                Also halt the job while waiting for the customer
              </span>
            </label>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-[var(--text-2)]
              hover:text-[var(--text)] transition-colors">Cancel</button>
          <button onClick={() => (mode === 'pass' ? pass() : send_back())}
            disabled={busy || (mode === 'reject' && !note.trim())}
            className={`px-4 py-2 text-sm font-bold text-white rounded-xl
              disabled:opacity-40 hover:opacity-90 transition-opacity
              ${mode === 'pass' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {busy ? 'Saving…' : mode === 'pass' ? 'Clear for production' : 'Send back'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}