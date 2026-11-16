// src/components/attendant/AttendantOverview.jsx
//
// The attendant's Today screen (redesigned 16 Nov 2026). One call, polled
// every 30 seconds (GET /api/v1/jobs/attendant/today/), feeds all of it:
//
//   band          her photo, the greeting, her streak, Register customer, and
//                 the shift from opening to sign-off with a live countdown to
//                 recording closing
//   someone just scanned in   when a customer scans the counter QR
//   my day        a ring of her jobs against her own usual day, what she has
//                 recorded, how many are paid, jobs an hour, and New job, a
//                 round red button that greys and locks once recording closes
//   needs you now front-desk work to take, pickups ready, chats Octos handed
//                 to a person, her drafts; anything kept waiting pulses red
//   my jobs today her jobs as a timeline, newest first
//   quick price check, and the team's day against a usual day here
//
// Reaching her target sets off confetti, once a day.
import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { todayQuery } from '../../api/today'
import StaffAvatar from '../shared/StaffAvatar'
import QuickPriceCheck from './QuickPriceCheck'
import Confetti from './Confetti'

// ── Little helpers ───────────────────────────────────────────────────────

const money = n => Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function clock(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const h = d.getHours()
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
}

function hourLabel(h) {
  if (h == null) return '—'
  return `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`
}

function minutesSince(iso, now) {
  return iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000)) : 0
}

