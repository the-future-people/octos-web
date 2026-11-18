// src/components/bm/OverviewPhone.jsx
//
// The Branch Manager's Overview on a phone (18 Nov 2026, from Khofi's
// reference): Octos at the top with round bell and profile buttons, the
// branch in large type, region / belt / date / floor load in one card, New
// Job in Octos red beside New Customer, Today's Pulse as four tinted cards,
// and the workload as cards, the one that needs acting on highlighted.
// The same figures as the computer's Overview (Overview.jsx hands them here).
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import IOSAccount from '../ios/IOSAccount'
import { Chevron } from '../ios/IOSList'
import NotificationBell from '../cashier/NotificationBell'

const RED = '#D70015'
const getPulse = () => client.get('/api/v1/jobs/pulse/').then(r => r.data)

const fmtMoney = v => {
  const n = parseFloat(v || 0)
  return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function mins(m) {
  if (m == null) return ''
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
}

const I = {
  pin: <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
  layers: <path d="M12 2 2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5" />,
  calendar: <path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M16 2v4 M8 2v4 M3 10h18" />,
  gauge: <path d="M12 14l4-4 M3.3 17a9 9 0 1 1 17.4 0" />,
  plus: <path d="M12 6v12 M6 12h12" />,
  personPlus: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M19 8v6 M22 11h-6" />,
  folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  check: <path d="M20 6 9 17l-5-5" />,
  cycle: <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16 M3 12a9 9 0 0 1 15.5-6.3L21 8 M21 3v5h-5 M3 21v-5h5" />,
  coins: <path d="M12 9c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3z M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />,
  card: <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M2 10h20" />,
  trend: <path d="M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6" />,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  clock: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2" />,
  arrow: <path d="M5 12h14 M13 6l6 6-6 6" />,
}
const Svg = ({ d, size = 22, width = 2, className = '', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width}
    strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">{d}</svg>
)

// Colour lives only in the small icon tiles: white cards, black numbers
// (Khofi chose this "hint" look over a colourful and a black-and-white one,
// 18 Nov 2026). Red is kept for New Job and for whatever needs acting on now.
const TINT = {
  blue:   { tile: '#DCE9FF', ink: '#2563EB' },
  green:  { tile: '#D3F2DE', ink: '#16A34A' },
  amber:  { tile: '#FFEDB8', ink: '#D97706' },
  purple: { tile: '#E7DCFF', ink: '#7C3AED' },
  grey:   { tile: '#F1F1F3', ink: '#52525B' },
  red:    { tile: '#FFE1E1', ink: RED },
}

function Pulse({ tint, icon, label, value }) {
  const t = TINT[tint]
  return (
    <div className="rounded-[18px] p-3 bg-white border border-black/[0.05] shadow-[0_3px_12px_rgba(17,24,39,0.05)]">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-[12px] grid place-items-center shrink-0" style={{ background: t.tile, color: t.ink }}>
          <Svg d={icon} size={20} />
        </span>
        <div className="min-w-0 pt-0.5">
          <div className="text-[13.5px] font-semibold text-[#1C1C1E] truncate">{label}</div>
          <div className="text-[24px] leading-[30px] font-extrabold tracking-[-0.02em] text-[#111] truncate">{value}</div>
        </div>
      </div>
    </div>
  )
}

function Work({ tint, icon, title, detail, value, urgent, onClick }) {
  const t = urgent ? TINT.red : TINT[tint]
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-[16px] text-left bg-white border border-black/[0.04]
        active:scale-[0.99] transition-transform"
      style={{ boxShadow: `${urgent ? `inset 3px 0 0 ${RED}, ` : ''}0 3px 12px rgba(17,24,39,0.05)` }}>
      <span className="w-9 h-9 rounded-[11px] grid place-items-center shrink-0" style={{ background: t.tile, color: t.ink }}>
        <Svg d={icon} size={19} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15.5px] leading-[20px] font-semibold text-[#1C1C1E] truncate">{title}</span>
        {detail && <span className="block text-[12.5px] leading-[17px] truncate" style={{ color: urgent ? RED : '#8A8A8E' }}>{detail}</span>}
      </span>
      <span className="text-[19px] font-bold tabular-nums" style={{ color: urgent ? RED : '#111' }}>{value}</span>
      <Chevron className="text-[#B0B0B5]" />
    </button>
  )
}

