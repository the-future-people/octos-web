// src/components/bm/OnShift.jsx
//
// "On shift" at the foot of the manager's menu (15 Nov 2026): everyone who
// signed in today. Folded, a row of faces and a count; opened, a sideways
// strip of cards, three at a time, active first, then idle, then signed off.
// The server decides each state (accounts/on_shift.py); this only draws it.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'

const OPEN_KEY = 'octos.onshift.open'

// A face's colours by role: attendants teal, cashiers amber, operators
// purple, everyone else grey. Translucent, so they read in dark mode too.
const FACE = {
  ATTENDANT: { bg: 'rgba(29, 158, 117, 0.16)', fg: '#0F6E56' },
  CASHIER:   { bg: 'rgba(239, 159, 39, 0.20)', fg: '#854F0B' },
  OPERATOR:  { bg: 'rgba(127, 119, 221, 0.18)', fg: '#3C3489' },
}
const GREY = { bg: 'rgba(136, 135, 128, 0.18)', fg: '#5F5E5A' }
const DOT = { active: '#1D9E75', idle: '#B4B2A9' }

const getOnShift = () => client.get('/api/v1/accounts/on-shift/').then(r => r.data)

function wasOpen() {
  try { return localStorage.getItem(OPEN_KEY) !== '0' } catch { return true }
}

function Face({ person, size = 30, ring }) {
  const c = FACE[person.role] || GREY
  return (
    <div className="relative shrink-0 rounded-full grid place-items-center font-bold"
      style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: size * 0.4,
               boxShadow: ring ? '0 0 0 1.5px var(--panel)' : undefined }}>
      {person.initial}
      {!ring && DOT[person.state] && (
        <span className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full"
          style={{ background: DOT[person.state], boxShadow: '0 0 0 2px var(--panel)' }} />
      )}
    </div>
  )
}

export default function OnShift() {
  const [open, setOpen] = useState(wasOpen)
  const { data, isError } = useQuery({
    queryKey: ['onShift'],
    queryFn: getOnShift,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: false,
  })
  if (isError || !data) return null

  const toggle = () => {
    setOpen(o => {
      try { localStorage.setItem(OPEN_KEY, o ? '0' : '1') } catch { /* private window */ }
      return !o
    })
  }
  const staff = data.staff || []
  const here = staff.filter(p => p.state !== 'off')

  return (
    <div className="border-t border-[var(--border)] px-3 pt-2.5 pb-3">
      <button onClick={toggle} aria-expanded={open}
        className="w-full flex items-center gap-2 px-1 pb-2 text-left">
        <span className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest whitespace-nowrap">On shift</span>
        <span className="text-[10.5px] text-[var(--text-3)] whitespace-nowrap">{data.on} of {data.total}</span>
        {!open && here.length > 0 && (
          <span className="ml-auto flex">
            {here.slice(0, 4).map((p, i) => (
              <span key={p.id} style={{ marginLeft: i ? -6 : 0 }}><Face person={p} size={20} ring /></span>
            ))}
          </span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`${open || !here.length ? 'ml-auto' : ''} text-[var(--text-3)] transition-transform ${open ? '' : 'rotate-180'}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (staff.length === 0 ? (
        <p className="px-1 text-[11px] text-[var(--text-3)]">Nobody else has signed in yet today.</p>
      ) : (
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'thin' }}>
          {staff.map(p => (
            <div key={p.id} title={`${p.name} · ${p.label}`}
              className="snap-start shrink-0 min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-1 pt-2 pb-1.5 text-center"
              style={{ flexBasis: 'calc((100% - 12px) / 3)', opacity: p.state === 'off' ? 0.55 : 1 }}>
              <div className="flex justify-center mb-1"><Face person={p} /></div>
              <div className="text-[11.5px] font-semibold text-[var(--text)] truncate">{p.name}</div>
              <div className="text-[10px] text-[var(--text-3)] truncate">{p.label}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
