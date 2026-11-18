// src/components/bm/DaySheetPhone.jsx
//
// The Day Sheet on a phone (18 Nov 2026), in the Overview's look: the day's
// money first, then the jobs, how the day is going, when the work came in,
// who it came from, and the stock it used. Close the day sheet sits at the
// top once closing is near, as on the computer. The same data as DaySheet.jsx.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import { getTodaySummary, getLockStatus, getEODPrediction } from '../../api/bm'
import CloseSheetModal from './CloseSheetModal'
import PhoneHeader from './PhoneHeader'

const RED = '#D70015'
const card = 'mx-4 rounded-[16px] bg-white border border-black/[0.04] shadow-[0_3px_12px_rgba(17,24,39,0.05)]'
const RED_FILL = { background: 'linear-gradient(135deg,#EF1C2C 0%,#C8000F 100%)' }
const money = v => `GHS ${parseFloat(v || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const whole = v => {
  const n = parseFloat(v || 0)
  return `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
}
const clock = iso => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }) : '')

const Svg = ({ d, size = 18, width = 2, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{d}</svg>
)

function Title({ children, extra }) {
  return (
    <div className="px-5 pt-6 pb-2 flex items-end justify-between gap-3">
      <h2 className="m-0 text-[20px] leading-[25px] font-bold text-[#111]">{children}</h2>
      {extra}
    </div>
  )
}

function Segmented({ value, options, onPick }) {
  return (
    <div className="p-[2px] rounded-[9px] bg-black/[0.06] flex" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onPick(v)}
          className={`h-[26px] px-2.5 rounded-[7px] text-[12.5px] font-semibold ${value === v ? 'bg-white text-[#111] shadow-[0_1px_4px_rgba(0,0,0,0.10)]' : 'text-[#3A3A3C]'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

// Jobs by hour as plain bars, the busiest in Octos red. Drawn to fit the
// phone's width: no scrolling sideways.
function HourBars({ hours }) {
  const max = Math.max(...hours.map(h => h.count), 1)
  const peak = hours.reduce((pi, h, i) => (h.count > hours[pi].count ? i : pi), 0)
  return (
    <div className="flex items-end gap-[3px] h-[132px] pt-5">
      {hours.map((h, i) => {
        const on = h.count > 0
        const height = on ? Math.max(6, (h.count / max) * 96) : 3
        return (
          <div key={h.hour ?? h.label} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
            {on && <span className={`text-[10.5px] font-semibold tabular-nums ${i === peak ? 'text-[#D70015]' : 'text-[#8A8A8E]'}`}>{h.count}</span>}
            <span className="w-full max-w-[18px] rounded-[4px]" style={{ height, background: !on ? '#EDEDF0' : i === peak ? RED : '#C9DBFF' }} />
            <span className="text-[9.5px] text-[#A1A1AA] whitespace-nowrap">{i % 2 === 0 ? h.label.replace(/(am|pm)$/, m => m[0]) : ''}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function DaySheetPhone() {
  const [closing, setClosing] = useState(false)
  const [period, setPeriod] = useState('day')
  const { data: summary, isLoading } = useQuery({ queryKey: ['todaySummary'], queryFn: () => getTodaySummary().then(r => r.data), refetchInterval: 30_000 })
  const { data: perf } = useQuery({
    queryKey: ['performance-today', period],
    queryFn: () => client.get(`/api/v1/jobs/performance/?period=${period}`).then(r => r.data),
    refetchInterval: 60_000, staleTime: 30_000, placeholderData: prev => prev,
  })
  const { data: lock } = useQuery({ queryKey: ['lockStatus'], queryFn: () => getLockStatus().then(r => r.data), refetchInterval: 30_000, staleTime: 0 })
  const { data: forecast } = useQuery({ queryKey: ['eodPrediction'], queryFn: () => getEODPrediction().then(r => r.data), refetchInterval: 300_000, staleTime: 240_000 })

  const meta = summary?.meta || {}
  const revenue = summary?.revenue || {}
  const jobs = summary?.jobs || {}
  const pace = summary?.pace || {}
  const inventory = summary?.inventory || []
  const alerts = summary?.alerts || []
  const closed = meta.status === 'CLOSED' || meta.status === 'AUTO_CLOSED'
  const nearClose = (lock?.mins_to_close ?? 999) <= 30
  const used = inventory.filter(i => parseFloat(i.consumed || 0) > 0)
  const low = inventory.filter(i => i.is_low)
  const stock = used.length ? used : low
  const hours = perf?.hourly || []
  const busy = hours.some(h => h.count > 0)
  const dateWords = meta.date ? new Date(`${meta.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
  // A forecast only while there is day left to forecast.
  const showForecast = forecast && (forecast.remaining_hours > 0 || forecast.jobs_point > 0)

  return (
    <div className="ios min-h-full pb-6" style={{ background: '#F6F6F8' }}>
      <PhoneHeader />
      <div className="px-4 pt-1">
        <h1 className="m-0 text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] text-[#111]">Day Sheet</h1>
        <div className="mt-0.5 flex items-center gap-2 text-[14px] text-[#6E6E73]">
          <span className="tabular-nums">{meta.sheet_number}</span><span>·</span><span>{dateWords}</span><span>·</span>
          <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: closed ? '#6E6E73' : '#15803D' }}>
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: closed ? '#A1A1AA' : '#22C55E' }} />{closed ? 'Closed' : 'Open'}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 pt-4 space-y-3 animate-pulse" aria-hidden="true">
          <div className="h-[150px] rounded-[16px] bg-black/[0.05]" /><div className="h-[120px] rounded-[16px] bg-black/[0.05]" />
        </div>
      ) : (
        <>
          {/* Closing: done, or the button once it is near */}
          {closed ? (
            <div className={`${card} mt-3 px-4 py-3 flex items-center gap-3`}>
              <span className="w-9 h-9 rounded-full grid place-items-center" style={{ background: '#D3F2DE', color: '#15803D' }}><Svg d={<path d="M20 6 9 17l-5-5" />} width={2.6} /></span>
              <span><span className="block text-[15.5px] font-semibold">Day sheet closed</span>
                <span className="block text-[13px] text-[#8A8A8E]">{meta.closed_at ? `At ${clock(meta.closed_at)}` : 'Today'}{meta.closed_by ? ` by ${meta.closed_by}` : ''}</span></span>
            </div>
          ) : nearClose && (
            <div className="mx-4 mt-3">
              <button type="button" onClick={() => lock?.can_close_sheet && setClosing(true)} disabled={!lock?.can_close_sheet}
                className="w-full h-[50px] rounded-[16px] text-[16px] font-semibold inline-flex items-center justify-center gap-2 disabled:text-[#8A8A8E]"
                style={lock?.can_close_sheet ? { ...RED_FILL, color: '#FFFFFF' } : { background: '#E5E5EA' }}>
                <Svg d={<path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2" />} />
                {lock?.can_close_sheet ? 'Close the day sheet' : 'Waiting for the cashier to sign off'}
              </button>
            </div>
          )}

          {alerts.length > 0 && (
            <div className="mx-4 mt-3 px-3.5 py-3 rounded-[14px] bg-[#FFF8EC] text-[13.5px] text-[#8A5A00] flex gap-2.5">
              <Svg d={<path d="M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />} />
              <div className="space-y-0.5">{alerts.map((a, i) => <div key={i}>{a.message}</div>)}</div>
            </div>
          )}

          {/* The money */}
          <div className={`${card} mt-3`}>
            <div className="px-4 pt-3.5 pb-3">
              <div className="text-[13px] font-medium text-[#6E6E73]">Collected today</div>
              <div className="text-[32px] leading-[38px] font-extrabold tracking-[-0.02em] tabular-nums text-[#111]">{money(revenue.total)}</div>
            </div>
            <div className="grid grid-cols-3 border-t border-black/[0.06]">
              {[['Cash', revenue.cash, '#15803D'], ['MoMo', revenue.momo, '#B45309'], ['Card', revenue.pos, '#2563EB']].map(([label, v, dot], i) => (
                <div key={label} className={`px-3.5 py-2.5 min-w-0 ${i ? 'border-l border-black/[0.06]' : ''}`}>
                  <span className="flex items-center gap-1.5 text-[12.5px] text-[#6E6E73]"><span className="w-2 h-2 rounded-full" style={{ background: dot }} />{label}</span>
                  <span className="block mt-0.5 text-[15px] font-semibold tabular-nums truncate">{whole(v)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-black/[0.06] divide-y divide-black/[0.06]">
              {[
                ['Cash in the till', revenue.net_cash_in_till, null],
                ['Credit given', revenue.credit_issued, parseFloat(revenue.credit_issued || 0) > 0 ? '#B45309' : null],
                ['Petty cash out', revenue.petty_cash_out, parseFloat(revenue.petty_cash_out || 0) > 0 ? RED : null],
              ].map(([label, v, tone]) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[15px] text-[#1C1C1E]">{label}</span>
                  <span className="text-[15px] font-semibold tabular-nums" style={{ color: tone || '#111' }}>{money(v)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* The jobs */}
          <Title>Jobs</Title>
          <div className={`${card} grid grid-cols-3`}>
            {[
              // Black numbers; red only for jobs still waiting to be paid for.
              ['Total', jobs.total, '#111'], ['Complete', jobs.complete, '#111'], ['In progress', jobs.in_progress, '#111'],
              ['Pending', jobs.pending, jobs.pending > 0 ? RED : '#111'], ['Registered', jobs.registered, '#111'], ['Walk-in', jobs.walkin, '#111'],
            ].map(([label, v, tone], i) => (
              <div key={label} className={`px-3.5 py-3 ${i % 3 ? 'border-l border-black/[0.06]' : ''} ${i > 2 ? 'border-t border-black/[0.06]' : ''}`}>
                <div className="text-[12.5px] text-[#6E6E73]">{label}</div>
                <div className="text-[22px] leading-[28px] font-bold tabular-nums" style={{ color: tone }}>{v ?? '—'}</div>
              </div>
            ))}
          </div>

          {/* How the day is going */}
          <Title>How the day is going</Title>
          <div className={`${card} divide-y divide-black/[0.06]`}>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px]">Jobs an hour</span>
              <span className="text-right">
                <span className="block text-[15px] font-semibold tabular-nums">{pace.jobs_per_hour != null ? pace.jobs_per_hour.toFixed(1) : '—'}</span>
                {pace.pace_change_pct != null && (
                  <span className="block text-[12.5px] font-medium" style={{ color: pace.pace_change_pct >= 0 ? '#15803D' : RED }}>
                    {pace.pace_change_pct >= 0 ? '▲' : '▼'} {Math.abs(pace.pace_change_pct).toFixed(0)}% on yesterday
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px]">Average job</span>
              <span className="text-right">
                <span className="block text-[15px] font-semibold tabular-nums">{pace.avg_job_value_today != null ? money(pace.avg_job_value_today) : '—'}</span>
                {pace.avg_job_value_7d != null && <span className="block text-[12.5px] text-[#8A8A8E]">7-day average {money(pace.avg_job_value_7d)}</span>}
              </span>
            </div>
            {showForecast && (
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[15px]">By closing, likely</span>
                  <span className="text-[12.5px] text-[#8A8A8E]">{forecast.confidence_pct}% sure</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div><div className="text-[22px] leading-[28px] font-bold tabular-nums">{forecast.jobs_point} jobs</div>
                    <div className="text-[12.5px] text-[#8A8A8E]">{forecast.jobs_low}–{forecast.jobs_high}</div></div>
                  <div><div className="text-[22px] leading-[28px] font-bold tabular-nums">{whole(forecast.revenue_point)}</div>
                    <div className="text-[12.5px] text-[#8A8A8E]">{whole(forecast.revenue_low)}–{whole(forecast.revenue_high)}</div></div>
                </div>
                {forecast.weather_note && <div className="mt-2 text-[12.5px] text-[#2563EB]">{forecast.weather_note}</div>}
              </div>
            )}
          </div>

          {/* When the work came in */}
          <Title extra={<Segmented value={period} onPick={setPeriod} options={[['day', 'Today'], ['week', 'Week'], ['month', 'Month']]} />}>Jobs by hour</Title>
          <div className={`${card} px-3.5 pt-2 pb-3`}>
            {busy ? (
              <>
                <HourBars hours={hours} />
                {perf?.peak?.count > 0 && (
                  <div className="mt-2 text-[13px] text-[#6E6E73]">
                    Busiest at <b className="text-[#111]">{perf.peak.label}</b> · {perf.peak.count} job{perf.peak.count === 1 ? '' : 's'}
                    {' · '}{perf?.summary?.total ?? hours.reduce((s, h) => s + h.count, 0)} in all
                  </div>
                )}
              </>
            ) : (
              <div className="h-[90px] grid place-items-center text-[14px] text-[#8A8A8E]">{period === 'day' ? 'No jobs yet today' : 'No jobs in this period'}</div>
            )}
          </div>

          {/* Who it came from */}
          {jobs.total > 0 && (
            <>
              <Title>Who came in</Title>
              <div className={`${card} px-4 py-3.5`}>
                <div className="h-2.5 rounded-full overflow-hidden flex bg-[#EDEDF0]">
                  <span style={{ width: `${(jobs.registered / jobs.total) * 100}%`, background: '#3B82F6' }} />
                  <span style={{ width: `${(jobs.walkin / jobs.total) * 100}%`, background: '#F59E0B' }} />
                </div>
                <div className="mt-2.5 flex justify-between text-[13.5px]">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#3B82F6]" />Registered <b className="tabular-nums">{jobs.registered}</b>
                    <span className="text-[#8A8A8E]">{Math.round((jobs.registered / jobs.total) * 100)}%</span></span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#F59E0B]" />Walk-in <b className="tabular-nums">{jobs.walkin}</b>
                    <span className="text-[#8A8A8E]">{Math.round((jobs.walkin / jobs.total) * 100)}%</span></span>
                </div>
              </div>
            </>
          )}

          {/* The stock it used */}
          {stock.length > 0 && (
            <>
              <Title extra={low.length > 0 && <span className="text-[13px] font-semibold" style={{ color: '#B45309' }}>{low.length} running low</span>}>
                {used.length ? 'Stock used today' : 'Stock running low'}
              </Title>
              <div className={`${card} divide-y divide-black/[0.06]`}>
                {stock.map((item, i) => {
                  const left = parseFloat(item.closing ?? 0)
                  const tone = left <= 0 ? RED : item.is_low ? '#B45309' : '#111'
                  return (
                    <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-[15px] truncate">{item.consumable}</span>
                        <span className="block text-[12.5px] text-[#8A8A8E]">Used {item.consumed} · reorder at {item.reorder_point} {item.unit}</span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block text-[16px] font-bold tabular-nums" style={{ color: tone }}>{item.closing}</span>
                        <span className="block text-[11.5px] text-[#8A8A8E]">left</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {closing && (
        <CloseSheetModal sheetId={meta.sheet_id} summary={summary} onClose={() => setClosing(false)} onSuccess={() => setClosing(false)} />
      )}
    </div>
  )
}
