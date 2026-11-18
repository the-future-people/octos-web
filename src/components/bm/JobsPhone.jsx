// src/components/bm/JobsPhone.jsx
//
// The Branch Manager's Jobs page on a phone (18 Nov 2026), in the Overview's
// look: white cards, black text, colour only in small icon squares and status
// dots, red for what needs acting on.
//   Search      name, phone or job number (the server's own search)
//   Jobs | Receipts
//   Queues      one row of chips, each with its count (they replace the six
//               counter tiles and the filter buttons of the computer's page)
//   Period and type behind one button ("Today · All types")
//   The jobs in one white list; "Show more" loads the next twenty.
// Tapping a job opens its page full screen (JobFilePhone).
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getJobs, getJobStats } from '../../api/bm'
import PhoneHeader from './PhoneHeader'
import JobFilePhone from './JobFilePhone'
import { usePrefetchJobFile } from './jobFileQuery'
import { lifecycleState, serviceSummary, toneOf } from './jobLifecycle'

const RED = '#D70015'
const PAGE = 20

// Status dots and icon squares, the Overview's colours.
const DOT = { amber: '#F59E0B', violet: '#8B5CF6', green: '#22C55E', blue: '#3B82F6', red: RED, grey: '#A1A1AA' }
const TYPE = {
  INSTANT:    { label: 'Instant',    tile: '#F1F1F3', ink: '#52525B', d: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /> },
  PRODUCTION: { label: 'Production', tile: '#DCE9FF', ink: '#2563EB', d: <path d="M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z" /> },
  DESIGN:     { label: 'Design',     tile: '#E7DCFF', ink: '#7C3AED', d: <path d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.6 7.6 M11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /> },
}
const QUEUES = [
  { q: 'ALL',              label: 'All',              stat: 'total' },
  { q: 'awaiting_payment', label: 'Awaiting payment', stat: 'awaiting_payment' },
  { q: 'in_production',    label: 'In production',    stat: 'in_production' },
  { q: 'ready_for_pickup', label: 'Ready for pickup', stat: 'ready_for_pickup' },
  { q: 'halted',           label: 'Halted',           stat: 'halted', alarm: true },
  { q: 'handed_over',      label: 'Handed over',      stat: 'handed_over' },
]
const PERIODS = [['day', 'Today'], ['week', 'This week'], ['month', 'This month'], ['', 'All time']]
const TYPES = [['ALL', 'All types'], ['INSTANT', 'Instant'], ['PRODUCTION', 'Production'], ['DESIGN', 'Design']]

const Svg = ({ d, size = 18, width = 2, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{d}</svg>
)

const money = v => {
  const n = parseFloat(v || 0)
  return `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
}
// Today: the time. Yesterday: "Yesterday". Older: the date. As in Mail.
function stamp(iso) {
  if (!iso) return ''
  const d = new Date(iso), now = new Date()
  const days = Math.round((new Date(now.toDateString()) - new Date(d.toDateString())) / 86_400_000)
  if (days === 0) return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
const shortNumber = n => `#${(n || '').split('-').pop()}`
const titleCase = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

function JobRow({ job, first, onOpen, onHover }) {
  const s = lifecycleState(job)
  const tone = toneOf(s)
  const t = TYPE[job.job_type] || TYPE.INSTANT
  const alarm = tone === 'red' || s.subTone
  // "In production · In production" says it twice: drop a sub that repeats the label.
  const sub = s.sub && s.sub.toLowerCase() !== s.label.toLowerCase() ? s.sub.replace('Balance outstanding', 'Balance owed') : null
  return (
    <button type="button" onClick={onOpen} onTouchStart={onHover} onMouseEnter={onHover}
      className="w-full flex items-start gap-3 pl-3.5 pr-3 text-left active:bg-black/[0.04]">
      <span className="mt-3 w-9 h-9 rounded-[11px] grid place-items-center shrink-0" style={{ background: t.tile, color: t.ink }}>
        <Svg d={t.d} />
      </span>
      <span className={`flex-1 min-w-0 py-2.5 ${first ? '' : 'border-t border-black/[0.07]'}`}>
        <span className="flex items-baseline gap-2">
          <span className="flex-1 min-w-0 text-[16px] leading-[21px] font-semibold text-[#1C1C1E] truncate">{titleCase(job.customer_name) || 'Walk-in'}</span>
          <span className="text-[15px] font-semibold tabular-nums text-[#111] whitespace-nowrap">{money(job.estimated_cost)}</span>
        </span>
        <span className="flex items-baseline gap-2 mt-px">
          <span className="flex-1 min-w-0 text-[13.5px] leading-[18px] text-[#6E6E73] truncate">{serviceSummary(job)}</span>
          <span className="text-[12.5px] text-[#8A8A8E] whitespace-nowrap">{stamp(job.created_at)}</span>
        </span>
        <span className="flex items-center gap-1.5 mt-1 text-[12.5px] leading-[16px]">
          <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: DOT[tone] }} />
          <span className="font-medium truncate" style={{ color: alarm ? RED : '#3A3A3C' }}>
            {s.label}{sub ? ` · ${sub}` : ''}
          </span>
          <span className="ml-auto text-[#A1A1AA] tabular-nums">{shortNumber(job.job_number)}</span>
        </span>
      </span>
    </button>
  )
}

