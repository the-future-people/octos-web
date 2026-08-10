// src/components/bm/StrandedSheetsCard.jsx
// Surfaces days that were never closed. One unclosed sheet strands every
// day after it, because the next day's float is only staged during close —
// so this needs to be unavoidable rather than tucked away in Reports.

import { useQuery } from '@tanstack/react-query'
import { getStrandedSheets } from '../../api/bm'

function fmt(amount) {
  return `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function fmtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function StrandedSheetsCard({ onRecover }) {
  const { data, isLoading } = useQuery({
    queryKey: ['strandedSheets'],
    queryFn:  () => getStrandedSheets().then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 0,
  })

  if (isLoading || !data) return null
  if (data.stranded_count === 0) return null

  const blocked = data.requires_rm

  return (
    <div className={`bg-[var(--panel)] border-2 rounded-xl overflow-hidden mb-5
      ${blocked ? 'border-red-300' : 'border-amber-300'}`}>

      <div className={`px-5 py-4 ${blocked ? 'bg-red-50' : 'bg-amber-50'}`}>
        <div className="flex items-center gap-2">
          <span className={blocked ? 'text-red-500' : 'text-amber-500'}>
            {blocked ? '\u26a0' : '\u23f0'}
          </span>
          <div className={`font-bold text-base ${blocked ? 'text-red-900' : 'text-amber-900'}`}>
            {data.stranded_count} day{data.stranded_count !== 1 ? 's' : ''} not closed
          </div>
        </div>
        <div className={`text-xs mt-1 leading-relaxed ${blocked ? 'text-red-700' : 'text-amber-700'}`}>
          {blocked ? (
            <>
              This is beyond what a Branch Manager can settle alone. Your Regional
              Manager needs to review these before they can be closed. Until then,
              each new day opens without a float and the cashier cannot sign off.
            </>
          ) : (
            <>
              A day that never closed also never staged the next day&rsquo;s float.
              Settle these in order, oldest first — each one you close releases
              the day after it.
            </>
          )}
        </div>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {data.sheets.map(sheet => (
          <div key={sheet.sheet_id} className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-bold text-sm text-[var(--text)]">
                {fmtDate(sheet.date)}
              </div>
              <div className="text-xs text-[var(--text-3)] mt-0.5">
                {sheet.job_count} job{sheet.job_count !== 1 ? 's' : ''}
                {' · '}{fmt(sheet.total_revenue)} taken
                {sheet.cashier_name ? ` · ${sheet.cashier_name}` : ''}
              </div>
              <div className="text-xs text-[var(--text-3)] mt-0.5">
                Till should hold <strong className="text-[var(--text-2)] font-mono">
                  {fmt(sheet.expected_cash)}
                </strong>
              </div>
            </div>

            {!blocked && (
              <button
                onClick={() => onRecover?.(sheet)}
                className="shrink-0 px-4 py-2 bg-[var(--text)] text-white text-xs
                  font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                Settle this day
              </button>
            )}
          </div>
        ))}
      </div>

      {blocked && (
        <div className="px-5 py-3 bg-red-50 border-t border-red-200 text-xs text-red-800">
          A Branch Manager may settle up to {data.max_bm_days} days.
          Contact your Regional Manager to proceed.
        </div>
      )}
    </div>
  )
}