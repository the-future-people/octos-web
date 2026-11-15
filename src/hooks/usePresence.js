// src/hooks/usePresence.js
//
// Tells Octos who is using it (15 Nov 2026), for the manager's "On shift" strip.
//
// It feeds the analytics sessions the server already keeps: a session starts
// when someone signs in, and a heartbeat goes once a minute, but only if the
// person touched the screen (click, key, scroll, touch, mouse) since the last
// one. A portal left open with nobody at it sends nothing, so the server sees
// it go idle after 5 minutes, which is the engine's own idle rule.
//
// One session per person: the id is kept in localStorage so a second tab
// joins the same session instead of closing the first one's.
import { useEffect } from 'react'
import client from '../api/client'

const MINUTE = 60_000
const KEY = 'octos.session'
const TOUCHES = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove']

// The server's portal names, by role. Roles not listed (HR, Octos itself)
// don't report in.
const PORTALS = {
  BRANCH_MANAGER:   'BRANCH_MANAGER',
  ATTENDANT:        'ATTENDANT',
  CASHIER:          'CASHIER',
  OPERATOR:         'OPERATOR',
  FLOW_COORDINATOR: 'COORDINATOR',
  COORDINATOR:      'COORDINATOR',
  REGIONAL_MANAGER: 'REGIONAL_MANAGER',
  FINANCE:          'FINANCE',
  BELT_MANAGER:     'BELT_MANAGER',
}

const today = () => new Date().toDateString()

function saved() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}

function save(value) {
  try { value ? localStorage.setItem(KEY, JSON.stringify(value)) : localStorage.removeItem(KEY) } catch { /* private window */ }
}

// On sign-out: close the session now, so the strip says "Signed out" at once.
// The token is passed by hand because sign-out removes it straight after.
export function endPresence() {
  const token = localStorage.getItem('access_token')
  save(null)
  if (!token) return
  client.post('/api/v1/analytics/session/end/', {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
}

export default function usePresence(user) {
  const portal = PORTALS[user?.role_name]
  const userId = user?.id

  useEffect(() => {
    if (!portal || !userId) return
    let touched = true          // signing in counts as using it
    let stopped = false
    const touch = () => { touched = true }
    TOUCHES.forEach(e => window.addEventListener(e, touch, { passive: true }))

    const start = () =>
      client.post('/api/v1/analytics/session/start/', { portal, user_agent: navigator.userAgent })
        .then(r => save({ id: r.data.session_id, user: userId, day: today() }))

    const beat = async () => {
      if (stopped || !touched) return
      touched = false
      const mine = saved()
      try {
        // A new day is a new session, so yesterday's never runs into today.
        if (mine?.user === userId && mine?.id && mine?.day === today()) {
          await client.post('/api/v1/analytics/session/heartbeat/', { session_id: mine.id })
        } else {
          await start()
        }
      } catch (err) {
        // The session was closed (signed out elsewhere, or replaced): start a new one.
        if (err?.response?.status === 404) start().catch(() => {})
      }
    }

    beat()
    const timer = setInterval(beat, MINUTE)
    return () => {
      stopped = true
      clearInterval(timer)
      TOUCHES.forEach(e => window.removeEventListener(e, touch))
    }
  }, [portal, userId])
}
