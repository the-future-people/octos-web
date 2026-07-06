// src/components/cashier/IntakeHeldModal.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { getIntakeHeldJobs, resolveHandover, disputeHandover } from '../../api/cashier'

function fmt(amount) {
  return `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

export default function IntakeHeldModal({ onAllResolved }) {
  const queryClient = useQueryClient()
  const [confirmingDispute, setConfirmingDispute] = useState(null) // job id pending dispute confirmation
  const [actioningId, setActioningId] = useState(null)

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['intakeHeldJobs'],
    queryFn:  () => getIntakeHeldJobs().then(r => r.data),
    staleTime: 0,
  })

  const invalidateAfterAction = () => {
    queryClient.invalidateQueries({ queryKey: ['intakeHeldJobs'] })
    queryClient.invalidateQueries({ queryKey: ['paymentQueue'] })
    queryClient.invalidateQueries({ queryKey: ['jobStats'] })
    queryClient.invalidateQueries({ queryKey: ['todaySummary'] })
  }

  const { mutate: mutateResolve } = useMutation({
    mutationFn: (jobId) => resolveHandover(jobId),
    onMutate:   (jobId) => setActioningId(jobId),
    onSuccess:  () => { invalidateAfterAction(); setActioningId(null) },
    onError:    () => setActioningId(null),
  })

  const { mutate: mutateDispute } = useMutation({
    mutationFn: (jobId) => disputeHandover(jobId),
    onMutate:   (jobId) => setActioningId(jobId),
    onSuccess:  () => {
      invalidateAfterAction()
      setActioningId(null)
      setConfirmingDispute(null)
    },
    onError: () => { setActioningId(null); setConfirmingDispute(null) },
  })

  // Auto-close once every held job is resolved/disputed
  if (!isLoading && jobs.length === 0) {
    onAllResolved?.()
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-2xl
        max-h-[85vh] flex flex-col overflow-hidden border-2 border-amber-300">

        <div className="px-6 py-4 border-b border-amber-200 bg-amber-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 text-lg">⏰</span>
            <div className="font-bold text-lg text-amber-900">
              Overnight Jobs Awaiting Handover
            </div>
          </div>
          <div className="text-xs text-amber-700 mt-1">
            The Branch Manager recorded {jobs.length} job{jobs.length !== 1 ? 's' : ''} after
            closing last night. Confirm you've received the cash for each, or flag any you haven't.
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="text-center text-sm text-[var(--text-3)] py-8">Loading…</div>
          ) : (
            jobs.map(job => (
              <div key={job.id}
                className="border border-[var(--border)] rounded-xl p-4 bg-[var(--bg)]">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="font-bold text-sm text-[var(--text)]">{job.job_number}</div>
                    <div className="text-xs text-[var(--text-3)] mt-0.5">{job.title}</div>
                    <div className="text-xs text-[var(--text-3)] mt-0.5">
                      {job.customer_name} · Recorded by {job.recorded_by}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-base text-[var(--text)]">
                      {fmt(job.estimated_cost)}
                    </div>
                    {parseFloat(job.cash_tendered) > 0 && (
                      <div className="text-[10px] text-[var(--text-3)]">
                        Cash tendered: {fmt(job.cash_tendered)}
                      </div>
                    )}
                  </div>
                </div>

                {job.post_closing_reason && (
                  <div className="text-xs text-[var(--text-3)] italic mb-3">
                    "{job.post_closing_reason}"
                  </div>
                )}

                {confirmingDispute === job.id ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-xs text-red-700 mb-2 font-medium">
                      This will escalate instantly to the Regional Manager and be recorded
                      on your audit trail. Are you sure the BM did not give you this cash?
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => mutateDispute(job.id)}
                        disabled={actioningId === job.id}
                        className="flex-1 py-2 bg-red-600 text-white text-xs font-bold rounded-lg
                          hover:opacity-90 disabled:opacity-40 transition-opacity">
                        {actioningId === job.id ? 'Submitting…' : 'Yes, Report Missing Handover'}
                      </button>
                      <button
                        onClick={() => setConfirmingDispute(null)}
                        className="px-4 py-2 text-xs font-semibold text-[var(--text-2)]
                          hover:text-[var(--text)] transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => mutateResolve(job.id)}
                      disabled={actioningId === job.id}
                      className="flex-1 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg
                        hover:opacity-90 disabled:opacity-40 transition-opacity">
                      {actioningId === job.id ? 'Confirming…' : 'Confirm Received'}
                    </button>
                    <button
                      onClick={() => setConfirmingDispute(job.id)}
                      disabled={actioningId === job.id}
                      className="flex-1 py-2 bg-white border border-red-300 text-red-700
                        text-xs font-bold rounded-lg hover:bg-red-50 disabled:opacity-40
                        transition-colors">
                      BM Didn't Give Me This
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}