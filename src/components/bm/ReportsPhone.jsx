// src/components/bm/ReportsPhone.jsx
//
// Reports & Filing on a phone (18 Nov 2026), in the Overview's look.
//   Days      every day this month, the gaps kept: a Sunday or a holiday is
//             quiet, an unexplained day is red with "Report". A day opens
//             its page: the money by method, who came in, what was used.
//   Weeks     this week, then every filed week by month; a week opens its
//             page with its PDF. Filing happens here.     (ReportsPhoneFiling)
//   Month     the monthly close: what is left, the totals, every day of the
//             month with the ones worth a second look.   (ReportsPhoneFiling)
//   Year      the year by month; a month opens its close.(ReportsPhoneHistory)
//   Ledger    years, then months, then weeks.            (ReportsPhoneHistory)
//   Statement for the business owner only.               (ReportsPhoneHistory)
// The same calls as Reports.jsx.
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { reportMissingDayDisruption } from '../../api/bm'
import PhoneHeader from './PhoneHeader'
import {
  AMBER, GREEN, RED, REASON, REASONS, api, card, dayMonth, dayOf, errorOf, isoOf, mondayOf, money, num, short, span,
  useDays, weekday,
} from './reportsKit'
import { Chevron, Empty, Field, Figures, Pushed, Sheet, Skeleton, Title } from './ReportsPhoneUI'
import { MonthTab, WeeksTab } from './ReportsPhoneFiling'
import { LedgerTab, StatementTab, YearTab } from './ReportsPhoneHistory'

const STATUS = { OPEN: ['Open now', GREEN], CLOSED: ['Closed', '#8A8A8E'], AUTO_CLOSED: ['Auto-closed', AMBER] }
const DISRUPTION = { PENDING_REVIEW: ['awaiting review', AMBER], APPROVED: ['approved', GREEN], REJECTED: ['turned down', RED] }

