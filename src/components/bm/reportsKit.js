// src/components/bm/reportsKit.js
//
// What the phone's Reports & Filing shares (18 Nov 2026): the calls, the
// date and money wording, and the one query two screens need. The calls are
// the ones Reports.jsx makes, under the same query keys, so filing on either
// screen refreshes both.
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'

export const RED = '#D70015'
export const AMBER = '#B45309'
export const GREEN = '#15803D'
export const card = 'mx-4 rounded-[16px] bg-white border border-black/[0.04] shadow-[0_3px_12px_rgba(17,24,39,0.05)]'
export const RED_FILL = { background: 'linear-gradient(135deg,#EF1C2C 0%,#C8000F 100%)' }

export const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const MON = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const num = v => parseFloat(v || 0)
export const money = v => `GHS ${num(v).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const short = v => {
  const n = num(v)
  if (n >= 1_000_000) return `GHS ${(n / 1_000_000).toFixed(1)}m`
  if (n >= 10000) return `GHS ${(n / 1000).toFixed(1)}k`
  const cents = n % 1 ? 2 : 0
  return `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: cents, maximumFractionDigits: cents })}`
}

// Dates arrive as "2026-11-18". Read as local days, so a phone in another
// time zone does not shift every row by one.
const pad = n => String(n).padStart(2, '0')
export const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const dayOf = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }
export const weekday = (iso, long) => dayOf(iso).toLocaleDateString('en-GB', { weekday: long ? 'long' : 'short' })
export const dayMonth = (iso, long) => dayOf(iso).toLocaleDateString('en-GB', { day: 'numeric', month: long ? 'long' : 'short' })
export const when = iso => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')
export const mondayOf = iso => { const d = dayOf(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d }

// "2 – 7 Nov", or "30 Nov – 5 Dec" across a month.
export function span(from, to) {
  const a = dayOf(from), b = dayOf(to)
  if (from === to) return `${a.getDate()} ${MON[a.getMonth() + 1]}`
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${MON[b.getMonth() + 1]}`
    : `${a.getDate()} ${MON[a.getMonth() + 1]} – ${b.getDate()} ${MON[b.getMonth() + 1]}`
}

// One half of a calendar week that a month boundary cut in two.
export function isSplit(r) {
  const mon = mondayOf(r.date_from)
  const sat = new Date(mon); sat.setDate(mon.getDate() + 5)
  return r.date_from !== isoOf(mon) || r.date_to !== isoOf(sat)
}

// The week can be prepared and filed on Saturday or the month's last day,
// after five.
export function filingOpen(now = new Date()) {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return (now.getDay() === 6 || now.getDate() === last) && now.getHours() >= 17
}

export const list = d => (Array.isArray(d) ? d : d?.results || [])

export function errorOf(err, fallback = 'That did not go through. Try again.') {
  const d = err?.response?.data
  if (!d) return fallback
  if (typeof d === 'string') return d.length < 200 ? d : fallback
  if (d.detail) return Array.isArray(d.detail) ? d.detail.join(' · ') : d.detail
  return Object.values(d).flat().find(v => typeof v === 'string') || fallback
}

export const REASONS = [
  ['POWER_OUTAGE', 'Power outage'], ['FLOODING', 'Flooding'], ['SECURITY_INCIDENT', 'Security incident'],
  ['FORCE_MAJEURE', 'Force majeure'], ['OTHER', 'Something else'],
]
export const REASON = Object.fromEntries(REASONS)

export const api = {
  sheets: params => client.get('/api/v1/finance/sheets/', { params }),
  sheetSummary: id => client.get(`/api/v1/finance/sheets/${id}/summary/`),
  holidays: () => client.get('/api/v1/finance/holidays/'),
  declareHoliday: body => client.post('/api/v1/finance/holidays/declare/', body),
  weeks: () => client.get('/api/v1/finance/weekly/'),
  week: id => client.get(`/api/v1/finance/weekly/${id}/`),
  prepareWeek: () => client.post('/api/v1/finance/weekly/prepare/'),
  submitWeek: (id, notes) => client.post(`/api/v1/finance/weekly/${id}/submit/`, { bm_notes: notes }),
  weekNotes: (id, notes) => client.patch(`/api/v1/finance/weekly/${id}/notes/`, { bm_notes: notes }),
  weekPdf: id => client.get(`/api/v1/finance/weekly/${id}/pdf/`, { responseType: 'blob' }),
  close: (month, year) => client.get(`/api/v1/finance/monthly-close/?month=${month}&year=${year}`),
  prepareClose: (month, year) => client.post('/api/v1/finance/monthly-close/prepare/', { month, year }),
  submitClose: (month, year, notes) => client.post('/api/v1/finance/monthly-close/submit/', { month, year, bm_notes: notes }),
  closePdf: id => client.get(`/api/v1/finance/monthly-close/${id}/pdf/`, { responseType: 'blob' }),
  review: (month, year) => client.get(`/api/v1/finance/monthly-close/review/?month=${month}&year=${year}`),
  dayNote: (sheetId, body) => client.post(`/api/v1/finance/sheets/${sheetId}/notes/`, { body }),
  history: params => client.get('/api/v1/jobs/history/', { params }),
}

// Every day of this month up to today, newest first, with the gaps kept:
// a day with no sheet is either a Sunday, a declared holiday, or something
// the manager has to explain.
export function useDays() {
  const sheets = useQuery({
    queryKey: ['sheets-monthly'],
    queryFn: () => api.sheets({ period: 'month' }).then(r => r.data),
    staleTime: 60_000,
  })
  const holidays = useQuery({
    queryKey: ['holidays'],
    queryFn: () => api.holidays().then(r => r.data),
    staleTime: 300_000,
  })
  const byDate = Object.fromEntries(list(sheets.data).map(s => [s.date, s]))
  const holidayOn = Object.fromEntries(list(holidays.data).map(h => [h.date, h.name]))
  const now = new Date()
  const days = []
  for (let d = now.getDate(); d >= 1; d--) {
    const iso = isoOf(new Date(now.getFullYear(), now.getMonth(), d))
    const sheet = byDate[iso]
    // Today without a sheet has not opened yet; that is not a gap.
    const kind = sheet ? 'sheet' : dayOf(iso).getDay() === 0 ? 'sunday' : holidayOn[iso] ? 'holiday'
      : d === now.getDate() ? 'notyet' : 'gap'
    days.push({ iso, sheet, kind, holiday: holidayOn[iso] })
  }
  return { days, isLoading: sheets.isLoading, gaps: days.filter(d => d.kind === 'gap').length }
}
