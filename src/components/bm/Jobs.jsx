// src/components/bm/Jobs.jsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { getJobs, getJobStats, getJobDetail, transitionJob } from '../../api/bm'
import client from '../../api/client'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (diff < 1)  return 'Just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return `${Math.floor(diff / 1440)}d ago`
}

function toTitleCase(str) {
  if (!str) return str
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  DRAFT:               { label: 'Draft',             bg: 'bg-zinc-100',    text: 'text-zinc-600'    },
  PENDING_PAYMENT:     { label: 'Pending Payment',   bg: 'bg-amber-100',   text: 'text-amber-700'   },
  PAID:                { label: 'Paid',               bg: 'bg-blue-100',    text: 'text-blue-700'    },
  CONFIRMED:           { label: 'Confirmed',          bg: 'bg-blue-100',    text: 'text-blue-700'    },
  IN_PROGRESS:         { label: 'In Progress',        bg: 'bg-violet-100',  text: 'text-violet-700'  },
  READY:               { label: 'Ready',              bg: 'bg-emerald-100', text: 'text-emerald-700' },
  COMPLETE:            { label: 'Complete',           bg: 'bg-emerald-100', text: 'text-emerald-700' },
  CANCELLED:           { label: 'Cancelled',          bg: 'bg-red-100',     text: 'text-red-600'     },
  VOIDED:              { label: 'Voided',             bg: 'bg-red-100',     text: 'text-red-600'     },
  HALTED:              { label: 'Halted',             bg: 'bg-red-100',     text: 'text-red-600'     },
  QUEUED:              { label: 'Queued',             bg: 'bg-zinc-100',    text: 'text-zinc-600'    },
  READY_FOR_PAYMENT:   { label: 'Ready for Payment', bg: 'bg-amber-100',   text: 'text-amber-700'   },
  DESIGN_IN_PROGRESS:  { label: 'Design in Progress',bg: 'bg-violet-100',  text: 'text-violet-700'  },
  DESIGN_APPROVED:     { label: 'Design Approved',   bg: 'bg-blue-100',    text: 'text-blue-700'    },
  BRIEFED:             { label: 'Briefed',            bg: 'bg-blue-100',    text: 'text-blue-700'    },
  SAMPLE_SENT:         { label: 'Sample Sent',        bg: 'bg-blue-100',    text: 'text-blue-700'    },
  REVISION_REQUESTED:  { label: 'Revision Requested',bg: 'bg-amber-100',   text: 'text-amber-700'   },
  OUT_FOR_DELIVERY:    { label: 'Out for Delivery',  bg: 'bg-blue-100',    text: 'text-blue-700'    },
  INTAKE_HELD:         { label: 'Intake Held',        bg: 'bg-amber-100',   text: 'text-amber-700'   },
}

const TYPE_CONFIG = {
  INSTANT:    { label: 'Instant',    color: 'text-zinc-700',   bg: 'bg-zinc-100'   },
  PRODUCTION: { label: 'Production', color: 'text-blue-700',   bg: 'bg-blue-100'   },
  DESIGN:     { label: 'Design',     color: 'text-violet-700', bg: 'bg-violet-100' },
}

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || { label: status, bg: 'bg-zinc-100', text: 'text-zinc-600' }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

