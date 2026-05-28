// src/components/bm/CloseSheetModal.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { closeSheet, getStaff } from '../../api/bm'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toFixed(2)}`
}

export default function CloseSheetModal({ sheetId, summary, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const [floats,  setFloats]  = useState({})
  const [error,   setError]   = useState('')

  // Get cashiers for the branch
  const { data: staffData = [] } = useQuery({
    queryKey: ['staff'],
    queryFn:  () => getStaff().then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d?.results || [])
    }),
  })

  const cashiers = staffData.filter(s =>
    s.role_name === 'CASHIER' && s.is_active
  )

  // Default float to GHS 100
  const getFloat = (cashierId) =>
    floats[cashierId] !== undefined ? floats[cashierId] : '100.00'

  const setFloat = (cashierId, value) =>
    setFloats(f => ({ ...f, [cashierId]: value }))

  const { mutate, isPending } = useMutation({
    mutationFn: (payload) => closeSheet(sheetId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todaySummary'] })
      queryClient.invalidateQueries({ queryKey: ['lockStatus'] })
      onSuccess?.()
      onClose()
    },
    onError: (err) => {
      const data = err.response?.data
      if (data?.errors) {
        setError(data.errors.join(' · '))
      } else {
        setError(data?.detail || 'Failed to close sheet.')
      }
    },
  })

  const handleClose = () => {
    setError('')
    const floatsPayload = cashiers.map(c => ({
      cashier_id:    c.id,
      opening_float: parseFloat(getFloat(c.id)) || 100,
    }))
    mutate({ floats: floatsPayload })
  }

  const revenue = summary?.revenue || {}
  const jobs    = summary?.jobs    || {}
  const meta    = summary?.meta    || {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
      bg-black/40 p-4 animate-fadeIn">
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-md
        flex flex-col overflow-hidden animate-slideUp">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4
          border-b border-[var(--border)]">
          <div>
            <div className="font-bold text-lg text-[var(--text)]">Close Day Sheet</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">
              {meta.sheet_number} · {meta.date}
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
              hover:bg-[var(--bg)] text-[var(--text-3)] transition-colors">
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">

          {/* Summary snapshot */}
          <div className="bg-[var(--bg)] border border-[var(--border)]
            rounded-xl p-4 space-y-2">
            <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
              tracking-widest mb-3">Day Summary</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Cash',  value: fmt(revenue.cash),  color: 'text-emerald-600' },
                { label: 'MoMo',  value: fmt(revenue.momo),  color: 'text-amber-600'  },
                { label: 'Total', value: fmt(revenue.total), color: 'text-[var(--text)]' },
                { label: 'Jobs',  value: jobs.total ?? '—',  color: 'text-blue-600'   },
              ].map(item => (
                <div key={item.label}>
                  <div className="text-[10px] text-[var(--text-3)] uppercase
                    tracking-wider">{item.label}</div>
                  <div className={`font-mono font-black text-lg ${item.color}`}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tomorrow's floats */}
          <div>
            <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
              tracking-widest mb-3">Set Tomorrow's Opening Float</div>
            {cashiers.length === 0 ? (
              <div className="text-sm text-[var(--text-3)] text-center py-4">
                No active cashiers found
              </div>
            ) : (
              <div className="space-y-2">
                {cashiers.map(cashier => (
                  <div key={cashier.id}
                    className="flex items-center justify-between gap-3
                      bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">
                        {cashier.full_name}
                      </div>
                      <div className="text-xs text-[var(--text-3)]">Cashier</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-3)]">GHS</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={getFloat(cashier.id)}
                        onChange={e => setFloat(cashier.id, e.target.value)}
                        className="w-24 px-2 py-1.5 text-sm font-mono bg-[var(--panel)]
                          border border-[var(--border)] rounded-lg outline-none
                          focus:border-[var(--border-dark)] text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="px-3 py-2.5 bg-[var(--amber-bg)] border
            border-[var(--amber-border)] rounded-xl">
            <p className="text-xs text-[var(--amber-text)]">
              ⚠ This action is irreversible. The sheet will be closed and
              all totals frozen. Ensure all cashiers have signed off.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2.5 bg-[var(--red-bg)] border
              border-[var(--red-border)] rounded-xl">
              <p className="text-xs text-[var(--red-text)]">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2 flex items-center justify-end gap-3 shrink-0
          border-t border-[var(--border)]">
          <button onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)]
              hover:text-[var(--text)] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleClose}
            disabled={isPending}
            className="px-5 py-2.5 bg-[var(--text)] text-white text-sm font-bold
              rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
            {isPending ? 'Closing...' : 'Close Day Sheet'}
          </button>
        </div>

      </div>
    </div>
  )
}