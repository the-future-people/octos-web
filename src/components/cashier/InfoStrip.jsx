// src/components/cashier/InfoStrip.jsx
// Polls shift status every 60s. Shows sheet no, date, shift end, opening float.

import { useQuery } from '@tanstack/react-query'
import { getShiftStatus } from '../../api/cashier'

function fmt(amount) {
  return `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

export default function InfoStrip() {
  const { data } = useQuery({
    queryKey: ['shiftStatus'],
    queryFn: () => getShiftStatus().then(r => r.data),
    refetchInterval: 60_000,
  })

  const sheetNumber  = data?.sheet_number  || '—'
  const date         = data?.date          || '—'
  const shiftEnd     = data?.shift_end     || '—'
  const openingFloat = data?.opening_float != null ? fmt(data.opening_float) : '—'
  const timeLeft     = data?.time_remaining_label || null

  return (
    <div className="bg-[var(--panel)] border-b border-[var(--border)] px-6 py-3
      flex items-center gap-6 text-sm shrink-0">

      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Sheet</span>
        <span className="font-mono font-bold text-[var(--text)] mt-0.5">{sheetNumber}</span>
      </div>

      <div className="w-px h-8 bg-[var(--border)]" />

      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Date</span>
        <span className="font-semibold text-[var(--text)] mt-0.5">{date}</span>
      </div>

      <div className="w-px h-8 bg-[var(--border)]" />

      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Shift Ends</span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-semibold text-[var(--text)]">{shiftEnd}</span>
          {timeLeft && (
            <span className="text-[10px] font-bold text-[var(--amber-text)] bg-[var(--amber-bg)]
              border border-[var(--amber-border)] px-1.5 py-0.5 rounded">
              {timeLeft}
            </span>
          )}
        </div>
      </div>

      <div className="w-px h-8 bg-[var(--border)]" />

      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Opening Float</span>
        <span className="font-semibold text-[var(--text)] mt-0.5">{openingFloat}</span>
      </div>

    </div>
  )
}
