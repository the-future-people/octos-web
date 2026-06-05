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

  const isSignedOff  = data?.float_status === 'SIGNED_OFF' || data?.is_signed_off
  const sheetNumber  = data?.sheet_number  || '—'
  const date         = data?.has_shift
    ? new Date().toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
    : '—'
  const shiftEnd     = data?.shift_end     || '—'
  const openingFloat = data?.opening_float != null ? fmt(data.opening_float) : '—'
  const timeLeft     = data?.time_remaining_label || null
  const signedOffAt  = data?.signed_off_at
    ? new Date(data.signed_off_at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
    : null

  // ── Signed-off state ──────────────────────────────────────────────────────
  if (isSignedOff) {
    return (
      <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-3
        flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 bg-emerald-100 rounded-full flex items-center
            justify-center text-emerald-600 text-sm">✓</span>
          <div>
            <div className="text-sm font-black text-emerald-800">Shift Complete</div>
            <div className="text-[10px] text-emerald-600 font-semibold">
              You have successfully signed off for today
              {signedOffAt ? ` at ${signedOffAt}` : ''}
            </div>
          </div>
        </div>

        <div className="w-px h-8 bg-emerald-200 hidden sm:block" />

        {[
          { label: 'Sheet',          value: sheetNumber },
          { label: 'Date',           value: date },
          { label: 'Opening Float',  value: openingFloat },
        ].map(item => (
          <div key={item.label} className="flex flex-col">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{item.label}</span>
            <span className="font-mono font-bold text-emerald-800 mt-0.5">{item.value}</span>
          </div>
        ))}

        <div className="ml-auto">
          <span className="text-[10px] font-bold px-3 py-1.5 bg-emerald-100
            border border-emerald-200 rounded-full text-emerald-700">
            Waiting for BM to close sheet
          </span>
        </div>
      </div>
    )
  }

  // ── Active shift state ────────────────────────────────────────────────────
  return (
    <div className="bg-[var(--panel)] border-b border-[var(--border)]">
      <div className="flex items-center gap-4 px-4 sm:px-6 py-2 mx-auto max-w-6xl
        overflow-x-auto whitespace-nowrap">

        <span className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider shrink-0">
          Sheet <span className="text-[var(--text)] normal-case font-semibold">{sheetNumber}</span>
        </span>

        <span className="text-[var(--text-3)]">·</span>

        <span className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider shrink-0">
          Date <span className="text-[var(--text)] normal-case font-semibold">{date}</span>
        </span>

        <span className="text-[var(--text-3)]">·</span>

        <span className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider shrink-0">
          Shift Ends <span className="text-[var(--text)] normal-case font-semibold">{shiftEnd}</span>
          {timeLeft && (
            <span className="ml-1.5 text-[10px] font-bold text-[var(--amber-text)]
              bg-[var(--amber-bg)] border border-[var(--amber-border)]
              px-1.5 py-0.5 rounded normal-case">
              {timeLeft}
            </span>
          )}
        </span>

        <span className="text-[var(--text-3)]">·</span>

        <span className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider shrink-0">
          Opening Float <span className="text-[var(--text)] normal-case font-semibold">{openingFloat}</span>
        </span>

      </div>
    </div>
  )
}
