// src/components/cashier/TodaysLog.jsx
// Chronological audit trail of the cashier's shift.
// Combines: float events, payment confirmations, credit settlements.

import { useQuery } from '@tanstack/react-query'
import { getShiftStatus, getCashierReceipts } from '../../api/cashier'

function fmt(amount) {
  return `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function timeStr(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString('en-GH', {
    hour: '2-digit', minute: '2-digit'
  })
}

const EVENT_TYPES = {
  SHIFT_START: {
    color: 'bg-[var(--green-bg)] border-[var(--green-border)]',
    dot:   'bg-[var(--green-text)]',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  SHIFT_END: {
    color: 'bg-[var(--blue-bg)] border-[var(--blue-border)]',
    dot:   'bg-[var(--blue-text)]',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    ),
  },
  PAYMENT: {
    color: 'bg-[var(--panel)] border-[var(--border)]',
    dot:   'bg-[var(--text-3)]',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="6" width="20" height="12" rx="2"/>
        <path d="M22 10H2M6 14h.01"/>
      </svg>
    ),
  },
  CREDIT: {
    color: 'bg-[var(--amber-bg)] border-[var(--amber-border)]',
    dot:   'bg-[var(--amber-text)]',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
}

export default function TodaysLog() {
  const today = new Date().toISOString().split('T')[0]

  const { data: shiftData } = useQuery({
    queryKey: ['shiftStatus'],
    queryFn: () => getShiftStatus().then(r => r.data),
  })

  const { data: receiptsData, isLoading } = useQuery({
    queryKey: ['cashierReceipts', today],
    queryFn: () => getCashierReceipts({ date: today }).then(r => r.data),
    refetchInterval: 30_000,
  })

  const receipts = Array.isArray(receiptsData)
    ? receiptsData
    : (receiptsData?.results || [])

  // Build unified event timeline
  const events = []

  // Float acknowledgement — shift start
  if (shiftData?.acknowledged_at || shiftData?.opening_float != null) {
    events.push({
      type     : 'SHIFT_START',
      time     : shiftData?.acknowledged_at || shiftData?.sheet_date + 'T08:00:00',
      title    : 'Shift started',
      subtitle : `Opening float: ${fmt(shiftData?.opening_float)}`,
      amount   : null,
    })
  }

  // Payment receipts
  receipts.forEach(r => {
    events.push({
      type    : 'PAYMENT',
      time    : r.created_at,
      title   : `Payment confirmed — ${r.receipt_number}`,
      subtitle: `${r.job_number} · ${r.job_title || 'Instant job'} · ${r.payment_method}`,
      amount  : r.amount_paid,
    })
  })

  // Shift sign-off
  if (shiftData?.signed_off_at) {
    events.push({
      type    : 'SHIFT_END',
      time    : shiftData.signed_off_at,
      title   : 'Shift signed off',
      subtitle: `Closing float submitted`,
      amount  : null,
    })
  }

  // Sort by time ascending
  events.sort((a, b) => new Date(a.time) - new Date(b.time))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Today's Log</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            Chronological record of your shift — {today}
          </p>
        </div>
        <div className="px-3 py-1 bg-[var(--panel)] border border-[var(--border)]
          rounded-full text-sm font-semibold text-[var(--text-2)]">
          {events.length} events
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-14 bg-[var(--panel)] border border-[var(--border)]
              rounded-xl animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-[var(--bg)] flex items-center
            justify-center mb-3">
            <svg className="w-5 h-5 text-[var(--text-3)]" fill="none"
              stroke="currentColor" viewBox="0 0 24 24">
              <line x1="8" y1="6" x2="21" y2="6" strokeWidth="2"/>
              <line x1="8" y1="12" x2="21" y2="12" strokeWidth="2"/>
              <line x1="8" y1="18" x2="21" y2="18" strokeWidth="2"/>
              <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="2"/>
              <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="2"/>
              <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="2"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--text-2)]">No events yet</p>
          <p className="text-xs text-[var(--text-3)] mt-1">
            Events will appear here as your shift progresses
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-4 bottom-4 w-px bg-[var(--border)]" />

          <div className="space-y-2">
            {events.map((event, idx) => {
              const style = EVENT_TYPES[event.type] || EVENT_TYPES.PAYMENT
              return (
                <div key={idx} className="flex gap-3 items-start">

                  {/* Dot */}
                  <div className={`w-9 h-9 rounded-full border flex items-center
                    justify-center shrink-0 relative z-10 ${style.color}`}>
                    <span className={`text-current`} style={{
                      color: event.type === 'SHIFT_START' ? 'var(--green-text)'
                           : event.type === 'SHIFT_END'   ? 'var(--blue-text)'
                           : event.type === 'CREDIT'      ? 'var(--amber-text)'
                           : 'var(--text-3)'
                    }}>
                      {style.icon}
                    </span>
                  </div>

                  {/* Content */}
                  <div className={`flex-1 rounded-xl border px-4 py-2.5 ${style.color}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text)] truncate">
                          {event.title}
                        </div>
                        <div className="text-xs text-[var(--text-3)] mt-0.5 truncate">
                          {event.subtitle}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {event.amount && (
                          <div className="font-mono font-bold text-sm text-[var(--text)]">
                            {fmt(event.amount)}
                          </div>
                        )}
                        <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                          {timeStr(event.time)}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}