// Period and type (redrawn 18 Nov 2026, Khofi: "not in a list"): the period
// as an iOS segmented control, the type as four tiles with the same icons as
// the rows. Nothing changes until "Show N jobs", which counts the choice first.
const SHORT_PERIODS = [['day', 'Today'], ['week', 'Week'], ['month', 'Month'], ['', 'All']]
const ALL_TILE = { label: 'All types', tile: '#F1F1F3', ink: '#1C1C1E', d: <path d="M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z" /> }

function ShowSheet({ period, jobType, onApply, onClose }) {
  const [p, setP] = useState(period)
  const [t, setT] = useState(jobType)
  const { data } = useQuery({
    queryKey: ['jobStats', p, t],
    queryFn: () => getJobStats({ period: p || undefined, job_type: t !== 'ALL' ? t : undefined }).then(r => r.data),
    staleTime: 30_000,
  })
  const n = data?.total
  const changed = p !== 'day' || t !== 'ALL'

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-label="Show jobs">
      <div className="absolute inset-0 bg-black/30 animate-fadeIn" onClick={onClose} />
      <div className="ios absolute inset-x-0 bottom-0 rounded-t-[24px] animate-slideUp px-4"
        style={{ background: '#F6F6F8', paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}>
        <div className="flex justify-center pt-2"><span className="w-9 h-[5px] rounded-full bg-black/15" aria-hidden="true" /></div>
        <div className="flex items-center justify-between pt-2.5">
          <button type="button" onClick={() => { setP('day'); setT('ALL') }} disabled={!changed}
            className="text-[16px] text-[#D70015] disabled:text-[#C4C4C7] w-16 text-left">Reset</button>
          <h2 className="text-[17px] font-bold text-[#111]">Show</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-16 flex justify-end">
            <span className="w-8 h-8 rounded-full bg-black/[0.06] grid place-items-center text-[#6E6E73]">
              <Svg d={<path d="M18 6 6 18 M6 6l12 12" />} size={13} width={3} />
            </span>
          </button>
        </div>

        <div className="mt-4 text-[13px] font-semibold text-[#6E6E73] px-1">When</div>
        <div className="mt-2 p-[3px] rounded-[12px] bg-black/[0.06] flex" role="radiogroup" aria-label="Period">
          {SHORT_PERIODS.map(([v, label]) => (
            <button key={label} type="button" role="radio" aria-checked={p === v} onClick={() => setP(v)}
              className={`flex-1 h-[36px] rounded-[9px] text-[14.5px] font-semibold transition-colors
                ${p === v ? 'bg-white text-[#111] shadow-[0_2px_6px_rgba(0,0,0,0.10)]' : 'text-[#3A3A3C]'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 text-[13px] font-semibold text-[#6E6E73] px-1">Type</div>
        <div className="mt-2 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Type">
          {[['ALL', ALL_TILE], ...Object.entries(TYPE)].map(([v, c]) => {
            const on = t === v
            return (
              <button key={v} type="button" role="radio" aria-checked={on} onClick={() => setT(v)}
                className={`relative h-[64px] rounded-[16px] bg-white px-3 flex items-center gap-3 text-left transition-shadow
                  ${on ? 'shadow-[0_0_0_2px_#D70015]' : 'shadow-[0_0_0_1px_rgba(0,0,0,0.06)]'}`}>
                <span className="w-9 h-9 rounded-[11px] grid place-items-center shrink-0" style={{ background: c.tile, color: c.ink }}>
                  <Svg d={c.d} />
                </span>
                <span className="text-[15px] font-semibold text-[#1C1C1E]">{c.label}</span>
                {on && (
                  <span className="absolute top-2 right-2 w-[18px] h-[18px] rounded-full bg-[#D70015] text-white grid place-items-center">
                    <Svg d={<path d="M20 6 9 17l-5-5" />} size={11} width={3.4} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button type="button" onClick={() => onApply(p, t)}
          className="mt-6 w-full h-[50px] rounded-[16px] text-white text-[16.5px] font-semibold active:scale-[0.99] transition-transform"
          style={{ background: 'linear-gradient(135deg,#EF1C2C 0%,#C8000F 100%)' }}>
          {n == null ? 'Show jobs' : n === 0 ? 'No jobs to show' : `Show ${n.toLocaleString()} job${n === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>,
    document.body,
  )
}

export default function JobsPhone({ focus = null, onOpenChat, receipts }) {
  const [tab, setTab] = useState('jobs')
  const [queue, setQueue] = useState('ALL')
  const [jobType, setJobType] = useState('ALL')
  const [period, setPeriod] = useState('day')
  const [search, setSearch] = useState('')
  const [showing, setShowing] = useState(false)
  const [openId, setOpenId] = useState(focus?.id ?? null)
  const prefetch = usePrefetchJobFile()
  const q = useDebounced(search.trim())

  const params = {
    queue: queue !== 'ALL' ? queue : undefined,
    job_type: jobType !== 'ALL' ? jobType : undefined,
    period: q ? undefined : (period || undefined),   // a search looks through every job
    search: q || undefined,
  }
  const { data: stats = {} } = useQuery({
    queryKey: ['jobStats', period, jobType],
    queryFn: () => getJobStats({ period: period || undefined, job_type: params.job_type }).then(r => r.data),
    refetchInterval: 30_000, staleTime: 30_000,
  })
  const list = useInfiniteQuery({
    queryKey: ['jobs-phone', params],
    queryFn: ({ pageParam }) => getJobs({ ...params, page: pageParam, page_size: PAGE }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last?.next ? pages.length + 1 : undefined),
    staleTime: 15_000,
  })
  const jobs = (list.data?.pages || []).flatMap(p => (Array.isArray(p) ? p : p?.results || []))
  const count = list.data?.pages?.[0]?.count ?? jobs.length

  const periodLabel = PERIODS.find(([v]) => v === period)?.[1]
  const typeLabel = TYPES.find(([v]) => v === jobType)?.[1]

  return (
    <div className="ios min-h-full pb-6" style={{ background: '#F6F6F8' }}>
      <PhoneHeader />

      <div className="px-4 pt-1 flex items-end justify-between">
        <h1 className="m-0 text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] text-[#111]">Jobs</h1>
      </div>

      {/* Jobs | Receipts, the iOS segmented control */}
      <div className="mx-4 mt-3 p-[3px] rounded-[10px] bg-black/[0.06] flex" role="tablist">
        {[['jobs', 'Jobs'], ['receipts', 'Receipts']].map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={`flex-1 h-[30px] rounded-[8px] text-[13.5px] font-semibold transition-colors
              ${tab === v ? 'bg-white text-[#111] shadow-[0_2px_6px_rgba(0,0,0,0.10)]' : 'text-[#3A3A3C]'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'receipts' ? <div className="mt-2">{receipts}</div> : (
        <>
          <label className="mx-4 mt-3 h-[38px] px-3 rounded-[11px] bg-black/[0.06] flex items-center gap-2 text-[#8A8A8E]">
            <Svg d={<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3" />} size={17} />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Name, phone or job number" enterKeyHint="search"
              className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-[#111] placeholder:text-[#8A8A8E]" />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear"
                className="w-[18px] h-[18px] rounded-full bg-[#A1A1AA] text-white grid place-items-center">
                <Svg d={<path d="M18 6 6 18 M6 6l12 12" />} size={10} width={3.2} />
              </button>
            )}
          </label>

          {/* Queues with their counts, one swipeable row */}
          <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            {QUEUES.map(c => {
              const on = queue === c.q
              const n = stats[c.stat]
              return (
                <button key={c.q} type="button" onClick={() => setQueue(c.q)}
                  className={`shrink-0 h-[34px] px-3.5 rounded-full flex items-center gap-1.5 text-[14px] font-semibold whitespace-nowrap
                    ${on ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E] border border-black/[0.06]'}`}>
                  {c.label}
                  {n != null && (
                    <span className="tabular-nums" style={{ color: on ? 'rgba(255,255,255,0.7)' : c.alarm && n > 0 ? RED : '#8A8A8E' }}>{n}</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="px-4 mt-3 mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setShowing(true)} disabled={!!q}
              className="flex items-center gap-1 text-[14.5px] font-semibold text-[#D70015] disabled:text-[#8A8A8E]">
              {q ? 'All time' : periodLabel} · {typeLabel}
              <Svg d={<path d="M6 9l6 6 6-6" />} size={15} width={2.4} />
            </button>
            <span className="text-[13px] text-[#8A8A8E]">
              {list.isLoading ? '' : `${count.toLocaleString()} job${count === 1 ? '' : 's'}`}
            </span>
          </div>

          {list.isLoading ? (
            <div className="mx-4 rounded-[16px] bg-white overflow-hidden animate-pulse" aria-hidden="true">
              {[0, 1, 2, 3, 4].map(i => <div key={i} className={`h-[78px] ${i ? 'border-t border-black/[0.05]' : ''}`} />)}
            </div>
          ) : list.isError ? (
            <div className="mx-4 rounded-[16px] bg-white py-10 px-6 text-center">
              <div className="text-[16px] font-semibold text-[#1C1C1E]">The jobs could not load</div>
              <button type="button" onClick={() => list.refetch()} className="mt-2 text-[15px] font-semibold text-[#D70015]">Try again</button>
            </div>
          ) : jobs.length === 0 ? (
            <div className="mx-4 rounded-[16px] bg-white py-12 px-6 text-center">
              <div className="text-[16px] font-semibold text-[#1C1C1E]">{q ? `Nothing matches “${q}”` : 'No jobs here'}</div>
              <div className="text-[13.5px] text-[#8A8A8E] mt-1">
                {q ? 'Try part of the name, the phone number or the job number.' : 'Try another queue or a longer period.'}
              </div>
            </div>
          ) : (
            <>
              <div className="mx-4 rounded-[16px] bg-white overflow-hidden border border-black/[0.04] shadow-[0_3px_12px_rgba(17,24,39,0.05)]">
                {jobs.map((job, i) => (
                  <JobRow key={job.id} job={job} first={i === 0} onOpen={() => setOpenId(job.id)} onHover={() => prefetch(job.id)} />
                ))}
              </div>
              {list.hasNextPage && (
                <button type="button" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}
                  className="mx-4 mt-3 w-[calc(100%-2rem)] h-[44px] rounded-[14px] bg-white border border-black/[0.06]
                    text-[15px] font-semibold text-[#D70015] disabled:text-[#8A8A8E]">
                  {list.isFetchingNextPage ? 'Loading…' : `Show ${Math.min(PAGE, count - jobs.length)} more`}
                </button>
              )}
            </>
          )}
        </>
      )}

      {showing && (
        <ShowSheet period={period} jobType={jobType} onClose={() => setShowing(false)}
          onApply={(p, t) => { setPeriod(p); setJobType(t); setShowing(false) }} />
      )}
      {openId && <JobFilePhone jobId={openId} onClose={() => setOpenId(null)} onOpenChat={onOpenChat} />}
    </div>
  )
}
