// src/components/bm/DaySheet.jsx
import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTodaySummary, getLockStatus, getEODPrediction } from '../../api/bm'
import CloseSheetModal from './CloseSheetModal'
import client from '../../api/client'

function HourlyChart({ data, height = 140 }) {
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
      if (d.count > 0) {
        ctx.fillStyle = isPeak ? '#4338ca' : '#94a3b8'
        ctx.font      = `bold ${dpr > 1 ? 9 : 10}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(d.count, padL + i * gap + gap / 2, y - 3)
      }
      ctx.fillStyle = lblClr
      ctx.font      = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(d.label, padL + i * gap + gap / 2, H - 8)
    })
  }, [data, height])
  return (
    <div style={{ minWidth: '520px' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: `${height}px`, display: 'block' }} />
    </div>
  )
}

function fmt(amount) {
  return `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function pct(val) {
  return `${parseFloat(val || 0).toFixed(1)}%`
}

export default function DaySheet() {
  const [showCloseModal, setShowCloseModal] = useState(false)

  const { data: summary, isLoading } = useQuery({
    queryKey: ['todaySummary'],
    queryFn:  () => getTodaySummary().then(r => r.data),
    refetchInterval: 30_000,
  })

  const [perfPeriod, setPerfPeriod] = useState('day')

  const { data: perfData } = useQuery({
    queryKey: ['performance-today', perfPeriod],
    queryFn:  () => client.get(`/api/v1/jobs/performance/?period=${perfPeriod}`).then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
    placeholderData: prev => prev,
  })

  const { data: lockData } = useQuery({
    queryKey: ['lockStatus'],
    queryFn:  () => getLockStatus().then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 0,
  })

  const { data: prediction } = useQuery({
    queryKey: ['eodPrediction'],
    queryFn:  () => getEODPrediction().then(r => r.data),
    refetchInterval: 300_000,
    staleTime: 240_000,
  })

  if (isLoading) return (
    <div className="p-6 space-y-4">
      {[1,2,3].map(i => (
        <div key={i} className="h-24 bg-[var(--panel)] border border-[var(--border)]
          rounded-xl animate-pulse" />
      ))}
    </div>
  )

  const meta      = summary?.meta      || {}
  const revenue   = summary?.revenue   || {}
  const jobs      = summary?.jobs      || {}
  const pace      = summary?.pace      || {}
  const inventory = summary?.inventory || []
  const alerts    = summary?.alerts    || []

  const minsToClose   = lockData?.mins_to_close ?? 999
  const canClose      = lockData?.can_close_sheet
  const showCloseBtn  = minsToClose <= 30
  const isClosed      = meta.status === 'CLOSED' || meta.status === 'AUTO_CLOSED'
  const lowStockItems   = inventory.filter(i => i.is_low)
  const consumedToday   = inventory.filter(i => parseFloat(i.consumed || 0) > 0)

  return (
    <div className="p-5 sm:p-6 space-y-5">

      {/* Sheet header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Day Sheet</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {meta.sheet_number} · {meta.date} · {meta.status}
          </p>
        </div>
        {isClosed ? (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50
            border border-emerald-200 rounded-xl">
            <span className="w-5 h-5 bg-emerald-100 rounded-full flex items-center
              justify-center text-emerald-600 text-xs shrink-0">✓</span>
            <div>
              <div className="text-xs font-black text-emerald-800">Sheet Closed</div>
              <div className="text-[10px] text-emerald-600 font-semibold">
                {meta.closed_at
                  ? new Date(meta.closed_at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
                  : 'Today'}
              </div>
            </div>
          </div>
        ) : showCloseBtn ? (
          <button
            disabled={!canClose}
            onClick={() => canClose && setShowCloseModal(true)}
            className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-colors
              flex items-center gap-2
              ${canClose
                ? 'bg-[var(--text)] text-white hover:opacity-90'
                : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text-3)] cursor-not-allowed'
              }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
              <line x1="6" y1="1" x2="6" y2="4"/>
              <line x1="10" y1="1" x2="10" y2="4"/>
              <line x1="14" y1="1" x2="14" y2="4"/>
            </svg>
            {canClose ? 'Close Day Sheet' : 'Waiting for cashier sign-off'}
          </button>
        ) : null}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="p-3 bg-[var(--amber-bg)] border border-[var(--amber-border)]
          rounded-xl flex items-start gap-2">
          <span className="text-[var(--amber-text)] shrink-0 mt-0.5">⚠</span>
          <div className="text-xs text-[var(--amber-text)]">
            {alerts.map((a, i) => <div key={i}>{a.message}</div>)}
          </div>
        </div>
      )}

      {/* Revenue cards */}
      <div>
        <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
          tracking-widest mb-2">Revenue</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Cash',           value: revenue.cash,            color: 'border-t-emerald-500', textColor: 'text-emerald-600' },
            { label: 'MoMo',           value: revenue.momo,            color: 'border-t-amber-400',   textColor: 'text-amber-600'  },
            { label: 'POS',            value: revenue.pos,             color: 'border-t-blue-500',    textColor: 'text-blue-600'   },
            { label: 'Net Cash in Till', value: revenue.net_cash_in_till, color: 'border-t-zinc-400',  textColor: 'text-[var(--text)]' },
          ].map(card => (
            <div key={card.label}
              className={`bg-[var(--panel)] border border-[var(--border)] border-t-4
                ${card.color} rounded-xl p-4`}>
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                tracking-wider mb-2">{card.label}</div>
              <div className={`font-mono font-black text-xl ${card.textColor}`}>
                {fmt(card.value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total revenue */}
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4
        flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">
            Total Collected
          </div>
          <div className="font-mono font-black text-2xl text-[var(--text)]">
            {fmt(revenue.total)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">
            Credit Issued
          </div>
          <div className="font-mono font-bold text-lg text-[var(--amber-text)]">
            {fmt(revenue.credit_issued)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">
            Petty Cash Out
          </div>
          <div className="font-mono font-bold text-lg text-[var(--red-text)]">
            {fmt(revenue.petty_cash_out)}
          </div>
        </div>
      </div>

      {/* Job stats */}
      <div>
        <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
          tracking-widest mb-2">Jobs</div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: 'Total',    value: jobs.total,       color: 'text-[var(--text)]'    },
            { label: 'Complete', value: jobs.complete,    color: 'text-emerald-600'       },
            { label: 'In Progress', value: jobs.in_progress, color: 'text-amber-600'    },
            { label: 'Pending',  value: jobs.pending,     color: 'text-red-500'          },
            { label: 'Registered', value: jobs.registered, color: 'text-blue-600'       },
            { label: 'Walk-in',  value: jobs.walkin,      color: 'text-[var(--text-2)]' },
          ].map(card => (
            <div key={card.label}
              className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-3 text-center">
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                tracking-wider mb-1">{card.label}</div>
              <div className={`font-mono font-black text-xl ${card.color}`}>
                {card.value ?? '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analytics strip */}
      <div>
        <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
          tracking-widest mb-2">Pace & Predictions</div>
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">

          {/* Top row — jobs/hour + avg job value */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                tracking-wider mb-1">Jobs / Hour</div>
              <div className="font-mono font-black text-xl text-[var(--text)]">
                {pace.jobs_per_hour?.toFixed(1) ?? '—'}
              </div>
              {pace.pace_change_pct != null && (
                <div className={`text-[10px] mt-0.5 font-semibold
                  ${pace.pace_change_pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {pace.pace_change_pct >= 0 ? '↑' : '↓'} {Math.abs(pace.pace_change_pct).toFixed(1)}% vs yesterday
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                tracking-wider mb-1">Avg Job Value</div>
              <div className="font-mono font-black text-xl text-[var(--text)]">
                {fmt(pace.avg_job_value_today)}
              </div>
              <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                7d avg: {fmt(pace.avg_job_value_7d)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                tracking-wider mb-1">Data Signal</div>
              <div className="font-mono font-black text-xl text-[var(--text)]">
                {prediction?.data_weeks ?? '—'}
                <span className="text-xs font-normal text-[var(--text-3)] ml-1">wks</span>
              </div>
              <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                {prediction?.method === 'curve' ? 'Curve model' : 'Linear fallback'}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                tracking-wider mb-1">Weather</div>
              <div className="font-mono font-black text-xl text-[var(--text)]">
                {prediction?.weather_factor != null
                  ? `${Math.round(prediction.weather_factor * 100)}%`
                  : '—'}
              </div>
              <div className="text-[10px] text-[var(--text-3)] mt-0.5 truncate">
                {prediction?.weather_note || 'No impact'}
              </div>
            </div>
          </div>

          {/* Prediction interval panel */}
          {prediction && (
            <div className="border border-[var(--border)] rounded-xl overflow-hidden mb-4">
              {/* Header */}
              <div className="px-4 py-2.5 bg-[var(--bg)] border-b border-[var(--border)]
                flex items-center justify-between">
                <span className="text-[10px] font-black text-[var(--text-2)] uppercase tracking-wider">
                  EOD Forecast
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 bg-[var(--border)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        prediction.confidence_pct >= 70 ? 'bg-emerald-500' :
                        prediction.confidence_pct >= 45 ? 'bg-amber-400' : 'bg-zinc-400'
                      }`}
                      style={{ width: `${prediction.confidence_pct}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-black ${
                    prediction.confidence_pct >= 70 ? 'text-emerald-600' :
                    prediction.confidence_pct >= 45 ? 'text-amber-600' : 'text-[var(--text-3)]'
                  }`}>
                    {prediction.confidence_pct}% confidence
                  </span>
                </div>
              </div>

              {/* Two columns — jobs + revenue */}
              <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
                {/* Jobs */}
                <div className="px-4 py-3">
                  <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                    tracking-wider mb-1">Likely EOD Jobs</div>
                  <div className="font-mono font-black text-2xl text-[var(--text)]">
                    {prediction.jobs_point}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-[var(--text-3)]">Range</span>
                    <span className="text-xs font-bold text-[var(--text-2)]">
                      {prediction.jobs_low} – {prediction.jobs_high}
                    </span>
                  </div>
                </div>

                {/* Revenue */}
                <div className="px-4 py-3">
                  <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                    tracking-wider mb-1">Likely EOD Revenue</div>
                  <div className="font-mono font-black text-2xl text-violet-600">
                    {fmt(prediction.revenue_point)}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-[var(--text-3)]">Range</span>
                    <span className="text-xs font-bold text-[var(--text-2)]">
                      {fmt(prediction.revenue_low)} – {fmt(prediction.revenue_high)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Weather note if applicable */}
              {prediction.weather_note && (
                <div className="px-4 py-2 bg-blue-50 border-t border-blue-100
                  flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" className="text-blue-500 shrink-0">
                    <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/>
                    <line x1="8" y1="16" x2="8.01" y2="16"/>
                    <line x1="8" y1="20" x2="8.01" y2="20"/>
                    <line x1="12" y1="18" x2="12.01" y2="18"/>
                    <line x1="12" y1="22" x2="12.01" y2="22"/>
                    <line x1="16" y1="16" x2="16.01" y2="16"/>
                    <line x1="16" y1="20" x2="16.01" y2="20"/>
                  </svg>
                  <span className="text-[10px] text-blue-700 font-semibold">
                    {prediction.weather_note}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Hourly activity chart */}
          <div className="mt-5 pt-4 border-t border-[var(--border)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
                  Activity
                </div>
                <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                  {`${perfData?.summary?.total ?? (perfData?.hourly || []).reduce((s, h) => s + h.count, 0)} jobs · by hour · ${perfPeriod === 'day' ? 'today' : perfPeriod === 'week' ? 'this week' : 'this month'}`}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {perfData?.peak?.count > 0 && (
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Peak</div>
                    <div className="text-sm font-black text-violet-600">{perfData.peak.label}</div>
                    <div className="text-[10px] text-[var(--text-3)]">{perfData.peak.count} jobs</div>
                  </div>
                )}
                <div className="flex gap-0.5 bg-[var(--border)] p-0.5 rounded-lg">
                  {[
                    { value: 'day',   label: 'Today' },
                    { value: 'week',  label: 'Week'  },
                    { value: 'month', label: 'Month' },
                  ].map(p => (
                    <button key={p.value} onClick={() => setPerfPeriod(p.value)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors
                        ${perfPeriod === p.value
                          ? 'bg-[var(--text)] text-white'
                          : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                        }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="w-full overflow-x-auto">
              {perfPeriod === 'day' ? (
                (perfData?.hourly?.length > 0 && perfData.hourly.some(h => h.count > 0)) ? (
                  <HourlyChart data={perfData.hourly} height={150} />
                ) : (
                  <div className="flex items-center justify-center h-20 text-xs text-[var(--text-3)]">
                    No activity yet today
                  </div>
                )
              ) : (
                (perfData?.hourly?.length > 0 && perfData.hourly.some(h => h.count > 0)) ? (
                  <HourlyChart data={perfData.hourly} height={150} />
                ) : (
                  <div className="flex items-center justify-center h-20 text-xs text-[var(--text-3)]">
                    No activity for this period
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Inventory */}
      {(consumedToday.length > 0 || lowStockItems.length > 0) && (
        <div>
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
            tracking-widest mb-2">
            Consumed Today ({consumedToday.length} items)
            {lowStockItems.length > 0 && (
              <span className="ml-2 text-amber-600">· {lowStockItems.length} low stock</span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {(consumedToday.length > 0 ? consumedToday : lowStockItems).map((item, i) => {
              const closing = parseFloat(item.closing ?? 0)
              const isCritical = closing <= 0
              return (
                <div key={i}
                  className={`bg-[var(--panel)] border rounded-xl px-3 py-2.5
                    ${isCritical ? 'border-[var(--red-border)]' : 'border-[var(--border)]'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--text)] leading-tight truncate">
                        {item.consumable}
                      </div>
                      <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                        {item.category} · {item.unit}
                      </div>
                    </div>
                    <span className={`font-mono font-black text-sm shrink-0
                      ${isCritical ? 'text-[var(--red-text)]' : 'text-amber-500'}`}>
                      {item.closing}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--text-3)]">
                    <span>{item.opening} open</span>
                    <span className="text-[var(--border-dark)]">·</span>
                    <span>-{item.consumed} used</span>
                    <span className="text-[var(--border-dark)]">·</span>
                    <span>min {item.reorder_point}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    {showCloseModal && (
        <CloseSheetModal
          sheetId={meta.sheet_id}
          summary={summary}
          onClose={() => setShowCloseModal(false)}
          onSuccess={() => setShowCloseModal(false)}
        />
      )}
    </div>
  )
}