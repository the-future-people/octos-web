// src/components/eye/theme.js
// The Eye's dark palette. Colour is meaning, never decoration.
export const C = {
  ground: '#0f0f0e', panel: '#161614', raised: '#1d1c1a', border: '#2a2926', line: '#24231f',
  text: '#ffffff', text2: '#cfccc6', muted: '#8a8780', faint: '#6b6860',
  green: '#3ccf8e', amber: '#f2b531', red: '#ff5468', blue: '#5b8cff', gold: '#e8c84a', grey: '#8a8780',
}
export const TONE = {
  green: { bg: '#0f2a1d', border: '#3ccf8e', text: '#7fe3b4' },
  amber: { bg: '#2a220c', border: '#f2b531', text: '#f6cc6a' },
  red:   { bg: '#2a1015', border: '#ff5468', text: '#ff8a98' },
  blue:  { bg: '#101b33', border: '#5b8cff', text: '#9db8ff' },
  grey:  { bg: '#1a1917', border: '#3a3833', text: '#cfccc6' },
}
export const STATUS = {
  on: C.green, late: C.amber, absent: C.red, leave: C.blue, off: C.faint, not_yet: C.muted, untracked: C.muted,
  printing: C.green, idle: C.grey, down: C.red,
  ON_TRACK: C.green, AT_RISK: C.amber, LATE: C.red,
  regular: C.green, quiet: C.amber, credit_limit: C.red, new: C.gold,
  ok: C.green, unknown: C.grey,
}
export const cedis = (v) => (v === null || v === undefined) ? '—'
  : `GHS ${Math.round(Number(v)).toLocaleString('en-GH')}`
export const pct = (v) => (v === null || v === undefined) ? '—' : `${v}%`
export const since = (iso) => {
  if (!iso) return ''
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${m} min`
  if (m < 1440) return `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`
  return `${Math.floor(m / 1440)} day${m >= 2880 ? 's' : ''}`
}
export const DISPLAY = "'Syne', 'DM Sans', sans-serif"
export const MONO = "'JetBrains Mono', ui-monospace, monospace"