function waited(min) {
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m`
  return `${Math.floor(min / 60)}h ${min % 60}m`
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function shortDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function useNow(ms) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

// A number that counts up to its new value instead of jumping.
function CountUp({ value, decimals = 0, duration = 700 }) {
  const still = reducedMotion()
  const [moving, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const target = Number(value || 0)
    if (still) { from.current = target; return }
    const start = performance.now(), begin = from.current
    let frame
    const step = t => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(begin + (target - begin) * eased)
      if (p < 1) frame = requestAnimationFrame(step)
      else from.current = target
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, duration, still])
  const shown = still ? Number(value || 0) : moving
  return decimals
    ? Number(shown).toLocaleString('en-GH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(shown).toLocaleString('en-GH')
}

const card = 'rounded-2xl border border-[var(--border)] bg-[var(--panel)]'
const heading = 'text-[11px] font-bold uppercase tracking-widest text-[var(--text-3)]'

// ── The band ─────────────────────────────────────────────────────────────

function Band({ user, me, shift, recordingClosed, onRegisterCustomer }) {
  const now = useNow(1000)
  const hour = new Date(now).getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const name = me?.first_name || user?.first_name || ''
  const person = { role: 'ATTENDANT', photo_url: me?.photo_url, full_name: user?.full_name,
                   initials: `${(user?.first_name || '?')[0]}${(user?.last_name || '')[0] || ''}`.toUpperCase() }

  return (
    <section className="today-rise relative overflow-hidden rounded-2xl bg-[#0B0B0C] text-white p-5 sm:p-6 border border-white/5">
      {/* A soft red glow in the corner, so the black isn't flat */}
      <div aria-hidden className="absolute -right-24 -top-24 w-72 h-72 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(204,0,0,0.35), transparent 65%)' }} />

      <div className="relative flex flex-wrap items-center gap-4">
        <div className="relative shrink-0">
          <StaffAvatar person={person} size={56} />
          <span className="today-breathe absolute right-0 bottom-0 w-3.5 h-3.5 rounded-full bg-[#22C55E] ring-[3px] ring-[#0B0B0C]" />
        </div>
        <div className="min-w-[180px] flex-1">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight truncate">{greeting}, {name}</h2>
          <p className="text-[13px] text-white/60 mt-0.5">
            {me?.streak > 0
              ? <>🔥 <b className="text-white">{me.streak}-day streak</b> hitting your target</>
              : 'Your usual day is the one to beat. Let’s go.'}
          </p>
        </div>
        <button onClick={onRegisterCustomer}
          className="w-full sm:w-auto justify-center inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white text-[#0B0B0C] text-sm font-bold hover:bg-white/90 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M19 8v6M22 11h-6" />
          </svg>
          Register customer
        </button>
      </div>

      {shift && <ShiftLine shift={shift} now={now} recordingClosed={recordingClosed} />}
    </section>
  )
}

function ShiftLine({ shift, now, recordingClosed }) {
  const start = new Date(shift.opens).getTime()
  const end = new Date(shift.sign_off).getTime()
  const closes = new Date(shift.recording_closes).getTime()
  const span = Math.max(end - start, 1)
  const at = t => Math.min(100, Math.max(0, ((t - start) / span) * 100))
  const left = Math.max(0, closes - now)
  const closed = recordingClosed || left === 0
  const h = Math.floor(left / 3_600_000), m = Math.floor(left / 60_000) % 60, s = Math.floor(left / 1000) % 60

  return (
    <div className="relative mt-5">
      <div className={`text-[12.5px] font-semibold tabular-nums mb-2 ${closed ? 'text-white/60' : left < 30 * 60_000 ? 'text-[#FCA5A5]' : 'text-white'}`}>
        {closed
          ? <>Recording closed at {clock(shift.recording_closes)}</>
          : <>Recording closes in {h ? `${h}h ` : ''}{m}m {String(s).padStart(2, '0')}s</>}
      </div>
      <div className="relative h-1.5 rounded-full bg-white/10">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#CC0000] to-[#FF4D4D]"
          style={{ width: `${at(now)}%`, transition: 'width 1s linear' }} />
        {/* Where recording closes */}
        <span className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/40 rounded" style={{ left: `${at(closes)}%` }}
          title={`Recording closes ${clock(shift.recording_closes)}`} />
        {/* Now */}
        <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.15)]"
          style={{ left: `${at(now)}%`, transition: 'left 1s linear' }} />
      </div>
      <div className="flex justify-between text-[11px] text-white/50 mt-2">
        <span>Opened {clock(shift.opens)}</span>
        <span>Sign off {clock(shift.sign_off)}</span>
      </div>
    </div>
  )
}

// ── Someone just scanned in ──────────────────────────────────────────────

function ScanIn({ scans, recordingClosed, onStartJob, onOpenChat }) {
  const [hidden, setHidden] = useState(() => new Set())
  const showing = (scans || []).filter(s => !hidden.has(s.id)).slice(0, 2)
  if (!showing.length) return null
  return (
    <div className="space-y-2">
      {showing.map(s => (
        <div key={s.id} className="today-slide relative flex flex-wrap items-center gap-3 rounded-2xl border p-3.5 pr-10"
          style={{ borderColor: 'rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.08)' }}>
          <span className="relative w-9 h-9 rounded-full grid place-items-center bg-[#10B981] text-white shrink-0">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v7h-7" />
            </svg>
          </span>
          <div className="min-w-[180px] flex-1">
            <div className="text-sm text-[var(--text)]">
              <b>{s.name}</b> just scanned in{s.verified && <span title="Scanned the signed counter code" className="text-[#10B981]"> ✓</span>}
            </div>
            <div className="text-[11.5px] text-[var(--text-3)]">
              {s.visits_this_month > 0 ? `${ordinal(s.visits_this_month)} visit this month` : 'First visit this month'} · {clock(s.at)}
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto pl-12 sm:pl-0">
            <button disabled={recordingClosed} onClick={() => onStartJob(s)}
              className="h-9 px-3.5 rounded-xl bg-[#0B0B0C] text-white text-[13px] font-bold disabled:opacity-40">Start her job</button>
            <button onClick={() => onOpenChat(s.conversation_id)}
              className="h-9 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[13px] font-semibold text-[var(--text)]">Her chat</button>
          </div>
          <button onClick={() => setHidden(h => new Set(h).add(s.id))} aria-label="Dismiss"
            className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full grid place-items-center text-[var(--text-3)] hover:text-[var(--text)]">✕</button>
        </div>
      ))}
    </div>
  )
}

// ── My day ───────────────────────────────────────────────────────────────

function Ring({ total, target }) {
  const r = 52, c = 2 * Math.PI * r
  const [p, setP] = useState(0)
  // Fills from empty on arrival, then follows the count.
  useEffect(() => {
    const id = requestAnimationFrame(() => setP(Math.min(1, total / Math.max(target, 1))))
    return () => cancelAnimationFrame(id)
  }, [total, target])
  const reached = total >= target
  return (
    <div className="relative w-[132px] h-[132px] shrink-0">
      <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--border)" strokeWidth="11" />
        <circle cx="66" cy="66" r={r} fill="none" strokeWidth="11" strokeLinecap="round"
          stroke={reached ? '#10B981' : '#CC0000'} className="today-ring"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[34px] leading-none font-black text-[var(--text)] tabular-nums"><CountUp value={total} /></div>
          <div className="text-[11px] text-[var(--text-3)] mt-1">{reached ? 'target reached' : `of ${target} jobs`}</div>
        </div>
      </div>
    </div>
  )
}

function NewJobDisc({ closed, onNewJob }) {
  if (closed) {
    return (
      <div className="flex items-center gap-3">
        <div aria-disabled="true" className="w-14 h-14 rounded-full grid place-items-center bg-[var(--border)] text-[var(--text-3)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>
        <div className="text-[13px] font-semibold text-[var(--text-3)]">Recording closed for today</div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <div role="button" tabIndex={0} aria-label="New job" onClick={onNewJob}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNewJob() } }}
        className="relative w-14 h-14 rounded-full cursor-pointer select-none outline-none focus-visible:ring-4 focus-visible:ring-red-300 group">
        <span aria-hidden className="today-halo absolute inset-0 rounded-full bg-[#CC0000]" />
        <span className="absolute inset-0 rounded-full bg-[#CC0000] grid place-items-center text-white shadow-[0_8px_20px_-6px_rgba(204,0,0,0.7)] transition-transform group-hover:scale-105 group-active:scale-95">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </div>
      <div>
        <div className="text-sm font-bold text-[var(--text)]">New job</div>
        <div className="text-[11.5px] text-[var(--text-3)]">Tap to record</div>
      </div>
    </div>
  )
}

function MyDay({ me, recordingClosed, onNewJob }) {
  const figures = [
    { label: 'recorded', value: <>GHS <CountUp value={me.value} decimals={0} /></> },
    { label: 'paid', value: <><CountUp value={me.paid} />/{me.total}</> },
    { label: 'per hour', value: me.per_hour != null ? <CountUp value={me.per_hour} decimals={1} /> : '—' },
  ]
  return (
    <section className={`today-rise ${card} p-5`} style={{ animationDelay: '60ms' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={heading}>My day</h3>
        {me.sheet_number && <span className="text-[11px] text-[var(--text-3)]">Sheet {me.sheet_number}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <Ring total={me.total} target={me.target} />
        <div className="flex-1 min-w-[200px]">
          <p className="text-[12.5px] text-[var(--text-2)]">
            Your usual: <b className="text-[var(--text)]">{me.target}</b>
            {me.best ? <> · Best: <b className="text-[var(--text)]">{me.best}</b>{me.best_date ? `, ${shortDate(me.best_date)}` : ''}</> : null}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {figures.map(f => (
              <div key={f.label} className="rounded-xl bg-[var(--bg)] px-2.5 py-2">
                <div className="text-[15px] font-black text-[var(--text)] tabular-nums whitespace-nowrap">{f.value}</div>
                <div className="text-[10.5px] text-[var(--text-3)]">{f.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4"><NewJobDisc closed={recordingClosed} onNewJob={onNewJob} /></div>
        </div>
      </div>
    </section>
  )
}

// ── Needs you now ────────────────────────────────────────────────────────

const URGENT_MINUTES = 5

function needItems(needs, now) {
  const items = []
  const { desk, pickups, chats, drafts } = needs || {}
  if (desk?.count) {
    items.push({
      key: 'desk', to: 'work', urgent: desk.oldest_minutes >= URGENT_MINUTES, tone: '#D92D20',
      title: `${desk.count} front-desk job${desk.count === 1 ? '' : 's'} to take`,
      sub: `${desk.first ? `${desk.first.who}: ${desk.first.what} · ` : ''}oldest waiting ${waited(desk.oldest_minutes)}`,
      icon: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
    })
  }
  if (chats?.count) {
    const m = minutesSince(chats.since, now)
    items.push({
      key: 'chats', to: 'inbox', chatId: chats.first_id, urgent: m >= URGENT_MINUTES, tone: '#F59E0B',
      title: `${chats.count} chat${chats.count === 1 ? '' : 's'} Octos handed to you`,
      sub: `${chats.first_name}${chats.since ? ` · waiting ${waited(m)}` : ''}`,
      icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    })
  }
  if (pickups?.count) {
    items.push({
      key: 'pickups', to: 'collect', tone: '#10B981',
      title: `${pickups.count} ready for pickup`,
      sub: pickups.oldest_ready_at ? `Oldest ready since ${clock(pickups.oldest_ready_at)}` : 'Waiting at the counter',
      icon: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>,
    })
  }
  if (drafts?.count) {
    items.push({
      key: 'drafts', to: 'drafts', tone: '#71717A',
      title: `${drafts.count} draft${drafts.count === 1 ? '' : 's'} to finish`,
      sub: drafts.first ? `${drafts.first.who}: ${drafts.first.what}` : 'Saved when New job was closed',
      icon: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
    })
  }
  return items
}

function NeedsNow({ needs, onNavigate, onOpenChat }) {
  const now = useNow(30_000)
  const items = needItems(needs, now)
  return (
    <section className={`today-rise ${card} p-4`} style={{ animationDelay: '100ms' }}>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className={heading}>Needs you now</h3>
        {items.some(i => i.urgent) && <span className="w-2 h-2 rounded-full bg-[#D92D20] animate-pulse" />}
      </div>
      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-[var(--bg)] px-3 py-3.5">
          <span className="w-8 h-8 rounded-full grid place-items-center text-white bg-[#10B981] shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">All clear</div>
            <div className="text-[11.5px] text-[var(--text-3)]">Nothing is waiting on you.</div>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map(i => (
            <button key={i.key}
              onClick={() => (i.chatId ? onOpenChat(i.chatId) : onNavigate(i.to))}
              className={`today-slide w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:brightness-95
                ${i.urgent ? 'today-urgent' : 'bg-[var(--bg)]'}`}
              style={i.urgent ? { boxShadow: 'inset 3px 0 0 #D92D20' } : undefined}>
              <span className="w-8 h-8 rounded-full grid place-items-center shrink-0"
                style={{ background: i.urgent ? '#D92D20' : `${i.tone}22`, color: i.urgent ? '#fff' : i.tone }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{i.icon}</svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[13px] font-semibold ${i.urgent ? 'text-[#B42318]' : 'text-[var(--text)]'}`}>{i.title}</span>
                <span className="block text-[11.5px] text-[var(--text-3)] truncate">{i.sub}</span>
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--text-3)] shrink-0"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