function Fact({ icon, top, bottom, children }) {
  return (
    <div className="flex-1 min-w-0 flex items-center gap-1.5 px-2 [&+&]:border-l [&+&]:border-black/[0.06] last:flex-[1.2]">
      <Svg d={icon} size={18} width={1.9} className="text-[#3A3A3C] shrink-0" />
      {children || (
        <span className="min-w-0 leading-[17px]">
          <span className="block text-[12px] font-medium text-[#1C1C1E] truncate">{top}</span>
          <span className="block text-[12px] font-semibold text-[#1C1C1E] truncate">{bottom}</span>
        </span>
      )}
    </div>
  )
}

export default function OverviewPhone({ stats, revenue, workload, loading, onNavigate, onNewJob, onNewCustomer, stranded }) {
  const { user } = useAuth()
  const branch = user?.branch_detail || {}
  const { data: pulse } = useQuery({ queryKey: ['branchPulse'], queryFn: getPulse, staleTime: 30_000, refetchInterval: 60_000 })
  const floor = pulse?.floor
  const floorTone = floor?.percent == null ? null : floor.percent > 100 ? 'bad' : floor.percent >= 70 ? 'warn' : 'good'
  const floorPill = { good: ['#DDF5E3', '#15803D'], warn: ['#FDF0D5', '#B45309'], bad: ['#FDE2E2', '#B91C1C'] }[floorTone] || ['#F1F1F3', '#52525B']

  // The header turns translucent once the page moves under it.
  const top = useRef(null)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = top.current
    if (!el) return undefined
    const watch = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { root: el.closest('.overflow-y-auto'), threshold: 0 })
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  const w = workload || {}
  const pending = w.pending_payment ?? 0
  const oldest = w.oldest_pending_mins
  const overdue = w.overdue ?? 0
  const dash = loading ? '…' : null
  const now = new Date()

  return (
    <div className="ios min-h-full pb-6" style={{ background: '#F6F6F8' }}>
      <div ref={top} className="h-px" />
      <div className={`sticky top-0 z-30 transition-[background,box-shadow] duration-200 ${scrolled ? 'ios-bar' : ''}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-[58px] px-4 flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-full bg-white grid place-items-center shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
            <img src="/octos-mark.svg" alt="" width={27} height={27} />
          </span>
          <span className="octos-wordmark text-[21px] text-[#111]">OCTOS</span>
          <span className="ml-auto w-10 h-10 rounded-full bg-white grid place-items-center shadow-[0_2px_10px_rgba(0,0,0,0.08)]
            [&_button]:!w-10 [&_button]:!h-10 [&_button]:!rounded-full">
            <NotificationBell />
          </span>
          <IOSAccount variant="card" />
        </div>
      </div>

      <div className="px-4 pt-1">
        <div className="text-[12px] font-semibold tracking-[0.04em] uppercase text-[#6E6E73]">Branch Manager</div>
        <h1 className="m-0 text-[26px] leading-[32px] font-extrabold tracking-[-0.02em] text-[#111]">{branch.name || 'Your branch'}</h1>
      </div>

      {stranded && <div className="px-4 mt-3 empty:hidden">{stranded}</div>}

      <div className="mx-4 mt-3.5 h-[56px] rounded-[16px] bg-white flex items-center shadow-[0_3px_12px_rgba(17,24,39,0.05)]
        border border-black/[0.03]">
        <Fact icon={I.pin} top={branch.region_name || '—'} bottom="Region" />
        <Fact icon={I.layers} top={branch.belt_name || '—'} bottom="Belt" />
        <Fact icon={I.calendar} top={now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} bottom={String(now.getFullYear())} />
        <Fact icon={I.gauge}>
          <span className="min-w-0 leading-[17px]">
            <span className="block text-[11px] text-[#6E6E73] whitespace-nowrap">Floor load</span>
            <span className="inline-block mt-0.5 px-2 py-[1px] rounded-full text-[12px] font-bold"
              style={{ background: floorPill[0], color: floorPill[1] }}>
              {floor?.state === 'closed' ? 'Closed' : floor?.percent != null ? `${floor.percent}%` : '—'}
            </span>
          </span>
        </Fact>
      </div>

      <div className="px-4 mt-3.5 grid grid-cols-2 gap-2.5">
        <button type="button" onClick={onNewJob}
          className="h-[64px] rounded-[18px] px-2.5 flex items-center gap-2 text-left text-white active:scale-[0.98] transition-transform
            shadow-[0_6px_14px_rgba(215,0,21,0.18)]"
          style={{ background: 'linear-gradient(135deg,#EF1C2C 0%,#C8000F 100%)' }}>
          <span className="w-9 h-9 rounded-[11px] bg-white grid place-items-center shrink-0" style={{ color: RED }}>
            <Svg d={I.plus} size={20} width={2.8} />
          </span>
          <span className="min-w-0">
            <span className="block text-[16px] font-bold leading-[20px]">New Job</span>
            <span className="block text-[10.5px] leading-[13px] text-white/85">Instant · Production · Design</span>
          </span>
        </button>
        <button type="button" onClick={onNewCustomer}
          className="h-[64px] rounded-[18px] px-2.5 flex items-center gap-2 text-left bg-white active:scale-[0.98] transition-transform
            shadow-[0_4px_14px_rgba(17,24,39,0.06)] border border-black/[0.03]">
          <span className="w-9 h-9 rounded-[11px] grid place-items-center shrink-0 text-[#1C1C1E]">
            <Svg d={I.personPlus} size={21} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold leading-[20px] text-[#111] whitespace-nowrap">New Customer</span>
            <span className="block text-[10.5px] leading-[14px] text-[#8A8A8E] whitespace-nowrap">Register a customer</span>
          </span>
        </button>
      </div>

      <h2 className="m-0 px-4 mt-5 mb-2.5 text-[20px] font-extrabold tracking-[-0.01em] text-[#111]">Today’s Pulse</h2>
      <div className="px-4 grid grid-cols-2 gap-2.5">
        <Pulse tint="blue" icon={I.folder} label="Total Jobs" value={dash || (stats?.total ?? 0)} />
        <Pulse tint="green" icon={I.check} label="Complete" value={dash || (stats?.complete ?? 0)} />
        <Pulse tint="amber" icon={I.cycle} label="In Progress" value={dash || (stats?.in_progress ?? 0)} />
        <Pulse tint="purple" icon={I.coins} label="Revenue"
          value={dash || (revenue?.total_collected != null ? `₵${fmtMoney(revenue.total_collected)}` : '—')} />
      </div>

      <div className="px-4 mt-5 mb-2.5 flex items-center justify-between">
        <h2 className="m-0 text-[20px] font-extrabold tracking-[-0.01em] text-[#111]">Active Workload</h2>
        <button type="button" onClick={() => onNavigate('jobs')}
          className="flex items-center gap-1 text-[15px] font-semibold active:opacity-60" style={{ color: RED }}>
          View all jobs <Svg d={I.arrow} size={18} width={2.4} />
        </button>
      </div>
      <div className="px-4 space-y-2">
        <Work tint="blue" icon={I.card} title="Pending Payment"
          detail={pending ? `Oldest waiting ${mins(oldest)}` : 'Nothing waiting'}
          value={dash || pending} urgent={pending > 0 && oldest > 15} onClick={() => onNavigate('pending_payment')} />
        <Work tint="blue" icon={I.trend} title="In Production" detail="Confirmed + In Progress"
          value={dash || (w.in_production ?? 0)} onClick={() => onNavigate('in_production')} />
        <Work tint="green" icon={I.pin} title="Ready for Pickup" detail="Awaiting collection"
          value={dash || (w.ready_for_pickup ?? 0)} onClick={() => onNavigate('ready_for_pickup')} />
        <Work tint="purple" icon={I.chat} title="Awaiting Feedback" detail="Sample sent · Revision"
          value={dash || (w.awaiting_feedback ?? 0)} onClick={() => onNavigate('awaiting_feedback')} />
        <Work tint="grey" icon={I.clock} title="Overdue" detail="Past deadline"
          value={dash || overdue} urgent={overdue > 0} onClick={() => onNavigate('overdue')} />
      </div>
    </div>
  )
}
