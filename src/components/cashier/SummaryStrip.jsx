// src/components/cashier/SummaryStrip.jsx
// Revenue summary cards. Polls every 30s.

import { useQuery } from '@tanstack/react-query'
import { getCashierSummary } from '../../api/cashier'

function fmt(amount) {
  return `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

const CARDS = [
  { key: 'CASH',  label: 'Cash',            color: 'border-t-emerald-500', textColor: 'text-emerald-600' },
  { key: 'MOMO',  label: 'MoMo',            color: 'border-t-amber-400',   textColor: 'text-amber-600'   },
  { key: 'POS',   label: 'POS',             color: 'border-t-blue-500',    textColor: 'text-blue-600'    },
  { key: 'total', label: 'Total Collected', color: 'border-t-zinc-900',    textColor: 'text-zinc-900'    },
]

export default function SummaryStrip() {
  const { data } = useQuery({
    queryKey: ['cashierSummary'],
    queryFn: () => getCashierSummary().then(r => r.data),
    refetchInterval: 30_000,
  })

  return (
    <div className="grid grid-cols-4 gap-4 px-6 py-4 bg-[var(--bg)] border-b border-[var(--border)] shrink-0">
      {CARDS.map(card => {
        const entry  = data?.[card.key]
        const amount = entry?.total ?? 0
        const count  = entry?.count ?? 0

        return (
          <div
            key={card.key}
            className={`bg-[var(--panel)] border border-[var(--border)] border-t-4
              ${card.color} rounded-xl p-4`}
          >
            <div className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-2">
              {card.label}
            </div>
            <div className={`font-mono font-black text-xl ${card.textColor}`}>
              {fmt(amount)}
            </div>
            <div className="text-xs text-[var(--text-3)] mt-1">
              {count} transaction{count !== 1 ? 's' : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}
