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

const MORE_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
  </svg>
)

function Tab({ icon, label, on, onClick, badge }) {
  return (
    <button onClick={onClick} aria-current={on ? 'page' : undefined}
      className={`relative flex-1 flex flex-col items-center justify-center gap-1 h-14 select-none
        ${on ? 'text-[var(--text)]' : 'text-[var(--text-3)]'}`}>
      {on && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-[#CC0000]" aria-hidden="true" />}
      <span className={`relative [&>svg]:w-[22px] [&>svg]:h-[22px] ${on ? '[&>svg]:stroke-[2.3]' : ''}`}>
        {icon}
        {badge}
      </span>
      <span className={`text-[10.5px] leading-none ${on ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </button>
  )
}

function InboxBadge({ unread = 0, needs = 0 }) {
  if (!unread && !needs) return null
  return (
    <span className={`absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#CC0000] text-white
      text-[10px] font-bold grid place-items-center ring-2 ring-[var(--panel)] ${needs ? 'octos-pulse' : ''}`}>
      {needs ? '!' : unread > 99 ? '99+' : unread}
    </span>
  )
}

export default function BMBottomBar({ sections, active, onNavigate }) {
  const [more, setMore] = useState(false)
  const badge = useInboxBadge()
  const items = sections.flatMap(s => s.items)
  const primary = PRIMARY.map(id => items.find(i => i.id === id)).filter(Boolean)
  const rest = items.filter(i => !PRIMARY.includes(i.id))
  const go = id => { setMore(false); onNavigate(id) }
  const onMore = !PRIMARY.includes(active)

  return (
    <>
      <nav aria-label="Pages"
        className="octos-bottombar sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--panel)] border-t border-[var(--border)]
          flex shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {primary.map(item => (
          <Tab key={item.id} icon={ICONS[item.icon]} label={item.label} on={active === item.id && !more}
            onClick={() => go(item.id)}
            badge={item.id === 'inbox' ? <InboxBadge {...badge} /> : null} />
        ))}
        <Tab icon={MORE_ICON} label="More" on={onMore || more} onClick={() => setMore(m => !m)} />
      </nav>

      {more && createPortal(
        <div className="sm:hidden fixed inset-0 z-[60]" role="dialog" aria-label="More pages">
          <div className="absolute inset-0 bg-black/35 animate-fadeIn" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-[var(--panel)] rounded-t-[22px] shadow-2xl animate-slideUp
            max-h-[85dvh] overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="w-10 h-1.5 rounded-full bg-[var(--border)]" aria-hidden="true" />
            </div>
            <div className="px-4 pt-1 pb-3 grid grid-cols-3 gap-2">
              {rest.map(item => (
                <button key={item.id} onClick={() => go(item.id)}
                  className={`flex flex-col items-center justify-center gap-2 h-[84px] rounded-2xl text-center px-1
                    ${active === item.id ? 'bg-[var(--text)] text-[var(--panel)]' : 'bg-[var(--bg)] text-[var(--text)]'}`}>
                  <span className="[&>svg]:w-[22px] [&>svg]:h-[22px]">{ICONS[item.icon]}</span>
                  <span className="text-[12px] font-semibold leading-tight">{item.label}</span>
                </button>
              ))}
            </div>
            <div className="px-2"><OnShift /></div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
