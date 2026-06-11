// src/components/bm/Overview.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getJobStats, getTodaySummary, getLockStatus, getWorkload } from '../../api/bm'
import NewJobModal from './NewJobModal'
import LateJobModal from './LateJobModal'

function fmt(amount) {
  return `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function fmtMins(mins) {
  if (mins == null) return null
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, textColor, sub }) {
  return (
    <div className={`bg-[var(--panel)] border border-[var(--border)] border-t-4
      ${color} rounded-xl p-4`}>
      <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className={`font-mono font-black text-2xl ${textColor}`}>
        {value ?? '—'}
      </div>
      {sub && (
        <div className="text-[10px] text-[var(--text-3)] mt-1">{sub}</div>
      )}
    </div>
  )
}

// ── Workload Tile ─────────────────────────────────────────────────────────────
function WorkloadTile({ icon, label, count, color, urgency, sub, onClick }) {
  const base = 'bg-[var(--panel)] border rounded-xl p-4 flex items-start gap-3 transition-colors'
  const borderColor = urgency === 'high'
    ? 'border-red-200 hover:border-red-300'
    : urgency === 'medium'
    ? 'border-amber-200 hover:border-amber-300'
    : 'border-[var(--border)] hover:border-[var(--border-dark)]'

  return (
    <button onClick={onClick} className={`${base} ${borderColor} w-full text-left`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
          {label}
        </div>
        <div className={`font-mono font-black text-xl mt-0.5 ${
          urgency === 'high' ? 'text-red-600' :
          urgency === 'medium' ? 'text-amber-600' :
          'text-[var(--text)]'
        }`}>
          {count ?? '—'}
        </div>
        {sub && (
          <div className={`text-[10px] mt-0.5 ${
            urgency === 'high' ? 'text-red-500' :
            urgency === 'medium' ? 'text-amber-600' :
            'text-[var(--text-3)]'
          }`}>{sub}</div>
        )}
      </div>
    </button>
  )
}

export default function Overview({ onNavigate }) {
  const [showNewJob,  setShowNewJob]  = useState(false)
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

  const { data: lockData } = useQuery({
    queryKey: ['lockStatus'],
    queryFn:  () => getLockStatus().then(r => r.data),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const { data: workload, isLoading: workloadLoading } = useQuery({
    queryKey: ['workload'],
    queryFn:  () => getWorkload().then(r => r.data),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const canCreateJobs    = lockData?.can_create_jobs ?? true
  const cashierSignedOff = lockData?.cashier_signed_off ?? false
  const sheetOpen        = summaryData?.meta?.status === 'OPEN'
  const isPostClose      = !canCreateJobs && sheetOpen

  const stats   = statsData || {}
  const revenue = summaryData?.revenue || {}

  // Workload urgency helpers
  const pendingUrgency = (workload?.oldest_pending_mins ?? 0) > 30 ? 'high'
    : (workload?.oldest_pending_mins ?? 0) > 10 ? 'medium' : 'low'
  const overdueUrgency = (workload?.overdue ?? 0) > 0 ? 'high' : 'low'
  const pickupUrgency  = (workload?.ready_for_pickup ?? 0) > 0 ? 'medium' : 'low'

  return (
    <div className="p-5 sm:p-6 space-y-6">

      {/* ── Hero Buttons ── */}
      <div className="grid grid-cols-2 gap-3">
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
            Instant · Production · Design
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
            Route to another branch
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" className="shrink-0">
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" className="shrink-0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Post-closing Hold
            <span className="text-orange-600 text-xs font-normal ml-auto hidden sm:block">
              Cashier signed off · job held until morning handover
            </span>
          </button>
        )}
      </div>

      {/* ── Today's Pulse ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-black text-[var(--text-3)] uppercase tracking-widest">
            Today's Pulse
          </span>
          <div className="flex-1 h-px bg-[var(--border)]" />
          {summaryData?.meta?.sheet_number && (
            <span className="text-[10px] font-mono text-[var(--text-3)]">
              {summaryData.meta.sheet_number}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Jobs"
            value={stats.total}
            color="border-t-blue-500"
            textColor="text-blue-600"
          />
          <StatCard
            label="Complete"
            value={stats.complete}
            color="border-t-emerald-500"
            textColor="text-emerald-600"
          />
          <StatCard
            label="In Progress"
            value={stats.in_progress}
            color="border-t-amber-400"
            textColor="text-amber-600"
          />
          <StatCard
            label="Revenue"
            value={revenue.total_collected != null
              ? `GHS ${parseFloat(revenue.total_collected).toLocaleString('en-GH', { minimumFractionDigits: 0 })}`
              : '—'}
            color="border-t-violet-500"
            textColor="text-violet-600"
            sub={revenue.total_cash != null ? `Cash ${fmt(revenue.total_cash)}` : null}
          />
        </div>
      </div>

      {/* ── Active Workload ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-black text-[var(--text-3)] uppercase tracking-widest">
            Active Workload
          </span>
          <div className="flex-1 h-px bg-[var(--border)]" />
          <button
            onClick={() => onNavigate('jobs')}
            className="text-[10px] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
            View all jobs →
          </button>
        </div>

        {workloadLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-24 bg-[var(--panel)] border border-[var(--border)]
                rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <WorkloadTile
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" className={
                    pendingUrgency === 'high' ? 'text-red-600' :
                    pendingUrgency === 'medium' ? 'text-amber-600' : 'text-blue-600'
                  }>
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              }
              label="Pending Payment"
              count={workload?.pending_payment ?? '—'}
              color={
                pendingUrgency === 'high' ? 'bg-red-50' :
                pendingUrgency === 'medium' ? 'bg-amber-50' : 'bg-blue-50'
              }
              urgency={pendingUrgency}
              sub={workload?.oldest_pending_mins != null
                ? `Oldest: ${fmtMins(workload.oldest_pending_mins)}`
                : null}
              onClick={() => onNavigate('jobs')}
            />
            <WorkloadTile
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" className="text-blue-600">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                  <polyline points="17 6 23 6 23 12"/>
                </svg>
              }
              label="In Production"
              count={workload?.in_production ?? '—'}
              color="bg-blue-50"
              urgency="low"
              sub="Confirmed + In Progress"
              onClick={() => onNavigate('jobs')}
            />
            <WorkloadTile
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" className={
                    pickupUrgency === 'medium' ? 'text-amber-600' : 'text-emerald-600'
                  }>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              }
              label="Ready for Pickup"
              count={workload?.ready_for_pickup ?? '—'}
              color={pickupUrgency === 'medium' ? 'bg-amber-50' : 'bg-emerald-50'}
              urgency={pickupUrgency}
              sub="Awaiting collection"
              onClick={() => onNavigate('jobs')}
            />
            <WorkloadTile
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" className="text-violet-600">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              }
              label="Awaiting Feedback"
              count={workload?.awaiting_feedback ?? '—'}
              color="bg-violet-50"
              urgency="low"
              sub="Sample sent · Revision"
              onClick={() => onNavigate('jobs')}
            />
            <WorkloadTile
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" className={
                    overdueUrgency === 'high' ? 'text-red-600' : 'text-zinc-400'
                  }>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              }
              label="Overdue"
              count={workload?.overdue ?? '—'}
              color={overdueUrgency === 'high' ? 'bg-red-50' : 'bg-zinc-50'}
              urgency={overdueUrgency}
              sub="Past deadline"
              onClick={() => onNavigate('jobs')}
            />
          </div>
        )}
      </div>

      {/* ── Sheet Summary Footer ── */}
      {summaryData?.meta && (
        <div className="flex items-center justify-between px-4 py-3
          bg-[var(--panel)] border border-[var(--border)] rounded-xl">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              summaryData.meta.status === 'OPEN' ? 'bg-emerald-500' : 'bg-zinc-400'
            }`} />
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--text-3)]">Day Sheet</span>
              <span className="font-mono font-bold text-[var(--text-2)]">
                {summaryData.meta.sheet_number || '—'}
              </span>
              <span className="w-px h-3 bg-[var(--border)]" />
              <span className={`font-bold uppercase text-[10px] tracking-wider ${
                summaryData.meta.status === 'OPEN'
                  ? 'text-emerald-600'
                  : 'text-[var(--text-3)]'
              }`}>
                {summaryData.meta.status}
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigate('daysheet')}
            className="text-xs font-bold text-[var(--text-3)] hover:text-[var(--text)]
              transition-colors flex items-center gap-1.5">
            View Day Sheet
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── Payment Queue Alert ── */}
      {(workload?.pending_payment ?? 0) > 0 && (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                pendingUrgency === 'high' ? 'bg-red-500' : 'bg-amber-400'
              }`} />
              <span className="text-sm font-bold text-[var(--text)]">
                {workload.pending_payment} job{workload.pending_payment !== 1 ? 's' : ''} waiting for payment
              </span>
              {workload.oldest_pending_mins != null && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  pendingUrgency === 'high'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  Oldest: {fmtMins(workload.oldest_pending_mins)}
                </span>
              )}
            </div>
            <button
              onClick={() => onNavigate('jobs')}
              className="text-xs font-bold text-[var(--text-2)] hover:text-[var(--text)]
                transition-colors flex items-center gap-1">
              Go to Jobs →
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
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