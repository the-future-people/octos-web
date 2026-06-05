// src/components/cashier/InfoStrip.jsx
// Polls shift status every 60s. Shows sheet no, date, shift end, opening float.

import { useQuery } from '@tanstack/react-query'
import { useRef, useState, useEffect } from 'react'
import { getShiftStatus } from '../../api/cashier'

function InfoStripScroll({ items }) {
  const scrollRef = useRef(null)
  const [canLeft,  setCanLeft]  = useState(false)
  const [canRight, setCanRight] = useState(false)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 0)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [])

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 150, behavior: 'smooth' })
  }

  return (
    <div className="bg-[var(--panel)] border-b border-[var(--border)] shrink-0">
      <div className="max-w-6xl mx-auto flex items-center">
        {canLeft && (
          <button onClick={() => scroll(-1)}
            className="px-2 py-2.5 text-[var(--text-3)] hover:text-[var(--text)]
              transition-colors shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
        <div ref={scrollRef} onScroll={checkScroll}
          className="flex-1 flex items-center gap-5 px-4 py-2.5 text-xs
            overflow-x-auto whitespace-nowrap
            [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 shrink-0">
              <span className="font-bold text-[var(--text-3)] uppercase tracking-wider">
                {item.label}
              </span>
              <span className="font-semibold text-[var(--text)]">{item.value}</span>
              {item.extra}
            </div>
          ))}
        </div>
        {canRight && (
          <button onClick={() => scroll(1)}
            className="px-2 py-2.5 text-[var(--text-3)] hover:text-[var(--text)]
              transition-colors shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

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
  return <InfoStripScroll items={[
    { label: 'SHEET',         value: sheetNumber },
    { label: 'DATE',          value: date        },
    { label: 'SHIFT ENDS',    value: shiftEnd, extra: timeLeft ? (
      <span className="ml-1.5 text-[10px] font-bold text-[var(--amber-text)]
        bg-[var(--amber-bg)] border border-[var(--amber-border)]
        px-1.5 py-0.5 rounded">
        {timeLeft}
      </span>
    ) : null },
    { label: 'OPENING FLOAT', value: openingFloat },
  ]} />
}
