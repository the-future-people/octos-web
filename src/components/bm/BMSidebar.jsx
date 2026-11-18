// src/components/bm/BMSidebar.jsx
import { useEffect, useState } from 'react'
import NavBadge, { NavDot } from '../shared/NavBadge'
import useInboxBadge from '../../hooks/useInboxBadge'
import OnShift from './OnShift'
import { ICONS } from './navIcons'

// The Inbox always has a thin line round it (15 Nov 2026), and its colour
// says one thing: grey, Octos is handling it; green, unread chats; amber, a
// customer needs a person; thick red once they've waited 5 minutes.
const LATE_MS = 5 * 60 * 1000
const LINE = {
  calm:    { color: 'color-mix(in srgb, var(--text-3) 45%, transparent)', width: 1, title: 'Octos is handling the inbox' },
  unread:  { color: '#16A34A', width: 1, title: 'Unread chats' },
  waiting: { color: '#D97706', width: 1.5, title: 'A customer needs a person' },
  late:    { color: '#CC0000', width: 2.5, title: 'A customer has waited over 5 minutes for a person' },
}

function inboxLine({ unread, needs, waitingSince }, now) {
  if (needs) return waitingSince && now - new Date(waitingSince).getTime() >= LATE_MS ? 'late' : 'waiting'
  return unread ? 'unread' : 'calm'
}

// The line's style for a menu item: only the Inbox has one.
function lineStyle(id, state) {
  if (id !== 'inbox') return undefined
  const { color, width } = LINE[state]
  return { boxShadow: `inset 0 0 0 ${width}px ${color}` }
}

export default function BMSidebar({ sections, active, onNavigate, mobileOpen, onMobileClose }) {
  // The inbox's badge: unread chats, and chats Octos asked a person to take.
  const badge = useInboxBadge()
  // A clock for the line, so amber turns red at 5 minutes without waiting for new data.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])
  const line = inboxLine(badge, now)
  const SidebarContent = ({ collapsed = false }) => (
    <div className="pt-3">
      {sections.map(section => (
        <div key={section.group}>
          {!collapsed && (
            <div className="px-5 pt-3 pb-1">
              <span className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest">
                {section.group}
              </span>
            </div>
          )}
          {section.items.map(item => (
            <div key={item.id}>
              {/* Full — md+ */}
              <div className="hidden md:block px-3 py-0.5">
                <button
                  onClick={() => onNavigate(item.id)}
                  style={lineStyle(item.id, line)}
                  title={item.id === 'inbox' ? LINE[line].title : undefined}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm
                    transition-colors text-left rounded-lg
                    ${active === item.id
                      ? 'octos-nav-active'
                      : 'text-[var(--text-2)] hover:bg-[var(--bg)] font-medium'
                    }`}
                >
                  <span className="shrink-0">{ICONS[item.icon]}</span>
                  {item.label}
                  {item.id === 'inbox' && <NavBadge {...badge} />}
                </button>
              </div>
              {/* Icon only — sm collapsed */}
              <div className="hidden sm:block md:hidden">
                <button
                  onClick={() => onNavigate(item.id)}
                  title={item.id === 'inbox' ? `${item.label}: ${LINE[line].title}` : item.label}
                  style={lineStyle(item.id, line)}
                  className={`relative w-full flex items-center justify-center py-3
                    transition-colors
                    ${active === item.id
                      ? 'octos-nav-active octos-nav-icon'
                      : 'text-[var(--text-2)] hover:bg-[var(--bg)]'
                    }`}
                >
                  {ICONS[item.icon]}
                  {item.id === 'inbox' && <NavDot {...badge} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-20 md:hidden"
            onClick={onMobileClose}
          />
          <div className="fixed top-14 left-0 bottom-0 w-52 bg-[var(--panel)]
            border-r border-[var(--border)] z-30 md:hidden overflow-y-auto pt-2 flex flex-col">
            {sections.map(section => (
              <div key={section.group}>
                <div className="px-5 pt-3 pb-1">
                  <span className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest">
                    {section.group}
                  </span>
                </div>
                {section.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    style={lineStyle(item.id, line)}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm
                      transition-colors text-left
                      ${active === item.id
                        ? 'octos-nav-active'
                        : 'text-[var(--text-2)] hover:bg-[var(--bg)] font-medium'
                      }`}
                  >
                    <span className="shrink-0">{ICONS[item.icon]}</span>
                    {item.label}
                    {item.id === 'inbox' && <NavBadge {...badge} />}
                  </button>
                ))}
              </div>
            ))}
            <div className="mt-auto pt-3"><OnShift /></div>
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden sm:flex md:w-52 sm:w-12 shrink-0 bg-[var(--panel)]
        border-r border-[var(--border)] flex-col overflow-y-auto">
        {/* Full labels md+ */}
        <div className="hidden md:flex flex-col min-h-full">
          <SidebarContent collapsed={false} />
          {/* Outside SidebarContent, so its open/closed state survives re-renders */}
          <div className="mt-auto pt-3"><OnShift /></div>
        </div>
        {/* Icons only sm */}
        <div className="md:hidden pt-3">
          {sections.map((section, sIdx) => (
            <div key={section.group}>
              {sIdx > 0 && (
                <div className="px-3 pt-2 pb-1">
                  <div className="h-px bg-[var(--border)]" />
                </div>
              )}
              {section.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={item.id === 'inbox' ? `${item.label}: ${LINE[line].title}` : item.label}
                  style={lineStyle(item.id, line)}
                  className={`relative w-full flex items-center justify-center py-3
                    transition-colors
                    ${active === item.id
                      ? 'octos-nav-active octos-nav-icon'
                      : 'text-[var(--text-2)] hover:bg-[var(--bg)]'
                    }`}
                >
                  {ICONS[item.icon]}
                  {item.id === 'inbox' && <NavDot {...badge} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}