// ── My jobs today ────────────────────────────────────────────────────────

function MyJobs({ jobs, total, onNavigate }) {
  return (
    <section className={`today-rise ${card} p-5`} style={{ animationDelay: '140ms' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={heading}>My jobs today</h3>
        {total > 0 && (
          <button onClick={() => onNavigate('my-jobs')} className="text-[12px] font-semibold text-[var(--text-2)] hover:text-[var(--text)]">
            See all {total} →
          </button>
        )}
      </div>
      {jobs.length === 0 ? (
        <p className="text-[13px] text-[var(--text-3)] py-4 text-center">Your first job of the day will show up here.</p>
      ) : (
        <ol className="relative">
          <span aria-hidden className="absolute left-[44px] top-2 bottom-2 w-px bg-[var(--border)]" />
          {jobs.map((j, idx) => (
            <li key={j.id} className="today-slide relative flex items-start gap-3 py-2" style={{ animationDelay: `${180 + idx * 50}ms` }}>
              <span className="w-[34px] text-right text-[11px] text-[var(--text-3)] tabular-nums pt-0.5 shrink-0">{clock(j.at).replace(/(am|pm)$/, '')}</span>
              <span className="relative z-[1] mt-1 w-2.5 h-2.5 rounded-full shrink-0 ring-4 ring-[var(--panel)]"
                style={{ background: j.paid ? '#10B981' : '#F59E0B' }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-[var(--text)] truncate">{j.what}</span>
                <span className="block text-[11.5px] text-[var(--text-3)] truncate">
                  {j.from_chat && <span title="From a chat">💬 </span>}{j.who}
                </span>
              </span>
              <span className="text-right shrink-0">
                <span className="block text-[13px] font-bold text-[var(--text)] tabular-nums">GHS {money(j.amount)}</span>
                <span className="block text-[10.5px] font-semibold" style={{ color: j.paid ? '#10B981' : '#B45309' }}>
                  {j.paid ? 'Paid' : 'At the till'}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

// ── Team today ───────────────────────────────────────────────────────────

function TeamToday({ team }) {
  const usual = team.usual || 0
  const pct = usual ? Math.min(100, (team.total / usual) * 100) : 0
  const minePct = team.total ? (team.mine / team.total) * 100 : 0
  return (
    <section className={`today-rise ${card} p-4`} style={{ animationDelay: '200ms' }}>
      <h3 className={`${heading} mb-2`}>Team today</h3>
      <div className="text-[22px] font-black text-[var(--text)] leading-tight">
        <CountUp value={team.total} /> <span className="text-sm font-semibold text-[var(--text-3)]">jobs so far</span>
      </div>
      {usual > 0 && (
        <div className="mt-2.5 h-2 rounded-full bg-[var(--bg)] overflow-hidden" title={`${Math.round(pct)}% of a usual day`}>
          <div className="h-full rounded-full bg-[var(--text)] relative" style={{ width: `${pct}%`, transition: 'width 1s ease' }}>
            <div className="absolute inset-y-0 left-0 bg-[#CC0000] rounded-full" style={{ width: `${minePct}%` }} />
          </div>
        </div>
      )}
      <p className="mt-2 text-[12px] text-[var(--text-2)] leading-relaxed">
        {usual ? <>A usual day here: <b className="text-[var(--text)]">{usual}</b>. </> : null}
        Yours: <b className="text-[#CC0000]">{team.mine}</b>.
        {team.busiest_hour != null && <> Busiest hour: <b className="text-[var(--text)]">{hourLabel(team.busiest_hour)}</b>.</>}
      </p>
    </section>
  )
}

// ── Confetti, once a day ─────────────────────────────────────────────────

function useTargetConfetti(me, userId) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!me || !userId || me.total < me.target) return
    const key = `octos.confetti.${userId}.${new Date().toDateString()}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch { /* private window: it may show again */ }
    // Once the ring has filled to the top.
    const t = setTimeout(() => setShow(true), 900)
    return () => clearTimeout(t)
  }, [me, userId])
  const done = useCallback(() => setShow(false), [])
  return [show, done]
}

// ── The screen ───────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="p-5 sm:p-6 space-y-4">
      <div className="h-36 rounded-2xl bg-[#0B0B0C] animate-pulse" />
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
        <div className="h-56 rounded-2xl bg-[var(--panel)] border border-[var(--border)] animate-pulse" />
        <div className="h-56 rounded-2xl bg-[var(--panel)] border border-[var(--border)] animate-pulse" />
      </div>
    </div>
  )
}

export default function AttendantOverview({
  onNavigate, onNewJob, onRegisterCustomer, onOpenChat, onStartChatJob, recordingClosed = false,
}) {
  const { user } = useAuth()
  const { data, isError } = useQuery(todayQuery)
  const now = useNow(15_000)
  const [confetti, confettiDone] = useTargetConfetti(data?.me, user?.id)

  if (!data) {
    if (isError) {
      return <div className="p-6 text-sm text-[var(--text-3)]">Today could not load. It will try again in a moment.</div>
    }
    return <Skeleton />
  }

  const { me, needs, team, jobs, shift, scans } = data
  const closed = recordingClosed || !!(shift && now >= new Date(shift.recording_closes).getTime())
  const startJob = s => onStartChatJob?.({ conversationId: s.conversation_id, customerId: s.customer_id, name: s.name, phone: s.phone })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Band user={user} me={me} shift={shift} recordingClosed={closed} onRegisterCustomer={onRegisterCustomer} />
      <ScanIn scans={scans} recordingClosed={closed} onStartJob={startJob} onOpenChat={onOpenChat} />

      {/* Two columns on a wide screen; on a phone one, with Needs you now
          straight after My day, before the longer lists. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <div className="contents lg:block lg:space-y-4 lg:min-w-0">
          <div className="order-1 lg:order-none"><MyDay me={me} recordingClosed={closed} onNewJob={onNewJob} /></div>
          <div className="order-3 lg:order-none"><MyJobs jobs={jobs || []} total={me.total} onNavigate={onNavigate} /></div>
        </div>
        <div className="contents lg:block lg:space-y-4 lg:min-w-0">
          <div className="order-2 lg:order-none"><NeedsNow needs={needs} onNavigate={onNavigate} onOpenChat={onOpenChat} /></div>
          <div className="order-4 lg:order-none"><QuickPriceCheck /></div>
          <div className="order-5 lg:order-none"><TeamToday team={team} /></div>
        </div>
      </div>

      {confetti && <Confetti onDone={confettiDone} />}
    </div>
  )
}
