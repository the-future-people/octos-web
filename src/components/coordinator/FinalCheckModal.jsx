// src/components/coordinator/FinalCheckModal.jsx
//
// The final check at a piece's last step: what was ordered against what
// was made. "Made" starts filled with the order, so the coordinator
// measures, counts and looks, and changes only what differs.
//
// Everything matches: the piece is done, and when every piece of the job
// has passed, the job is ready and the customer is told. Anything differs:
// the piece is never handed over. It goes back to its machine to be made
// again, and the estimate grows by itself.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { getCheck } from '../../api/coordinator'
import { clockTime, dueTime } from './shared'

// The same reading the server uses: case, spaces and x for × aside.
function same(a, b) {
  const norm = v => String(v ?? '').toLowerCase().replace(/×/g, 'x').replace(/\s+/g, '')
  return norm(a) === norm(b)
}

const Mark = ({ ok }) => (
  <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center
    ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      {ok ? <path d="M5 12l5 5L20 7" /> : <path d="M6 6l12 12M18 6 6 18" />}
    </svg>
  </span>
)

/**
 * row:      the floor row for the step being checked
 * onSubmit: (made, note) => post the check; resolves when done
 * onClose:  close without checking
 * busy:     the check is being saved
 */
export default function FinalCheckModal({ row, onSubmit, onClose, busy }) {
  const [made, setMade] = useState({})
  const [note, setNote] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['final-check', row.step],
    queryFn:  () => getCheck(row.step).then(r => r.data),
  })

  useEffect(() => {
    if (data?.rows) {
      setMade(Object.fromEntries(data.rows.map(r => [r.field, r.ordered])))
    }
  }, [data])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  const rows = data?.rows || []
  const mismatches = rows.filter(r => !same(r.ordered, made[r.field])).length
  const allMatch = rows.length > 0 && mismatches === 0

  const promise = data?.promise
  const now = data?.now || new Date().toISOString()
  const lateBy = promise ? Math.round((new Date(now) - new Date(promise)) / 60000) : null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-3 sm:p-5">
      <div role="dialog" aria-modal="true" aria-label={`Final check for ${row.job_number}`}
        className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-[680px]
          max-h-[94vh] flex flex-col overflow-hidden">

        <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)]">
          <span className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 17 17 3l4 4L7 21H3z" /><path d="m14 6 2 2M11 9l2 2M8 12l2 2" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-[var(--text)]">Final check · {row.job_number}</div>
            <div className="text-xs text-[var(--text-3)] truncate">
              {row.line} · {row.customer_name}
            </div>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Close without checking"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[var(--bg)]
              text-[var(--text-2)]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="h-48 rounded-xl bg-[var(--bg)] animate-pulse" />
          ) : (
            <>
              <p className="text-sm text-[var(--text-2)] mb-3">
                Measure, count and look. Change <strong>Made</strong> only where it differs.
              </p>
              <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg)] text-xs text-[var(--text-3)]">
                      <th className="text-left font-semibold px-3 py-2 w-[26%]"></th>
                      <th className="text-left font-semibold px-3 py-2">Ordered</th>
                      <th className="text-left font-semibold px-3 py-2">Made</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const ok = same(r.ordered, made[r.field])
                      return (
                        <tr key={r.field} className={`border-t border-[var(--border)] ${ok ? '' : 'bg-red-50'}`}>
                          <td className="px-3 py-2 text-[var(--text-3)]">{r.label}</td>
                          <td className="px-3 py-2 text-[var(--text)]">{r.ordered || '—'}</td>
                          <td className="px-3 py-1.5">
                            <input value={made[r.field] ?? ''} aria-label={`${r.label} as made`}
                              onChange={e => setMade(m => ({ ...m, [r.field]: e.target.value }))}
                              className={`w-full px-2.5 py-1.5 rounded-lg border outline-none text-sm
                                bg-[var(--panel)] ${ok ? 'border-[var(--border)]' : 'border-red-300'}`} />
                          </td>
                          <td className="px-2"><Mark ok={ok} /></td>
                        </tr>
                      )
                    })}
                    <tr className="border-t border-[var(--border)]">
                      <td className="px-3 py-2 text-[var(--text-3)]">Time</td>
                      <td className="px-3 py-2 text-[var(--text)]">
                        {promise ? `Promised ${dueTime(promise)}` : 'No promise'}
                      </td>
                      <td className={`px-3 py-2 ${lateBy > 0 ? 'text-red-600 font-semibold' : 'text-[var(--text)]'}`}>
                        Ready {clockTime(now)}
                      </td>
                      <td className="px-2">{promise && <Mark ok={!(lateBy > 0)} />}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {lateBy > 0 && (
                <p className="text-xs text-red-600 mt-2">{lateBy} minutes past the promise.</p>
              )}

              {!allMatch && rows.length > 0 && (
                <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-sm font-semibold text-red-700">
                    {mismatches} {mismatches === 1 ? 'thing differs' : 'things differ'} from the order.
                  </p>
                  <p className="text-xs text-red-700/80 mt-0.5">
                    This piece can't go to the customer. It goes back to its machine to be made
                    again, and the time left is worked out afresh.
                  </p>
                  <input value={note} onChange={e => setNote(e.target.value)}
                    placeholder="What went wrong (optional)"
                    className="mt-2 w-full px-3 py-2 text-sm rounded-lg border border-red-200
                      bg-[var(--panel)] outline-none" />
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t border-[var(--border)]">
          {allMatch ? (
            <button onClick={() => onSubmit(made, '')} disabled={busy}
              className="min-h-[48px] px-6 text-sm font-bold bg-emerald-600 text-white rounded-xl
                hover:opacity-90 disabled:opacity-40">
              {busy ? 'Saving…' : 'Matches · mark ready'}
            </button>
          ) : (
            <button onClick={() => onSubmit(made, note)} disabled={busy || rows.length === 0}
              className="min-h-[48px] px-6 text-sm font-bold bg-red-600 text-white rounded-xl
                hover:opacity-90 disabled:opacity-40">
              {busy ? 'Sending back…' : 'Send back to be made again'}
            </button>
          )}
          <button onClick={onClose} disabled={busy}
            className="min-h-[48px] px-5 text-sm font-semibold text-[var(--text-2)]">
            Not yet
          </button>
          {allMatch && (
            <span className="ml-auto text-xs text-[var(--text-3)]">
              The customer is told once every piece is ready
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}