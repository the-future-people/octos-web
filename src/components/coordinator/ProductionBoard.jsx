// src/components/coordinator/ProductionBoard.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getProductionBoard, getVerificationQueue, moveJobAxis, resumeJob,
} from '../../api/coordinator'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function waitingFor(iso) {
  if (!iso) return ''
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (mins < 60)   return `${mins}m`
  if (mins < 1440) return `${Math.floor(mins / 60)}h`
  return `${Math.floor(mins / 1440)}d`
}

// The ladder, in order. Each column knows what comes next, so the button
// on a card is always the one move that makes sense from where it is.
const COLUMNS = [
  { state: 'RECEIVED',      label: 'Waiting',       next: 'IN_PRODUCTION', action: 'Start'   },
  { state: 'IN_PRODUCTION', label: 'Printing',      next: 'FINISHING',     action: 'Finish'  },
  { state: 'FINISHING',     label: 'Finishing',     next: 'QUALITY_CHECK', action: 'Check'   },
  { state: 'QUALITY_CHECK', label: 'Quality check', next: 'DONE',          action: 'Done'    },
]

function services(job) {
  const items = job.line_items || []
  if (!items.length) return job.title || '—'
  const counts = new Map()
  for (const it of items) {
    const name = it.service_name || it.label || 'Service'
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
    .join(', ')
}

export default function ProductionBoard({ onOpenVerification }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['productionBoard'],
    queryFn:  () => getProductionBoard().then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const { data: queue = [] } = useQuery({
    queryKey: ['verificationQueue'],
    queryFn:  () => getVerificationQueue().then(r => r.data),
    refetchInterval: 30_000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['productionBoard'] })
    queryClient.invalidateQueries({ queryKey: ['verificationQueue'] })
  }

  const { mutate: advance, isPending: advancing } = useMutation({
    mutationFn: ({ id, to }) => moveJobAxis(id, { axis: 'WORK', to_state: to }),
    onSuccess:  invalidate,
    onError:    (e) => setError(e.response?.data?.detail || 'Could not move that job.'),
  })

  const { mutate: resume } = useMutation({
    mutationFn: (id) => resumeJob(id),
    onSuccess:  invalidate,
    onError:    (e) => setError(e.response?.data?.detail || 'Could not resume that job.'),
  })

  const columns = data?.columns || {}
  const halted  = data?.halted  || []

  const Card = ({ job, column }) => (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl
      px-3 py-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-bold text-[var(--text-3)]">
            {job.job_number}
          </div>
          <div className="text-xs font-semibold text-[var(--text)] leading-snug mt-0.5">
            {services(job)}
          </div>
        </div>
        <span className="text-[10px] text-[var(--text-3)] shrink-0">
          {waitingFor(job.created_at)}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-3)] truncate">
          {job.customer_name || 'Walk-in'}
        </span>
        <span className="font-mono text-[10px] text-[var(--text-2)]">
          {fmt(job.estimated_cost)}
        </span>
      </div>

      {column?.next && (
        <button onClick={() => { setError(''); advance({ id: job.id, to: column.next }) }}
          disabled={advancing}
          className="w-full py-1.5 text-[10px] font-bold bg-[var(--text)] text-white
            rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity">
          {column.action}
        </button>
      )}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Production</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            Everything on the floor right now
          </p>
        </div>

        {/* Work waiting to be checked blocks everything behind it, so the
            count sits where it cannot be missed rather than in a tab. */}
        <button onClick={onOpenVerification}
          className={`px-4 py-2.5 rounded-xl border text-left transition-colors
            ${queue.length > 0
              ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
              : 'bg-[var(--panel)] border-[var(--border)]'}`}>
          <div className={`text-[10px] font-bold uppercase tracking-wider
            ${queue.length > 0 ? 'text-amber-700' : 'text-[var(--text-3)]'}`}>
            To verify
          </div>
          <div className={`font-mono font-black text-xl
            ${queue.length > 0 ? 'text-amber-700' : 'text-[var(--text-3)]'}`}>
            {queue.length}
          </div>
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 bg-[var(--red-bg)] border border-[var(--red-border)]
          rounded-lg text-xs text-[var(--red-text)] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold ml-3">✕</button>
        </div>
      )}

      {isLoading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-64 bg-[var(--panel)] border border-[var(--border)]
              rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {COLUMNS.map(col => {
            const jobs = columns[col.state] || []
            return (
              <div key={col.state}
                className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-[var(--text-3)]
                    uppercase tracking-wider">{col.label}</span>
                  <span className="font-mono text-xs font-bold text-[var(--text-2)]">
                    {jobs.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {jobs.length === 0 ? (
                    <div className="text-[10px] text-[var(--text-3)] text-center py-6">
                      Nothing here
                    </div>
                  ) : jobs.map(job => (
                    <Card key={job.id} job={job} column={col} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {halted.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">
              Stopped
            </span>
            <span className="font-mono text-xs font-bold text-red-700">
              {halted.length}
            </span>
          </div>
          {/* Shown apart rather than in their columns: a halted job is not
              being worked on, and leaving it in place makes a column look
              busier than the floor actually is. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {halted.map(job => (
              <div key={job.id}
                className="bg-[var(--panel)] border border-red-200 rounded-xl
                  px-3 py-2.5 space-y-2">
                <div className="font-mono text-[10px] font-bold text-[var(--text-3)]">
                  {job.job_number}
                </div>
                <div className="text-xs font-semibold text-[var(--text)] leading-snug">
                  {services(job)}
                </div>
                <button onClick={() => { setError(''); resume(job.id) }}
                  className="w-full py-1.5 text-[10px] font-bold border border-red-300
                    text-red-700 rounded-lg hover:bg-red-100 transition-colors">
                  Resume
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}