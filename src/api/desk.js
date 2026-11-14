// src/api/desk.js
// Front-desk work (14 Nov 2026): jobs whose every line is instant work
// (photocopies, printing, binding, passport photos...) go straight to the
// attendants instead of the coordinator. Backend: apps/jobs/api/desk_views.py.

import client from './client'

export const getDeskQueue  = () => client.get('/api/v1/jobs/desk/queue/').then(r => r.data)
export const takeDeskJob   = id => client.post(`/api/v1/jobs/${id}/desk/take/`).then(r => r.data)
export const startDeskJob  = (id, checks) =>
  client.post(`/api/v1/jobs/${id}/desk/start/`, { signed_checks: checks }).then(r => r.data)
export const finishDeskJob = id => client.post(`/api/v1/jobs/${id}/desk/done/`).then(r => r.data)
export const holdDeskJob   = (id, outcome, note) =>
  client.post(`/api/v1/jobs/${id}/desk/problem/`, { outcome, note }).then(r => r.data)
export const resumeDeskJob = id => client.post(`/api/v1/jobs/${id}/desk/resume/`).then(r => r.data)

// One query, shared by the Work tab, the arrival alert and the menu badge,
// so all three always agree. The branch socket refreshes it the moment a
// job lands or moves ('deskQueue'); the interval is only the safety net.
export const deskQuery = {
  queryKey: ['deskQueue'],
  queryFn: getDeskQueue,
  refetchInterval: 15_000,
  staleTime: 5_000,
}

// The job's file, opened in a new tab. The tab is opened first, while the
// click still counts as the attendant's own action, or the browser blocks it.
export async function openDeskFile(file) {
  const win = window.open('', '_blank')
  try {
    const { data } = await client.get(file.url, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    if (win) win.location.href = url
    else window.location.href = url
  } catch {
    if (win) win.close()
    alert('That file could not be opened. Try again, or ask the customer to send it again.')
  }
}

// Shared helpers for the two front-desk screens.
export const LATE_MINUTES = 5

export const minutesSince = iso =>
  iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000)) : 0

export const clock = iso =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''

export const errorText = (e, fallback) => e?.response?.data?.detail || fallback

// A short chime, made in the browser so there is no sound file to ship.
// Loud is the 5-minute re-alert. Browsers only allow sound once the page has
// been clicked, which an attendant at work always has.
let audio
export function chime(loud = false) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    audio = audio || new Ctx()
    if (audio.state === 'suspended') audio.resume()
    const notes = loud ? [880, 660, 880, 660, 880] : [660, 880]
    notes.forEach((freq, i) => {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      const at = audio.currentTime + i * 0.2
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(loud ? 0.6 : 0.3, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18)
      osc.connect(gain).connect(audio.destination)
      osc.start(at)
      osc.stop(at + 0.19)
    })
  } catch {
    // No sound is better than a broken screen.
  }
}
