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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-3 bg-[var(--bg)]">
      {CARDS.map(card => {
        const entry  = data?.[card.key]
        const amount = entry?.total ?? 0
        const count  = entry?.count ?? 0

        return (
          <div
            key={card.key}
            className={`bg-[var(--panel)] border border-[var(--border)] border-t-2
              ${card.color} rounded-xl p-3`}
          >
            <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">
              {card.label}
            </div>
            <div className={`font-mono font-black text-base ${card.textColor}`}>
              {fmt(amount)}
            </div>
            <div className="text-[10px] text-[var(--text-3)] mt-0.5">
              {count} transaction{count !== 1 ? 's' : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}
