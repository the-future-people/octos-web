// src/components/cashier/FloatAcknowledgeModal.jsx
import { useState } from 'react'
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

export default function FloatAcknowledgeModal({ floatId, openingFloat, onSuccess }) {
  const queryClient = useQueryClient()
  const [counts, setCounts] = useState({})
  const [error, setError] = useState('')

  const setCount = (denom, val) =>
    setCounts(c => ({ ...c, [denom]: Math.max(0, parseInt(val) || 0) }))

  const computedTotal = DENOMS.reduce((sum, d) => {
    return sum + (counts[d.value] || 0) * d.value
  }, 0)

  const expected  = parseFloat(openingFloat || 0)
  const matches   = Math.abs(computedTotal - expected) < 0.01
  const breakdown = Object.fromEntries(
    DENOMS.map(d => [d.value, counts[d.value] || 0])
  )

  const { mutate, isPending } = useMutation({
    mutationFn: () => client.post(`/api/v1/finance/floats/${floatId}/acknowledge/`, { breakdown }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shiftStatus'] })
      onSuccess?.()
    },
    onError: (err) => {
      setError(err.response?.data?.detail || 'Acknowledgement failed.')
    },
  })

  const handleSubmit = () => {
    if (!matches) { setError(`Count mismatch. Expected ${fmt(expected)}, got ${fmt(computedTotal)}.`); return }
    setError('')
    mutate()
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 animate-fadeIn"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-slideUp">

        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--border)] bg-blue-50">
          <div className="flex items-center gap-3 mb-1">
            <span className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center text-lg">💰</span>
            <div>
              <div className="font-black text-lg text-[var(--text)]">Float Acknowledgement</div>
              <div className="text-xs text-[var(--text-3)]">Count your opening float and confirm receipt</div>
            </div>
          </div>
          <div className="mt-3 px-4 py-3 bg-white border border-blue-200 rounded-xl flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--text-2)]">Expected float</span>
            <span className="font-mono font-black text-xl text-blue-700">{fmt(expected)}</span>
          </div>
        </div>

        {/* Denomination grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-3">
            Denomination Count
          </div>
          <div className="space-y-2">
            {DENOMS.map(d => {
              const count  = counts[d.value] || 0
              const subtot = count * d.value
              return (
                <div key={d.value} className="flex items-center gap-3 px-4 py-2.5
                  bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                  <span className="w-14 text-sm font-bold text-[var(--text)]">{d.label}</span>
                  <span className="text-[var(--text-3)] text-sm">×</span>
                  <input
                    type="number" min="0" value={count || ''}
                    onChange={e => setCount(d.value, e.target.value)}
                    placeholder="0"
                    className="w-16 px-2 py-1 text-sm font-mono text-center bg-white border
                      border-[var(--border)] rounded-lg outline-none focus:border-blue-400"
                  />
                  <span className="text-[var(--text-3)] text-sm">=</span>
                  <span className={`flex-1 text-right font-mono text-sm font-bold
                    ${subtot > 0 ? 'text-[var(--text)]' : 'text-[var(--text-3)]'}`}>
                    {subtot > 0 ? fmt(subtot) : '—'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Running total */}
          <div className={`mt-4 px-4 py-3 rounded-xl border flex items-center justify-between
            ${matches && computedTotal > 0
              ? 'bg-emerald-50 border-emerald-200'
              : computedTotal > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-[var(--bg)] border-[var(--border)]'
            }`}>
            <span className="text-sm font-bold text-[var(--text-2)]">Your count</span>
            <div className="text-right">
              <div className={`font-mono font-black text-xl ${
                matches && computedTotal > 0 ? 'text-emerald-600' :
                computedTotal > 0 ? 'text-red-500' : 'text-[var(--text-3)]'
              }`}>{fmt(computedTotal)}</div>
              {computedTotal > 0 && !matches && (
                <div className="text-[10px] text-red-500 font-semibold">
                  {computedTotal > expected
                    ? `+${fmt(computedTotal - expected)} over`
                    : `${fmt(expected - computedTotal)} short`}
                </div>
              )}
              {matches && computedTotal > 0 && (
                <div className="text-[10px] text-emerald-600 font-semibold">✓ Matches</div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-3 px-3 py-2.5 bg-[var(--red-bg)] border border-[var(--red-border)]
              rounded-xl text-xs text-[var(--red-text)]">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-[var(--border)]">
          <button onClick={handleSubmit} disabled={!matches || isPending}
            className="w-full py-3 bg-[var(--text)] text-white font-bold text-sm rounded-xl
              disabled:opacity-40 hover:opacity-90 transition-opacity">
            {isPending ? 'Confirming…' : '✓ Confirm Float Receipt'}
          </button>
          <p className="text-[10px] text-[var(--text-3)] text-center mt-2">
            You cannot dismiss this screen until your float is acknowledged
          </p>
        </div>

      </div>
    </div>
  )

  return createPortal(modal, document.body)
}