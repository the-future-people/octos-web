// src/components/bm/RecoverSheetModal.jsx
// Settles a day that was never closed. The figures here come from a
// physical count agreed with the cashier — not from the system's own
// totals — so the expectation is shown for comparison, never prefilled.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recoverSheet } from '../../api/bm'

const REASONS = [
  { id: 'POWER_OUTAGE',    label: 'Power outage' },
  { id: 'SYSTEM_DOWN',     label: 'System unavailable' },
  { id: 'NETWORK_FAILURE', label: 'Network failure' },
  { id: 'NOT_CLOSED',      label: 'Not closed at end of day' },
  { id: 'OTHER',           label: 'Other' },
]

function fmt(amount) {
  return `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export default function RecoverSheetModal({ sheet, onClose, onSuccess }) {
  const queryClient = useQueryClient()

  // A day can strand with the cashier's sign-off already done: she
  // counted, signed and went home, and only the close never happened.
  // Then there is nothing to count — her figure stands, and this form
  // confirms it rather than asking for a number nobody counted.
  const alreadySigned = !!sheet.is_signed_off

  const [openingFloat,  setOpeningFloat]  = useState(String(sheet.suggested_opening ?? '100.00'))
  const [countedCash,   setCountedCash]   = useState(
    alreadySigned ? String(sheet.signed_closing ?? '') : ''
  )
  const [reason,        setReason]        = useState('')
  const [notes,         setNotes]         = useState('')
  const [varianceNotes, setVarianceNotes] = useState('')
  const [error,         setError]         = useState('')

  // Recomputed live: the expectation moves if the manager corrects the
  // opening float, since that is part of what the till should hold.
  // Compared in whole pesewas. Subtracting two floats built from decimal
  // strings leaves values marginally off a 0.01 threshold, so a genuine
  // one-pesewa difference can read as an exact match — which on a till
  // reconciliation screen means a real discrepancy passes unexplained.
  const toPesewas = (v) => Math.round(parseFloat(v || 0) * 100)

  const expectedP = toPesewas(openingFloat) + toPesewas(sheet.cash_collected)
  const countedP  = toPesewas(countedCash)
  const diffP     = countedCash === '' ? 0 : countedP - expectedP

  const expected = expectedP / 100
  const diff     = diffP / 100
  const hasDiff  = countedCash !== '' && diffP !== 0

  const { mutate, isPending } = useMutation({
    mutationFn: () => recoverSheet(sheet.sheet_id, {
      opening_float   : parseFloat(openingFloat).toFixed(2),
      closing_cash    : parseFloat(countedCash).toFixed(2),
      reason,
      notes,
      reconciled_with : sheet.cashier_id,
      variance_notes  : varianceNotes,
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['strandedSheets'] })
      queryClient.invalidateQueries({ queryKey: ['todaySummary'] })
      queryClient.invalidateQueries({ queryKey: ['lockStatus'] })
      onSuccess?.(res.data)
    },
    onError: (err) => {
      setError(err.response?.data?.detail || 'Could not settle this day. Please try again.')
    },
  })

    // Nothing to reconcile on an already-signed day: the count and its
  // variance were recorded and explained at the time. Only the reason it
  // never closed is still missing.
  const ready = alreadySigned
    ? (reason !== '' && notes.trim().length > 0)
    : (
        countedCash !== '' &&
        parseFloat(openingFloat || 0) >= 0 &&
        reason !== '' &&
        notes.trim().length > 0 &&
        (!hasDiff || varianceNotes.trim().length >= 10)
      )

  const handleSubmit = () => {
    setError('')
    if (!sheet.cashier_id) {
      setError('No cashier is on record for this day. This needs to be resolved before the day can be settled.')
      return
    }
    mutate()
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-lg
        max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="relative px-6 pt-5 pb-4 border-b border-[var(--border)]">
          <button onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center
              rounded-full hover:bg-[var(--bg)] text-[var(--text-3)] transition-colors">
            ✕
          </button>
          <div className="font-black text-lg text-[var(--text)]">Settle {fmtDate(sheet.date)}</div>
                    <div className="text-xs text-[var(--text-3)] mt-1 leading-relaxed">
            {alreadySigned
              ? `${sheet.cashier_name || 'The cashier'} counted and signed off. This day only needs closing.`
              : `This day was never closed. Record what was actually counted, agreed with ${sheet.cashier_name || 'the cashier'}.`}
          </div>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

          {/* What the system already knows */}
          <div className="border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-[var(--bg)] text-[10px] font-bold
              text-[var(--text-3)] uppercase tracking-wider">
              What the system recorded that day
            </div>
            <div className="px-4 py-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-3)]">Jobs</span>
                <span className="font-mono text-[var(--text-2)]">{sheet.job_count}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-3)]">Taken, all methods</span>
                <span className="font-mono text-[var(--text-2)]">{fmt(sheet.total_revenue)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-3)]">Of that, cash</span>
                <span className="font-mono text-[var(--text-2)]">{fmt(sheet.cash_collected)}</span>
              </div>
            </div>
          </div>

                   {alreadySigned ? (
            <div className="px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">
                Counted and signed off
              </div>
              <div className="font-mono font-black text-xl text-[var(--text)]">
                {fmt(sheet.signed_closing)}
              </div>
              <div className="text-xs text-[var(--text-3)] mt-1">
                {sheet.cashier_name || 'The cashier'} signed at{' '}
                {new Date(sheet.signed_off_at).toLocaleTimeString('en-GH', {
                  hour: 'numeric', minute: '2-digit',
                })}
              </div>
              {toPesewas(sheet.signed_variance) !== 0 && (
                <div className="text-xs text-amber-700 mt-2">
                  {fmt(Math.abs(sheet.signed_variance))}{' '}
                  {parseFloat(sheet.signed_variance) > 0 ? 'more' : 'less'} than expected,
                  recorded at the time
                </div>
              )}
              <div className="text-xs text-[var(--text-3)] mt-2 leading-relaxed">
                Her count stands as recorded and is not re-entered here.
              </div>
            </div>
          ) : (
          <>
          {/* Opening float */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
              Float she started with
            </label>

            <input
              type="number" min="0" step="0.01"
              value={openingFloat}
              onChange={e => setOpeningFloat(e.target.value)}
              className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                rounded-lg text-sm font-mono outline-none focus:border-[var(--border-dark)]"
            />
            <div className="mt-1 text-xs text-[var(--text-3)]">
              Change this if she actually started the day with something else.
            </div>
          </div>

          {/* Expectation, shown before the input */}
          <div className="px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
            <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">
              The till should hold
            </div>
            <div className="font-mono font-black text-xl text-[var(--text)]">{fmt(expected)}</div>
            <div className="text-xs text-[var(--text-3)] mt-1">
              {fmt(openingFloat)} float + {fmt(sheet.cash_collected)} cash taken
            </div>
          </div>

          {/* Counted */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
              What was counted <span className="text-[var(--red-text)]">*</span>
            </label>
            <input
              type="number" min="0" step="0.01"
              value={countedCash}
              onChange={e => setCountedCash(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                rounded-lg text-sm font-mono outline-none focus:border-[var(--border-dark)]"
            />
            {countedCash !== '' && (
              <div className={`mt-2 text-sm font-bold ${
                hasDiff ? 'text-amber-700' : 'text-emerald-600'
              }`}>
                {hasDiff
                  ? `${fmt(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than expected`
                  : 'Matches exactly'}
              </div>
            )}
          </div>

          {/* Variance explanation */}
          {hasDiff && (
            <div>
              <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
                What accounts for the difference? <span className="text-[var(--red-text)]">*</span>
              </label>
              <textarea
                rows={3}
                value={varianceNotes}
                onChange={e => setVarianceNotes(e.target.value)}
                placeholder="What was found when this was checked…"
                className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                  rounded-lg text-sm outline-none focus:border-[var(--border-dark)] resize-none"
              />
                            <div className="mt-1 text-xs text-[var(--text-3)]">
                This is a record of what was found, kept with the day. Minimum 10 characters.
              </div>
            </div>
          )}
          </>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
              Why wasn&rsquo;t this day closed? <span className="text-[var(--red-text)]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map(r => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors text-left
                    ${reason === r.id
                      ? 'bg-[var(--text)] text-white border-[var(--text)]'
                      : 'bg-[var(--bg)] text-[var(--text-2)] border-[var(--border)] hover:border-[var(--border-dark)]'
                    }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
              Notes <span className="text-[var(--red-text)]">*</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What happened, and when this was reconciled…"
              className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                rounded-lg text-sm outline-none focus:border-[var(--border-dark)] resize-none"
            />
          </div>

          {error && (
            <div className="px-3 py-2.5 bg-[var(--red-bg)] border border-[var(--red-border)]
              rounded-lg text-sm text-[var(--red-text)]">
              {error}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 border-t border-[var(--border)]">
          <div className="text-xs text-[var(--text-3)] mb-3 leading-relaxed">
            Recorded as settled by you, counted with {sheet.cashier_name || 'the cashier'}.
            Closing this day releases the next one.
          </div>
          <button
            onClick={handleSubmit}
            disabled={!ready || isPending}
            className="w-full py-3 bg-[var(--text)] text-white text-sm font-bold
              rounded-xl transition-opacity disabled:opacity-40 hover:opacity-90"
          >
            {isPending ? 'Settling…' : 'Settle this day'}
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}