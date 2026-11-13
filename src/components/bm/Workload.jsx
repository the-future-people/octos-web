// src/components/bm/Workload.jsx
// The five workload pages behind the Overview's tiles (12 Nov 2026).
//
// One page, five purposes: pending payment, in production, ready for pickup,
// awaiting feedback, overdue. Each lists the jobs behind its tile, from the
// same definition the tile counts with (stats_selectors.workload_filter), so a
// tile and its page can never disagree. Who a job is for follows the receipt
// rule: the customer record, else the WhatsApp chat, else Walk-in.

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { usePrefetchJobFile } from './jobFileQuery'

const VIEWS = [
  { id: 'pending_payment',   label: 'Pending payment',   blurb: 'Recorded and waiting for the cashier. Oldest first.' },
  { id: 'in_production',     label: 'In production',     blurb: 'On the floor now: confirmed or being made.' },
  { id: 'ready_for_pickup',  label: 'Ready for pickup',  blurb: 'Finished and waiting for the customer to collect.' },
  { id: 'awaiting_feedback', label: 'Awaiting feedback', blurb: 'Design samples sent, or revisions asked for.' },
  { id: 'overdue',           label: 'Overdue',           blurb: 'Past their deadline and not yet done.' },
]

const TYPES = ['All', 'INSTANT', 'PRODUCTION', 'DESIGN']
const TYPE_LABEL = { All: 'All', INSTANT: 'Instant', PRODUCTION: 'Production', DESIGN: 'Design' }

