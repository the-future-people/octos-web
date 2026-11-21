// src/components/shared/StatementModal.jsx
// A customer's statement (21 Nov 2026): what they owe from before (work
// delivered and not paid, or a balance after a deposit), their new work
// waiting for payment, and the total. The same figures as the cashier's
// Balances and Octos, because the server works them out in one place.
// Download the PDF, or send it in their WhatsApp chat.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getStatement, getStatementPdf, sendStatement } from '../../api/bm'
import { saveFile } from '../../api/saveFile'

const fmt = v => `GHS ${parseFloat(v || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
const day = iso => (iso ? new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

function Section({ title, hint, jobs, total }) {
  if (!jobs?.length) return null
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="text-[12px] font-extrabold tracking-wider text-[var(--text-3)] uppercase">{title}</div>
        <div className="font-mono text-[14px] font-bold text-[var(--text)]">{fmt(total)}</div>
      </div>
      {hint && <div className="text-[12px] text-[var(--text-3)] mt-0.5">{hint}</div>}
      <div className="mt-2 rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
        {jobs.map(j => (
          <div key={j.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <div className="font-mono text-[12.5px] font-bold text-[var(--text)]">{j.job_number}</div>
              <div className="text-[12.5px] text-[var(--text-2)] truncate">{j.what}</div>
              <div className="text-[11.5px] text-[var(--text-3)]">
                {j.delivered ? `Delivered ${day(j.date)}` : `Taken ${day(j.date)}`}
                {parseFloat(j.paid) > 0 ? ` · ${fmt(j.paid)} paid of ${fmt(j.amount)}` : ''}
              </div>
            </div>
            <div className="text-right font-mono text-[14px] font-bold text-amber-700 self-center">{fmt(j.balance)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StatementModal({ customerId, onClose }) {
  const [note, setNote] = useState({ text: '', ok: true })
  const { data, isLoading, isError } = useQuery({
    queryKey: ['statement', customerId],
    queryFn: () => getStatement(customerId).then(r => r.data),
    enabled: !!customerId,
  })
  const send = useMutation({
    mutationFn: () => sendStatement(customerId).then(r => r.data),
    onSuccess: r => setNote({ text: r.detail, ok: true }),
    onError: e => setNote({ text: e.response?.data?.detail || 'Could not send it.', ok: false }),
  })
  const [saving, setSaving] = useState(false)
  const download = async () => {
    setSaving(true)
    try {
      const res = await getStatementPdf(customerId)
      const name = (data?.customer?.name || 'customer').replace(/[^A-Za-z0-9]+/g, '-')
      await saveFile(`Statement-${name}.pdf`, res.data, `statement-${customerId}`)
    } catch {
      setNote({ text: 'Could not build the document.', ok: false })
    } finally {
      setSaving(false)
    }
  }
  const owesNothing = data && parseFloat(data.total) <= 0

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-slideUp"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <div className="text-[15px] font-bold text-[var(--text)]">Statement</div>
            <div className="text-[12.5px] text-[var(--text-3)] mt-0.5">{data?.customer?.name || ' '}</div>
          </div>
          <button onClick={onClose} aria-label="Close"
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg)] text-[var(--text-3)]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {isLoading && <div className="h-28 rounded-xl bg-[var(--bg)] animate-pulse" />}
          {isError && <p className="text-sm text-[var(--red-text)]">Could not load the statement.</p>}
          {data && (
            <>
              <div className="rounded-xl bg-[var(--bg)] px-4 py-3 flex items-end justify-between">
                <div>
                  <div className="text-[12px] font-semibold text-[var(--text-3)]">Total due</div>
                  <div className="font-mono text-[26px] font-extrabold text-[var(--text)] leading-tight">{fmt(data.total)}</div>
                </div>
                {!owesNothing && (
                  <div className="text-right text-[12px] text-[var(--text-3)]">
                    {parseFloat(data.owed_total) > 0 && <div>From before {fmt(data.owed_total)}</div>}
                    {parseFloat(data.current_total) > 0 && <div>New work {fmt(data.current_total)}</div>}
                  </div>
                )}
              </div>
              {owesNothing && <p className="text-sm text-[var(--text-2)]">Nothing is owed.</p>}
              <Section title="Owed from before" hint="Delivered and not paid, or a balance after a deposit."
                       jobs={data.owed} total={data.owed_total} />
              <Section title="New work" hint="Taken and waiting for payment." jobs={data.current} total={data.current_total} />
              {!owesNothing && (
                <p className="text-[12px] text-[var(--text-3)] leading-relaxed">
                  Paying part? The cashier takes it against the job they point to, by its number.
                </p>
              )}
            </>
          )}
          {note.text && (
            <div className={`px-3 py-2 rounded-lg text-[12.5px] ${note.ok
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-[var(--red-bg)] text-[var(--red-text)] border border-[var(--red-border)]'}`}>
              {note.text}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={download} disabled={!data || saving}
                  className="h-10 px-4 rounded-xl border border-[var(--border)] text-sm font-bold text-[var(--text-2)] hover:border-[var(--border-dark)] disabled:opacity-40">
            {saving ? 'Building…' : 'Download PDF'}
          </button>
          <button onClick={() => send.mutate()} disabled={!data || owesNothing || send.isPending}
                  className="h-10 px-4 rounded-xl bg-[var(--text)] text-white text-sm font-bold hover:opacity-90 disabled:opacity-40">
            {send.isPending ? 'Sending…' : 'Send on WhatsApp'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
