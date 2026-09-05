// src/components/bm/MonthReview.jsx
// Every day of a month, inside the weekly filing that covers it.
//
// The branch manager is meant to look again at each day before filing.
// Twenty-six days is more than anyone reads carefully every time, so the
// checks point at the handful worth a second look and leave the rest
// alone. A flag is a suggestion, not an accusation: most flagged days are
// a large corporate order, and the answer is a sentence.

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'

const getMonthReview = (month, year) =>
  client.get(`/api/v1/finance/monthly-close/review/?month=${month}&year=${year}`)

const saveDayNote = (sheetId, body) =>
  client.post(`/api/v1/finance/sheets/${sheetId}/notes/`, { body })

const MONTH_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const money = (n) =>
  parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })

const shortDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
}

const dayLabel = (iso) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-GH', { weekday: 'short' })} ${d.getDate()}`
}

// Named by its dates rather than its number, and a week the month
// boundary cut in two is named by the part that falls in this month.
function weekLabel(w) {
  const from = new Date(w.date_from)
  const to   = new Date(w.date_to)
  if (w.date_from === w.date_to) {
    return `${from.getDate()} ${MONTH_SHORT[from.getMonth() + 1]}`
  }
  return from.getMonth() === to.getMonth()
    ? `${from.getDate()} – ${to.getDate()} ${MONTH_SHORT[to.getMonth() + 1]}`
    : `${from.getDate()} ${MONTH_SHORT[from.getMonth() + 1]} – ${to.getDate()} ${MONTH_SHORT[to.getMonth() + 1]}`
}

function isSplit(w) {
  const from = new Date(w.date_from)
  const to   = new Date(w.date_to)
  const monday = new Date(from)
  monday.setDate(from.getDate() - ((from.getDay() + 6) % 7))
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5)
  return from.getTime() !== monday.getTime() || to.getTime() !== saturday.getTime()
}

const FlagIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
)

const TickIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    className="text-emerald-700 shrink-0">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const WeekIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    className="text-[var(--text-3)] shrink-0">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const SplitIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    className="text-amber-700 shrink-0">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
)

/**
 * A flagged day carries its reason and a box to answer it on the same
 * row. Once written the note stays and the row turns green: a flag that
 * has been answered is not the same as one that has not, and not the
 * same as no flag at all. The answer is the record.
 */
