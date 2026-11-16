// src/components/attendant/IdleCheck.jsx
//
// "Hey Kofi, are you there?" (16 Nov 2026). After 30 minutes with no touch,
// key or click, the portal asks, and says what came in while she was away:
// who scanned in, front-desk work waiting, chats handed to a person, what the
// team recorded. "I'm here" carries on; "Taking a break" tells Octos, so the
// manager's On shift says "On break", and a break past 30 minutes lets the
// manager know (analytics/breaks.py). "I'm back" ends it.
//
// The break is remembered in this browser for the day, so a reload while on
// break still shows it.
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { todayQuery, setBreak } from '../../api/today'

const IDLE_MS = 30 * 60_000
const CHECK_MS = 20_000
const BREAK_KEY = 'octos.break'
const TOUCHES = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove']

function clock(iso) {
  const d = new Date(iso), h = d.getHours()
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
}

function savedBreak(userId) {
  try {
    const b = JSON.parse(localStorage.getItem(BREAK_KEY) || 'null')
    return b && b.user === userId && b.day === new Date().toDateString() ? b.since : null
  } catch { return null }
}

function saveBreak(userId, since) {
  try {
    since ? localStorage.setItem(BREAK_KEY, JSON.stringify({ user: userId, since, day: new Date().toDateString() }))
          : localStorage.removeItem(BREAK_KEY)
  } catch { /* private window */ }
}

