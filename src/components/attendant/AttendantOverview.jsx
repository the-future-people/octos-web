// src/components/attendant/AttendantOverview.jsx
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import client from '../../api/client'
import { createPortal } from 'react-dom'

const getStats     = (sheetId) => client.get(`/api/v1/jobs/stats/${sheetId ? `?daily_sheet=${sheetId}` : ''}`).then(r => r.data)
const getMyJobs    = (sheetId) => client.get(`/api/v1/jobs/?intake_by=me${sheetId ? `&daily_sheet=${sheetId}` : ''}&page_size=5`).then(r => r.data)
const getServices  = ()        => client.get('/api/v1/jobs/services/').then(r => r.data)
const getDrafts    = ()        => client.get('/api/v1/jobs/drafts/').then(r => r.data)

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (diff < 1)    return 'Just now'
  if (diff < 60)   return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return `${Math.floor(diff / 1440)}d ago`
}

function toTitleCase(str) {
  if (!str) return str
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

const STATUS_CONFIG = {
  PENDING_PAYMENT: { label: 'Pending',   bg: 'bg-amber-100',   text: 'text-amber-700'   },
  PAID:            { label: 'Paid',       bg: 'bg-blue-100',    text: 'text-blue-700'    },
  COMPLETE:        { label: 'Complete',   bg: 'bg-emerald-100', text: 'text-emerald-700' },
  CANCELLED:       { label: 'Cancelled', bg: 'bg-red-100',     text: 'text-red-600'     },
  IN_PROGRESS:     { label: 'In Progress',bg: 'bg-violet-100',  text: 'text-violet-700'  },
}

// ── New Job Modal (delegated to existing component if available, else inline) ─
function NewJobButton({ sheet, onJobCreated }) {
  const [open, setOpen] = useState(false)

  // Dynamically import NewJobModal from BM if it exists
  // For now render a portal trigger
  const handleClick = () => {
    // Fire a custom event that AttendantPortal can intercept
    window.dispatchEvent(new CustomEvent('attendant:new-job'))
    setOpen(true)
  }

  return (
    <>
      <button onClick={handleClick}
        className="w-full flex items-center gap-3 px-5 py-4 bg-[var(--text)] text-white
          rounded-2xl hover:opacity-90 transition-opacity font-bold text-sm">
        <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
        <div className="text-left">
          <div className="font-black">New Job</div>
          <div className="text-xs text-white/70 font-normal">Create instant, production or design job</div>
        </div>
      </button>
    </>
  )
}

export default function AttendantOverview({ sheet, onNavigate }) {
  const { user } = useAuth()
  const sheetId  = sheet?.id

  const { data: statsData } = useQuery({
    queryKey: ['attendant-stats', sheetId],
    queryFn:  () => getStats(sheetId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: !!sheetId,
  })

  const { data: jobsData } = useQuery({
    queryKey: ['attendant-my-jobs-recent', sheetId],
    queryFn:  () => getMyJobs(sheetId),
    staleTime: 30_000,
    enabled: !!sheetId,
  })

  const { data: drafts = [] } = useQuery({
    queryKey: ['attendant-drafts'],
    queryFn:  getDrafts,
    staleTime: 30_000,
  })

  const personal = statsData?.personal || {}
  const myJobs   = Array.isArray(jobsData) ? jobsData : (jobsData?.results || [])
  const draftCount = Array.isArray(drafts) ? drafts.length : 0

  const target     = personal.daily_target || 10
  const myTotal    = personal.my_total || 0
  const progress   = Math.min((myTotal / target) * 100, 100)
  const remaining  = Math.max(target - myTotal, 0)

  const KPI_CARDS = [
    { label: 'My Jobs Today', value: myTotal,                    sub: 'on this sheet',    color: 'border-t-blue-400'    },
    { label: 'My Value',      value: fmt(personal.my_value),     sub: 'recorded today',   color: 'border-t-amber-400'   },
    { label: 'Confirmed Paid',value: personal.my_confirmed ?? 0, sub: 'by cashier',       color: 'border-t-emerald-400' },
    { label: 'Completion Rate',value: `${personal.my_rate ?? 0}%`, sub: 'today',          color: 'border-t-violet-400'  },
    { label: 'Avg Per Hour',  value: personal.jobs_per_hour ?? 0, sub: 'jobs / hr',       color: 'border-t-rose-400'    },
  ]

  return (
    <div className="p-5 sm:p-6 space-y-5">

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {KPI_CARDS.map(c => (
          <div key={c.label}
            className={`bg-[var(--panel)] border border-[var(--border)] border-t-2 ${c.color} rounded-xl px-3 py-3`}>
            <div className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">{c.label}</div>
            <div className="font-mono font-black text-xl text-[var(--text)]">{c.value ?? '—'}</div>
            <div className="text-[10px] text-[var(--text-3)] mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <NewJobButton sheet={sheet} />
          <button onClick={() => window.dispatchEvent(new CustomEvent('attendant:register-customer'))}
            className="w-full flex items-center gap-3 px-5 py-3.5 bg-[var(--panel)]
              border border-[var(--border)] rounded-2xl hover:border-[var(--border-dark)]
              transition-colors text-sm font-semibold text-[var(--text)]">
            <div className="w-7 h-7 bg-[var(--bg)] rounded-lg flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                <line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/>
              </svg>
            </div>
            Register Customer
          </button>
          <button onClick={() => onNavigate('services')}
            className="w-full flex items-center gap-3 px-5 py-3.5 bg-[var(--panel)]
              border border-[var(--border)] rounded-2xl hover:border-[var(--border-dark)]
              transition-colors text-sm font-semibold text-[var(--text)]">
            <div className="w-7 h-7 bg-[var(--bg)] rounded-lg flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/>
              </svg>
            </div>
            Browse Services
          </button>
        </div>

        {/* Quick stats sidebar */}
        <div className="space-y-2">
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl px-4 py-3 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Top service this week</div>
                <div className="text-xs font-bold text-[var(--text)] truncate mt-0.5">
                  {personal.top_service || 'No data yet this week'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-[var(--border)] pt-3">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">This week so far</div>
                <div className="text-xs font-bold text-[var(--text)] mt-0.5">
                  {personal.week_daily_counts?.[0]
                    ? `Mon ${personal.week_daily_counts.find(d => d.is_today)?.count ?? 0}`
                    : 'Mon 0'}
                </div>
              </div>
            </div>
            {draftCount > 0 && (
              <div className="flex items-center gap-3 border-t border-[var(--border)] pt-3">
                <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Drafts saved</div>
                  <button onClick={() => onNavigate('drafts')}
                    className="text-xs font-bold text-orange-600 mt-0.5 hover:underline">
                    {draftCount} draft{draftCount !== 1 ? 's' : ''} — resume →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-[var(--text)]">My recent jobs</span>
          <button onClick={() => onNavigate('my-jobs')}
            className="text-xs font-bold text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
            View all →
          </button>
        </div>

        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 px-5 py-2.5 border-b border-[var(--border)]
            text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
            <span className="col-span-3">Job</span>
            <span className="col-span-3">Title</span>
            <span className="col-span-2">Type</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-1">Customer</span>
            <span className="col-span-1 text-right">When</span>
          </div>

          {myJobs.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--text-3)]">
              No jobs yet today. Create your first one!
            </div>
          ) : (
            myJobs.map(job => {
              const sc = STATUS_CONFIG[job.status] || { label: job.status, bg: 'bg-zinc-100', text: 'text-zinc-600' }
              return (
                <div key={job.id} className="grid grid-cols-12 px-5 py-3 border-b border-[var(--border)]
                  last:border-0 items-center hover:bg-[var(--bg)] transition-colors">
                  <div className="col-span-3 sm:col-span-3">
                    <span className="font-mono text-xs font-bold text-[var(--text)]">{job.job_number}</span>
                  </div>
                  <div className="col-span-5 sm:col-span-3 min-w-0 px-2 sm:px-0">
                    <div className="text-xs font-semibold text-[var(--text)] truncate">{job.title}</div>
                  </div>
                  <div className="hidden sm:block col-span-2">
                    <span className="text-[10px] font-bold text-[var(--text-3)]">{job.job_type}</span>
                  </div>
                  <div className="hidden sm:block col-span-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                      {sc.label}
                    </span>
                  </div>
                  <div className="hidden sm:block col-span-1 text-xs text-[var(--text-3)] truncate">
                    {toTitleCase(job.customer_name) || 'Walk-in'}
                  </div>
                  <div className="col-span-4 sm:col-span-1 text-right text-[10px] text-[var(--text-3)]">
                    {timeAgo(job.created_at)}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}