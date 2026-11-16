// src/components/bm/OnShift.jsx
//
// "On shift" at the foot of the menu (15 Nov 2026; redrawn 16 Nov 2026 and
// shared by the manager's and the attendant's portals): everyone who signed
// in today. Folded, a dark tile with overlapping photos, a "+N", how many are
// in, and who is idle, on break or signed off.
// Clicked, a panel opens beside the menu with everyone grouped: working now,
// on break, idle, signed off. The server decides each state
// (accounts/on_shift.py); this only draws it.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import StaffAvatar from '../shared/StaffAvatar'

const getOnShift = () => client.get('/api/v1/accounts/on-shift/').then(r => r.data)

const DOT = { active: '#22C55E', break: '#F59E0B', idle: '#A1A1AA', off: null }
const GROUPS = [
  { state: 'active', title: 'Working now' },
  { state: 'break',  title: 'On break' },
  { state: 'idle',   title: 'Idle' },
  { state: 'off',    title: 'Signed off' },
]
const STACK = 3
const PANEL_W = 280

function Face({ person, size, ring, dot = true }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <StaffAvatar person={{ ...person, full_name: person.name }} size={size} ring={ring} />
      {dot && DOT[person.state] && (
        <span className="absolute -right-0.5 -bottom-0.5 rounded-full"
          style={{ width: size * 0.32, height: size * 0.32, background: DOT[person.state], boxShadow: '0 0 0 2px var(--panel)' }} />
      )}
    </span>
  )
}

function Panel({ anchor, data, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)

  // Beside the menu; on a narrow screen, above the button instead.
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.current?.getBoundingClientRect()
      if (!r) return
      const beside = r.right + 10 + PANEL_W <= window.innerWidth
      setPos(beside
        ? { left: r.right + 10, bottom: Math.max(12, window.innerHeight - r.bottom) }
        : { left: Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 8)), bottom: window.innerHeight - r.top + 8 })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchor])

  useEffect(() => {
    const away = e => {
      if (ref.current?.contains(e.target) || anchor.current?.contains(e.target)) return
      onClose()
    }
    const esc = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [anchor, onClose])

  if (!pos) return null
  const staff = data.staff || []
  return createPortal(
    <div ref={ref} role="dialog" aria-label="On shift"
      className="animate-slideUp fixed z-50 rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl overflow-hidden"
      style={{ ...pos, width: PANEL_W, maxHeight: 'min(70vh, 520px)' }}>
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div>
          <div className="text-sm font-bold text-[var(--text)]">On shift today</div>
          <div className="text-[11px] text-[var(--text-3)]">{data.on} in · {data.total} signed in today</div>
        </div>
        <button onClick={onClose} aria-label="Close"
          className="w-7 h-7 rounded-full grid place-items-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg)]">✕</button>
      </div>
      <div className="overflow-y-auto px-2 pb-3" style={{ maxHeight: 'calc(min(70vh, 520px) - 60px)' }}>
        {staff.length === 0 && <p className="px-2 py-3 text-[12px] text-[var(--text-3)]">Nobody else has signed in yet today.</p>}
        {GROUPS.map(g => {
          const people = staff.filter(p => p.state === g.state)
          if (!people.length) return null
          return (
            <div key={g.state} className="mt-1.5">
              <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                {DOT[g.state] && <span className="w-1.5 h-1.5 rounded-full" style={{ background: DOT[g.state] }} />}
                {g.title} <span className="font-semibold">· {people.length}</span>
              </div>
              {people.map(p => (
                <div key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[var(--bg)]"
                  style={{ opacity: p.state === 'off' ? 0.6 : 1 }}>
                  <Face person={p} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-[var(--text)] truncate">{p.name}</div>
                    <div className="text-[11px] text-[var(--text-3)] truncate">{p.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>,
    document.body,
  )
}

export default function OnShift() {
  const [open, setOpen] = useState(false)
  const anchor = useRef(null)
  const { data, isError } = useQuery({
    queryKey: ['onShift'],
    queryFn: getOnShift,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: false,
  })
  if (isError || !data) return null

  const staff = data.staff || []
  const here = staff.filter(p => p.state !== 'off')
  const idle = staff.filter(p => p.state === 'idle').length
  const onBreak = staff.filter(p => p.state === 'break').length
  const faces = (here.length ? here : staff).slice(0, STACK)
  const more = (here.length ? here : staff).length - faces.length

  const off = staff.length - here.length
  const summary = [idle && `${idle} idle`, onBreak && `${onBreak} on break`, off && `${off} signed off`].filter(Boolean).join(' · ')

  // A dark tile, like Today's band, so who is here stands out from the menu (16 Nov 2026).
  return (
    <div className="px-3 pt-2 pb-3">
      <button ref={anchor} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="dialog"
        className={`w-full rounded-xl bg-[#111113] border border-white/10 p-2.5 text-left transition-shadow
          ${open ? 'ring-2 ring-[#22C55E]/60' : 'hover:ring-2 hover:ring-white/10'}`}>
        <span className="flex items-center justify-between mb-2">
          <span className="text-[10.5px] font-semibold text-[#A1A1AA]">On shift</span>
          <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#4ADE80]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />{data.on} in
          </span>
        </span>
        {staff.length === 0 ? (
          <span className="block text-[11px] text-[#A1A1AA]">Nobody else in yet</span>
        ) : (
          <>
            <span className="flex items-center">
              {faces.map((p, i) => (
                <span key={p.id} className="relative rounded-full"
                  style={{ marginLeft: i ? -6 : 0, zIndex: STACK - i, boxShadow: '0 0 0 2px #111113', opacity: p.state === 'off' ? 0.55 : 1 }}>
                  <Face person={p} size={26} dot={false} />
                </span>
              ))}
              {more > 0 && (
                <span className="relative grid place-items-center rounded-full bg-[#3F3F46] text-white text-[10px] font-bold"
                  style={{ width: 26, height: 26, marginLeft: -6, boxShadow: '0 0 0 2px #111113' }}>+{more}</span>
              )}
            </span>
            {summary && <span className="block mt-1.5 text-[10.5px] text-[#A1A1AA] truncate">{summary}</span>}
          </>
        )}
      </button>
      {open && <Panel anchor={anchor} data={data} onClose={() => setOpen(false)} />}
    </div>
  )
}
