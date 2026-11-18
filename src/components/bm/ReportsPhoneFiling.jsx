// src/components/bm/ReportsPhoneFiling.jsx
//
// Filing on a phone (18 Nov 2026): the weeks and the monthly close, the two
// things a branch manager has to send. The same calls as the Weekly and
// Monthly tabs of Reports.jsx, and the same review as MonthReview.jsx.
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { saveFile } from '../../api/saveFile'
import {
  AMBER, GREEN, MONTHS, RED, api, card, dayMonth, dayOf, errorOf, filingOpen, isSplit, isoOf, list, money, short, span,
  weekday, when,
} from './reportsKit'
import { Chevron, Empty, Figures, Pushed, RedButton, Sheet, Skeleton, Stepper, Svg, Tile, Title } from './ReportsPhoneUI'

const CalendarIcon = () => <Svg size={18} width={1.8} d={<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>} />
const SplitIcon = () => <Svg size={18} width={1.8} d={<><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></>} />
const FlagIcon = () => <Svg size={14} width={1.9} d={<><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></>} />
const TickIcon = ({ size = 14 }) => <Svg size={size} width={2.4} d={<polyline points="20 6 9 17 4 12" />} />
const PdfButton = ({ busy, onClick }) => (
  <button type="button" onClick={onClick} disabled={busy}
    className="w-full h-[50px] rounded-[16px] bg-white border border-black/[0.08] text-[16.5px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50" style={{ color: RED }}>
    <Svg d={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>} />
    {busy ? 'Building the PDF…' : 'Download PDF'}
  </button>
)

const today = () => isoOf(new Date())
// A draft can be filed once its days are closed and the week is over, or on
// Saturday or the month's last day after five.
const canFile = r => r.status === 'DRAFT' && r.all_sheets_closed && (r.date_to < today() || filingOpen())

function useWeeks() {
  return useQuery({
    queryKey: ['weekly-reports'],
    queryFn: () => api.weeks().then(r => list(r.data)),
    staleTime: 30_000,
  })
}

// ── Filing a week ─────────────────────────────────────────────────────────────
function SubmitWeek({ report, onClose, onDone }) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState(report.bm_notes || '')
  const [error, setError] = useState('')
  const send = useMutation({
    mutationFn: () => api.submitWeek(report.id, notes),
    onSuccess: () => {
      ['weekly-reports', 'outstanding-week', 'month-review'].forEach(k => queryClient.invalidateQueries({ queryKey: [k] }))
      onDone?.(); onClose()
    },
    onError: err => setError(errorOf(err, 'That week did not file. Try again.')),
  })
  return (
    <Sheet title="File the week" sub={`${span(report.date_from, report.date_to)} · week ${report.week_number}`} onClose={onClose}
      busy={send.isPending} error={error} action={{ label: 'File and lock', busy: 'Filing…', onClick: () => { setError(''); send.mutate() } }}>
      <div className="rounded-[16px] bg-white overflow-hidden">
        {[['Collected', money(report.total_collected)], ['Jobs', report.total_jobs_created ?? 0], ['Days', report.sheets_count ?? '—']].map(([k, v], i) => (
          <div key={k} className={`px-4 py-3 flex justify-between text-[15px] ${i ? 'border-t border-black/[0.06]' : ''}`}>
            <span className="text-[#6E6E73]">{k}</span><b className="tabular-nums">{v}</b>
          </div>
        ))}
      </div>
      <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="A note for Finance (optional)"
        className="w-full px-4 py-3 text-[16px] rounded-[16px] bg-white outline-none resize-none" />
      <p className="m-0 px-1 text-[13px] text-[#8A8A8E]">Filing locks the week. It cannot be changed afterwards.</p>
    </Sheet>
  )
}

