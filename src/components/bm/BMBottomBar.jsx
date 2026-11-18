// src/components/bm/BMBottomBar.jsx
//
// The Branch Manager's pages on a phone (18 Nov 2026): the four used most
// along the bottom, within thumb reach (Overview, Jobs, Inbox, Invoices),
// and "More" for the rest in a sheet that slides up. Phones only: from the
// width of a small tablet up, the sidebar is back.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ICONS } from './navIcons'
import OnShift from './OnShift'
import useInboxBadge from '../../hooks/useInboxBadge'

const PRIMARY = ['overview', 'jobs', 'inbox', 'proformas']

// Overview is a house on the phone's bar (Khofi's reference, 18 Nov 2026).
const HOME_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </svg>
)

const MORE_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
  </svg>
)

function Tab({ icon, label, on, onClick, badge }) {
  return (
    <button onClick={onClick} aria-current={on ? 'page' : undefined}
      className={`relative flex-1 flex flex-col items-center justify-center gap-1 h-[62px] select-none
        ${on ? 'text-[#D70015]' : 'text-[#6E6E73]'}`}>
      <span className={`relative [&>svg]:w-[25px] [&>svg]:h-[25px] ${on ? '[&>svg]:stroke-[2.4] [&_path]:fill-current [&_path]:fill-opacity-15' : '[&>svg]:stroke-[1.8]'}`}>
        {icon}
        {badge}
      </span>
      <span className={`text-[11px] leading-none ${on ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </button>
  )
}

function InboxBadge({ unread = 0, needs = 0 }) {
  if (!unread && !needs) return null
  return (
    <span className={`absolute -top-1 -right-3 min-w-[18px] h-[18px] px-[5px] rounded-full bg-[#FF3B30] text-white
      text-[12px] font-medium grid place-items-center ${needs ? 'octos-pulse' : ''}`}>
      {needs ? '!' : unread > 99 ? '99+' : unread}
    </span>
  )
}

// The "More" sheet, drawn to match the Overview (18 Nov 2026): a light grey
// sheet, the pages as white tiles in their groups (Khofi chose tiles over a
// list: everything on one screen), colour only in the small icon squares.
const TILE = {
  daysheet:    ['#DCE9FF', '#2563EB'],
  notes:       ['#F1F1F3', '#52525B'],
  performance: ['#D3F2DE', '#16A34A'],
  catalogue:   ['#E7DCFF', '#7C3AED'],
  staff:       ['#DCE9FF', '#2563EB'],
  inventory:   ['#FFEDB8', '#D97706'],
  customers:   ['#D3F2DE', '#16A34A'],
  reports:     ['#F1F1F3', '#52525B'],
}

function Tile({ id, icon, size = 38 }) {
  const [bg, ink] = TILE[id] || TILE.notes
  return (
    <span className="grid place-items-center shrink-0 rounded-[9px] [&>svg]:w-[18px] [&>svg]:h-[18px]"
      style={{ width: size, height: size, background: bg, color: ink }}>{icon}</span>
  )
}

function MoreSheet({ sections, active, onGo, onClose }) {
  const groups = sections
    .map(s => ({ title: s.group, items: s.items.filter(i => !PRIMARY.includes(i.id) && i.id !== 'overview') }))
    .filter(g => g.items.length)
  return (
    <div className="sm:hidden fixed inset-0 z-[60]" role="dialog" aria-label="More pages">
      <div className="absolute inset-0 bg-black/30 animate-fadeIn" onClick={onClose} />
      <div className="ios absolute inset-x-0 bottom-0 rounded-t-[22px] shadow-2xl animate-slideUp max-h-[88dvh] overflow-y-auto"
        style={{ background: '#F2F2F7', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        <div className="flex justify-center pt-2"><span className="w-9 h-[5px] rounded-full bg-black/15" aria-hidden="true" /></div>
        <div className="flex items-center justify-between px-5 pt-2 pb-1">
          <h2 className="text-[22px] font-bold tracking-[-0.01em] text-[#111]">More</h2>
          <button onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-full bg-black/[0.06] grid place-items-center text-[#6E6E73]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        {groups.map(g => (
          <section key={g.title} className="px-4 pt-3">
            <div className="px-1 pb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-[#8A8A8E]">
              {g.title.charAt(0) + g.title.slice(1).toLowerCase()}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {g.items.map(item => (
                <button key={item.id} onClick={() => onGo(item.id)}
                  className={`flex flex-col items-center justify-center gap-2 h-[92px] rounded-[16px] bg-white px-1 text-center
                    shadow-[0_2px_10px_rgba(17,24,39,0.04)] border active:scale-[0.97] transition-transform
                    ${active === item.id ? 'border-[#D70015]/40' : 'border-black/[0.04]'}`}>
                  <Tile id={item.id} icon={ICONS[item.icon]} />
                  <span className="text-[13px] font-semibold leading-tight text-[#1C1C1E]">{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}

        <section className="px-4 pt-5">
          <div className="px-1 pb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-[#8A8A8E]">On shift</div>
          <OnShift light />
        </section>
      </div>
    </div>
  )
}

export default function BMBottomBar({ sections, active, onNavigate }) {
  const [more, setMore] = useState(false)
  const badge = useInboxBadge()
  const items = sections.flatMap(s => s.items)
  const primary = PRIMARY.map(id => items.find(i => i.id === id)).filter(Boolean)
  const go = id => { setMore(false); onNavigate(id) }
  const onMore = !PRIMARY.includes(active)

  return (
    <>
      <nav aria-label="Pages"
        className="octos-bottombar ios sm:hidden fixed inset-x-0 bottom-0 z-40 flex px-1 !bg-white border-t border-black/[0.08]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {primary.map(item => (
          <Tab key={item.id} icon={item.id === 'overview' ? HOME_ICON : ICONS[item.icon]} label={item.label} on={active === item.id && !more}
            onClick={() => go(item.id)}
            badge={item.id === 'inbox' ? <InboxBadge {...badge} /> : null} />
        ))}
        <Tab icon={MORE_ICON} label="More" on={onMore || more} onClick={() => setMore(m => !m)} />
      </nav>

      {more && createPortal(
        <MoreSheet sections={sections} active={active} onGo={go} onClose={() => setMore(false)} />,
        document.body,
      )}
    </>
  )
}
