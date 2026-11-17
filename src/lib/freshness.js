// src/lib/freshness.js
//
// Keeping every open Octos on the newest version (17 Nov 2026). A page left
// open never picks up a deploy by itself: the Eye kept showing the old Money
// page while a discount waited for the owner. So each copy of Octos compares
// its own build stamp with /version.json, every few minutes and whenever
// someone comes back to the window. When they differ, a newer Octos is live,
// and the page reloads at the first safe moment:
//   - nothing open on top (no dialog or overlay), and
//   - nobody typing, and no unsent text in a box, and
//   - the window is hidden, or nobody has touched it for a while.
// Moving to another section counts as safe too (UpdateBar). Until then a small
// bar offers "Reload now". Nothing is ever reloaded out from under someone.

const MINE = import.meta.env.VITE_OCTOS_BUILD || 'dev'
const CHECK_EVERY = 5 * 60_000      // look for a new version
const AT_MOST = 30_000              // never check more often than this
const QUIET_FOR = 90_000            // untouched this long counts as idle
const TRY_EVERY = 20_000            // once a new version is waiting

let waiting = false
let lastCheck = 0
let lastTouch = Date.now()
const listeners = new Set()

export const isWaiting = () => waiting
export function onWaiting(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

async function check() {
  if (waiting || Date.now() - lastCheck < AT_MOST) return
  lastCheck = Date.now()
  try {
    const r = await fetch(`/version.json?at=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return
    const { build } = await r.json()
    if (build && build !== MINE) {
      waiting = true
      listeners.forEach(fn => fn(true))
    }
  } catch {
    // Offline or between deploys: try again next time.
  }
}

// Something on screen the person would lose: a dialog, an overlay, a box
// being typed in, or text written and not yet sent.
export function busy() {
  if (document.querySelector('[role="dialog"], .fixed.inset-0')) return true
  const el = document.activeElement
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return true
  return [...document.querySelectorAll('textarea')].some(t => t.value.trim())
}

export function reloadNow() {
  window.location.reload()
}

function maybeReload() {
  if (!waiting || busy()) return
  if (document.hidden || Date.now() - lastTouch >= QUIET_FOR) reloadNow()
}

let started = false
export function startFreshness() {
  if (started || MINE === 'dev') return
  started = true
  const touched = () => { lastTouch = Date.now() }
  ;['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(e =>
    window.addEventListener(e, touched, { passive: true, capture: true }))
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) maybeReload()
    else check()
  })
  window.addEventListener('focus', check)
  window.addEventListener('online', check)
  setInterval(check, CHECK_EVERY)
  setInterval(maybeReload, TRY_EVERY)
  check()
}