// ── A week's page ─────────────────────────────────────────────────────────────
function WeekPage({ report, onClose }) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['weekly-detail', report.id],
    queryFn: () => api.week(report.id).then(r => r.data),
    staleTime: 60_000,
  })
  const r = { ...report, ...data }
  const draft = r.status === 'DRAFT'
  const [notes, setNotes] = useState(null)
  const [filing, setFiling] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [error, setError] = useState('')
  const saveNotes = useMutation({
    mutationFn: text => api.weekNotes(r.id, text),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['weekly-detail', r.id] }); queryClient.invalidateQueries({ queryKey: ['weekly-reports'] }) },
    onError: err => setError(errorOf(err, 'The note did not save.')),
  })
  const pdf = async () => {
    setPdfBusy(true); setError('')
    try {
      const res = await api.weekPdf(r.id)
      await saveFile(`weekly-${r.date_from}-to-${r.date_to}.pdf`, res.data)
    } catch { setError('Could not build that PDF.') } finally { setPdfBusy(false) }
  }
  const reg = r.total_jobs_registered || 0, walk = r.total_jobs_walkin || 0
  const regPct = reg + walk ? Math.round((reg / (reg + walk)) * 100) : null
  const used = (r.inventory_snapshot?.items || []).filter(i => parseFloat(i.consumed || 0) > 0)
  const services = r.top_services || []
  const days = r.daily_sheets || []
  const footer = draft
    ? (canFile(r) ? <RedButton onClick={() => setFiling(true)}>File the week</RedButton>
      : <p className="m-0 py-2 text-center text-[14px] text-[#8A8A8E]">{r.all_sheets_closed ? 'Files on Saturday after 5 pm.' : 'A day in this week is still open.'}</p>)
    : <PdfButton busy={pdfBusy} onClick={pdf} />

  return (
    <Pushed back="Weeks" title={`Week ${r.week_number}`} onBack={onClose} footer={footer} label="Week">
      <div className="px-5 pt-5">
        <div className="text-[14px] text-[#6E6E73]">Week {r.week_number}{isSplit(r) ? ' · split by the month' : ''}</div>
        <h1 className="m-0 text-[26px] leading-[32px] font-extrabold tracking-[-0.02em] text-[#111]">{span(r.date_from, r.date_to)}</h1>
        <div className="mt-1 text-[14px]" style={{ color: draft ? AMBER : GREEN }}>
          {draft ? 'Not filed yet' : `Filed ${when(r.submitted_at)}${r.submitted_by_name ? ` by ${r.submitted_by_name}` : ''}`}
        </div>
      </div>
      {error && <p className="m-0 mx-5 mt-2 text-[14px] text-[#B91C1C]">{error}</p>}

      <div className={`${card} mt-4`}>
        <div className="px-4 pt-3.5 pb-3">
          <div className="text-[13px] font-medium text-[#6E6E73]">Collected</div>
          <div className="text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] tabular-nums text-[#111]">{money(r.total_collected)}</div>
        </div>
        <Figures items={[['Cash', short(r.total_cash)], ['MoMo', short(r.total_momo)], ['POS', short(r.total_pos)]]} />
        <div className="px-4 py-3 border-t border-black/[0.06] flex justify-between text-[15px]">
          <span className="text-[#6E6E73]">Jobs</span><b className="tabular-nums">{r.total_jobs_created ?? 0}</b>
        </div>
      </div>

      {days.length > 0 && (
        <>
          <Title extra={<span className="text-[12.5px] text-[#8A8A8E]">{days.length} days</span>}>Days in it</Title>
          <div className={card}>
            {days.map((s, i) => (
              <div key={s.id} className={`px-4 py-3 flex items-center gap-3 ${i ? 'border-t border-black/[0.06]' : ''}`}>
                <span className="w-[74px] text-[15px] shrink-0">{weekday(s.date)} {dayMonth(s.date).split(' ')[0]}</span>
                <span className="flex-1 text-[13.5px] text-[#8A8A8E] tabular-nums">{s.total_jobs_created ?? 0} jobs{s.status === 'OPEN' ? <span style={{ color: RED }}> · still open</span> : ''}</span>
                <span className="text-[15px] font-semibold tabular-nums">{short(s.total_collected)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {regPct != null && (
        <>
          <Title>Who came in</Title>
          <div className={`${card} px-4 py-3.5`}>
            <div className="h-[8px] rounded-full overflow-hidden flex bg-[#EDEDF0]"><span className="h-full bg-[#1C1C1E]" style={{ width: `${regPct}%` }} /></div>
            <div className="mt-2 flex justify-between text-[13.5px]">
              <span><b className="tabular-nums">{regPct}%</b> <span className="text-[#6E6E73]">registered</span></span>
              <span><b className="tabular-nums">{100 - regPct}%</b> <span className="text-[#6E6E73]">walk-in</span></span>
            </div>
          </div>
        </>
      )}

      {services.length > 0 && (
        <>
          <Title>Top services</Title>
          <div className={card}>
            {services.map((s, i) => (
              <div key={s.name} className={`px-4 py-3 flex items-baseline gap-2 ${i ? 'border-t border-black/[0.06]' : ''}`}>
                <span className="w-5 text-[13px] font-semibold text-[#A1A1AA] tabular-nums">{i + 1}</span>
                <span className="flex-1 min-w-0 text-[15.5px] font-semibold truncate">{s.name}</span>
                <span className="text-[15px] font-semibold tabular-nums">{short(s.revenue)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {used.length > 0 && (
        <>
          <Title extra={<span className="text-[12.5px] text-[#8A8A8E]">{used.length} items</span>}>What was used</Title>
          <div className={card}>
            {used.map((u, i) => (
              <div key={u.consumable + i} className={`px-4 py-3 flex justify-between gap-3 text-[15px] ${i ? 'border-t border-black/[0.06]' : ''}`}>
                <span className="truncate">{u.consumable}</span><span className="tabular-nums text-[#6E6E73] shrink-0">−{parseFloat(u.consumed)} {u.unit}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <Title extra={draft && saveNotes.isPending ? <span className="text-[12.5px] text-[#8A8A8E]">Saving…</span> : null}>Notes for Finance</Title>
      {draft ? (
        <div className="mx-4">
          <textarea rows={3} value={notes ?? r.bm_notes ?? ''} onChange={e => setNotes(e.target.value)}
            onBlur={() => notes != null && notes !== (r.bm_notes || '') && saveNotes.mutate(notes)}
            placeholder="Anything Finance should know about this week"
            className="w-full px-4 py-3 text-[16px] rounded-[16px] bg-white border border-black/[0.04] outline-none resize-none" />
        </div>
      ) : (
        <div className={card}>{r.bm_notes ? <p className="m-0 px-4 py-3 text-[15px] text-[#3A3A3C] whitespace-pre-wrap">{r.bm_notes}</p> : <Empty>No notes were added.</Empty>}</div>
      )}

      {filing && <SubmitWeek report={{ ...r, bm_notes: notes ?? r.bm_notes }} onClose={() => setFiling(false)} onDone={onClose} />}
    </Pushed>
  )
}

// ── Weeks ─────────────────────────────────────────────────────────────────────
function WeekRow({ r, first, onOpen }) {
  const split = isSplit(r)
  return (
    <button type="button" onClick={() => onOpen(r)} className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-black/[0.03] ${first ? '' : 'border-t border-black/[0.06]'}`}>
      {split ? <Tile bg="#FFEDB8" ink={AMBER}><SplitIcon /></Tile> : <Tile bg="#DCE9FF" ink="#1D4ED8"><CalendarIcon /></Tile>}
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-semibold">{span(r.date_from, r.date_to)}</span>
        <span className="block text-[13px] text-[#8A8A8E] truncate">Week {r.week_number}{split ? ' · split by the month' : ''}{r.submitted_at ? ` · filed ${when(r.submitted_at)}` : ''}</span>
      </span>
      <span className="text-right shrink-0">
        <span className="block text-[15px] font-semibold tabular-nums">{short(r.total_collected)}</span>
        <span className="block text-[12.5px] text-[#8A8A8E] tabular-nums">{r.total_jobs_created ?? 0} jobs</span>
      </span>
      <Chevron />
    </button>
  )
}

export function WeeksTab() {
  const queryClient = useQueryClient()
  const { data: reports = [], isLoading } = useWeeks()
  const [open, setOpen] = useState(null)
  const [filing, setFiling] = useState(null)
  const [error, setError] = useState('')
  const prepare = useMutation({
    mutationFn: () => api.prepareWeek(),
    onSuccess: () => { setError(''); queryClient.invalidateQueries({ queryKey: ['weekly-reports'] }) },
    onError: err => setError(errorOf(err)),
  })
  if (isLoading) return <Skeleton rows={[120, 260]} />

  const drafts = reports.filter(r => r.status === 'DRAFT').sort((a, b) => a.date_from.localeCompare(b.date_from))
  const filed = reports.filter(r => r.status !== 'DRAFT')
  const now = new Date()
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const saturday = new Date(monday); saturday.setDate(monday.getDate() + 5)
  const thisWeekDrafted = drafts.some(r => r.date_to >= isoOf(monday))

  const months = []
  for (const r of [...filed].sort((a, b) => b.date_from.localeCompare(a.date_from))) {
    const key = r.date_from.slice(0, 7)
    if (!months.length || months[months.length - 1].key !== key) months.push({ key, weeks: [], total: 0 })
    const g = months[months.length - 1]
    g.weeks.push(r); g.total += parseFloat(r.total_collected || 0)
  }

  return (
    <>
      <Title>To file</Title>
      {error && <p className="m-0 mx-5 mb-2 text-[14px] text-[#B91C1C]">{error}</p>}
      <div className={card}>
        {drafts.map((r, i) => {
          const ready = canFile(r)
          const past = r.date_to < today()
          return (
            <div key={r.id} className={`px-4 py-3.5 ${i ? 'border-t border-black/[0.06]' : ''}`}>
              <button type="button" onClick={() => setOpen(r)} className="w-full flex items-center gap-3 text-left">
                <Tile bg={past ? '#FFE1E1' : '#FFEDB8'} ink={past ? RED : AMBER}><CalendarIcon /></Tile>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium" style={{ color: past ? RED : '#6E6E73' }}>{past ? 'Overdue' : 'This week'}</span>
                  <span className="block text-[16px] font-semibold">{span(r.date_from, r.date_to)}</span>
                  <span className="block text-[13px] text-[#8A8A8E] tabular-nums">{r.total_jobs_created || 0} jobs · {short(r.total_collected)}{!r.all_sheets_closed ? ' · a day is still open' : ''}</span>
                </span>
                <Chevron />
              </button>
              {ready
                ? <div className="mt-3"><RedButton onClick={() => setFiling(r)}>File the week</RedButton></div>
                : <p className="m-0 mt-2.5 text-[13.5px] text-[#8A8A8E]">{r.all_sheets_closed ? 'Files on Saturday after 5 pm.' : 'Close the open day first, then file.'}</p>}
            </div>
          )
        })}
        {!thisWeekDrafted && (
          <div className={`px-4 py-3.5 flex items-center gap-3 ${drafts.length ? 'border-t border-black/[0.06]' : ''}`}>
            <Tile><CalendarIcon /></Tile>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-medium text-[#6E6E73]">This week</span>
              <span className="block text-[16px] font-semibold">{span(isoOf(monday), isoOf(saturday))}</span>
              <span className="block text-[13px] text-[#8A8A8E]">{filingOpen() ? 'Ready to prepare.' : 'Prepared on Saturday after 5 pm.'}</span>
            </span>
            {filingOpen() && (
              <button type="button" onClick={() => prepare.mutate()} disabled={prepare.isPending}
                className="h-[34px] px-3.5 rounded-full text-[14px] font-semibold text-white disabled:opacity-50" style={{ background: RED }}>
                {prepare.isPending ? 'Preparing…' : 'Prepare'}
              </button>
            )}
          </div>
        )}
      </div>

      {months.length === 0 ? (
        <><Title>Filed</Title><div className={card}><Empty>Filed weeks appear here.</Empty></div></>
      ) : months.map(g => {
        const [y, m] = g.key.split('-').map(Number)
        return (
          <div key={g.key}>
            <Title extra={<span className="text-[13px] text-[#8A8A8E] tabular-nums">{g.weeks.length} week{g.weeks.length === 1 ? '' : 's'} · {short(g.total)}</span>}>{MONTHS[m]} {y}</Title>
            <div className={`${card} overflow-hidden`}>
              {g.weeks.map((r, i) => <WeekRow key={r.id} r={r} first={i === 0} onOpen={setOpen} />)}
            </div>
          </div>
        )
      })}

      {open && <WeekPage report={open} onClose={() => setOpen(null)} />}
      {filing && <SubmitWeek report={filing} onClose={() => setFiling(null)} />}
    </>
  )
}

// ── Every day of the month, the ones worth a second look ──────────────────────
function ReviewDay({ day, month, year, first }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const flagged = day.flags.length > 0
  const answered = day.notes.length > 0
  const save = useMutation({
    mutationFn: () => api.dayNote(day.sheet_id, draft.trim()),
    onSuccess: () => { setDraft(''); queryClient.invalidateQueries({ queryKey: ['month-review', month, year] }) },
  })
  const d = dayOf(day.date)
  return (
    <div className={first ? '' : 'border-t border-black/[0.06]'} style={flagged ? { boxShadow: `inset 3px 0 0 ${answered ? '#7AAB86' : '#E0A82E'}` } : undefined}>
      <div className="px-4 py-2.5 flex items-center gap-3">
        <span className="w-[58px] text-[15px] shrink-0">{weekday(day.date)} {d.getDate()}</span>
        <span className="flex-1 text-[13px] text-[#8A8A8E] tabular-nums truncate">{day.jobs} jobs</span>
        <span className="text-[15px] font-semibold tabular-nums">{short(day.total)}</span>
      </div>
      {flagged && (
        <div className="px-4 pb-3 -mt-1">
          <div className="flex items-start gap-1.5 text-[13.5px]" style={{ color: answered ? GREEN : AMBER }}>
            <span className="mt-[2px]">{answered ? <TickIcon /> : <FlagIcon />}</span>
            <span className="flex-1">{day.flags.join(' · ')}{answered ? ' — explained' : ''}</span>
          </div>
          {day.notes.map(n => (
            <div key={n.id} className="mt-1.5 pl-5">
              <div className="text-[12px] text-[#8A8A8E]">{n.author} · {when(n.created_at)}</div>
              <div className="text-[14.5px] text-[#3A3A3C]">{n.body}</div>
            </div>
          ))}
          {!answered && (
            <div className="mt-2 pl-5">
              <textarea rows={2} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Why was this day like this?"
                className="w-full px-3 py-2 text-[16px] rounded-[12px] bg-[#F6F6F8] outline-none resize-none" />
              <div className="mt-1.5 flex items-center justify-end gap-3">
                {save.isError && <span className="text-[13px] text-[#B91C1C]">Did not save.</span>}
                <button type="button" onClick={() => draft.trim() && save.mutate()} disabled={save.isPending || !draft.trim()}
                  className="h-[32px] px-3.5 rounded-full bg-[#1C1C1E] text-white text-[14px] font-semibold disabled:opacity-35">
                  {save.isPending ? 'Saving…' : 'Save note'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReviewWeek({ week, month, year }) {
  const unanswered = week.days.filter(d => d.flags.length && !d.notes.length).length
  const [open, setOpen] = useState(unanswered > 0)
  return (
    <div className={`${card} overflow-hidden mb-2.5`}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        {isSplit(week) ? <Tile bg="#FFEDB8" ink={AMBER} size={32}><SplitIcon /></Tile> : <Tile bg="#DCE9FF" ink="#1D4ED8" size={32}><CalendarIcon /></Tile>}
        <span className="flex-1 min-w-0">
          <span className="block text-[15.5px] font-semibold">{span(week.date_from, week.date_to)}</span>
          <span className="block text-[12.5px] text-[#8A8A8E]">Week {week.week_number} · {week.jobs} jobs</span>
        </span>
        {week.flag_count > 0 && (
          <span className="flex items-center gap-1 text-[13px] font-semibold tabular-nums" style={{ color: unanswered ? AMBER : GREEN }}>
            {unanswered ? <FlagIcon /> : <TickIcon />}{unanswered || week.flag_count}
          </span>
        )}
        <span className="text-[15px] font-semibold tabular-nums">{short(week.total)}</span>
        <span className={`text-[#C4C4C7] transition-transform ${open ? 'rotate-90' : ''}`}><Svg d={<path d="M9 18l6-6-6-6" />} size={16} width={2.4} /></span>
      </button>
      {open && <div className="border-t border-black/[0.06]">{week.days.map((d, i) => <ReviewDay key={d.sheet_id} day={d} month={month} year={year} first={i === 0} />)}</div>}
    </div>
  )
}

function MonthReviewPhone({ month, year }) {
  const { data, isLoading } = useQuery({
    queryKey: ['month-review', month, year],
    queryFn: () => api.review(month, year).then(r => r.data),
    staleTime: 30_000,
  })
  if (isLoading && !data) return <Skeleton rows={[60, 60]} />
  if (!data || (!data.weeks.length && !data.unfiled_days.length)) return null
  const unexplained = [...data.weeks.flatMap(w => w.days), ...data.unfiled_days].filter(d => d.flags.length && !d.notes.length).length
  return (
    <>
      <Title extra={data.flagged_count > 0 ? (
        <span className="text-[13px] flex items-center gap-1" style={{ color: unexplained ? AMBER : GREEN }}>
          {unexplained ? <FlagIcon /> : <TickIcon />}{unexplained ? `${unexplained} to explain` : 'All explained'}
        </span>) : null}>Every day</Title>
      <p className="m-0 px-5 -mt-1 mb-2.5 text-[13.5px] text-[#8A8A8E]">Look again before closing. A flag only asks for a sentence.</p>
      <div className="px-0">{data.weeks.map(w => <ReviewWeek key={`${w.week_number}-${w.date_from}`} week={w} month={month} year={year} />)}</div>
      {data.unfiled_days.length > 0 && (
        <div className={`${card} overflow-hidden`} style={{ borderLeft: `3px solid ${RED}` }}>
          <div className="px-4 py-3">
            <div className="text-[15.5px] font-semibold" style={{ color: RED }}>{data.unfiled_days.length} day{data.unfiled_days.length === 1 ? '' : 's'} not in a filed week</div>
            <div className="text-[13.5px] text-[#6E6E73]">File their weeks before closing the month.</div>
          </div>
          <div className="border-t border-black/[0.06]">{data.unfiled_days.map((d, i) => <ReviewDay key={d.sheet_id} day={d} month={month} year={year} first={i === 0} />)}</div>
        </div>
      )}
    </>
  )
}

// ── The monthly close ─────────────────────────────────────────────────────────
const CLOSE_STATUS = {
  OPEN: ['Open', '#6E6E73'], SUBMITTED: ['With Finance', '#1D4ED8'], FINANCE_REVIEWING: ['Finance is reviewing', AMBER],
  FINANCE_CLEARED: ['Cleared by Finance', '#6D28D9'], ENDORSED: ['Endorsed', GREEN], LOCKED: ['Locked', GREEN], REJECTED: ['Sent back', RED],
}

function SubmitClose({ month, year, snap, onClose, onDone }) {
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const send = useMutation({
    mutationFn: () => api.submitClose(month, year, notes),
    onSuccess: () => { onDone(); onClose() },
    onError: err => setError(errorOf(err, 'The close did not send. Try again.')),
  })
  return (
    <Sheet title="Send the monthly close" sub={`${MONTHS[month]} ${year}`} onClose={onClose} busy={send.isPending} error={error}
      action={{ label: 'Send to Finance', busy: 'Sending…', onClick: () => { setError(''); send.mutate() } }}>
      {snap?.revenue && (
        <div className="rounded-[16px] bg-white overflow-hidden">
          {[['Collected', money(snap.revenue.total_collected)], ['Cash', money(snap.revenue.total_cash)], ['MoMo', money(snap.revenue.total_momo)], ['Jobs', snap.jobs?.total ?? '—']].map(([k, v], i) => (
            <div key={k} className={`px-4 py-3 flex justify-between text-[15px] ${i ? 'border-t border-black/[0.06]' : ''}`}>
              <span className="text-[#6E6E73]">{k}</span><b className="tabular-nums">{v}</b>
            </div>
          ))}
        </div>
      )}
      <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes for Finance and the Regional Manager"
        className="w-full px-4 py-3 text-[16px] rounded-[16px] bg-white outline-none resize-none" />
      <p className="m-0 px-1 text-[13px] text-[#8A8A8E]">This locks every week in the month and sends the close for review. It cannot be undone.</p>
    </Sheet>
  )
}

export function MonthTab({ month, year, onMove }) {
  const now = new Date()
  const [snapshot, setSnapshot] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const { data: close, isLoading, refetch } = useQuery({
    queryKey: ['monthly-close', month, year],
    queryFn: () => api.close(month, year).then(r => r.data),
    staleTime: 30_000,
  })
  const prepare = useMutation({
    mutationFn: () => api.prepareClose(month, year),
    onSuccess: res => { setSnapshot(res.data.summary_snapshot); setError(''); setSending(true); refetch() },
    onError: err => setError(errorOf(err, 'The close could not be prepared.')),
  })
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1
  const isLatest = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)
  const move = step => {
    let m = month + step, y = year
    if (m < 1) { m = 12; y-- } else if (m > 12) { m = 1; y++ }
    onMove({ month: m, year: y })
  }
  const pdf = async () => {
    setPdfBusy(true); setError('')
    try {
      const res = await api.closePdf(close.id)
      await saveFile(`monthly-close-${year}-${String(month).padStart(2, '0')}.pdf`, res.data)
    } catch { setError('Could not build that PDF.') } finally { setPdfBusy(false) }
  }

  const open = close?.status === 'OPEN'
  const integrity = close?.integrity || {}
  const checks = Object.entries(integrity.checks || {})
  const snap = snapshot || (!open ? close?.summary_snapshot : null)
  const [status, tone] = CLOSE_STATUS[close?.status] || [close?.status, '#6E6E73']
  const left = checks.filter(([, c]) => !c.pass).length

  return (
    <>
      <Stepper label={`${MONTHS[month]} ${year}`} onPrev={() => move(-1)} onNext={() => move(1)} canNext={!isLatest} />
      {isLoading && !close ? <Skeleton rows={[200, 160]} /> : !close ? (
        <div className={`${card} mt-3`}><Empty>No close for this month yet.</Empty></div>
      ) : (
        <>
          <div className={`${card} mt-3`}>
            <div className="px-4 pt-3.5 pb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium text-[#6E6E73]">Monthly close</div>
                <div className="text-[22px] leading-[28px] font-bold" style={{ color: tone }}>{status}</div>
              </div>
              {snap?.revenue && <div className="text-right"><div className="text-[13px] text-[#6E6E73]">Collected</div><div className="text-[20px] font-bold tabular-nums">{short(snap.revenue.total_collected)}</div></div>}
            </div>
            {snap?.revenue && <Figures items={[['Cash', short(snap.revenue.total_cash)], ['MoMo', short(snap.revenue.total_momo)], ['Jobs', snap.jobs?.total ?? '—']]} />}
            {(close.submitted_by || close.endorsed_by) && (
              <div className="px-4 py-3 border-t border-black/[0.06] text-[14px] text-[#6E6E73] space-y-0.5">
                {close.submitted_by && <div>Sent by {close.submitted_by} · {when(close.submitted_at)}</div>}
                {close.endorsed_by && <div style={{ color: GREEN }}>Endorsed by {close.endorsed_by} · {when(close.endorsed_at)}</div>}
              </div>
            )}
            {close.rejected_by && (
              <div className="px-4 py-3 border-t border-black/[0.06]" style={{ boxShadow: `inset 3px 0 0 ${RED}` }}>
                <div className="text-[15px] font-semibold" style={{ color: RED }}>Sent back by {close.rejected_by}</div>
                {close.rejection_reason && <div className="text-[14.5px] text-[#3A3A3C] mt-0.5">{close.rejection_reason}</div>}
              </div>
            )}
          </div>

          {open && checks.length > 0 && (
            <>
              <Title extra={<span className="text-[13px] text-[#8A8A8E]">{left ? `${left} left` : 'All done'}</span>}>{isCurrent ? 'Before it can close' : 'Checks'}</Title>
              <div className={card}>
                {checks.map(([key, c], i) => {
                  const mark = c.pass ? ['#D3F2DE', GREEN, <TickIcon key="t" size={15} />]
                    : isCurrent ? ['#EEF0F4', '#8A8A8E', <span key="o" className="w-[9px] h-[9px] rounded-full border-2 border-current" />]
                      : ['#FFE1E1', RED, <Svg key="x" size={14} width={2.6} d={<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>} />]
                  return (
                    <div key={key} className={`px-4 py-3 flex items-start gap-3 ${i ? 'border-t border-black/[0.06]' : ''}`}>
                      <Tile bg={mark[0]} ink={mark[1]} size={28}>{mark[2]}</Tile>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15.5px] font-semibold">{c.label}</span>
                        <span className="block text-[13.5px] text-[#8A8A8E]">{c.detail}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {error && <p className="m-0 mx-5 mt-3 text-[14px] text-[#B91C1C]">{error}</p>}
          <div className="mx-4 mt-4">
            {open ? (
              <>
                <RedButton onClick={() => { setError(''); prepare.mutate() }} disabled={!integrity.can_submit} busy={prepare.isPending ? 'Checking…' : null}>Prepare the close</RedButton>
                {!integrity.can_submit && <p className="m-0 mt-2 text-center text-[13px] text-[#8A8A8E]">{isCurrent ? 'Opens once the month has ended and every check passes.' : 'Opens once every check passes.'}</p>}
              </>
            ) : close.id ? <PdfButton busy={pdfBusy} onClick={pdf} /> : null}
          </div>

          <MonthReviewPhone month={month} year={year} />
        </>
      )}
      {sending && <SubmitClose month={month} year={year} snap={snap} onClose={() => setSending(false)} onDone={refetch} />}
    </>
  )
}