// ── A day's page ──────────────────────────────────────────────────────────────
function DayPage({ sheet, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['sheet-summary', sheet.id],
    queryFn: () => api.sheetSummary(sheet.id).then(r => r.data),
    staleTime: 120_000,
  })
  const jobs = data?.jobs || {}
  const total = jobs.total || 0
  const reg = total ? Math.round(((jobs.registered || 0) / total) * 100) : 0
  const used = (data?.inventory || []).filter(i => num(i.consumed) > 0)
  const [status, tone] = STATUS[sheet.status] || [sheet.status, '#8A8A8E']
  const dis = sheet.disruption_reason && DISRUPTION[sheet.disruption_status]

  return (
    <Pushed back="Days" title={dayMonth(sheet.date)} onBack={onClose} label="Day">
      <div className="px-5 pt-5">
        <div className="text-[14px] text-[#6E6E73]">{weekday(sheet.date, true)}</div>
        <h1 className="m-0 text-[26px] leading-[32px] font-extrabold tracking-[-0.02em] text-[#111]">{dayMonth(sheet.date, true)}</h1>
        <div className="mt-1 text-[14px]" style={{ color: tone }}>{status}{sheet.closed_by_name ? <span className="text-[#8A8A8E]"> · closed by {sheet.closed_by_name}</span> : null}</div>
      </div>

      <div className={`${card} mt-4`}>
        <div className="px-4 pt-3.5 pb-3">
          <div className="text-[13px] font-medium text-[#6E6E73]">Taken</div>
          <div className="text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] tabular-nums text-[#111]">{money(sheet.total_collected)}</div>
        </div>
        <Figures items={[['Cash', short(sheet.total_cash)], ['MoMo', short(sheet.total_momo)], ['POS', short(sheet.total_pos)]]} />
        <div className="px-4 py-3 border-t border-black/[0.06] flex justify-between text-[15px]">
          <span className="text-[#6E6E73]">Cash left in the till</span><b className="tabular-nums">{money(sheet.net_cash_in_till)}</b>
        </div>
        <div className="px-4 py-3 border-t border-black/[0.06] flex justify-between text-[15px]">
          <span className="text-[#6E6E73]">Jobs</span><b className="tabular-nums">{sheet.total_jobs_created ?? '—'}</b>
        </div>
      </div>

      {sheet.disruption_reason && (
        <>
          <Title>Disruption</Title>
          <div className={`${card} px-4 py-3`} style={{ borderLeft: `3px solid ${dis ? dis[1] : AMBER}` }}>
            <div className="text-[15.5px] font-semibold">{REASON[sheet.disruption_reason] || sheet.disruption_reason}
              {dis && <span className="font-normal" style={{ color: dis[1] }}> · {dis[0]}</span>}</div>
            {sheet.disruption_notes && <p className="m-0 mt-1 text-[14.5px] text-[#3A3A3C]">{sheet.disruption_notes}</p>}
            <p className="m-0 mt-1 text-[13px] text-[#8A8A8E] break-words">Evidence: {sheet.disruption_evidence}</p>
            {sheet.disruption_status === 'REJECTED' && sheet.disruption_rejection_reason && (
              <p className="m-0 mt-1 text-[13px]" style={{ color: RED }}>{sheet.disruption_rejection_reason}</p>
            )}
          </div>
        </>
      )}

      {isLoading ? <Skeleton rows={[90]} /> : (
        <>
          {total > 0 && (
            <>
              <Title extra={<span className="text-[12.5px] text-[#8A8A8E]">{total} jobs</span>}>Who came in</Title>
              <div className={`${card} px-4 py-3.5`}>
                <div className="h-[8px] rounded-full overflow-hidden flex bg-[#EDEDF0]">
                  <span className="h-full bg-[#1C1C1E]" style={{ width: `${reg}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-[13.5px]">
                  <span><b className="tabular-nums">{reg}%</b> <span className="text-[#6E6E73]">registered customers</span></span>
                  <span><b className="tabular-nums">{100 - reg}%</b> <span className="text-[#6E6E73]">walk-in</span></span>
                </div>
              </div>
            </>
          )}
          <Title extra={used.length ? <span className="text-[12.5px] text-[#8A8A8E]">{used.length} items</span> : null}>What was used</Title>
          <div className={card}>
            {used.length === 0 ? <Empty>Nothing recorded as used.</Empty> : used.map((u, i) => (
              <div key={u.consumable + i} className={`px-4 py-3 flex justify-between gap-3 text-[15px] ${i ? 'border-t border-black/[0.06]' : ''}`}>
                <span className="truncate">{u.consumable}</span>
                <span className="tabular-nums text-[#6E6E73] shrink-0">−{parseFloat(u.consumed)} {u.unit}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Pushed>
  )
}

// ── Reporting a day with no sheet ─────────────────────────────────────────────
function ReportGap({ iso, onClose }) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('POWER_OUTAGE')
  const [evidence, setEvidence] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const send = useMutation({
    mutationFn: () => reportMissingDayDisruption({ date: iso, reason, evidence: evidence.trim(), notes }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sheets-monthly'] }); onClose() },
    onError: err => setError(errorOf(err, 'That did not send. Try again.')),
  })
  const go = () => { if (!evidence.trim()) return setError('Add something that shows it: a link, an ECG reference, a photo.'); setError(''); send.mutate() }
  return (
    <Sheet title="Report what happened" sub={`${weekday(iso, true)} ${dayMonth(iso, true)}`} onClose={onClose}
      busy={send.isPending} error={error} action={{ label: 'Send for review', busy: 'Sending…', onClick: go }}>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="What happened">
        {REASONS.map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={reason === v} onClick={() => setReason(v)}
            className={`h-[48px] rounded-[14px] text-[15px] font-semibold ${v === 'OTHER' ? 'col-span-2' : ''}
              ${reason === v ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E]'}`}>{label}</button>
        ))}
      </div>
      <Field label="What shows it">
        <input value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="News link, ECG reference, photo link"
          className="w-full mt-1 text-[16px] bg-transparent outline-none" />
      </Field>
      <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything else (optional)"
        className="w-full px-4 py-3 text-[16px] rounded-[16px] bg-white outline-none resize-none" />
      <p className="m-0 px-1 text-[13px] text-[#8A8A8E]">The business owner checks it before the day is excused.</p>
    </Sheet>
  )
}

function DeclareHoliday({ onClose }) {
  const queryClient = useQueryClient()
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const save = useMutation({
    mutationFn: () => api.declareHoliday({ date, name: name.trim() }),
    onSuccess: () => { ['holidays', 'sheets-monthly'].forEach(k => queryClient.invalidateQueries({ queryKey: [k] })); onClose() },
    onError: err => setError(errorOf(err, 'Could not declare that holiday.')),
  })
  const go = () => {
    if (!date) return setError('Pick the day the branch closes.')
    if (!name.trim()) return setError('Name the holiday.')
    setError(''); save.mutate()
  }
  return (
    <Sheet title="Declare a holiday" onClose={onClose} busy={save.isPending} error={error}
      action={{ label: 'Declare holiday', onClick: go }}>
      <Field label="The day the branch closes">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full mt-1 text-[16px] bg-transparent outline-none" />
      </Field>
      <Field label="Holiday">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Farmers’ Day" className="w-full mt-1 text-[16px] bg-transparent outline-none" />
      </Field>
      <p className="m-0 px-1 text-[13px] text-[#8A8A8E]">If a holiday is observed on another day, declare the day you actually close.</p>
    </Sheet>
  )
}

// ── Days ─────────────────────────────────────────────────────────────────────
function DayRow({ day, first, onOpen, onReport }) {
  const d = dayOf(day.iso)
  const date = (
    <span className="w-10 text-center shrink-0">
      <span className="block text-[11.5px] font-semibold uppercase text-[#8A8A8E]">{weekday(day.iso)}</span>
      <span className="block text-[21px] leading-[24px] font-bold tabular-nums">{d.getDate()}</span>
    </span>
  )
  const line = first ? '' : 'border-t border-black/[0.06]'

  if (day.kind === 'sunday' || day.kind === 'holiday' || day.kind === 'notyet') {
    const text = day.kind === 'sunday' ? 'Closed · Sunday' : day.kind === 'holiday' ? `Closed · ${day.holiday}` : 'Not opened yet'
    return (
      <div className={`flex items-center gap-3 px-4 py-2.5 opacity-60 ${line}`}>
        {date}<span className="flex-1 text-[15px] text-[#6E6E73]">{text}</span>
      </div>
    )
  }
  if (day.kind === 'gap') {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 ${line}`}>
        {date}
        <span className="flex-1 min-w-0">
          <span className="block text-[15.5px] font-semibold" style={{ color: RED }}>No sheet recorded</span>
          <span className="block text-[13px] text-[#8A8A8E]">Say why the branch did not open</span>
        </span>
        <button type="button" onClick={() => onReport(day.iso)}
          className="h-[32px] px-3.5 rounded-full text-[14px] font-semibold shrink-0" style={{ color: RED, background: '#FFE9EA' }}>Report</button>
      </div>
    )
  }
  const s = day.sheet
  const [status, tone] = STATUS[s.status] || [s.status, '#8A8A8E']
  const dis = s.disruption_reason && DISRUPTION[s.disruption_status]
  return (
    <button type="button" onClick={() => onOpen(s)} className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-black/[0.03] ${line}`}>
      {date}
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-semibold tabular-nums">{money(s.total_collected)}</span>
        <span className="block text-[13px] text-[#8A8A8E] truncate">
          {s.total_jobs_created ?? 0} jobs · {dis
            ? <span style={{ color: dis[1] }}>{REASON[s.disruption_reason]} · {dis[0]}</span>
            : <span style={{ color: tone }}>{status}</span>}
        </span>
      </span>
      <Chevron />
    </button>
  )
}

function DaysTab() {
  const { days, isLoading, gaps } = useDays()
  const [open, setOpen] = useState(null)
  const [reporting, setReporting] = useState(null)
  const [holiday, setHoliday] = useState(false)

  if (isLoading) return <Skeleton rows={[150, 320]} />
  const traded = days.filter(d => d.sheet)
  const taken = traded.reduce((n, d) => n + num(d.sheet.total_collected), 0)
  const jobs = traded.reduce((n, d) => n + (d.sheet.total_jobs_created || 0), 0)
  const now = new Date()

  // Grouped by week, Monday to Sunday, newest first.
  const weeks = []
  for (const d of days) {
    const key = isoOf(mondayOf(d.iso))
    if (!weeks.length || weeks[weeks.length - 1].key !== key) weeks.push({ key, days: [] })
    weeks[weeks.length - 1].days.push(d)
  }

  return (
    <>
      <div className={`${card} mt-3`}>
        <div className="px-4 pt-3.5 pb-3">
          <div className="text-[13px] font-medium text-[#6E6E73]">{now.toLocaleDateString('en-GB', { month: 'long' })} so far</div>
          <div className="text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] tabular-nums text-[#111]">{money(taken)}</div>
        </div>
        <Figures items={[['Days open', traded.length], ['Jobs', jobs], ['Unexplained', gaps, gaps > 0 ? RED : null]]} />
      </div>

      <Title extra={<button type="button" onClick={() => setHoliday(true)} className="text-[15px] font-medium" style={{ color: RED }}>Declare holiday</button>}>Every day</Title>
      {weeks.map(w => {
        const last = w.days[0].iso, first = w.days[w.days.length - 1].iso
        return (
          <div key={w.key} className="mb-3">
            <div className="px-5 pb-1.5 text-[13px] font-medium text-[#8A8A8E]">{span(first, last)}</div>
            <div className={`${card} overflow-hidden`}>
              {w.days.map((d, i) => <DayRow key={d.iso} day={d} first={i === 0} onOpen={setOpen} onReport={setReporting} />)}
            </div>
          </div>
        )
      })}

      {open && <DayPage sheet={open} onClose={() => setOpen(null)} />}
      {reporting && <ReportGap iso={reporting} onClose={() => setReporting(null)} />}
      {holiday && <DeclareHoliday onClose={() => setHoliday(false)} />}
    </>
  )
}

// ── The page ─────────────────────────────────────────────────────────────────
export default function ReportsPhone() {
  const { user } = useAuth()
  const { gaps } = useDays()
  const [tab, setTab] = useState('days')
  const now = new Date()
  const [pick, setPick] = useState({ month: now.getMonth() + 1, year: now.getFullYear() })
  const tabs = [['days', 'Days', gaps], ['weeks', 'Weeks'], ['month', 'Month'], ['year', 'Year'], ['ledger', 'Ledger']]
  if (user?.can_generate_branch_statement) tabs.push(['statement', 'Statement'])
  const openMonth = (month, year) => { setPick({ month, year }); setTab('month') }

  return (
    <div className="ios min-h-full pb-6" style={{ background: '#F6F6F8' }}>
      <PhoneHeader />
      <div className="px-4 pt-1">
        <h1 className="m-0 text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] text-[#111]">Reports &amp; Filing</h1>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]" role="tablist" aria-label="Reports">
        {tabs.map(([id, label, n]) => {
          const on = tab === id
          return (
            <button key={id} type="button" role="tab" aria-selected={on} onClick={() => setTab(id)}
              className={`shrink-0 h-[34px] px-3.5 rounded-full flex items-center gap-1.5 text-[14px] font-semibold whitespace-nowrap
                ${on ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E] border border-black/[0.06]'}`}>
              {label}
              {n > 0 && <span className="tabular-nums" style={{ color: on ? 'rgba(255,255,255,0.75)' : RED }}>{n}</span>}
            </button>
          )
        })}
      </div>

      {tab === 'days' && <DaysTab />}
      {tab === 'weeks' && <WeeksTab />}
      {tab === 'month' && <MonthTab key={`${pick.year}-${pick.month}`} month={pick.month} year={pick.year} onMove={setPick} />}
      {tab === 'year' && <YearTab onOpenMonth={openMonth} />}
      {tab === 'ledger' && <LedgerTab />}
      {tab === 'statement' && <StatementTab />}
    </div>
  )
}