function ReviewDay({ day, onSave, saving }) {
  const [draft, setDraft] = useState('')
  const flagged  = day.flags.length > 0
  const answered = day.notes.length > 0

  const tone = !flagged ? {}
    : answered
      ? { background: '#f4f8f4', borderLeft: '3px solid #7aab86' }
      : { background: '#fdf7ec', borderLeft: '3px solid #e0a82e' }

  return (
    <div style={tone} className="border-t border-[var(--border)]">
      <div className={`flex items-center gap-2.5 py-1.5 pr-3 ${flagged ? 'pl-[33px]' : 'pl-9'}`}>
        <span className="text-xs text-[var(--text)] w-[62px] shrink-0">{dayLabel(day.date)}</span>
        <span className="text-xs text-[var(--text-2)] w-[52px] shrink-0">{day.jobs} jobs</span>
        {flagged ? (
          <span className={`text-[11px] flex-1 min-w-0 flex items-center gap-1.5
            ${answered ? 'text-[var(--text-2)]' : 'text-amber-700'}`}>
            {answered ? <TickIcon /> : <FlagIcon />}
            <span className="truncate">
              {day.flags.join(' · ')}{answered ? ' — explained' : ''}
            </span>
          </span>
        ) : (
          <span className="font-mono text-[10px] text-[var(--text-3)] flex-1 min-w-0 truncate">
            cash {money(day.cash)} · momo {money(day.momo)}
          </span>
        )}
        <span className="font-mono text-xs text-[var(--text)] w-[76px] text-right shrink-0">
          {money(day.total)}
        </span>
      </div>

      {answered && (
        <div className="pl-[33px] pr-3 pb-2 space-y-1.5">
          {day.notes.map(n => (
            <div key={n.id}>
              <div className="text-[10px] text-[var(--text-3)]">
                {n.author} · {shortDate(n.created_at)}
              </div>
              <div className="text-xs text-[var(--text-2)] leading-relaxed">{n.body}</div>
            </div>
          ))}
        </div>
      )}

      {flagged && !answered && (
        <div className="pl-[33px] pr-3 pb-2.5">
          <textarea rows={2} value={draft} onChange={e => setDraft(e.target.value)}
            placeholder="Why was this day like this?"
            className="w-full px-2.5 py-1.5 text-xs bg-[var(--panel)] border
              border-[var(--border)] rounded-lg outline-none resize-none
              focus:border-[var(--border-dark)]" />
          <div className="flex justify-end mt-1.5">
            <button onClick={() => draft.trim() && onSave(day.sheet_id, draft.trim())}
              disabled={saving || !draft.trim()}
              className="px-3 py-1 text-[11px] font-bold border border-[var(--border-dark)]
                rounded-lg text-[var(--text-2)] hover:border-[var(--text-3)]
                disabled:opacity-40 transition-colors">
              {saving ? 'Saving…' : 'Save the note'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * A week holding an unanswered flag opens itself and shows amber; a clean
 * week stays shut and plain, so six collapsed rows say which two need
 * opening without opening any.
 */
function ReviewWeek({ week, onSave, savingId }) {
  const unanswered = week.days.filter(
    d => d.flags.length > 0 && d.notes.length === 0
  ).length
  const [open, setOpen] = useState(unanswered > 0)

  return (
    <div className={`border rounded-xl overflow-hidden mb-1.5
      ${unanswered > 0 ? 'border-amber-400' : 'border-[var(--border)]'}`}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background: week.flag_count > 0 ? '#fdf7ec' : '#fbf8ea' }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
          className={`text-[var(--text-3)] shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {isSplit(week) ? <SplitIcon /> : <WeekIcon />}
        <span className="text-[13px] font-semibold text-[var(--text)] flex-1 min-w-0 truncate">
          {weekLabel(week)}
          <span className="text-[var(--text-3)] font-normal text-[11px]">
            {' · '}week {week.week_number}
            {week.days.length === 1 ? ' · 1 day' : ''}
          </span>
        </span>
        {week.flag_count > 0 && (
          <span className="text-[11px] text-amber-700 flex items-center gap-1 shrink-0">
            <FlagIcon /> {week.flag_count}
          </span>
        )}
        <span className="text-xs text-[var(--text-2)] shrink-0 hidden sm:block">
          {week.jobs} jobs
        </span>
        <span className="font-mono text-xs font-bold text-emerald-700 w-[78px] text-right shrink-0">
          {money(week.total)}
        </span>
      </button>

      {open && (
        <div className="bg-[var(--panel)]">
          {week.days.map(d => (
            <ReviewDay key={d.sheet_id} day={d} onSave={onSave}
              saving={savingId === d.sheet_id} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function MonthReview({ month, year, onSummary }) {
  const queryClient = useQueryClient()
  const [savingId, setSavingId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['month-review', month, year],
    queryFn: () => getMonthReview(month, year).then(r => r.data),
    staleTime: 30_000,
  })

  const { mutate: save } = useMutation({
    mutationFn: ({ sheetId, body }) => saveDayNote(sheetId, body),
    onMutate: ({ sheetId }) => setSavingId(sheetId),
    onSettled: () => setSavingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['month-review', month, year] })
    },
  })

    const handleSave = (sheetId, body) => save({ sheetId, body })

  // Handed up so the month header can say how much is left, beside the
  // submit button. In an effect rather than during render: calling a
  // parent's setter while rendering forces an extra pass.
  const flaggedCount = data?.flagged_count ?? 0
  const openCount = (data?.weeks || []).reduce((n, w) =>
    n + w.days.filter(d => d.flags.length > 0 && d.notes.length === 0).length, 0)

  useEffect(() => {
    if (onSummary) onSummary({ flagged: flaggedCount, unexplained: openCount })
  }, [flaggedCount, openCount, onSummary])

  if (isLoading && !data) {
    return <div className="space-y-1.5">
      {[1,2,3].map(i => (
        <div key={i} className="h-11 bg-[var(--panel)] border border-[var(--border)]
          rounded-xl animate-pulse" />
      ))}
    </div>
  }

    const unexplained = (data?.weeks || []).reduce((n, w) =>
    n + w.days.filter(d => d.flags.length > 0 && d.notes.length === 0).length, 0)

  if (!data || data.weeks.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
          Every day this month
        </span>
        {data.flagged_count > 0 && (
          <span className="text-[11px] text-amber-700 flex items-center gap-1.5">
            <FlagIcon />
            {data.flagged_count} worth a look
            {unexplained > 0 && ` · ${unexplained} still unexplained`}
          </span>
        )}
      </div>

      {data.weeks.map(w => (
        <ReviewWeek key={`${w.week_number}-${w.date_from}`} week={w}
          onSave={handleSave} savingId={savingId} />
      ))}

      {data.unfiled_days.length > 0 && (
        <div className="mt-3 px-3 py-2.5 bg-[var(--red-bg)] border
          border-[var(--red-border)] rounded-xl">
          <div className="text-xs font-bold text-[var(--red-text)]">
            {data.unfiled_days.length} day
            {data.unfiled_days.length === 1 ? '' : 's'} belong to no weekly filing
          </div>
          <div className="text-[11px] text-[var(--red-text)] mt-0.5">
            {data.unfiled_days.map(d => shortDate(d.date)).join(', ')} — file the
            week before closing the month.
          </div>
        </div>
      )}
    </div>
  )
}