function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}` }

// What changed between the last touch and now.
function whileAway(before, now, since) {
  if (!now) return []
  const lines = []
  for (const s of (now.scans || []).filter(s => new Date(s.at).getTime() > since)) {
    lines.push({ key: `scan-${s.id}`, dot: '#10B981', text: <><b>{s.name}</b> scanned in at {clock(s.at)}</> })
  }
  const desk = now.needs?.desk?.count || 0
  const deskBefore = before?.needs?.desk?.count || 0
  if (desk) {
    lines.push({ key: 'desk', dot: '#D92D20',
      text: <><b>{plural(desk, 'front-desk job')}</b> waiting{desk > deskBefore ? `, ${desk - deskBefore} new` : ''}</> })
  }
  const chats = now.needs?.chats?.count || 0
  if (chats) lines.push({ key: 'chats', dot: '#F59E0B', text: <><b>{plural(chats, 'chat')}</b> handed to a person</> })
  const ready = (now.needs?.pickups?.count || 0) - (before?.needs?.pickups?.count || 0)
  if (ready > 0) lines.push({ key: 'ready', dot: '#3B82F6', text: <><b>{ready} more</b> ready for pickup</> })
  const recorded = (now.team?.total || 0) - (before?.team?.total || 0)
  if (recorded > 0) lines.push({ key: 'team', dot: '#71717A', text: <>The team recorded <b>{plural(recorded, 'job')}</b></> })
  return lines
}

export default function IdleCheck({ user, enabled = true }) {
  const queryClient = useQueryClient()
  const { data: today } = useQuery(todayQuery)
  const [mode, setMode] = useState(() => (savedBreak(user?.id) ? 'break' : null))   // null | 'ask' | 'break'
  const [since, setSince] = useState(() => savedBreak(user?.id))
  const [busy, setBusy] = useState(false)
  // When the asking began: the picture of the day at her last touch, and that time.
  const [away, setAway] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const lastTouch = useRef(0)
  const snapshot = useRef(null)
  const modeRef = useRef(mode)
  useEffect(() => { modeRef.current = mode }, [mode])

  // Every touch resets the clock and keeps a picture of the day to compare with.
  useEffect(() => {
    let last = 0
    lastTouch.current = Date.now()
    const touch = () => {
      if (modeRef.current) return
      const now = Date.now()
      lastTouch.current = now
      if (now - last > 5000) { last = now; snapshot.current = queryClient.getQueryData(todayQuery.queryKey) || snapshot.current }
    }
    TOUCHES.forEach(e => window.addEventListener(e, touch, { passive: true }))
    const timer = setInterval(() => {
      if (enabled && !modeRef.current && Date.now() - lastTouch.current >= IDLE_MS) {
        modeRef.current = 'ask'
        setAway({ before: snapshot.current, since: lastTouch.current })
        setMode('ask')
      }
    }, CHECK_MS)
    return () => { clearInterval(timer); TOUCHES.forEach(e => window.removeEventListener(e, touch)) }
  }, [enabled, queryClient])

  // Until her first touch, the day as it first loaded is what to compare with.
  useEffect(() => { if (!snapshot.current && today) snapshot.current = today }, [today])

  // A minute counter while on break.
  useEffect(() => {
    if (mode !== 'break') return
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [mode])

  if (!mode || (!enabled && mode === 'ask')) return null

  const here = () => { lastTouch.current = Date.now(); snapshot.current = today; modeRef.current = null; setMode(null) }
  const goOnBreak = async () => {
    setBusy(true)
    const at = new Date().toISOString()
    try { const r = await setBreak(true); setSince(r?.since || at); saveBreak(user?.id, r?.since || at) }
    catch { setSince(at); saveBreak(user?.id, at) }
    finally { setBusy(false); setNow(Date.now()); modeRef.current = 'break'; setMode('break') }
  }
  const back = async () => {
    setBusy(true)
    try { await setBreak(false) } catch { /* the session may have ended; she's back either way */ }
    saveBreak(user?.id, null)
    setBusy(false)
    here()
  }

  const name = user?.first_name || 'there'
  const lines = away ? whileAway(away.before, today, away.since) : []
  const breakMinutes = since ? Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000)) : 0

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4 bg-black/55 backdrop-blur-sm animate-fadeIn">
      <div role="dialog" aria-modal="true" aria-labelledby="idle-title"
        className="animate-slideUp w-full max-w-sm rounded-3xl bg-[var(--panel)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {mode === 'ask' ? (
          <>
            <div className="relative bg-[#0B0B0C] text-white px-6 pt-6 pb-5 overflow-hidden">
              <div aria-hidden className="absolute -right-16 -top-16 w-48 h-48 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(204,0,0,0.4), transparent 65%)' }} />
              <div className="relative text-3xl mb-2" aria-hidden>👋</div>
              <h2 id="idle-title" className="relative text-xl font-black">Hey {name}, are you there?</h2>
              <p className="relative text-[13px] text-white/60 mt-1">It’s been quiet here for 30 minutes.</p>
            </div>
            <div className="px-6 py-4">
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-[var(--text-3)] mb-2">While you were away…</div>
              {lines.length === 0 ? (
                <p className="text-[13px] text-[var(--text-2)]">Nothing new came in. All quiet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {lines.map((l, i) => (
                    <li key={l.key} className="today-slide flex items-center gap-2.5 text-[13px] text-[var(--text-2)]" style={{ animationDelay: `${i * 70}ms` }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.dot }} />
                      <span>{l.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button onClick={here} autoFocus
                className="flex-1 h-11 rounded-xl bg-[#CC0000] text-white text-sm font-bold hover:bg-[#B00000] transition-colors">I’m here</button>
              <button onClick={goOnBreak} disabled={busy}
                className="flex-1 h-11 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg)] disabled:opacity-50">Taking a break</button>
            </div>
          </>
        ) : (
          <div className="px-6 py-7 text-center">
            <div className="mx-auto w-16 h-16 rounded-full grid place-items-center text-3xl mb-3"
              style={{ background: 'rgba(245,158,11,0.15)' }} aria-hidden>☕</div>
            <h2 id="idle-title" className="text-xl font-black text-[var(--text)]">Enjoy your break, {name}</h2>
            <p className="text-[13px] text-[var(--text-3)] mt-1">
              On break since {since ? clock(since) : 'just now'}{breakMinutes ? ` · ${breakMinutes} min` : ''}
            </p>
            <p className={`text-[12px] mt-3 ${breakMinutes >= 30 ? 'text-[#B45309] font-semibold' : 'text-[var(--text-3)]'}`}>
              {breakMinutes >= 30
                ? 'Your manager has been told you’re past 30 minutes.'
                : 'Your team sees you’re on break. After 30 minutes your manager is told.'}
            </p>
            <button onClick={back} disabled={busy} autoFocus
              className="mt-5 w-full h-11 rounded-xl bg-[#0B0B0C] text-white text-sm font-bold hover:bg-black disabled:opacity-50">I’m back</button>
          </div>
        )}
      </div>
    </div>
  )
}
