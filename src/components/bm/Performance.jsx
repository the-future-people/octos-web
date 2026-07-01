// src/components/bm/Performance.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function fmtK(n) {
  const v = parseFloat(n || 0)
  if (v >= 1000) return `GHS ${(v / 1000).toFixed(1)}k`
  return fmt(v)
}

const getPerformance = (period) =>
  client.get(`/api/v1/jobs/performance/?period=${period}`).then(r => r.data)

// ── Bar chart (canvas) ────────────────────────────────────────────────────────
function HourlyChart({ data, height = 160 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data?.length) return

    const maxCount = Math.max(...data.map(d => d.count), 1)
    const dpr = window.devicePixelRatio || 1
    const W   = canvas.offsetWidth
    const H   = height

    canvas.width  = W * dpr
    canvas.height = H * dpr
    canvas.style.width  = W + 'px'
    canvas.style.height = H + 'px'

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const padL = 8, padR = 8, padT = 10, padB = 28
    const cW   = W - padL - padR
    const cH   = H - padT - padB
    const barW = (cW / data.length) * 0.55
    const gap  = cW / data.length

    const isDark  = document.documentElement.dataset.theme === 'dark'
    const lblClr  = isDark ? '#6b6b69' : '#a3a3a3'
    const peakIdx = data.reduce((mi, d, i) => d.count > data[mi].count ? i : mi, 0)

    ctx.clearRect(0, 0, W, H)

    data.forEach((d, i) => {
      const bH = d.count > 0 ? Math.max((d.count / maxCount) * cH, 4) : 2
      const x  = padL + i * gap + (gap - barW) / 2
      const y  = padT + cH - bH

      const isPeak = i === peakIdx && d.count > 0
      ctx.fillStyle = isPeak ? '#6366f1' : (d.count > 0 ? '#c7d2fe' : '#f1f5f9')
      ctx.beginPath()
      ctx.roundRect(x, y, barW, bH, 3)
      ctx.fill()

      // Count label on top
      if (d.count > 0) {
        ctx.fillStyle = isPeak ? '#4338ca' : '#94a3b8'
        ctx.font      = `bold ${dpr > 1 ? 9 : 10}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(d.count, padL + i * gap + gap / 2, y - 3)
      }

      // Hour label
      ctx.fillStyle = lblClr
      ctx.font      = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(d.label, padL + i * gap + gap / 2, H - 8)
    })
  }, [data, height])

  return <canvas ref={canvasRef} style={{ width: '100%', height: `${height}px`, display: 'block' }} />
}

// ── Service bar ───────────────────────────────────────────────────────────────
function ServiceBar({ name, count, revenue, percentage, rank }) {
  const COLORS = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
                  'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-pink-500']
  const color  = COLORS[rank % COLORS.length]

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
      <div className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-semibold text-[var(--text)] truncate">{name}</span>
          <span className="text-xs font-mono font-bold text-[var(--text)] shrink-0">{fmt(revenue)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full transition-all duration-500`}
              style={{ width: `${percentage}%` }} />
          </div>
          <span className="text-[10px] text-[var(--text-3)] font-mono shrink-0 w-10 text-right">
            {count} jobs
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Staff card ────────────────────────────────────────────────────────────────
function StaffCard({ member, rank }) {
  const rateColor = member.rate >= 95 ? 'text-emerald-600' : member.rate >= 80 ? 'text-amber-500' : 'text-red-500'
  const initials  = member.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const BG_COLORS = ['bg-violet-100 text-violet-700', 'bg-blue-100 text-blue-700',
                     'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700']
  const avatarClr = BG_COLORS[rank % BG_COLORS.length]

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center
          text-xs font-black shrink-0 ${avatarClr}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-[var(--text)] truncate">{member.name}</div>
          <div className="text-[10px] text-[var(--text-3)]">{member.total} jobs intake</div>
        </div>
        <div className={`text-lg font-black ${rateColor}`}>{member.rate}%</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total',    value: member.total,              color: 'text-[var(--text)]'  },
          { label: 'Complete', value: member.complete,           color: 'text-emerald-600'     },
          { label: 'Revenue',  value: fmtK(member.revenue),      color: 'text-blue-600'        },
        ].map(c => (
          <div key={c.label} className="bg-[var(--bg)] rounded-lg px-2 py-2 text-center">
            <div className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-0.5">{c.label}</div>
            <div className={`text-sm font-black font-mono ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Completion bar */}
      <div className="mt-3 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500
          ${member.rate >= 95 ? 'bg-emerald-500' : member.rate >= 80 ? 'bg-amber-400' : 'bg-red-400'}`}
          style={{ width: `${member.rate}%` }} />
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const PERIODS = [
  { value: 'day',   label: 'Today'     },
  { value: 'week',  label: 'This Week'  },
  { value: 'month', label: 'This Month' },
]

export default function Performance() {
  const [period, setPeriod] = useState('day')

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['performance', period],
    queryFn:  () => getPerformance(period),
    refetchInterval: 60_000,
    staleTime: 30_000,
    placeholderData: prev => prev,
  })

  const summary  = data?.summary  || {}
  const services = data?.services || []
  const staff    = data?.staff    || []

  return (
    <div className="p-5 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Performance</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            Branch operations analytics
          </p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1 bg-black/5 p-1 rounded-xl">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors
                ${period === p.value
                  ? 'bg-[var(--panel)] text-[var(--text)] shadow-sm'
                  : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && !data ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-[var(--panel)] border border-[var(--border)] rounded-2xl animate-pulse" />)}
        </div>
      ) : (<>

        {/* Summary KPIs — responsive: 2 rows mobile, 1 row md+ */}
        {(() => {
          const kpis = [
            { label: 'Total',    value: summary.total,         color: 'text-[var(--text)]',  dot: '#94a3b8' },
            { label: 'Complete', value: summary.complete,      color: 'text-emerald-600',     dot: '#10b981' },
            { label: 'Pending',  value: summary.pending,       color: 'text-amber-600',       dot: '#f59e0b' },
            { label: 'Rate',     value: `${summary.rate}%`,    color: summary.rate >= 95 ? 'text-emerald-600' : summary.rate >= 80 ? 'text-amber-500' : 'text-red-500', dot: '#6366f1' },
            { label: 'Revenue',  value: fmtK(summary.revenue), color: 'text-blue-600',        dot: '#3b82f6' },
          ]
          const KpiCell = ({ c, last }) => (
            <div className={`flex-1 px-3 py-2.5 text-center min-w-0 ${!last ? 'border-r border-[var(--border)]' : ''}`}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
                <span className="text-[9px] sm:text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider truncate">
                  {c.label}
                </span>
              </div>
              <div className={`font-mono font-black text-base sm:text-lg ${c.color}`}>{c.value ?? '—'}</div>
            </div>
          )
          return (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl overflow-hidden">
              {/* Mobile: row 1 — 3 items */}
              <div className="flex md:hidden items-center border-b border-[var(--border)]">
                {kpis.slice(0, 3).map((c, i) => <KpiCell key={c.label} c={c} last={i === 2} />)}
              </div>
              {/* Mobile: row 2 — 2 items */}
              <div className="flex md:hidden items-center">
                {kpis.slice(3).map((c, i) => <KpiCell key={c.label} c={c} last={i === 1} />)}
              </div>
              {/* md+: single row — all 5 */}
              <div className="hidden md:flex items-center divide-x divide-[var(--border)]">
                {kpis.map((c, i) => <KpiCell key={c.label} c={c} last={i === 4} />)}
              </div>
            </div>
          )
        })()}

        {/* Services + Staff — side by side on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Top services */}
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-[var(--text)]">Top Services</div>
                <div className="text-xs text-[var(--text-3)] mt-0.5">By revenue · completed jobs</div>
              </div>
              <span className="text-[10px] font-bold text-[var(--text-3)]">
                {services.length} services
              </span>
            </div>
            {services.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-sm text-[var(--text-3)]">
                No completed jobs yet
              </div>
            ) : (
              <div>
                {services.map((s, i) => (
                  <ServiceBar key={s.name} {...s} rank={i} />
                ))}
              </div>
            )}
          </div>

          {/* Staff performance */}
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-[var(--text)]">Staff Performance</div>
                <div className="text-xs text-[var(--text-3)] mt-0.5">Completion rate and revenue</div>
              </div>
              <span className="text-[10px] font-bold text-[var(--text-3)]">
                {staff.length} staff
              </span>
            </div>
            {staff.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-sm text-[var(--text-3)]">
                No staff activity recorded
              </div>
            ) : (
              <div className="space-y-3">
                {staff.map((m, i) => (
                  <StaffCard key={m.id} member={m} rank={i} />
                ))}
              </div>
            )}
          </div>

        </div>

        </>)}
    </div>
  )
}