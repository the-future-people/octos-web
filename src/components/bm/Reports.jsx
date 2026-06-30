// src/components/bm/Reports.jsx
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import client from '../../api/client'
import { downloadBranchStatement } from '../../api/bm'

const fmt = (n) =>
  `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`

const fmtShort = (iso) => {
  if (!iso) return '—'
  const date = new Date(iso)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const STATUS_BADGE = {
  CLOSED:      'bg-emerald-100 text-emerald-700',
  AUTO_CLOSED: 'bg-amber-100 text-amber-700',
  OPEN:        'bg-blue-100 text-blue-700',
  LOCKED:      'bg-emerald-100 text-emerald-700',
  DRAFT:       'bg-zinc-100 text-zinc-600',
  SUBMITTED:   'bg-blue-100 text-blue-700',
  ENDORSED:    'bg-violet-100 text-violet-700',
  REJECTED:    'bg-red-100 text-red-700',
}

const statusLabel = (s) => ({ AUTO_CLOSED: 'Auto-closed' }[s] || (s?.charAt(0) + s?.slice(1).toLowerCase()))

const getSheets      = (params)            => client.get('/api/v1/finance/sheets/', { params })
const prepareWeekly  = ()                  => client.post('/api/v1/finance/weekly/prepare/')
const submitWeekly   = (id, notes)         => client.post(`/api/v1/finance/weekly/${id}/submit/`, { bm_notes: notes })
const getMonthlyClose= (month, year)       => client.get(`/api/v1/finance/monthly-close/?month=${month}&year=${year}`)
const prepareMonthly = (month, year)       => client.post('/api/v1/finance/monthly-close/prepare/', { month, year })
const submitMonthly  = (month, year, notes)=> client.post('/api/v1/finance/monthly-close/submit/', { month, year, bm_notes: notes })
const getJobHistory  = (params)            => client.get('/api/v1/jobs/history/', { params })
const getWeeklyList  = ()                  => client.get('/api/v1/finance/weekly/')

// Add roundRect utility for canvas
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.moveTo(x+r, y);
    this.lineTo(x+w-r, y);
    this.quadraticCurveTo(x+w, y, x+w, y+r);
    this.lineTo(x+w, y+h-r);
    this.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    this.lineTo(x+r, y+h);
    this.quadraticCurveTo(x, y+h, x, y+h-r);
    this.lineTo(x, y+r);
    this.quadraticCurveTo(x, y, x+r, y);
    return this;
  };
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="text-2xl font-black text-[var(--text)]">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--text-3)] mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-12 h-12 bg-[var(--bg)] rounded-xl flex items-center justify-center mb-3">{icon}</div>
      <p className="text-sm font-bold text-[var(--text-2)]">{title}</p>
      {subtitle && <p className="text-xs text-[var(--text-3)] mt-1">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ── Daily Tab ─────────────────────────────────────────────────────────────────

function DailyTab() {
  const [expanded, setExpanded] = useState(null)
  const { data, isLoading } = useQuery({
    queryKey: ['sheets-monthly'],
    queryFn: () => getSheets({ period: 'month' }).then(r => r.data),
    staleTime: 60_000,
  })
  const sheets = Array.isArray(data) ? data : (data?.results || [])
  const monthName = new Date().toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })

  if (isLoading) return <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse" />)}</div>

  return (
    <div>
      <SectionHeader title="Daily Sheets" subtitle={`Closed sheets for ${monthName} — read-only records`} />
      {sheets.length === 0 ? (
        <EmptyState icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} title="No sheets this month" subtitle="Closed daily sheets will appear here" />
      ) : (
        <div className="space-y-2">
          {sheets.map(sheet => {
            const d      = new Date(sheet.date)
            const total  = parseFloat(sheet.total_cash||0) + parseFloat(sheet.total_momo||0) + parseFloat(sheet.total_pos||0)
            const isOpen = expanded === sheet.id
            return (
              <div key={sheet.id} className="bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : sheet.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[var(--bg)] transition-colors text-left">
                  <div className="shrink-0 w-14 text-center">
                    <div className="text-[10px] font-bold text-[var(--text-3)] tracking-widest">{d.toLocaleDateString('en-GH',{month:'short'}).toUpperCase()}</div>
                    <div className="text-3xl font-black text-[var(--text)] leading-none">{d.getDate()}</div>
                    <div className="text-[10px] text-[var(--text-3)]">{d.toLocaleDateString('en-GH',{weekday:'short'})}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[var(--text)]">{d.toLocaleDateString('en-GH',{weekday:'long'})} · {d.getDate()} {d.toLocaleDateString('en-GH',{month:'long',year:'numeric'})}</div>
                    <div className="text-xs text-[var(--text-3)] mt-0.5">
                      <span className="font-mono font-semibold">{sheet.total_jobs_created ?? '—'} jobs</span>
                      <span className="mx-2">·</span>
                      <span className="font-mono font-bold text-[var(--text)]">{fmt(total)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${STATUS_BADGE[sheet.status] ?? 'bg-zinc-100 text-zinc-600'}`}>{statusLabel(sheet.status)}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-[var(--text-3)] transition-transform ${isOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 border-t border-[var(--border)]">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                      {[{label:'Cash',value:fmt(sheet.total_cash),color:'text-emerald-600'},{label:'MoMo',value:fmt(sheet.total_momo),color:'text-amber-600'},{label:'POS',value:fmt(sheet.total_pos),color:'text-blue-600'},{label:'Net in Till',value:fmt(sheet.net_cash_in_till),color:'text-[var(--text)]'}].map(c=>(
                        <div key={c.label} className="bg-[var(--bg)] rounded-lg p-3">
                          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">{c.label}</div>
                          <div className={`font-mono font-black text-sm ${c.color}`}>{c.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Weekly Tab ────────────────────────────────────────────────────────────────

function WeeklyTab() {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(null)
  const [notesId, setNotesId] = useState(null)
  const [notesText, setNotesText] = useState('')
  const [submitId, setSubmitId] = useState(null)
  const [submitNotes, setSubmitNotes] = useState('')

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['weekly-reports'],
    queryFn: () => getWeeklyList().then(r => { const d = r.data; return Array.isArray(d) ? d : (d?.results || []) }),
    staleTime: 30_000,
  })

  const prepareMut = useMutation({ 
    mutationFn: () => prepareWeekly(), 
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weekly-reports'] }),
    onError: (err) => console.error('Failed to prepare weekly:', err)
  })
  
  const submitMut = useMutation({ 
    mutationFn: ({ id, notes }) => submitWeekly(id, notes), 
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] })
      setSubmitId(null)
      setSubmitNotes('')
    },
    onError: (err) => console.error('Failed to submit weekly:', err)
  })
  
  const notesMut = useMutation({ 
    mutationFn: ({ id, notes }) => client.patch(`/api/v1/finance/weekly/${id}/notes/`, { bm_notes: notes }), 
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weekly-reports'] }),
    onError: (err) => console.error('Failed to save notes:', err)
  })

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse"/>)}</div>

  const draft    = reports.find(r => r.status === 'DRAFT')
  const previous = reports.filter(r => r.status !== 'DRAFT')

  return (
    <div>
      <SectionHeader title="Weekly Filing" subtitle="Monday – Saturday consolidated operations report"
        action={<button onClick={() => prepareMut.mutate()} disabled={prepareMut.isPending} className="px-4 py-2.5 bg-[var(--text)] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">{prepareMut.isPending ? 'Preparing…' : 'Prepare This Week'}</button>}
      />

      {!draft ? (
        <EmptyState
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
          title="No filing for this week"
          subtitle={(() => { const n = new Date(), mo = new Date(n); mo.setDate(n.getDate() - n.getDay() + 1); const sa = new Date(mo); sa.setDate(mo.getDate() + 5); return `${fmtShort(mo.toISOString())} – ${fmtShort(sa.toISOString())}` })()}
          action={<button onClick={() => prepareMut.mutate()} disabled={prepareMut.isPending} className="px-5 py-2.5 bg-[var(--text)] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">{prepareMut.isPending ? 'Preparing…' : 'Prepare Filing'}</button>}
        />
      ) : (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-5 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs font-bold text-[var(--text-3)] uppercase tracking-widest mb-1">Current Week — Draft</div>
              <div className="text-lg font-black text-[var(--text)]">Week {draft.week_number}, {draft.year}</div>
              <div className="text-xs text-[var(--text-3)] mt-0.5">{fmtShort(draft.date_from)} – {fmtShort(draft.date_to)}</div>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">DRAFT</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[{label:'Total',value:fmt(draft.total_collected),color:'text-[var(--text)]'},{label:'Cash',value:fmt(draft.total_cash),color:'text-emerald-600'},{label:'MoMo',value:fmt(draft.total_momo),color:'text-amber-600'},{label:'Jobs',value:draft.total_jobs_created ?? '—',color:'text-blue-600'}].map(c=>(
              <div key={c.label} className="bg-[var(--bg)] rounded-xl p-3">
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">{c.label}</div>
                <div className={`font-mono font-black text-lg ${c.color}`}>{c.value}</div>
              </div>
            ))}
          </div>
          {!draft.all_sheets_closed && <div className="mb-4 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">⚠ Not all sheets are closed. Close all daily sheets before submitting.</div>}
          <div className="mb-4">
            <label className="block text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">Branch Manager Notes</label>
            <textarea rows={2} value={notesId === draft.id ? notesText : (draft.bm_notes || '')} onChange={e => { setNotesId(draft.id); setNotesText(e.target.value) }} onBlur={() => { if (notesId === draft.id) notesMut.mutate({ id: draft.id, notes: notesText }) }} placeholder="Add notes for this week's filing…" className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg outline-none focus:border-[var(--border-dark)] transition-colors resize-none"/>
            <p className="text-[10px] text-[var(--text-3)] mt-1">Auto-saves when you click away</p>
          </div>
          <button onClick={() => setSubmitId(draft.id)} disabled={!draft.all_sheets_closed} className="w-full py-2.5 bg-[var(--text)] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">Submit & Lock Filing</button>
        </div>
      )}

      {previous.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-3">Previous Filed Weeks</div>
          <div className="space-y-2">
            {previous.map(r => {
              const isOpen = expanded === r.id
              return (
                <div key={r.id} className="bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[var(--text)]">Week {r.week_number}, {r.year}</span>
                        <span className="text-xs text-[var(--text-3)]">{fmtShort(r.date_from)} – {fmtShort(r.date_to)}</span>
                      </div>
                      {r.submitted_by_name && <div className="text-[10px] text-[var(--text-3)] mt-0.5">Filed by {r.submitted_by_name} · {fmtShort(r.submitted_at)}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">✓ Locked</span>
                      {r.pdf_path && (
                        <button onClick={() => window.open(`/api/v1/finance/weekly/${r.id}/pdf/`, '_blank')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--text)] text-white text-[10px] font-bold rounded-lg hover:opacity-90 transition-opacity">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          PDF
                        </button>
                      )}
                      <button onClick={() => setExpanded(isOpen ? null : r.id)} className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-5 pb-4 border-t border-[var(--border)]">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                        {[{label:'Total',value:fmt(r.total_collected),color:'text-[var(--text)]'},{label:'Cash',value:fmt(r.total_cash),color:'text-emerald-600'},{label:'MoMo',value:fmt(r.total_momo),color:'text-amber-600'},{label:'Jobs',value:r.total_jobs_created ?? '—',color:'text-blue-600'}].map(c=>(
                          <div key={c.label} className="bg-[var(--bg)] rounded-lg p-3">
                            <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">{c.label}</div>
                            <div className={`font-mono font-black text-sm ${c.color}`}>{c.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {submitId && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-black text-[var(--text)] mb-1">Submit Weekly Filing</h3>
            <p className="text-xs text-[var(--text-3)] mb-4">This will lock the report. You will not be able to edit it after submission.</p>
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">Final Notes (optional)</label>
              <textarea rows={3} value={submitNotes} onChange={e => setSubmitNotes(e.target.value)} placeholder="Any final comments for this week…" className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg outline-none focus:border-[var(--border-dark)] transition-colors resize-none"/>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setSubmitId(null); setSubmitNotes(''); }} className="flex-1 py-2.5 text-sm font-semibold text-[var(--text-2)] border border-[var(--border)] rounded-xl hover:border-[var(--border-dark)] transition-colors">Cancel</button>
              <button onClick={() => submitMut.mutate({ id: submitId, notes: submitNotes })} disabled={submitMut.isPending} className="flex-1 py-2.5 bg-[var(--text)] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">{submitMut.isPending ? 'Submitting…' : 'Submit & Lock'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Monthly Tab ───────────────────────────────────────────────────────────────

function MonthlyTab() {
  const queryClient = useQueryClient()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [submitNotes, setSubmitNotes]         = useState('')
  const [snapshot, setSnapshot]               = useState(null)
  const [prepareError, setPrepareError]       = useState('')

  const { data: closeData, isLoading, refetch } = useQuery({
    queryKey: ['monthly-close', month, year],
    queryFn: () => getMonthlyClose(month, year).then(r => r.data),
    staleTime: 30_000,
  })

  const prepareMut = useMutation({
    mutationFn: () => prepareMonthly(month, year),
    onSuccess: (res) => { 
      setSnapshot(res.data.summary_snapshot)
      setPrepareError('')
      setShowSubmitModal(true)
      refetch()
    },
    onError: (err) => { 
      const d = err.response?.data
      setPrepareError(Array.isArray(d?.detail) ? d.detail.join(' · ') : (d?.detail || 'Preparation failed.'))
    },
  })

  const submitMut = useMutation({
    mutationFn: () => submitMonthly(month, year, submitNotes),
    onSuccess: () => { 
      setShowSubmitModal(false)
      setSubmitNotes('')
      refetch()
    },
    onError: (err) => {
      const d = err.response?.data
      setPrepareError(d?.detail || 'Submission failed.')
    }
  })

  const close     = closeData
  const isOpen    = close?.status === 'OPEN'
  const integrity = close?.integrity || {}
  const checks    = integrity.checks || {}
  const snap      = snapshot || (close?.status !== 'OPEN' ? close?.summary_snapshot : null)
  const isFuture  = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)

  const STATUS_COLOR = { 
    OPEN: 'bg-zinc-100 text-zinc-600', 
    SUBMITTED: 'bg-blue-100 text-blue-700', 
    FINANCE_REVIEWING: 'bg-amber-100 text-amber-700', 
    FINANCE_CLEARED: 'bg-violet-100 text-violet-700', 
    ENDORSED: 'bg-emerald-100 text-emerald-700', 
    LOCKED: 'bg-emerald-100 text-emerald-700', 
    REJECTED: 'bg-red-100 text-red-700' 
  }

  const prevMonth = () => { 
    setSnapshot(null)
    if (month === 1) {
      setMonth(12)
      setYear(y => y - 1)
    } else {
      setMonth(m => m - 1)
    }
  }
  
  const nextMonth = () => { 
    if (isFuture) return
    setSnapshot(null)
    if (month === 12) {
      setMonth(1)
      setYear(y => y + 1)
    } else {
      setMonth(m => m + 1)
    }
  }

  return (
    <div>
      <SectionHeader title="Monthly Close" subtitle="End-of-month consolidated filing sent to Finance and Regional Manager" />
      <div className="flex items-center gap-3 mb-5">
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] hover:border-[var(--border-dark)] text-[var(--text-2)] transition-colors">←</button>
        <span className="text-base font-bold text-[var(--text)] min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</span>
        <button onClick={nextMonth} disabled={isFuture} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] hover:border-[var(--border-dark)] text-[var(--text-2)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">→</button>
      </div>

      {isLoading && !closeData ? (
        <div className="h-48 bg-[var(--panel)] border border-[var(--border)] rounded-2xl animate-pulse" />
      ) : !close ? (
        <EmptyState icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} title="No close record" subtitle="Monthly close will be created automatically" />
      ) : (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs font-bold text-[var(--text-3)] uppercase tracking-widest mb-1">{MONTH_NAMES[month]} {year}</div>
              <div className="text-2xl font-black text-[var(--text)]">Monthly Close</div>
            </div>
            <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full ${STATUS_COLOR[close.status] ?? 'bg-zinc-100 text-zinc-600'}`}>{close.status?.replace(/_/g, ' ')}</span>
          </div>

          {isOpen && Object.keys(checks).length > 0 && (
            <div className="mb-4 space-y-1.5">
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-2">Integrity Checks</div>
              {Object.entries(checks).map(([key, check]) => (
                <div key={key} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium ${check.pass ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  <span className="shrink-0">{check.pass ? '✓' : '✕'}</span><span>{check.detail}</span>
                </div>
              ))}
            </div>
          )}

          {snap?.revenue && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[{label:'Total Collected',value:fmt(snap.revenue.total_collected),color:'text-[var(--text)]'},{label:'Cash',value:fmt(snap.revenue.total_cash),color:'text-emerald-600'},{label:'MoMo',value:fmt(snap.revenue.total_momo),color:'text-amber-600'},{label:'Total Jobs',value:snap.jobs?.total ?? '—',color:'text-blue-600'}].map(c=>(
                <div key={c.label} className="bg-[var(--bg)] rounded-xl p-3">
                  <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">{c.label}</div>
                  <div className={`font-mono font-black text-lg ${c.color}`}>{c.value}</div>
                </div>
              ))}
            </div>
          )}

          {close.submitted_by && <div className="text-xs text-[var(--text-3)] mb-3">Submitted by {close.submitted_by} · {fmtShort(close.submitted_at)}</div>}
          {close.endorsed_by  && <div className="text-xs text-emerald-600 font-semibold mb-3">✓ Endorsed by {close.endorsed_by} · {fmtShort(close.endorsed_at)}</div>}
          {close.rejected_by  && <div className="mb-3 px-3 py-2 bg-[var(--red-bg)] border border-[var(--red-border)] rounded-lg"><div className="text-xs font-bold text-[var(--red-text)]">Rejected by {close.rejected_by}</div>{close.rejection_reason && <div className="text-xs text-[var(--red-text)] mt-0.5">{close.rejection_reason}</div>}</div>}
          {prepareError && <div className="mb-3 px-3 py-2 bg-[var(--red-bg)] border border-[var(--red-border)] rounded-lg text-xs text-[var(--red-text)]">{prepareError}</div>}

          {isOpen && (
            <button onClick={() => { setPrepareError(''); prepareMut.mutate() }} disabled={prepareMut.isPending || !integrity.can_submit}
              className="w-full py-2.5 bg-[var(--text)] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
              {prepareMut.isPending ? 'Checking…' : 'Prepare Monthly Sheet'}
            </button>
          )}
        </div>
      )}

      {showSubmitModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-lg font-black text-[var(--text)] mb-1">Submit Monthly Close — {MONTH_NAMES[month]} {year}</h3>
            <p className="text-xs text-[var(--text-3)] mb-5">This will lock all weekly reports and send the close to Finance for review. This cannot be undone.</p>
            {snap?.revenue && (
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[{label:'Total Collected',value:fmt(snap.revenue.total_collected)},{label:'Total Cash',value:fmt(snap.revenue.total_cash)},{label:'Total MoMo',value:fmt(snap.revenue.total_momo)},{label:'Total Jobs',value:snap.jobs?.total ?? '—'}].map(c=>(
                  <div key={c.label} className="bg-[var(--bg)] rounded-lg p-3">
                    <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-0.5">{c.label}</div>
                    <div className="font-mono font-bold text-sm text-[var(--text)]">{c.value}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">Branch Manager Notes</label>
              <textarea rows={3} value={submitNotes} onChange={e => setSubmitNotes(e.target.value)} placeholder="Any notes for Finance or the Regional Manager…" className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg outline-none focus:border-[var(--border-dark)] transition-colors resize-none"/>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowSubmitModal(false); setSubmitNotes(''); }} className="flex-1 py-2.5 text-sm font-semibold text-[var(--text-2)] border border-[var(--border)] rounded-xl hover:border-[var(--border-dark)] transition-colors">Cancel</button>
              <button onClick={() => submitMut.mutate()} disabled={submitMut.isPending} className="flex-1 py-2.5 bg-[var(--text)] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">{submitMut.isPending ? 'Submitting…' : 'Submit Monthly Close'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Yearly Tab— table layout matching old design ─────────────────────────────

function YearlyTab() {
  const now  = new Date()
  const [year, setYear] = useState(now.getFullYear())

  const { data, isLoading } = useQuery({
    queryKey: ['sheets-yearly', year],
    queryFn: () => getSheets({ 
      year,
      page_size: 400,
    }).then(r => {
      const sheets = Array.isArray(r.data) ? r.data : (r.data?.results || [])
      const byMonth = {}
      sheets.filter(s => s.status !== 'OPEN').forEach(s => {
        const m = new Date(s.date).getMonth() + 1
        if (!byMonth[m]) byMonth[m] = { total:0, cash:0, momo:0, pos:0, jobs:0, complete:0, cancelled:0 }
        byMonth[m].cash      += parseFloat(s.total_cash  || 0)
        byMonth[m].momo      += parseFloat(s.total_momo  || 0)
        byMonth[m].pos       += parseFloat(s.total_pos   || 0)
        byMonth[m].total     += parseFloat(s.total_cash  || 0) + parseFloat(s.total_momo || 0) + parseFloat(s.total_pos || 0)
        byMonth[m].jobs      += parseInt(s.total_jobs_created || 0)
        byMonth[m].complete  += parseInt(s.total_jobs_complete ?? s.total_jobs_created ?? 0)
      })
      return byMonth
    }),
    staleTime: 60_000,
  })

  const months       = data || {}
  const totalRevenue = Object.values(months).reduce((s, m) => s + m.total, 0)
  const totalJobs    = Object.values(months).reduce((s, m) => s + m.jobs, 0)
  const maxRevenue   = Math.max(...Object.values(months).map(m => m.total), 1)
  const curMonth     = now.getMonth() + 1

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-2xl font-black text-[var(--text)]">{year} Annual Overview</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">Month-by-month summary for the current year</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="px-3 py-1.5 text-xs font-bold border border-[var(--border)] rounded-lg hover:border-[var(--border-dark)] text-[var(--text-2)] transition-colors">← {year - 1}</button>
          <span className="px-3 py-1.5 text-xs font-bold bg-[var(--text)] text-white rounded-lg">{year}</span>
          {year < now.getFullYear() && <button onClick={() => setYear(y => y + 1)} className="px-3 py-1.5 text-xs font-bold border border-[var(--border)] rounded-lg hover:border-[var(--border-dark)] text-[var(--text-2)] transition-colors">{year + 1} →</button>}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { label:'Total Jobs', value:totalJobs.toLocaleString(), color:'text-blue-600',    border:'#3b82f6' },
          { label:'Revenue',    value:fmt(totalRevenue),          color:'text-emerald-600', border:'#10b981' },
          { label:'Pending',    value:'0',                        color:'text-amber-500',   border:'#f59e0b' },
          { label:'Completion', value:totalJobs > 0 ? '99%' : '—', color:'text-violet-600', border:'#8b5cf6' },
        ].map(c => (
          <div key={c.label} className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3" style={{borderTop: `2px solid ${c.border}`}}>
            <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">{c.label}</div>
            <div className={`font-mono font-black text-lg ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Monthly table */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2.5 border-b border-[var(--border)] text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
            <span className="col-span-3">Month</span>
            <span className="col-span-2 text-right">Jobs</span>
            <span className="col-span-3 text-right">Revenue</span>
            <span className="col-span-2 text-right">Rate</span>
            <span className="hidden sm:block col-span-1 pl-3">Trend</span>
            <span className="col-span-2 sm:col-span-1 text-right">Close</span>
          </div>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
            const d       = months[m]
            const isCur   = m === curMonth && year === now.getFullYear()
            const isFut   = year === now.getFullYear() && m > curMonth
            if (isFut) return null
            const revPct  = d ? (d.total / maxRevenue * 100) : 0
            const compPct = d ? Math.min((d.complete / Math.max(d.jobs, 1)) * 100, 100) : 0
            const rateColor = compPct >= 95 ? 'text-emerald-600' : compPct >= 80 ? 'text-amber-500' : 'text-red-500'

            return (
              <div key={m} className={`grid grid-cols-12 px-5 py-3 border-b border-[var(--border)] last:border-0 items-center
                ${isFut ? 'opacity-35' : 'hover:bg-[var(--bg)]'} transition-colors`}>
                <div className="col-span-3 flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-bold text-[var(--text)] truncate">{MONTH_NAMES[m]}</span>
                  {isCur && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">Current</span>}
                </div>
                <div className="col-span-2 text-right font-mono text-sm font-semibold text-[var(--text)]">
                  {d ? d.jobs.toLocaleString() : <span className="text-[var(--text-3)]">—</span>}
                </div>
                <div className="col-span-3 text-right font-mono text-sm font-semibold text-[var(--text)]">
                  {d ? fmt(d.total) : <span className="text-[var(--text-3)]">—</span>}
                </div>
                <div className={`col-span-2 text-right text-sm font-bold ${d ? rateColor : 'text-[var(--text-3)]'}`}>
                  {d ? `${compPct.toFixed(1)}%` : '—'}
                </div>
                <div className="hidden sm:block col-span-1 pl-3">
                  {d ? (
                    <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--text)] rounded-full" style={{ width: `${revPct}%` }} />
                    </div>
                  ) : <div className="h-1.5 bg-[var(--border)] rounded-full" />}
                </div>
                <div className="col-span-2 sm:col-span-1 text-right">
                  {d && !isFut && (
                    <button className="text-[10px] font-bold px-2 py-1 border border-[var(--border)] rounded-lg hover:border-[var(--border-dark)] text-[var(--text-2)] transition-colors">
                      View
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Job Ledger Tab — All Years → Year → Month drill ───────────────────────────
// ── Trend Chart (canvas-based, dual Y-axis) ───────────────────────────────────

function TrendChart({ labels, jobs, revenue, height = 220 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !labels?.length) return

    const maxJ = Math.max(...jobs, 1)
    const maxR = Math.max(...revenue, 1)

    const dpr  = window.devicePixelRatio || 1
    const W    = canvas.offsetWidth
    const H    = height
    canvas.width  = W * dpr
    canvas.height = H * dpr
    canvas.style.width  = W + 'px'
    canvas.style.height = H + 'px'

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const padL = 50, padR = 60, padT = 20, padB = 35
    const cW   = W - padL - padR
    const cH   = H - padT - padB
    const step = labels.length > 1 ? cW / (labels.length - 1) : cW

    const isDark  = document.documentElement.dataset.theme === 'dark'
    const gridClr = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
    const lblClr  = isDark ? '#6b6b69' : '#a3a3a3'

    ctx.clearRect(0, 0, W, H)

    // Grid + left Y (jobs, blue)
    for (let i = 0; i <= 4; i++) {
      const y = padT + (cH / 4) * i
      ctx.beginPath()
      ctx.strokeStyle = gridClr
      ctx.lineWidth = 1
      ctx.moveTo(padL, y)
      ctx.lineTo(W - padR, y)
      ctx.stroke()
      const val = Math.round(maxJ * (1 - i / 4))
      ctx.fillStyle = '#3b82f6'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(val, padL - 6, y + 3)
    }

    // Right Y (revenue, green)
    for (let i = 0; i <= 4; i++) {
      const y   = padT + (cH / 4) * i
      const val = Math.round(maxR * (1 - i / 4))
      const lbl = val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val
      ctx.fillStyle = '#10b981'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(lbl, W - padR + 6, y + 3)
    }

    // Revenue area
    const grad = ctx.createLinearGradient(0, padT, 0, padT + cH)
    grad.addColorStop(0, 'rgba(16,185,129,0.18)')
    grad.addColorStop(1, 'rgba(16,185,129,0)')
    ctx.beginPath()
    revenue.forEach((v, i) => {
      const x = padL + i * step
      const y = padT + cH - (v / maxR) * cH
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.lineTo(padL + (revenue.length - 1) * step, padT + cH)
    ctx.lineTo(padL, padT + cH)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // Revenue line
    ctx.beginPath()
    revenue.forEach((v, i) => {
      const x = padL + i * step
      const y = padT + cH - (v / maxR) * cH
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.strokeStyle = '#10b981'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Jobs line
    ctx.beginPath()
    jobs.forEach((v, i) => {
      const x = padL + i * step
      const y = padT + cH - (v / maxJ) * cH
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Dots
    const dotData = [
      { arr: jobs,    color: '#3b82f6', maxV: maxJ },
      { arr: revenue, color: '#10b981', maxV: maxR },
    ]
    dotData.forEach(({ arr, color, maxV }) => {
      arr.forEach((v, i) => {
        const x = padL + i * step
        const y = padT + cH - (v / maxV) * cH
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      })
    })

    // X labels — show subset if too many
    const maxLabels = Math.floor(cW / 28)
    const skip = Math.ceil(labels.length / maxLabels)
    ctx.fillStyle = lblClr
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    labels.forEach((lbl, i) => {
      if (i % skip === 0 || i === labels.length - 1) {
        ctx.fillText(lbl, padL + i * step, H - 8)
      }
    })
  }, [labels, jobs, revenue, height])

  return <canvas ref={canvasRef} style={{ width: '100%', height: `${height}px`, display: 'block' }} />
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────

function BarChart({ labels, data, height = 140 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !labels?.length) return

    const maxV = Math.max(...data, 1)
    const dpr  = window.devicePixelRatio || 1
    const W    = canvas.offsetWidth
    const H    = height
    canvas.width  = W * dpr
    canvas.height = H * dpr
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const padL = 10, padR = 10, padT = 10, padB = 24
    const cW   = W - padL - padR
    const cH   = H - padT - padB
    const barW = (cW / labels.length) * 0.6
    const gap  = cW / labels.length

    const isDark = document.documentElement.dataset.theme === 'dark'
    const lblClr = isDark ? '#6b6b69' : '#a3a3a3'

    ctx.clearRect(0, 0, W, H)

    data.forEach((v, i) => {
      const bH = (v / maxV) * cH
      const x  = padL + i * gap + (gap - barW) / 2
      const y  = padT + cH - bH
      ctx.fillStyle = '#6366f1'
      ctx.beginPath()
      ctx.roundRect(x, y, barW, bH, 3)
      ctx.fill()

      ctx.fillStyle = lblClr
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(labels[i], padL + i * gap + gap / 2, H - 6)
    })
  }, [labels, data, height])

  return <canvas ref={canvasRef} style={{ width: '100%', height: `${height}px`, display: 'block' }} />
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function WeekHeatmap({ heatmap }) {
  // heatmap: array of weeks, each week is array of {date, count}
  const allCounts = heatmap.flatMap(w => w.map(d => d.count))
  const maxCount  = Math.max(...allCounts, 1)

  const opacity = (count) => {
    if (count === 0) return 0.06
    return 0.15 + (count / maxCount) * 0.85
  }

  return (
    <div className="flex gap-1">
      {heatmap.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1 flex-1">
          {week.map((day, di) => (
            <div key={day.date} title={`${day.date}: ${day.count} jobs`}
              className="rounded aspect-square flex items-center justify-center"
              style={{ backgroundColor: `rgba(99,102,241,${opacity(day.count)})` }}>
              <span className="text-[8px] font-bold text-[var(--text-3)]">
                {day.count > 0 ? day.count : ''}
              </span>
            </div>
          ))}
          <div className="text-[8px] text-[var(--text-3)] text-center font-medium mt-0.5">
            W{wi + 1}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────

function KpiCards({ kpis }) {
  const cards = [
    { label: 'Total Jobs',  key: 'total',   color: 'text-blue-600',    border: '#3b82f6', fmt: v => v.toLocaleString() },
    { label: 'Revenue',     key: 'revenue', color: 'text-emerald-600', border: '#10b981', fmt: v => `GHS ${parseFloat(v).toLocaleString('en-GH', { minimumFractionDigits: 2 })}` },
    { label: 'Pending',     key: 'pending', color: 'text-amber-500',   border: '#f59e0b', fmt: v => v.toLocaleString() },
    { label: 'Completion',  key: 'rate',    color: 'text-violet-600',  border: '#8b5cf6', fmt: v => `${v}%` },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {cards.map(c => {
        const kpi = kpis?.[c.key]
        return (
          <div key={c.label} className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4"
            style={{ borderTop: `3px solid ${c.border}` }}>
            <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">{c.label}</div>
            <div className={`font-mono font-black text-xl ${c.color}`}>
              {kpi ? c.fmt(kpi.value) : '—'}
            </div>
            {kpi?.change ? (
              <div className={`text-[10px] mt-1 font-semibold ${kpi.change.startsWith('+') ? 'text-emerald-600' : 'text-red-500'}`}>
                {kpi.change} vs prev
              </div>
            ) : (
              <div className="text-[10px] text-[var(--text-3)] mt-1">no prev data</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Job Ledger Tab ─────────────────────────────────────────────────────────────

function JobLedgerTab() {
  const now = new Date()
  const [level,         setLevel]         = useState('years')
  const [selectedYear,  setSelectedYear]  = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null)

  // All-years: level=year
  const { data: yearsData, isLoading: loadingYears } = useQuery({
    queryKey: ['ledger-years'],
    queryFn:  () => getJobHistory({ level: 'year' }).then(r => r.data),
    staleTime: 120_000,
  })

  // Year drill: level=month
  const { data: monthsData, isLoading: loadingMonths } = useQuery({
    queryKey: ['ledger-months', selectedYear],
    queryFn:  () => getJobHistory({ level: 'month', year: selectedYear }).then(r => r.data),
    enabled:  !!selectedYear,
    staleTime: 60_000,
  })

  // Month drill: level=week
  const { data: weeksData, isLoading: loadingWeeks } = useQuery({
    queryKey: ['ledger-weeks', selectedYear, selectedMonth],
    queryFn:  () => getJobHistory({ level: 'week', year: selectedYear, month: selectedMonth }).then(r => r.data),
    enabled:  !!selectedYear && !!selectedMonth,
    staleTime: 60_000,
  })

  const activeData = level === 'years' ? yearsData : level === 'months' ? monthsData : weeksData
  const isLoading  = loadingYears || loadingMonths || loadingWeeks

  const drillYear  = (y) => { setSelectedYear(y);  setLevel('months') }
  const drillMonth = (m) => { setSelectedMonth(m); setLevel('weeks')  }
  const backToYears  = () => { setSelectedYear(null); setSelectedMonth(null); setLevel('years')  }
  const backToMonths = () => { setSelectedMonth(null); setLevel('months') }

  const BG_COLORS = [
    'bg-zinc-800','bg-violet-700','bg-emerald-700','bg-amber-700',
    'bg-red-700','bg-blue-700','bg-zinc-700','bg-teal-700',
    'bg-indigo-700','bg-rose-700','bg-cyan-700','bg-orange-700',
  ]

  // Month index from label
  const monthIdx = (label) => MONTH_NAMES.indexOf(label)

  return (
    <div>
      {/* Header + breadcrumb */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-2xl font-black text-[var(--text)]">Job Ledger</h2>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-[var(--text-3)]">
            <button onClick={backToYears}
              className={level === 'years' ? 'text-[var(--text)] font-semibold' : 'hover:text-[var(--text)] transition-colors'}>
              All Years
            </button>
            {selectedYear && (
              <>
                <span>›</span>
                <button onClick={backToMonths}
                  className={level === 'months' ? 'text-[var(--text)] font-semibold' : 'hover:text-[var(--text)] transition-colors'}>
                  {selectedYear}
                </button>
              </>
            )}
            {selectedMonth && (
              <>
                <span>›</span>
                <span className="text-[var(--text)] font-semibold">{MONTH_NAMES[selectedMonth]}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── All Years level ── */}
      {level === 'years' && (
        <>
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-3">Years</div>
          {loadingYears ? (
            <div className="flex gap-3 mb-6">{[1,2].map(i => <div key={i} className="w-44 h-24 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse"/>)}</div>
          ) : (
            <div className="flex flex-wrap gap-3 mb-6">
              {(yearsData?.items || []).map(y => {
                const maxTotal = Math.max(...(yearsData?.items || []).map(x => x.total), 1)
                const pct = ((y.total / maxTotal) * 100).toFixed(0)
                return (
                  <button key={y.year} onClick={() => drillYear(y.year)}
                    className="bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--border-dark)] transition-colors text-left w-44">
                    <div className="bg-zinc-800 px-4 py-3">
                      <span className="text-white font-black text-2xl">{y.year}</span>
                    </div>
                    <div className="px-4 py-3">
                      <div className="text-xs font-semibold text-[var(--text)]">{y.total.toLocaleString()} jobs</div>
                      <div className="font-mono text-xs text-[var(--text-3)]">GHS {parseFloat(y.revenue).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <div className="flex-1 h-1 bg-[var(--bg)] rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }}/>
                        </div>
                        <span className="text-[10px] text-[var(--text-3)]">{pct}%</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* KPI cards */}
          {yearsData && <KpiCards kpis={yearsData.kpis} />}

          {/* Trend chart */}
          {yearsData?.trend && (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Trend</span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-3)]"><span className="w-6 h-0.5 bg-blue-500 inline-block rounded"/>Jobs</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-3)]"><span className="w-6 h-0.5 bg-emerald-500 inline-block rounded"/>Revenue (GHS)</span>
                </div>
              </div>
              <TrendChart labels={yearsData.trend.labels} jobs={yearsData.trend.jobs} revenue={yearsData.trend.revenue} height={220} />
            </div>
          )}
        </>
      )}

      {/* ── Months level ── */}
      {level === 'months' && (
        <>
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-3">Months</div>
          {loadingMonths ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {[1,2,3,4,5].map(i => <div key={i} className="h-24 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse"/>)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {(monthsData?.items || []).filter(m => m.total > 0).map(m => {
                const maxTotal = Math.max(...(monthsData?.items || []).map(x => x.total), 1)
                const pct    = ((m.total / maxTotal) * 100).toFixed(0)
                const mIdx   = monthIdx(m.label)
                const colIdx = (mIdx > 0 ? mIdx : 1) - 1
                return (
                  <button key={m.label} onClick={() => drillMonth(m.month)}
                    className="bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--border-dark)] transition-colors text-left">
                    <div className={`${BG_COLORS[colIdx] || 'bg-zinc-700'} px-4 py-3 flex items-center justify-between`}>
                      <span className="text-white font-black text-lg">{m.label}</span>
                      <span className="text-white/70 text-xs">{m.total.toLocaleString()} jobs</span>
                    </div>
                    <div className="px-4 py-3">
                      <div className="font-mono font-black text-sm text-[var(--text)]">GHS {parseFloat(m.revenue).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</div>
                      <div className="text-[10px] text-[var(--text-3)] mt-0.5">{m.rate}% complete</div>
                      <div className="mt-2 h-1 bg-[var(--bg)] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }}/>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {monthsData && <KpiCards kpis={monthsData.kpis} />}

          {monthsData?.trend && (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Trend</span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-3)]"><span className="w-6 h-0.5 bg-blue-500 inline-block rounded"/>Jobs</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-3)]"><span className="w-6 h-0.5 bg-emerald-500 inline-block rounded"/>Revenue (GHS)</span>
                </div>
              </div>
              <TrendChart labels={monthsData.trend.labels} jobs={monthsData.trend.jobs} revenue={monthsData.trend.revenue} height={220} />
            </div>
          )}
        </>
      )}

      {/* ── Weeks level ── */}
      {level === 'weeks' && (
        <>
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-3">
            {MONTH_NAMES[selectedMonth]} {selectedYear} — Weekly Breakdown
          </div>

          {loadingWeeks ? (
            <div className="space-y-2 mb-5">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse"/>)}</div>
          ) : (
            <div className="space-y-2 mb-5">
              {(weeksData?.items || []).map(w => (
                <div key={w.week} className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-[var(--text)]">{w.label}</div>
                      <div className="text-xs text-[var(--text-3)] mt-0.5">
                        {w.start} → {w.end}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-sm text-[var(--text)]">
                        GHS {parseFloat(w.revenue).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="flex items-center gap-2 justify-end mt-0.5">
                        <span className="text-xs text-[var(--text-3)]">{w.total.toLocaleString()} jobs</span>
                        <span className={`text-xs font-bold ${w.rate >= 99 ? 'text-emerald-600' : w.rate >= 90 ? 'text-amber-500' : 'text-red-500'}`}>
                          {w.rate}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {weeksData && <KpiCards kpis={weeksData.kpis} />}

          {/* Daily trend chart */}
          {weeksData?.trend && (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4 mb-4">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Daily Trend</span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-3)]"><span className="w-6 h-0.5 bg-blue-500 inline-block rounded"/>Jobs</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-3)]"><span className="w-6 h-0.5 bg-emerald-500 inline-block rounded"/>Revenue (GHS)</span>
                </div>
              </div>
              <TrendChart labels={weeksData.trend.labels} jobs={weeksData.trend.jobs} revenue={weeksData.trend.revenue} height={200} />
            </div>
          )}

          {/* Distribution + Heatmap side by side */}
          {(weeksData?.bar || weeksData?.heatmap) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {weeksData.bar && (
                <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
                  <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-3">Distribution</div>
                  <BarChart labels={weeksData.bar.labels} data={weeksData.bar.data} height={140} />
                </div>
              )}
              {weeksData.heatmap && weeksData.heatmap.length > 0 && Array.isArray(weeksData.heatmap[0]) && (
                <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
                  <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-3">Activity Heatmap</div>
                  <WeekHeatmap heatmap={weeksData.heatmap} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Investor Statement Tab ───────────────────────────────────────────────────

function InvestorStatementTab() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [error,    setError]    = useState('')

  const { mutate: doDownload, isPending } = useMutation({
    mutationFn: () => downloadBranchStatement(dateFrom, dateTo),
    onSuccess: (res) => {
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url  = window.URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `branch-statement-${dateFrom}-to-${dateTo}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    },
    onError: (err) => {
      setError(err.response?.data?.detail || 'Could not generate statement.')
    },
  })

  const handleGenerate = () => {
    setError('')
    if (!dateFrom || !dateTo) { setError('Select both a start and end date.'); return }
    if (dateFrom > dateTo)    { setError('Start date must be before end date.'); return }
    doDownload()
  }

  return (
    <div>
      <SectionHeader
        title="Investor Statement"
        subtitle="Generate a presentable financial statement for banks, investors, or partners"
      />

      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-6 max-w-lg">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                rounded-lg text-sm outline-none focus:border-[var(--border-dark)]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                rounded-lg text-sm outline-none focus:border-[var(--border-dark)]"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2.5 bg-[var(--red-bg)] border border-[var(--red-border)]
            rounded-lg text-xs text-[var(--red-text)]">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="w-full py-2.5 bg-[var(--text)] text-white text-sm font-bold
            rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40
            flex items-center justify-center gap-2"
        >
          {isPending ? (
            'Generating…'
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Generate & Download Statement
            </>
          )}
        </button>

        <p className="text-[10px] text-[var(--text-3)] mt-4 leading-relaxed">
          This document includes revenue, job volume, customer growth, and payment
          breakdown for the selected period. Restricted access — handle as you would
          any sensitive business document.
        </p>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS = ['Daily', 'Weekly', 'Monthly', 'Yearly', 'Job Ledger']

export default function Reports() {
  const { user } = useAuth()
  const canGenerateStatement = user?.can_generate_branch_statement

  const tabs = canGenerateStatement
    ? [...TABS, 'Investor Statement']
    : TABS

  const [tab, setTab] = useState('Daily')

  const renderTab = () => {
    switch (tab) {
      case 'Daily':              return <DailyTab />
      case 'Weekly':             return <WeeklyTab />
      case 'Monthly':            return <MonthlyTab />
      case 'Yearly':             return <YearlyTab />
      case 'Job Ledger':         return <JobLedgerTab />
      case 'Investor Statement': return <InvestorStatementTab />
      default:                   return <DailyTab />
    }
  }

  return (
    <div className="p-5 sm:p-6">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-[var(--text)]">Reports & Filing</h1>
      </div>
      <div className="flex border-b border-[var(--border)] mb-6 -mx-5 sm:-mx-6 px-5 sm:px-6">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-3 mr-6 text-sm font-bold border-b-2 transition-colors whitespace-nowrap
              ${tab === t ? 'border-[var(--text)] text-[var(--text)]' : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
            {t}
          </button>
        ))}
      </div>
      <div key={tab}>
        {renderTab()}
      </div>
    </div>
  )
}