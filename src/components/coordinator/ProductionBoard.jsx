// src/components/coordinator/ProductionBoard.jsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getProductionBoard, getVerificationQueue, moveJobAxis,
  resumeJob, haltJob, verifyJob, rejectVerification,
} from '../../api/coordinator'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function waited(iso) {
  if (!iso) return ''
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (mins < 60)   return `${mins}m`
  if (mins < 1440) return `${Math.floor(mins / 60)}h`
  return `${Math.floor(mins / 1440)}d`
}

function clockTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('en-GH', {
    hour: 'numeric', minute: '2-digit',
  })
}

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

// One button per row. The label is the move that makes sense from where
// the job is, so a coordinator never has to work out what comes next.
const NEXT = {
  RECEIVED:      { to: 'IN_PRODUCTION', label: 'Start',  tone: 'bg-zinc-100 text-zinc-600'      },
  IN_PRODUCTION: { to: 'FINISHING',     label: 'Finish', tone: 'bg-violet-100 text-violet-700'  },
  FINISHING:     { to: 'QUALITY_CHECK', label: 'Check',  tone: 'bg-blue-100 text-blue-700'      },
  QUALITY_CHECK: { to: 'DONE',          label: 'Done',   tone: 'bg-amber-100 text-amber-700'    },
}

const STATE_LABEL = {
  RECEIVED: 'Waiting', IN_PRODUCTION: 'Printing',
  FINISHING: 'Finishing', QUALITY_CHECK: 'Quality check',
}

const HALT_REASONS = [
  { value: 'MACHINE_BREAKDOWN', label: 'Machine down'        },
  { value: 'MATERIALS_OUT',     label: 'Materials out'       },
  { value: 'AWAITING_CUSTOMER', label: 'Waiting on customer' },
  { value: 'QUALITY_FAILURE',   label: 'Quality problem'     },
  { value: 'OTHER',             label: 'Other'               },
]

