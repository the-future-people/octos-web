// src/components/cashier/NotificationBell.jsx
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../api/notifications'

// Re-export from bm api if needed — both use same endpoints

export default function NotificationBell() {
  const [open,    setOpen]    = useState(false)
  const [showAll, setShowAll] = useState(false)
  const ref         = useRef(null)
  const queryClient = useQueryClient()

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setShowAll(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Poll unread count every 30s
  const { data: countData } = useQuery({
    queryKey: ['notifCount'],
    queryFn:  () => getUnreadCount().then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 0,
  })

  // Load notifications only when dropdown is open
  const { data: notifsData, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => getNotifications().then(r => r.data),
    enabled:  open,
  })

  const unread    = countData?.count || 0
  const allNotifs = Array.isArray(notifsData) ? notifsData : (notifsData?.results || [])
  const notifs    = showAll ? allNotifs : allNotifs.slice(0, 5)

  const { mutate: markRead } = useMutation({
    mutationFn: (id) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifCount'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const { mutate: markAll } = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifCount'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return (
    <div className="relative" ref={ref}>

      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-8 h-8 flex items-center justify-center rounded-full
          hover:bg-[var(--bg)] text-[var(--text-2)] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>

        {/* Unread badge */}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
            bg-red-500 text-white text-[9px] font-bold rounded-full
            flex items-center justify-center leading-none pointer-events-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="fixed left-2 right-2 top-16 sm:absolute sm:left-auto sm:right-0
          sm:top-10 sm:w-[360px] bg-[var(--panel)]
          border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3
            border-b border-[var(--border)]">
            <span className="text-sm font-bold text-[var(--text)]">
              {unread > 0 ? `${unread} New Notifications` : 'Notifications'}
            </span>
            {unread > 0 && (
              <button
                onClick={() => markAll()}
                className="text-xs text-[var(--text-3)] hover:text-[var(--text)]
                  transition-colors">
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[360px]">
            {isLoading && !notifsData ? (
              <div className="p-6 text-center text-sm text-[var(--text-3)]">
                Loading…
              </div>
            ) : allNotifs.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm font-semibold text-[var(--text-2)]">All caught up</p>
                <p className="text-xs text-[var(--text-3)] mt-1">No notifications yet</p>
              </div>
            ) : (
              <>
                {notifs.map(n => (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markRead(n.id)}
                    className={`px-4 py-3 border-b border-[var(--border)] last:border-0
                      cursor-pointer transition-colors hover:bg-[var(--bg)]
                      ${!n.is_read ? 'bg-[var(--blue-bg)]' : ''}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0
                        ${!n.is_read ? 'bg-[var(--blue-text)]' : 'bg-transparent'}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed
                          ${!n.is_read
                            ? 'text-[var(--text)] font-semibold'
                            : 'text-[var(--text-2)]'}`}>
                          {n.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {n.actor_name && (
                            <span className="text-[10px] text-[var(--text-3)]">
                              {n.actor_name}
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--text-3)]">
                            {n.time_ago}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Show more */}
                {allNotifs.length > 5 && !showAll && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="w-full py-3 text-xs font-semibold text-[var(--text-3)]
                      hover:text-[var(--text)] hover:bg-[var(--bg)] transition-colors
                      border-t border-[var(--border)]">
                    Show {allNotifs.length - 5} more ↓
                  </button>
                )}
              </>
            )}
          </div>

        </div>
      )}
    </div>
  )
}