// src/components/bm/LiveToday.jsx
//
// The day, live (18 Nov 2026, from Khofi's widget reference): a dark card at
// the top of the phone's Overview, the way an iPhone widget sits on a home
// screen. Three rings, each with its line beside it:
//   blue    how much of the day has gone, and the time left to close
//   orange  jobs finished out of jobs taken today
//   green   what has been taken, against what the forecast expects
// Refreshed every 30 seconds; the time left ticks every minute. A tap opens
// the Day Sheet. A real home-screen widget needs a native app, so this is the
// in-app version.
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getEODPrediction, getLockStatus, getTodaySummary } from '../../api/bm'

const BLUE = '#0A84FF', ORANGE = '#FF9F0A', GREEN = '#30D158'
const clamp = v => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0))
const cedis = v => {
  const n = parseFloat(v || 0)
  return n >= 10000 ? `GHS ${(n / 1000).toFixed(1)}k` : `GHS ${n.toLocaleString('en-GH', { maximumFractionDigits: 0 })}`
}
const clock = d => d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', ' ')
function left(ms) {
  const m = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(m / 60)
  return h ? `${h}h ${m % 60}m` : `${m}m`
}

function Ring({ r, value, color }) {
  const c = 2 * Math.PI * r
  return (
    <>
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="7" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - clamp(value))} transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)' }} />
    </>
  )
}

function Line({ color, label, value }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color }} />
      <span className="text-[13px] text-white/60 shrink-0">{label}</span>
      <span className="ml-auto text-[13.5px] font-semibold text-white tabular-nums truncate">{value}</span>
    </div>
  )
}

export default function LiveToday({ onOpen }) {
  const { data: summary, dataUpdatedAt } = useQuery({ queryKey: ['todaySummary'], queryFn: () => getTodaySummary().then(r => r.data), refetchInterval: 30_000 })
  const { data: lock } = useQuery({ queryKey: ['lockStatus'], queryFn: () => getLockStatus().then(r => r.data), refetchInterval: 30_000, staleTime: 0 })
  const { data: forecast } = useQuery({ queryKey: ['eodPrediction'], queryFn: () => getEODPrediction().then(r => r.data), refetchInterval: 300_000, staleTime: 240_000 })

  // The time left moves on its own between refreshes.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const meta = summary?.meta
  const open = meta?.status === 'OPEN'
  const opened = meta?.opened_at ? new Date(meta.opened_at) : null
  const end = lock?.schedule?.shift_end ? new Date(lock.schedule.shift_end) : null
  const jobs = summary?.jobs || {}
  const total = jobs.total || 0
  const done = jobs.complete || 0
  const taken = parseFloat(summary?.revenue?.total || 0)
  const expected = parseFloat(forecast?.revenue_point || 0)

  const dayShare = !meta ? 0 : !open ? 1 : opened && end ? (now - opened) / (end - opened) : 0
  const dayText = !meta ? 'Not open yet'
    : !open ? (meta.closed_at ? `Closed ${clock(new Date(meta.closed_at))}` : 'Closed')
      : end ? (end > now ? `${left(end - now)} left` : 'Past closing') : 'Open'

  return (
    <button type="button" onClick={onOpen} aria-label="Today, live. Opens the day sheet."
      className="w-full text-left rounded-[24px] p-4 active:scale-[0.99] transition-transform shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
      style={{ background: 'linear-gradient(160deg,#1C1C1E 0%,#0B0B0C 100%)' }}>
      <div className="flex items-center gap-2">
        <span className="relative w-2 h-2">
          {open && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: GREEN, opacity: 0.6 }} />}
          <span className="absolute inset-0 rounded-full" style={{ background: open ? GREEN : 'rgba(255,255,255,0.35)' }} />
        </span>
        <span className="text-[14px] font-semibold text-white">{open ? 'Today, live' : 'Today'}</span>
        {dataUpdatedAt > 0 && <span className="ml-auto text-[12px] text-white/40 tabular-nums">Updated {clock(new Date(dataUpdatedAt))}</span>}
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="relative w-[104px] h-[104px] shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
            <Ring r={44} value={dayShare} color={BLUE} />
            <Ring r={35} value={total ? done / total : 0} color={ORANGE} />
            <Ring r={26} value={expected > 0 ? taken / Math.max(expected, taken) : taken > 0 ? 1 : 0} color={GREEN} />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-[22px] leading-[24px] font-extrabold text-white tabular-nums">{total}</div>
              <div className="text-[10.5px] text-white/50">jobs</div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2.5">
          <Line color={BLUE} label="Day" value={dayText} />
          <Line color={ORANGE} label="Finished" value={`${done} of ${total}`} />
          <Line color={GREEN} label="Taken" value={open && expected > taken ? `${cedis(taken)} of ~${cedis(expected).replace('GHS ', '')}` : cedis(taken)} />
        </div>
      </div>
    </button>
  )
}