export default function ProductionBoard() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [error, setError]       = useState('')
  const [halting, setHalting]   = useState(null)

    // placeholderData keeps the previous result on screen while the next is
  // in flight. Without it every state change blanks the board to skeletons
  // and back, which reads as the page flickering under your hands.
  const { data: board, isLoading } = useQuery({
    queryKey: ['productionBoard'],
    queryFn:  () => getProductionBoard().then(r => r.data),
    refetchInterval: 30_000,
    placeholderData: prev => prev,
  })

  const { data: arrivals = [] } = useQuery({
    queryKey: ['verificationQueue'],
    queryFn:  () => getVerificationQueue().then(r => r.data),
    refetchInterval: 30_000,
    placeholderData: prev => prev,
  })

    // The tip of the stack is what to deal with next, so it opens itself
  // rather than waiting to be clicked. Re-reads the selected job from the
  // fresh data each time: holding the object from when it was clicked
  // means acting on a job the server has since moved on.
  useEffect(() => {
    if (!arrivals.length) {
      if (selected && !selected._fromFloor) setSelected(null)
      return
    }
    if (!selected) { setSelected(arrivals[0]); return }
    const fresh = arrivals.find(j => j.id === selected.id)
    if (fresh) setSelected(fresh)
    else if (!selected._fromFloor) setSelected(arrivals[0])
  }, [arrivals])

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

  const { mutate: halt, isPending: haltingNow } = useMutation({
    mutationFn: ({ id, reason, note }) => haltJob(id, { reason, note }),
    onSuccess:  () => { invalidate(); setHalting(null) },
    onError:    (e) => setError(e.response?.data?.detail || 'Could not halt that job.'),
  })

  const { mutate: clear, isPending: clearing } = useMutation({
    mutationFn: ({ id, note }) => verifyJob(id, { note }),
    onSuccess:  () => { invalidate(); setSelected(null) },
    onError:    (e) => setError(e.response?.data?.detail || 'Could not clear that job.'),
  })

  // Everything on the floor as one list. A halted job stays where it is
  // rather than moving to a separate section: it is still on the floor,
  // and hiding it away is how it gets forgotten.
  const rows = [
    ...(board?.columns?.RECEIVED      || []),
    ...(board?.columns?.IN_PRODUCTION || []),
    ...(board?.columns?.FINISHING     || []),
    ...(board?.columns?.QUALITY_CHECK || []),
    ...(board?.halted                 || []),
  ]

  return (
    <div className="p-5 sm:p-6">
      {error && (
        <div className="mb-3 px-3 py-2 bg-[var(--red-bg)] border border-[var(--red-border)]
          rounded-lg text-xs text-[var(--red-text)] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold ml-3">✕</button>
        </div>
      )}

      <div className="flex gap-4 items-start">

        {/* ── Arrivals rail ───────────────────────────────────── */}
        <div className="w-52 shrink-0">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
            tracking-wider mb-2">
            Arrived · {arrivals.length}
          </div>

          {arrivals.length === 0 ? (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl
              px-3 py-8 text-center">
              <p className="text-[11px] text-[var(--text-3)]">Nothing waiting</p>
            </div>
          ) : (
            <div className="space-y-1">
              {arrivals.map((job, i) => {
                const isTip = i === 0
                const isOpen = selected?.id === job.id
                return (
                  <div key={job.id}>
                    <button onClick={() => setSelected(job)}
                      style={{ opacity: isTip ? 1 : Math.max(0.5, 1 - i * 0.15) }}
                      className={`w-full text-left bg-[var(--panel)] border rounded-xl
                        px-3 transition-all duration-300 ease-out
                        ${isOpen
                          ? 'border-l-[3px] border-l-[var(--text)] border-[var(--border)]'
                          : 'border-[var(--border)] hover:border-[var(--border-dark)]'}
                        ${isTip ? 'py-3' : 'py-2'}`}>
                      <div className="font-mono text-[10px] text-[var(--text-3)]">
                        {job.job_number}
                      </div>
                      <div className={`font-semibold text-[var(--text)] leading-snug mt-0.5
                        ${isTip ? 'text-xs' : 'text-[11px]'}`}>
                        {services(job)}
                      </div>
                      {isTip && (
                        <div className="text-[10px] text-[var(--text-3)] mt-1">
                          {job.customer_name || 'Walk-in'}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1.5">
                        {isTip && job.payment_state === 'SETTLED' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full
                            bg-emerald-100 text-emerald-700">Paid</span>
                        )}
                        <span className={`text-[10px] ml-auto
                          ${waited(job.created_at).includes('h') || waited(job.created_at).includes('d')
                            ? 'text-red-600 font-semibold' : 'text-[var(--text-3)]'}`}>
                          {waited(job.created_at)}
                        </span>
                      </div>
                    </button>
                    {i < arrivals.length - 1 && (
                      <div className="text-center text-[10px] text-[var(--text-3)] py-0.5">↓</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Workspace + production rows ─────────────────────── */}
        <div className="flex-1 min-w-0">

          {selected ? (
            <Workspace
              job={selected}
              onClear={(note) => clear({ id: selected.id, note })}
              onSendBack={() => setSelected(null)}
              busy={clearing}
              onClose={() => setSelected(null)}
              setError={setError}
              invalidate={invalidate}
            />
          ) : (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
              px-6 py-10 text-center mb-4">
              <p className="text-sm font-semibold text-[var(--text-2)]">Nothing open</p>
              <p className="text-xs text-[var(--text-3)] mt-1">
                Pick an arrival from the left, or a job from the floor below
              </p>
            </div>
          )}

          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
            tracking-wider mb-2">
            In production · {rows.length}
          </div>

          {isLoading && !board ? (
            <div className="space-y-1.5">
              {[1,2,3].map(i => (
                <div key={i} className="h-14 bg-[var(--panel)] border border-[var(--border)]
                  rounded-xl animate-pulse" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl
              px-4 py-8 text-center">
              <p className="text-xs text-[var(--text-3)]">The floor is clear</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {rows.map(job => {
                const next  = NEXT[job.work_state]
                const stuck = job.is_halted
                const ready = clockTime(job.predicted?.ready_at)
                return (
                  <div key={job.id}
                    className={`bg-[var(--panel)] border rounded-xl px-3 py-2.5
                      flex items-center gap-3
                      ${stuck ? 'border-l-[3px] border-l-red-500 border-[var(--border)]'
                              : 'border-[var(--border)]'}`}>
                                        <button onClick={() => setSelected({ ...job, _fromFloor: true })}
                      className="flex-1 min-w-0 text-left">
                      <div className="font-mono text-[10px] text-[var(--text-3)]">
                        {job.job_number}
                      </div>
                      <div className="text-xs font-semibold text-[var(--text)] leading-snug">
                        {services(job)}
                      </div>
                      {stuck && (
                        <div className="text-[10px] text-red-600 mt-0.5">
                          Halted
                        </div>
                      )}
                    </button>

                    {ready && !stuck && (
                      <span className="text-[10px] text-[var(--text-3)] shrink-0 hidden sm:block">
                        {job.predicted.is_next_day ? 'tomorrow ' : ''}{ready}
                      </span>
                    )}

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0
                      ${stuck ? 'bg-red-100 text-red-700' : next?.tone || 'bg-zinc-100 text-zinc-600'}`}>
                      {stuck ? 'Halted' : STATE_LABEL[job.work_state] || job.work_state}
                    </span>

                    {stuck ? (
                      <button onClick={() => { setError(''); resume(job.id) }}
                        className="px-3 py-1 text-[10px] font-bold border border-red-300
                          text-red-700 rounded-lg hover:bg-red-50 transition-colors shrink-0">
                        Resume
                      </button>
                    ) : (
                      <>
                        <button onClick={() => { setError(''); advance({ id: job.id, to: next.to }) }}
                          disabled={advancing}
                          className="px-3 py-1 text-[10px] font-bold bg-[var(--text)]
                            text-white rounded-lg hover:opacity-90 disabled:opacity-40
                            transition-opacity shrink-0">
                          {next.label}
                        </button>
                        <button onClick={() => setHalting(job)}
                          className="px-2 py-1 text-[10px] font-bold text-[var(--text-3)]
                            hover:text-red-600 transition-colors shrink-0">
                          Halt
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {halting && (
        <HaltDialog
          job={halting}
          onClose={() => setHalting(null)}
          onHalt={(reason, note) => halt({ id: halting.id, reason, note })}
          busy={haltingNow}
        />
      )}
    </div>
  )
}

/**
 * The panel a coordinator works in. Shows everything needed to decide,
 * so they are not opening a second screen to read line items.
 */
function Workspace({ job, onClear, onClose, busy, setError, invalidate }) {
  const [note, setNote] = useState('')
  const needsCheck = job.verification?.required && !job.verification?.passed
  const ready      = clockTime(job.predicted?.ready_at)

  return (
        <div className="rounded-2xl p-5 mb-4 border-2 border-dashed border-[var(--border-dark)]"
      style={{
        backgroundImage: 'radial-gradient(circle, var(--border-dark) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
      }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="font-mono text-sm font-bold text-[var(--text)]">
            {job.job_number}
          </div>
          <div className="text-xs text-[var(--text-3)] mt-0.5">
            {job.customer_name || 'Walk-in'}
            {job.customer_phone ? ` · ${job.customer_phone}` : ''}
            {job.intake_channel ? ` · ${job.intake_channel.replace('_', ' ').toLowerCase()}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {needsCheck && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full
              bg-amber-100 text-amber-700">Needs checking</span>
          )}
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full
              hover:bg-[var(--bg)] text-[var(--text-3)] text-sm">✕</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-3 py-2.5">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
            tracking-wider mb-1.5">What was ordered</div>
          <div className="space-y-1">
            {(job.line_items || []).map(li => (
              <div key={li.id} className="text-xs text-[var(--text)]">
                {li.label || li.service_name}
                <span className="text-[var(--text-3)]">
                  {' · '}{li.quantity} × {li.pages}pp{li.is_color ? ' · colour' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--bg)] rounded-xl px-3 py-2.5">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
            tracking-wider mb-1.5">Payment &amp; collection</div>
          <div className="text-xs text-[var(--text)]">
            {job.payment_state === 'SETTLED' ? 'Paid in full'
              : job.payment_state === 'DEPOSIT_PAID' ? 'Deposit paid'
              : 'Unpaid'}
            {' · '}{fmt(job.estimated_cost)}
          </div>
          {/* Promised time goes here once a job carries one. Until then the
              prediction stands alone; when both exist and disagree, that
              gap is the thing worth seeing. */}
          {ready && (
            <div className="text-xs text-[var(--text-2)] mt-1">
              Ready {job.predicted.is_next_day ? 'tomorrow ' : ''}{ready}
              {job.predicted.confidence === 'estimated' && (
                <span className="text-[10px] text-[var(--text-3)]"> · estimated</span>
              )}
            </div>
          )}
        </div>
      </div>

      {needsCheck && (
        <>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)]
              rounded-lg outline-none mb-2" />
          <div className="flex gap-2">
            <button onClick={() => onClear(note)} disabled={busy}
              className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white
                rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity">
              {busy ? 'Clearing…' : 'Clear for production'}
            </button>
            <button
              className="px-4 py-2 text-xs font-bold border border-[var(--border)]
                rounded-lg text-[var(--text-2)] hover:border-[var(--border-dark)]
                transition-colors">
              Send back
            </button>
            {job.customer_phone && (
              <a href={`tel:${job.customer_phone}`}
                className="px-4 py-2 text-xs font-bold border border-[var(--border)]
                  rounded-lg text-[var(--text-2)] hover:border-[var(--border-dark)]
                  transition-colors">
                Call customer
              </a>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function HaltDialog({ job, onClose, onHalt, busy }) {
  const [reason, setReason] = useState('MACHINE_BREAKDOWN')
  const [note, setNote]     = useState('')

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-sm
        overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="text-sm font-bold text-[var(--text)]">Stop this job</div>
          <div className="font-mono text-[11px] text-[var(--text-3)] mt-0.5">
            {job.job_number}
          </div>
        </div>

        <div className="p-4 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {HALT_REASONS.map(r => (
              <button key={r.value} onClick={() => setReason(r.value)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border
                  transition-colors
                  ${reason === r.value
                    ? 'bg-[var(--text)] text-white border-transparent'
                    : 'border-[var(--border)] text-[var(--text-2)]'}`}>
                {r.label}
              </button>
            ))}
          </div>
          {/* Free text only where the chips do not fit. What gets typed here
              is what the chip list should learn from. */}
          {reason === 'OTHER' && (
            <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
              placeholder="What happened"
              className="w-full px-3 py-2 text-xs bg-[var(--bg)] border
                border-[var(--border)] rounded-lg outline-none resize-none" />
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-2)]">Cancel</button>
          <button onClick={() => onHalt(reason, note)}
            disabled={busy || (reason === 'OTHER' && !note.trim())}
            className="px-4 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg
              disabled:opacity-40 hover:opacity-90 transition-opacity">
            {busy ? 'Stopping…' : 'Stop job'}
          </button>
        </div>
      </div>
    </div>
  )
}