function span(minutes) {
  if (minutes == null) return '—'
  if (minutes < 60) return `${minutes} min`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h`
  return `${Math.round(minutes / (60 * 24))} d`
}
const sinceMinutes = iso => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
const clock = iso => (iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—')
const money = v => `GHS ${Number(v || 0).toFixed(2)}`

// The column that matters most on each page, and how urgent it looks.
function keyCell(view, r) {
  if (view === 'pending_payment') {
    const m = r.waited_minutes
    return { label: span(m), tone: m >= 15 ? 'red' : m >= 5 ? 'amber' : '' }
  }
  if (view === 'overdue') return { label: `${span(r.late_minutes)} late`, tone: 'red' }
  if (view === 'ready_for_pickup' || view === 'awaiting_feedback') {
    const m = sinceMinutes(r.updated_at)
    return { label: span(m), tone: m >= 60 * 24 * 7 ? 'red' : m >= 60 * 24 * 2 ? 'amber' : '' }
  }
  return { label: (r.status || '').replace(/_/g, ' ').toLowerCase(), tone: '' }
}
const KEY_HEAD = { pending_payment: 'Waiting', in_production: 'Stage', ready_for_pickup: 'Ready for',
                   awaiting_feedback: 'Waiting for', overdue: 'Late by' }
const TONE = { red: 'text-red-600 font-bold', amber: 'text-amber-600 font-bold', '': 'text-[var(--text-2)]' }

// Why a job is being marked collected from this page: every clean-up says why.
const REASONS = [
  ['COLLECTED_EARLIER', 'Collected earlier'],
  ['TEST_JOB', 'Test job'],
  ['OTHER', 'Other'],
]

export default function Workload({ view = 'pending_payment', onNavigate, onOpenJob }) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState('All')
  const meta = VIEWS.find(v => v.id === view) || VIEWS[0]
  const queryClient = useQueryClient()
  const prefetchJob = usePrefetchJobFile()

  // Marking collected (Ready for pickup only): one row open at a time, with a reason.
  const [marking, setMarking] = useState(null)      // { id, reason, note, error }
  const markCollected = useMutation({
    mutationFn: ({ id, reason, note }) => client.post(`/api/v1/jobs/${id}/mark-collected/`, { reason, note }),
    onSuccess: () => {
      setMarking(null)
      queryClient.invalidateQueries({ queryKey: ['workload-list', view] })
      queryClient.invalidateQueries({ queryKey: ['workload'] })
    },
    onError: err => setMarking(m => ({ ...m, error: err?.response?.data?.detail || 'That did not save. Try again.' })),
  })
  const pickup = view === 'ready_for_pickup'
  const cols = pickup ? 'grid-cols-[110px_minmax(0,1.6fr)_minmax(0,1fr)_110px_190px]'
                      : 'grid-cols-[110px_minmax(0,1.6fr)_minmax(0,1fr)_110px_80px]'

  // The tiles' counts: the same query and key the Overview uses, so they share it.
  const { data: counts } = useQuery({
    queryKey: ['workload'],
    queryFn: () => client.get('/api/v1/jobs/workload/').then(r => r.data),
    staleTime: 60_000,
  })
  const { data, isLoading } = useQuery({
    queryKey: ['workload-list', view],
    queryFn: () => client.get(`/api/v1/jobs/workload/${view}/`).then(r => r.data),
    refetchInterval: 30_000,
  })

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.rows || []).filter(r =>
      (type === 'All' || r.job_type === type) &&
      (!q || r.job_number.toLowerCase().includes(q) || (r.for || '').toLowerCase().includes(q)))
  }, [data, search, type])

  const s = data?.summary || {}
  const figures = {
    pending_payment:   [['Waiting to be paid', money(s.total_amount)], ['Longest wait', span(s.oldest_minutes)], ['From WhatsApp', `${s.from_chat ?? 0} of ${s.count ?? 0}`]],
    in_production:     [['On the floor', s.count ?? 0], ['Oldest', span(s.oldest_minutes)], ['From WhatsApp', s.from_chat ?? 0]],
    ready_for_pickup:  [['Waiting to collect', s.count ?? 0], ['Value held', money(s.total_amount)], ['Oldest', span(s.oldest_minutes)]],
    awaiting_feedback: [['Samples out', s.count ?? 0], ['Oldest', span(s.oldest_minutes)], ['From WhatsApp', s.from_chat ?? 0]],
    overdue:           [['Overdue', s.count ?? 0], ['Oldest', span(s.oldest_minutes)], ['Value', money(s.total_amount)]],
  }[view]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* The five pages, with live counts: move between them without leaving */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {VIEWS.map(v => (
          <button key={v.id} type="button" onClick={() => onNavigate?.(v.id)}
                  className={`h-9 px-3.5 rounded-full text-[13px] font-semibold border transition
                              ${v.id === view ? 'bg-zinc-900 text-white border-transparent' : 'bg-[var(--panel)] border-[var(--border)] text-[var(--text-2)] hover:border-black/30'}`}>
            {v.label} <span className={v.id === view ? 'opacity-80' : 'text-[var(--text-3)]'}>· {counts?.[v.id] ?? '—'}</span>
          </button>
        ))}
      </div>

      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h1 className="text-xl font-black text-[var(--text)]">{meta.label}</h1>
        <button type="button" onClick={() => onNavigate?.('overview')}
                className="text-[13px] font-semibold text-[var(--text-3)] hover:text-[var(--text)]">Back to overview</button>
      </div>
      <p className="text-[13px] text-[var(--text-3)] mb-4">{meta.blurb}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {figures.map(([label, value]) => (
          <div key={label} className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-3)]">{label}</div>
            <div className="text-2xl font-black tabular-nums mt-1">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search job, name or number"
               className="flex-1 min-w-[220px] h-10 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--panel)] text-sm outline-none focus:border-black/40" />
        {TYPES.map(t => (
          <button key={t} type="button" onClick={() => setType(t)}
                  className={`h-10 px-3.5 rounded-xl text-[13px] font-semibold border
                              ${type === t ? 'bg-zinc-900 text-white border-transparent' : 'bg-[var(--panel)] border-[var(--border)] text-[var(--text-2)]'}`}>
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className={`grid ${cols} gap-3 px-4 py-2.5 border-b border-[var(--border)]
                        text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-3)]`}>
          <span>{KEY_HEAD[view]}</span><span>Job and customer</span><span>Recorded</span>
          <span className="text-right">Amount</span><span />
        </div>
        {isLoading && <div className="px-4 py-8 text-sm text-[var(--text-3)]">Loading…</div>}
        {!isLoading && rows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-[var(--text-3)]">Nothing here right now.</div>
        )}
        {rows.map(r => {
          const k = keyCell(view, r)
          return (
            <div key={r.id} className="border-b border-[var(--border)] last:border-0">
            <div className={`grid ${cols} gap-3 px-4 py-3 items-center hover:bg-black/[0.015]`}>
              <span className={`text-[13px] capitalize ${TONE[k.tone]}`}>{k.label}</span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-bold">{r.job_number}</div>
                <div className="text-[12.5px] text-[var(--text-2)] truncate">
                  {r.for}
                  {r.from_chat && <span className="ml-1.5 text-[10.5px] font-bold px-1.5 py-px rounded bg-emerald-50 text-emerald-700">WhatsApp</span>}
                  {r.items.length > 0 && <span className="text-[var(--text-3)]"> · {r.items.join(', ')}</span>}
                </div>
                {(view === 'overdue' || view === 'in_production') && (r.deadline || r.promised) && (
                  <div className="text-[11.5px] text-[var(--text-3)]">
                    {r.deadline && <>Deadline {clock(r.deadline)}</>}
                    {r.promised && <> · Promised {clock(r.promised)}</>}
                  </div>
                )}
              </div>
              <span className="text-[12.5px] text-[var(--text-2)] truncate">{r.recorded_by} · {clock(r.recorded_at)}</span>
              <span className="text-[13.5px] font-bold tabular-nums text-right">{money(r.amount)}</span>
              <span className="flex gap-1.5 justify-end">
                {pickup && (
                  <button type="button"
                          onClick={() => setMarking(m => (m?.id === r.id ? null : { id: r.id, reason: '', note: '', error: '' }))}
                          className="h-8 px-3 rounded-lg bg-zinc-900 text-white text-[12.5px] font-semibold">Mark collected</button>
                )}
                {/* Open goes to this job, not the list (13 Nov 2026). */}
                <button type="button" onMouseEnter={() => prefetchJob(r.id)} onFocus={() => prefetchJob(r.id)}
                        onClick={() => (onOpenJob ? onOpenJob(r.id) : onNavigate?.('jobs'))}
                        className="h-8 px-3 rounded-lg border border-[var(--border)] text-[12.5px] font-semibold hover:border-black/30">Open</button>
              </span>
            </div>
            {pickup && marking?.id === r.id && (
              <div className="px-4 pb-3 -mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] font-bold text-[var(--text-3)] mr-1">Why?</span>
                {REASONS.map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setMarking(m => ({ ...m, reason: value, error: '' }))}
                          className={`h-8 px-3 rounded-full text-[12.5px] font-semibold border
                                      ${marking.reason === value ? 'bg-zinc-900 text-white border-transparent' : 'bg-white border-black/15'}`}>
                    {label}
                  </button>
                ))}
                {marking.reason === 'OTHER' && (
                  <input value={marking.note} onChange={e => setMarking(m => ({ ...m, note: e.target.value }))}
                         placeholder="Briefly, why" className="h-8 px-2.5 rounded-lg border border-black/15 text-[12.5px] min-w-[200px]" />
                )}
                <button type="button" disabled={!marking.reason || markCollected.isPending}
                        onClick={() => markCollected.mutate({ id: r.id, reason: marking.reason, note: marking.note })}
                        className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-[12.5px] font-semibold disabled:opacity-40">
                  Confirm collected
                </button>
                {marking.error && <span className="w-full text-[12.5px] font-semibold text-red-600">{marking.error}</span>}
              </div>
            )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
