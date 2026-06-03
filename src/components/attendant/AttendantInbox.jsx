// src/components/attendant/AttendantInbox.jsx
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'

function timeAgo(iso) {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (d < 1)    return 'Just now'
  if (d < 60)   return `${d}m ago`
  if (d < 1440) return `${Math.floor(d / 60)}h ago`
  return `${Math.floor(d / 1440)}d ago`
}

export default function AttendantInbox() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['attendant-inbox'],
    queryFn:  () => client.get('/api/v1/notifications/')
      .then(r => { const d = r.data; return Array.isArray(d) ? d : (d?.results || []) })
      .catch(() => []),
    staleTime: 30_000,
  })

  const unread = data.filter(n => !n.is_read).length

  return (
    <div className="p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[var(--text)]">Inbox</h2>
        <p className="text-xs text-[var(--text-3)] mt-0.5">
          {unread > 0 ? `${unread} unread` : 'All caught up'}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          flex flex-col items-center justify-center py-16">
          <div className="w-12 h-12 bg-[var(--bg)] rounded-xl flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--text-2)]">No messages</p>
          <p className="text-xs text-[var(--text-3)] mt-1">Notifications will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map(n => (
            <div key={n.id}
              className={`bg-[var(--panel)] border rounded-xl px-5 py-4
                ${!n.is_read ? 'border-blue-200 bg-blue-50/30' : 'border-[var(--border)]'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {!n.is_read && (
                    <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full mb-1" />
                  )}
                  <div className="text-sm text-[var(--text)]">{n.message}</div>
                </div>
                <span className="text-[10px] text-[var(--text-3)] shrink-0">
                  {timeAgo(n.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}