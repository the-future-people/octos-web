// src/components/bm/ExpiredProformaModal.jsx
// An expired proforma (21 Nov 2026): what happened with it?
//   - The work was done and delivered: it becomes a job owing its whole
//     value, so it shows with every other balance (Balances, the customer's
//     statement, Octos). Then the statement opens, ready to send.
//   - The work wasn't done: renew it, the same lines at today's prices.
// Mr. Dwumfour's work was printed and delivered, the proforma expired, and
// what he owed was nowhere.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recordOwedProforma, renewProforma } from '../../api/bm'
import StatementModal from '../shared/StatementModal'

const fmt = v => `GHS ${parseFloat(v || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
const today = () => new Date().toISOString().slice(0, 10)

function Option({ value, title, sub, choice, onPick }) {
  return (
    <button type="button" onClick={() => onPick(value)}
            className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${choice === value
              ? 'border-[var(--text)] bg-[var(--bg)]'
              : 'border-[var(--border)] hover:border-[var(--border-dark)]'}`}>
      <div className="text-[14px] font-bold text-[var(--text)]">{title}</div>
      <div className="text-[12.5px] text-[var(--text-3)] mt-0.5 leading-relaxed">{sub}</div>
    </button>
  )
}

export default function ExpiredProformaModal({ proforma, onClose, onRenewed }) {
  const queryClient = useQueryClient()
  const [choice, setChoice] = useState('done')
  const [deliveredOn, setDeliveredOn] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [statementFor, setStatementFor] = useState(null)

  const refresh = () => {
    for (const key of ['proformas', 'proformas-phone', 'jobs', 'cashierBalances', 'statement']) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
  const record = useMutation({
    mutationFn: () => recordOwedProforma(proforma.id, { delivered_on: deliveredOn || undefined, note }).then(r => r.data),
    onSuccess: r => {
      refresh()
      if (r.job?.customer) setStatementFor(r.job.customer)
      else onClose()
    },
    onError: e => setError(e.response?.data?.detail || 'Could not record it.'),
  })
  const renew = useMutation({
    mutationFn: () => renewProforma(proforma.id).then(r => r.data),
    onSuccess: r => { refresh(); onRenewed?.(r.proforma); onClose() },
    onError: e => setError(e.response?.data?.detail || 'Could not renew it.'),
  })
  const busy = record.isPending || renew.isPending
  const pick = value => { setChoice(value); setError('') }

  if (statementFor) return <StatementModal customerId={statementFor} onClose={onClose} />

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slideUp"
           onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="text-[15px] font-bold text-[var(--text)]">Was the work done?</div>
          <div className="text-[12.5px] text-[var(--text-3)] mt-0.5">
            {proforma.proforma_number} · {proforma.customer_name} · {fmt(proforma.total)}
          </div>
        </div>

        <div className="px-5 py-4 space-y-2.5">
          <Option value="done" choice={choice} onPick={pick} title="Yes, it was done and delivered"
                  sub={`It becomes a job owing ${fmt(proforma.total)}, at the price on this proforma, and shows with their other balances.`} />
          <Option value="renew" choice={choice} onPick={pick} title="No, the work wasn't done"
                  sub="Renew it: the same lines on a fresh proforma at today's prices." />

          {choice === 'done' && (
            <div className="pt-2 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider">Delivered on</span>
                <input type="date" value={deliveredOn} max={today()} onChange={e => setDeliveredOn(e.target.value)}
                       className="mt-1 w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[16px]" />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider">Note</span>
                <input type="text" value={note} maxLength={300} onChange={e => setNote(e.target.value)}
                       placeholder="Optional"
                       className="mt-1 w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[16px]" />
              </label>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg text-[12.5px] bg-[var(--red-bg)] text-[var(--red-text)] border border-[var(--red-border)]">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)]">
            Not now
          </button>
          <button onClick={() => (choice === 'done' ? record.mutate() : renew.mutate())} disabled={busy}
                  className="h-10 px-4 rounded-xl bg-[var(--text)] text-white text-sm font-bold hover:opacity-90 disabled:opacity-40">
            {busy ? 'Saving…' : choice === 'done' ? 'Record what’s owed' : 'Renew at today’s prices'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