// ── Job Detail Panel ──────────────────────────────────────────────────────────
function JobDetailPanel({ jobId, onClose }) {
  const queryClient = useQueryClient()
  const [transitioning, setTransitioning] = useState(null)
  const [error, setError] = useState('')

  const { data: job, isLoading } = useQuery({
    queryKey: ['job-detail', jobId],
    queryFn:  () => getJobDetail(jobId).then(r => r.data),
    staleTime: 10_000,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: ({ to_status, notes }) => transitionJob(jobId, { to_status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-detail', jobId] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['jobStats'] })
      setTransitioning(null)
      setError('')
    },
    onError: (err) => {
      const d = err.response?.data
      setError(d?.detail || 'Transition failed.')
    },
  })

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[var(--panel)] w-full max-w-lg max-h-[90vh]
        flex flex-col overflow-hidden shadow-2xl rounded-2xl animate-slideUp">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <div className="font-black text-base text-[var(--text)]">
              {isLoading ? 'Loading…' : job?.job_number}
            </div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">
              {isLoading ? '' : job?.title}
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full
              hover:bg-[var(--bg)] text-[var(--text-3)] transition-colors">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-[var(--bg)] rounded-xl animate-pulse" />)}
            </div>
          ) : job ? (<>

            {/* Status + meta */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={job.status} />
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                ${TYPE_CONFIG[job.job_type]?.bg} ${TYPE_CONFIG[job.job_type]?.color}`}>
                {TYPE_CONFIG[job.job_type]?.label || job.job_type}
              </span>
              {job.is_routed && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  Routed Out
                </span>
              )}
            </div>

            {/* Key info grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Customer',    value: toTitleCase(job.customer_name) || 'Walk-in' },
                { label: 'Intake By',   value: toTitleCase(job.intake_by_name) || '—'      },
                { label: 'Channel',     value: job.intake_channel || '—'                   },
                { label: 'Created',     value: timeAgo(job.created_at)                     },
                { label: 'Est. Cost',   value: fmt(job.estimated_cost),  highlight: true   },
                { label: 'Amount Paid', value: fmt(job.amount_paid),     highlight: true   },
              ].map(item => (
                <div key={item.label}
                  className={`px-3 py-2.5 rounded-xl border ${item.highlight ? 'bg-emerald-50 border-emerald-100' : 'bg-[var(--bg)] border-[var(--border)]'}`}>
                  <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-0.5">{item.label}</div>
                  <div className={`text-sm font-bold ${item.highlight ? 'text-emerald-700 font-mono' : 'text-[var(--text)]'}`}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Line items */}
            {job.line_items?.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">Services</div>
                <div className="space-y-1.5">
                  {job.line_items.map(li => (
                    <div key={li.id} className="flex items-center justify-between px-3 py-2.5
                      bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[var(--text)]">{li.label || li.service_name}</div>
                        <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                          {li.quantity} × {li.pages}pp · {li.is_color ? 'Colour' : 'B&W'}
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-[var(--text)] ml-3">
                        {fmt(li.line_total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Allowed transitions */}
            {job.allowed_transitions?.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">Actions</div>
                <div className="flex flex-wrap gap-2">
                  {job.allowed_transitions.map(t => (
                    <button key={t.to_status}
                      onClick={() => {
                        setError('')
                        mutate({ to_status: t.to_status })
                      }}
                      disabled={isPending}
                      className="px-3 py-2 text-xs font-bold bg-[var(--text)] text-white
                        rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                      {t.label || t.to_status.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
                {error && (
                  <div className="mt-2 px-3 py-2 bg-[var(--red-bg)] border border-[var(--red-border)]
                    rounded-lg text-xs text-[var(--red-text)]">{error}</div>
                )}
              </div>
            )}

            {/* Status log */}
            {job.status_logs?.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">History</div>
                <div className="space-y-1">
                  {job.status_logs.slice(0, 8).map(log => (
                    <div key={log.id} className="flex items-center gap-3 px-3 py-2
                      bg-[var(--bg)] border border-[var(--border)] rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[var(--text-2)]">
                          <span className="text-[var(--text-3)]">{log.from_status?.replace(/_/g,' ')}</span>
                          {' → '}
                          <span className="font-semibold text-[var(--text)]">{log.to_status?.replace(/_/g,' ')}</span>
                        </div>
                        {log.actor_name && (
                          <div className="text-[10px] text-[var(--text-3)] mt-0.5">{toTitleCase(log.actor_name)}</div>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--text-3)] shrink-0">
                        {timeAgo(log.transitioned_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {job.notes && (
              <div className="px-3 py-3 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Notes</div>
                <div className="text-xs text-amber-800">{job.notes}</div>
              </div>
            )}

          </>) : (
            <div className="text-sm text-[var(--text-3)] text-center py-8">Job not found</div>
          )}
        </div>

      </div>
    </div>,
    document.body
  )
}

// ── Main Jobs Component ───────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { value: 'ALL',             label: 'All'             },
  { value: 'PENDING_PAYMENT', label: 'Pending Payment' },
  { value: 'IN_PROGRESS',     label: 'In Progress'     },
  { value: 'READY',           label: 'Ready'           },
  { value: 'COMPLETE',        label: 'Complete'        },
  { value: 'CANCELLED',       label: 'Cancelled'       },
]

const TYPE_FILTERS = [
  { value: 'ALL',        label: 'All Types'  },
  { value: 'INSTANT',    label: 'Instant'    },
  { value: 'PRODUCTION', label: 'Production' },
  { value: 'DESIGN',     label: 'Design'     },
]

export default function Jobs() {
  const [status,     setStatus]     = useState('ALL')
  const [jobType,    setJobType]    = useState('ALL')
  const [period,     setPeriod]     = useState('day')
  const [page,       setPage]       = useState(1)
  const [selectedId, setSelectedId] = useState(null)

  const { data: statsData } = useQuery({
    queryKey: ['jobStats', period, jobType],
    queryFn:  () => getJobStats({
      period:   period  || undefined,
      job_type: jobType !== 'ALL' ? jobType : undefined,
    }).then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 0,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', status, jobType, period, page],
    queryFn:  () => getJobs({
      status:   status   !== 'ALL' ? status   : undefined,
      job_type: jobType  !== 'ALL' ? jobType  : undefined,
      period:   period   || undefined,
      page,
      page_size: 20,
    }).then(r => r.data),
    staleTime: 15_000,
    placeholderData: prev => prev,
  })

  const jobs       = Array.isArray(data) ? data : (data?.results || [])
  const count      = data?.count || 0
  const totalPages = Math.ceil(count / 20)

  const stats = statsData || {}

  const handleStatus = (v) => { setStatus(v); setPage(1) }
  const handleType   = (v) => { setJobType(v); setPage(1) }
  const handlePeriod = (v) => { setPeriod(v); setPage(1) }

  return (
    <div className="p-5 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Jobs</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {count > 0 ? `${count.toLocaleString()} jobs` : 'All branch jobs'}
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: 'Total',      value: stats.total,      color: 'text-[var(--text)]',    border: 'border-t-zinc-400'    },
          { label: 'Complete',   value: stats.complete,   color: 'text-emerald-600',       border: 'border-t-emerald-500' },
          { label: 'In Progress',value: stats.in_progress,color: 'text-violet-600',        border: 'border-t-violet-500'  },
          { label: 'Pending',    value: stats.pending,    color: 'text-amber-600',         border: 'border-t-amber-400'   },
          { label: 'Cancelled',  value: stats.cancelled,  color: 'text-red-500',           border: 'border-t-red-400'     },
          { label: 'Walk-in',    value: stats.walkin,     color: 'text-blue-600',          border: 'border-t-blue-400'    },
        ].map(c => (
          <div key={c.label}
            className={`bg-[var(--panel)] border border-[var(--border)] border-t-2 ${c.border} rounded-xl px-3 py-3 text-center`}>
            <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">{c.label}</div>
            <div className={`font-mono font-black text-xl ${c.color}`}>{c.value ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Filters — period tabs + status + type in one clean bar */}
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-3 space-y-3">

        {/* Period — tab style */}
        <div className="flex gap-1 bg-[var(--bg)] p-1 rounded-xl">
          {[
            { value: 'day',   label: 'Today'     },
            { value: 'week',  label: 'This Week'  },
            { value: 'month', label: 'This Month' },
            { value: '',      label: 'All Time'   },
          ].map(f => (
            <button key={f.value} onClick={() => handlePeriod(f.value)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors
                ${period === f.value
                  ? 'bg-[var(--text)] text-white shadow-sm'
                  : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Status + Type — centered, two distinct groups */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button key={f.value} onClick={() => handleStatus(f.value)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors whitespace-nowrap
                  ${status === f.value
                    ? 'bg-zinc-800 text-white border-transparent'
                    : 'border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)] hover:border-[var(--border-dark)]'
                  }`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-[var(--border)] shrink-0" />

          {/* Type — blue accent */}
          <div className="flex gap-1 justify-center">
            {TYPE_FILTERS.map(f => (
              <button key={f.value} onClick={() => handleType(f.value)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors
                  ${jobType === f.value
                    ? 'bg-blue-600 text-white border-transparent'
                    : 'border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)] hover:border-[var(--border-dark)]'
                  }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Job list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          flex flex-col items-center justify-center py-16">
          <p className="text-sm font-semibold text-[var(--text-2)]">No jobs found</p>
          <p className="text-xs text-[var(--text-3)] mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          {/* Table header — desktop */}
          <div className="hidden sm:grid grid-cols-12 px-4 py-2
            text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
            <span className="col-span-2">Job No.</span>
            <span className="col-span-3">Title</span>
            <span className="col-span-2">Customer</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-1">Type</span>
            <span className="col-span-1 text-right">Amount</span>
            <span className="col-span-1 text-right">When</span>
          </div>

          <div className="space-y-1.5">
            {jobs.map(job => (
              <div key={job.id}
                onClick={() => setSelectedId(job.id)}
                className="bg-[var(--panel)] border border-[var(--border)] rounded-xl
                  px-4 py-3 cursor-pointer hover:border-[var(--border-dark)] transition-colors">

                {/* Mobile */}
                <div className="flex items-center justify-between sm:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--text)]">{job.job_number}</span>
                      <StatusBadge status={job.status} />
                    </div>
                    <div className="text-xs text-[var(--text-3)] mt-0.5 truncate">
                      {job.title} · {toTitleCase(job.customer_name) || 'Walk-in'}
                    </div>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <div className="font-mono text-sm font-bold text-[var(--text)]">{fmt(job.estimated_cost)}</div>
                    <div className="text-[10px] text-[var(--text-3)]">{timeAgo(job.created_at)}</div>
                  </div>
                </div>

                {/* Desktop */}
                <div className="hidden sm:grid grid-cols-12 items-center gap-1">
                  <div className="col-span-2">
                    <span className="font-mono text-xs font-bold text-[var(--text)]">{job.job_number}</span>
                  </div>
                  <div className="col-span-3 min-w-0">
                    <div className="text-xs font-semibold text-[var(--text)] truncate">{job.title}</div>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <div className="text-xs text-[var(--text-2)] truncate">
                      {toTitleCase(job.customer_name) || 'Walk-in'}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <StatusBadge status={job.status} />
                  </div>
                  <div className="col-span-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded
                      ${TYPE_CONFIG[job.job_type]?.bg} ${TYPE_CONFIG[job.job_type]?.color}`}>
                      {TYPE_CONFIG[job.job_type]?.label || job.job_type}
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="font-mono text-xs font-bold text-[var(--text)]">{fmt(job.estimated_cost)}</span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-[10px] text-[var(--text-3)]">{timeAgo(job.created_at)}</span>
                  </div>
                </div>

              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-[var(--text-3)]">
                Page {page} of {totalPages} · {count.toLocaleString()} jobs
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)] border border-[var(--border)]
                    rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">← Prev</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)] border border-[var(--border)]
                    rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">Next →</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Job detail panel */}
      {selectedId && (
        <JobDetailPanel jobId={selectedId} onClose={() => setSelectedId(null)} />
      )}

    </div>
  )
}