// src/components/bm/Overview.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getJobStats, getJobs, getTodaySummary } from '../../api/bm'
import NewJobModal from './NewJobModal'
import LateJobModal from './LateJobModal'

function fmt(amount) {
  return `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000)
  if (diff < 1)  return 'just now'
  if (diff < 60) return `${diff}m ago`
  return `${Math.floor(diff / 60)}h ago`
}

const STAT_CARDS = [
  { key: 'total',      label: 'Total Jobs',      color: 'border-t-blue-500',   textColor: 'text-blue-600'   },
  { key: 'in_progress',label: 'In Progress',     color: 'border-t-amber-400',  textColor: 'text-amber-600'  },
  { key: 'complete',   label: 'Complete',        color: 'border-t-emerald-500',textColor: 'text-emerald-600'},
  { key: 'pending',    label: 'Pending Payment', color: 'border-t-red-400',    textColor: 'text-red-500'    },
]

const STATUS_COLORS = {
  COMPLETE:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  IN_PROGRESS:     'bg-amber-50 text-amber-700 border-amber-200',
  PENDING_PAYMENT: 'bg-red-50 text-red-700 border-red-200',
  DRAFT:           'bg-zinc-50 text-zinc-600 border-zinc-200',
  CANCELLED:       'bg-zinc-50 text-zinc-400 border-zinc-200',
}


export default function Overview({ onNavigate }) {
  const [showNewJob, setShowNewJob] = useState(false)
  const [showLateJob, setShowLateJob] = useState(false)

  const { data: summaryData } = useQuery({
    queryKey: ['todaySummary'],
    queryFn:  () => getTodaySummary().then(r => r.data),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const sheetId = summaryData?.meta?.sheet_id

  const { data: statsData } = useQuery({
    queryKey: ['jobStats', sheetId],
    queryFn:  () => getJobStats({ daily_sheet: sheetId }).then(r => r.data),
    enabled:  !!sheetId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  const { data: jobsData } = useQuery({
    queryKey: ['recentJobs', sheetId],
    queryFn:  () => getJobs({ page_size: 6, daily_sheet: sheetId }).then(r => r.data),
    enabled:  !!sheetId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  const { data: lockData } = useQuery({
    queryKey: ['lockStatus'],
    queryFn:  () => getLockStatus().then(r => r.data),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const canCreateJobs    = lockData?.can_create_jobs ?? true
  const cashierSignedOff = lockData?.cashier_signed_off ?? false
  const sheetOpen        = summaryData?.meta?.status === 'OPEN'
  const isPostClose      = !canCreateJobs && sheetOpen

  const stats   = statsData || {}
  const jobs    = Array.isArray(jobsData) ? jobsData : (jobsData?.results || [])

  return (
    <div className="p-5 sm:p-6">

      {/* Hero buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setShowNewJob(true)}
          className="flex items-center gap-3 px-5 py-4 bg-[var(--text)] text-white
            rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Job
          <span className="text-white/60 text-xs font-normal ml-auto hidden sm:block">
            Create instant, production or design job
          </span>
        </button>
        <button
          className="flex items-center gap-3 px-5 py-4 bg-[var(--panel)]
            border border-[var(--border)] text-[var(--text)] rounded-xl
            font-bold text-sm hover:border-[var(--border-dark)] transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Outsource Job
          <span className="text-[var(--text-3)] text-xs font-normal ml-auto hidden sm:block">
            Route a job to another branch
          </span>
        </button>
        
        {/* Post-closing banners */}
        {isPostClose && !cashierSignedOff && (
          <button
            onClick={() => setShowLateJob(true)}
            className="col-span-2 flex items-center gap-3 px-5 py-4 bg-amber-50
              border-2 border-amber-300 text-amber-800 rounded-xl font-bold text-sm
              hover:bg-amber-100 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Record Late Job
            <span className="text-amber-600 text-xs font-normal ml-auto hidden sm:block">
              Branch closed · cashier still on shift · job processed normally
            </span>
          </button>
        )}

        {isPostClose && cashierSignedOff && (
          <button
            onClick={() => setShowLateJob(true)}
            className="col-span-2 flex items-center gap-3 px-5 py-4 bg-orange-50
              border-2 border-orange-300 text-orange-800 rounded-xl font-bold text-sm
              hover:bg-orange-100 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Post-closing Hold
            <span className="text-orange-600 text-xs font-normal ml-auto hidden sm:block">
              Cashier signed off · job held until morning handover
            </span>
          </button>
        )}
      </div>

      {/* Stats — single row of 6 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {STAT_CARDS.map(card => (
          <div key={card.key}
            className={`bg-[var(--panel)] border border-[var(--border)] border-t-4
              ${card.color} rounded-xl p-4`}>
            <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-2">
              {card.label}
            </div>
            <div className={`font-mono font-black text-2xl ${card.textColor}`}>
              {stats[card.key] ?? '—'}
            </div>
          </div>
        ))}
        <div className="bg-[var(--panel)] border border-[var(--border)] border-t-4
          border-t-red-300 rounded-xl p-4">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-2">
            Unread Messages
          </div>
          <div className="font-mono font-black text-2xl text-[var(--red-text)]">0</div>
        </div>
        <div className="bg-[var(--panel)] border border-[var(--border)] border-t-4
          border-t-purple-400 rounded-xl p-4">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-2">
            Routed Out
          </div>
          <div className="font-mono font-black text-2xl text-[var(--text)]">
            {stats.routed ?? '—'}
          </div>
        </div>
      </div>

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[var(--text)]">Recent Jobs</h2>
          <button
            onClick={() => onNavigate('jobs')}
            className="text-xs text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
            View all →
          </button>
        </div>

        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-12 px-4 py-2.5 border-b border-[var(--border)]
            text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
            <span className="col-span-5">Job</span>
            <span className="col-span-2">Type</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-2 text-right">Cost</span>
            <span className="col-span-1 text-right">When</span>
          </div>

          {jobs.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--text-3)]">
              No jobs found
            </div>
          ) : (
            jobs.map(job => (
              <div key={job.id}
                className="px-4 py-3 border-b border-[var(--border)]
                  last:border-0 hover:bg-[var(--bg)] transition-colors">
                {/* Mobile layout */}
                <div className="flex items-center justify-between gap-2 sm:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[var(--text)] truncate">
                      {job.title || job.job_number}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-[var(--text-3)] font-mono">
                        {job.job_number}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5
                        rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text-3)]">
                        {job.job_type}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5
                        rounded border ${STATUS_COLORS[job.status] || STATUS_COLORS.DRAFT}`}>
                        {job.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs font-bold text-[var(--text)]">
                      {fmt(job.estimated_cost)}
                    </div>
                    <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                      {timeAgo(job.created_at)}
                    </div>
                  </div>
                </div>
                {/* Desktop layout */}
                <div className="hidden sm:grid grid-cols-12">
                  <div className="col-span-5 min-w-0">
                    <div className="text-xs font-semibold text-[var(--text)] truncate">
                      {job.title || job.job_number}
                    </div>
                    <div className="text-[10px] text-[var(--text-3)] font-mono mt-0.5">
                      {job.job_number}
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider
                      px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)]
                      text-[var(--text-3)]">
                      {job.job_type}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className={`text-[10px] font-bold uppercase tracking-wider
                      px-1.5 py-0.5 rounded border
                      ${STATUS_COLORS[job.status] || STATUS_COLORS.DRAFT}`}>
                      {job.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center justify-end">
                    <span className="font-mono text-xs text-[var(--text)]">
                      {fmt(job.estimated_cost)}
                    </span>
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <span className="text-[10px] text-[var(--text-3)]">
                      {timeAgo(job.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      {showNewJob && (
        <NewJobModal
          onClose={() => setShowNewJob(false)}
          onSuccess={() => setShowNewJob(false)}
        />
      )}

      {showLateJob && (
        <LateJobModal
          onClose={() => setShowLateJob(false)}
          onSuccess={() => setShowLateJob(false)}
        />
      )}
    </div>
  )
}