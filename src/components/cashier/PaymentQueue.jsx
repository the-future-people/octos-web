// src/components/cashier/PaymentQueue.jsx
// Lists jobs waiting for payment. Polls every 15s.

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getPaymentQueue } from '../../api/cashier'
import PaymentModal from './PaymentModal'

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

export default function PaymentQueue() {
  const [activeJob, setActiveJob] = useState(null)
  const { data, isLoading } = useQuery({
    queryKey: ['paymentQueue'],
    queryFn: () => getPaymentQueue().then(r => r.data),
    refetchInterval: 15_000,
  })

  const jobs = Array.isArray(data) ? data : (data?.results || [])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-[var(--border)] rounded w-2/3 mb-2" />
            <div className="h-3 bg-[var(--border)] rounded w-1/3" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Payment Queue</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            Jobs waiting for payment confirmation — oldest first
          </p>
        </div>
        <div className="px-3 py-1 bg-[var(--panel)] border border-[var(--border)]
          rounded-full text-sm font-semibold text-[var(--text-2)] whitespace-nowrap shrink-0">
          {jobs.length} pending
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--bg)] flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-[var(--text-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--text-2)]">Queue is clear</p>
          <p className="text-xs text-[var(--text-3)] mt-1">No jobs waiting for payment right now</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job, idx) => (
            <div
              key={job.id}
              className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4"
            >
              {/* Top row — position + job info */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[var(--bg)] border border-[var(--border)]
                  flex items-center justify-center text-xs font-bold text-[var(--text-3)] shrink-0 mt-0.5">
                  {String(idx + 1).padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text)] break-words leading-snug">
                    {job.services_summary || job.job_number}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-[var(--text-3)] font-mono whitespace-nowrap">
                      {job.job_number}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5
                      rounded bg-[var(--blue-bg)] text-[var(--blue-text)] border border-[var(--blue-border)]
                      whitespace-nowrap">
                      {job.job_type}
                    </span>
                    <span className="text-xs text-[var(--text-3)] whitespace-nowrap">
                      by {job.attendant_name || '—'}
                    </span>
                    <span className="text-xs text-[var(--text-3)] whitespace-nowrap">
                      {timeAgo(job.created_at)}
                    </span>
                  </div>
                  {job.customer_name && (
                    <div className="text-xs font-medium text-[var(--text-2)] mt-1">
                      {job.customer_name}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom row — amount + button */}
              <div className="flex items-center justify-between mt-3 pt-3
                border-t border-[var(--border)]">
                <div>
                  <div className="font-mono font-black text-lg text-[var(--text)]">
                    {fmt(job.estimated_cost)}
                  </div>
                  {!job.customer_name && (
                    <div className="text-[10px] text-[var(--text-3)]">Walk-in</div>
                  )}
                </div>
                <button
                  className="px-5 py-2.5 bg-[var(--text)] text-white text-sm font-bold
                    rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap"
                  onClick={() => setActiveJob(job)}
                >
                  Collect Payment
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    {activeJob && (
        <PaymentModal
          job={activeJob}
          onClose={() => setActiveJob(null)}
        />
      )}
    </div>
  )
}