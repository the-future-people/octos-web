// src/components/cashier/NotificationBell.jsx
//
// The bell, in every portal's top bar (rebuilt 8 Nov 2026).
// - The menu is drawn on the page itself, positioned under the bell, not
//   inside the top bar: in the desktop app the bar is black and is the
//   window's drag area, and a menu inside it inherited both.
// - Clicking a notification opens what it is about (its link, or for older
//   ones the page it is clearly about) and marks it read. The portal listens
//   for 'octos:open' and shows that page.
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../api/notifications'

// Where a notification points: its link ("inbox/123", "inventory",
// "inbox?needs"), else what its words make plain.
function targetOf(n) {
  const link = (n.link || '').replace(/^\/+/, '')
  if (link) {
    const [path, query] = link.split('?')
    const [section, id] = path.split('/')
    return { section, id: id || null, filter: query || null }
  }
  const text = n.message || ''
  if (n.verb === 'stock_low' || /\b(low|toner|paper|ink)\b.*remaining/i.test(text)) return { section: 'inventory' }
  if (/^needs you/i.test(text) || n.verb === 'conversation_assigned' || n.verb === 'message_received')
    return { section: 'inbox', filter: 'needs' }
  if (/\bPFI-/i.test(text) || /proforma/i.test(text)) return { section: 'proformas' }
  if (/\bsheet\b|\bfloat\b|sign.?off/i.test(text)) return { section: 'daysheet' }
  if (/\bcredit\b|\boverdue\b/i.test(text)) return { section: 'customers' }
  if (/\bFP-[A-Z]+-\d+/i.test(text) || /\bjob\b/i.test(text)) return { section: 'jobs' }
  return null
}

export default function NotificationBell() {
  const [open,    setOpen]    = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [place,   setPlace]   = useState(null)
  const button      = useRef(null)
  const menu        = useRef(null)
  const queryClient = useQueryClient()

  // Close on a click anywhere but the bell and its menu.
  useEffect(() => {
    const handler = (e) => {
      if (button.current?.contains(e.target) || menu.current?.contains(e.target)) return
      setOpen(false)
      setShowAll(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Under the bell, right edges aligned; across the screen on a phone.
  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      const r = button.current?.getBoundingClientRect()
      if (!r) return
      const phone = window.innerWidth < 640
      setPlace(phone
        ? { top: r.bottom + 8, left: 8, right: 8 }
        : { top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right), width: 360 })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  const { data: countData } = useQuery({
    queryKey: ['notifCount'],
    queryFn:  () => getUnreadCount().then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 0,
  })

  const { data: notifsData, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => getNotifications().then(r => r.data),
    enabled:  open,
  })

  const unread    = countData?.count || 0
  const allNotifs = Array.isArray(notifsData) ? notifsData : (notifsData?.results || [])
  const notifs    = showAll ? allNotifs : allNotifs.slice(0, 5)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['notifCount'] })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }
  const { mutate: markRead } = useMutation({ mutationFn: (id) => markNotificationRead(id), onSuccess: refresh })
  const { mutate: markAll }  = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh })

  const openOne = (n) => {
    if (!n.is_read) markRead(n.id)
    const target = targetOf(n)
    if (target) {
      window.dispatchEvent(new CustomEvent('octos:open', { detail: target }))
      setOpen(false)
      setShowAll(false)
    }
  }

  return (
    <div className="relative">
      <button
        ref={button}
        onClick={() => setOpen(o => !o)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative w-8 h-8 flex items-center justify-center rounded-full
          hover:bg-[var(--bg)] text-[var(--text-2)] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
            bg-[#cc0000] text-white text-[9px] font-bold rounded-full
            flex items-center justify-center leading-none pointer-events-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && place && createPortal(
        <div ref={menu} role="dialog" aria-label="Notifications"
          style={{ position: 'fixed', zIndex: 10000, ...place }}
          className="bg-[var(--panel)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">

          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <span className="text-sm font-bold text-[var(--text)]">
              {unread > 0 ? `${unread} new` : 'Notifications'}
            </span>
            {unread > 0 && (
              <button onClick={() => markAll()}
                className="text-xs text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
                Mark all as read
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-[360px]">
            {isLoading && !notifsData ? (
              <div className="p-6 text-center text-sm text-[var(--text-3)]">Loading…</div>
            ) : allNotifs.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm font-semibold text-[var(--text-2)]">All caught up</p>
                <p className="text-xs text-[var(--text-3)] mt-1">Nothing needs you right now</p>
              </div>
            ) : (
              <>
                {notifs.map(n => {
                  const goes = !!targetOf(n)
                  return (
                    <button key={n.id} type="button" onClick={() => openOne(n)}
                      className={`w-full text-left px-4 py-3 border-b border-[var(--border)] last:border-0
                        transition-colors hover:bg-[var(--bg)] ${!n.is_read ? 'bg-[var(--red-bg)]' : ''}`}>
                      <div className="flex items-start gap-2.5">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.is_read ? 'bg-[#cc0000]' : 'bg-transparent'}`} />
                        <span className="flex-1 min-w-0">
                          <span className={`block text-xs leading-relaxed
                            ${!n.is_read ? 'text-[var(--text)] font-semibold' : 'text-[var(--text-2)]'}`}>
                            {n.message}
                          </span>
                          <span className="flex items-center gap-2 mt-1">
                            {n.actor_name && <span className="text-[10px] text-[var(--text-3)]">{n.actor_name}</span>}
                            <span className="text-[10px] text-[var(--text-3)]">{n.time_ago}</span>
                            {goes && <span className="ml-auto text-[10px] font-semibold text-[var(--text-2)]">Open →</span>}
                          </span>
                        </span>
                      </div>
                    </button>
                  )
                })}
                {allNotifs.length > 5 && !showAll && (
                  <button onClick={() => setShowAll(true)}
                    className="w-full py-3 text-xs font-semibold text-[var(--text-3)]
                      hover:text-[var(--text)] hover:bg-[var(--bg)] transition-colors border-t border-[var(--border)]">
                    Show {allNotifs.length - 5} more ↓
                  </button>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
