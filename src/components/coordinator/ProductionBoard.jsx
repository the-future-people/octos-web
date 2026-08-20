// src/components/coordinator/ProductionBoard.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getProductionBoard, getVerificationQueue, getSuspendedJobs, getJobDetail,
  moveJobAxis, resumeJob, haltJob, verifyJob, suspendJob,
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

// Mirrors JobVerification.Outcome, minus PASSED — which is a clearance,
// not a reason to hold something.
const SUSPEND_REASONS = [
  { value: 'ARTWORK_PROBLEM', label: 'Artwork not usable'      },
  { value: 'WRONG_FILE',      label: 'Wrong or missing file'   },
  { value: 'SPEC_UNCLEAR',    label: 'Specification unclear'   },
  { value: 'SPEC_IMPOSSIBLE', label: 'Cannot be made as asked' },
  { value: 'OTHER',           label: 'Other'                   },
]

const FINDING_LABEL = Object.fromEntries(
  SUSPEND_REASONS.map(r => [r.value, r.label])
)

export default function ProductionBoard({ openJobId, setOpenJobId }) {
  const queryClient = useQueryClient()
  const [error, setError]     = useState('')
  const [halting, setHalting] = useState(null)
  const [suspending, setSuspending] = useState(false)

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

  const { data: suspended = [] } = useQuery({
    queryKey: ['suspendedJobs'],
    queryFn:  () => getSuspendedJobs().then(r => r.data),
    refetchInterval: 60_000,
    placeholderData: prev => prev,
  })

  // The open job is fetched in full rather than carried over from the
  // rail. The list serializer has no files, and a coordinator cannot
  // inspect what they cannot see — so one request per job taken, instead
  // of file metadata on every row of every poll.
  const { data: openJob, isLoading: loadingJob } = useQuery({
    queryKey: ['job-detail', openJobId],
    queryFn:  () => getJobDetail(openJobId).then(r => r.data),
    enabled:  !!openJobId,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['productionBoard'] })
    queryClient.invalidateQueries({ queryKey: ['verificationQueue'] })
    queryClient.invalidateQueries({ queryKey: ['suspendedJobs'] })
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

  // Clearing and suspending both empty the workspace. Nothing takes its
  // place: the next job is taken deliberately, so a coordinator is never
  // handed work they did not ask for while their hand is still moving.
  const { mutate: clear, isPending: clearing } = useMutation({
    mutationFn: ({ id, note }) => verifyJob(id, { note }),
    onSuccess:  () => { invalidate(); setOpenJobId(null) },
    onError:    (e) => setError(e.response?.data?.detail || 'Could not clear that job.'),
  })

  const { mutate: suspend, isPending: suspendingNow } = useMutation({
    mutationFn: ({ id, outcome, note }) => suspendJob(id, { outcome, note }),
    onSuccess:  () => { invalidate(); setSuspending(false); setOpenJobId(null) },
    onError:    (e) => setError(e.response?.data?.detail || 'Could not suspend that job.'),
  })

  // Bringing a suspended job back is a resume followed by a fresh look —
  // it returns to the workspace unverified, for the same decision as
  // before, not straight to the floor.
  const { mutate: reopen } = useMutation({
    mutationFn: (id) => resumeJob(id),
    onSuccess:  (_r, id) => { invalidate(); setOpenJobId(id) },
    onError:    (e) => setError(e.response?.data?.detail || 'Could not reopen that job.'),
  })

  const rows = [
    ...(board?.columns?.RECEIVED      || []),
    ...(board?.columns?.IN_PRODUCTION || []),
    ...(board?.columns?.FINISHING     || []),
    ...(board?.columns?.QUALITY_CHECK || []),
    ...(board?.halted                 || []),
  ]

  const tip = arrivals[0]

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

        {/* ── Arrivals rail ───────────────────────────────────────
            Only the tip can be taken. The rest are visible so the
            coordinator knows what is behind it, and inert so nobody
            picks the easy job and leaves the oldest waiting. */}
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
                const isTip  = i === 0
                const isOpen = openJobId === job.id
                return (
                  <div key={job.id}>
                    {/* Arrows point up, toward the workspace: the queue
                        feeds it rather than descending away from it. */}
                    {i > 0 && (
                      <div className="text-center text-[10px] text-[var(--text-3)] py-0.5">↑</div>
                    )}
                    <button
                      onClick={() => isTip && !openJobId && setOpenJobId(job.id)}
                      disabled={!isTip || !!openJobId}
                      style={{
                        opacity: isTip ? 1 : Math.max(0.28, 0.6 - (i - 1) * 0.16),
                        filter:  isTip ? 'none' : `blur(${Math.min(1.6, 0.6 + (i - 1) * 0.4)}px)`,
                      }}
                      className={`w-full text-left bg-[var(--panel)] border rounded-xl px-3
                        transition-all duration-500 ease-out
                        ${isOpen ? 'opacity-0 scale-95 pointer-events-none' : ''}
                        ${isTip && !openJobId
                          ? 'border-[var(--border-dark)] hover:border-[var(--text-3)] cursor-pointer'
                          : 'border-[var(--border)] cursor-default'}
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
                      {isTip && (
                        <div className="flex items-center justify-between mt-1.5">
                          {job.payment_state === 'SETTLED' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full
                              bg-emerald-100 text-emerald-700">Paid</span>
                          )}
                          <span className={`text-[10px] ml-auto
                            ${waited(job.created_at).match(/[hd]/)
                              ? 'text-red-600 font-semibold' : 'text-[var(--text-3)]'}`}>
                            {waited(job.created_at)}
                          </span>
                        </div>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Suspended ──────────────────────────────────────── */}
          {suspended.length > 0 && (
            <div className="mt-5">
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                tracking-wider mb-2">
                Suspended · {suspended.length}
              </div>
              <div className="space-y-1">
                {suspended.map(job => (
                  <div key={job.id}
                    className="bg-[var(--panel)] border border-[var(--border)]
                      border-l-[3px] border-l-amber-500 rounded-none px-3 py-2">
                    <div className="font-mono text-[10px] text-[var(--text-3)]">
                      {job.job_number}
                    </div>
                    <div className="text-[11px] font-semibold text-[var(--text)] leading-snug">
                      {services(job)}
                    </div>
                    <div className="text-[10px] text-amber-700 mt-0.5">
                      {FINDING_LABEL[job.finding] || job.finding || 'Held'}
                      {' · '}{waited(job.halt?.halted_at)}
                    </div>
                    <button onClick={() => { setError(''); reopen(job.id) }}
                      disabled={!!openJobId}
                      className="mt-1.5 text-[10px] font-bold text-[var(--text-2)]
                        hover:text-[var(--text)] disabled:opacity-40 transition-colors">
                      Bring back →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Workspace + production rows ─────────────────────── */}
        <div className="flex-1 min-w-0">

          {openJobId ? (
            loadingJob && !openJob ? (
              <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
                h-64 mb-4 animate-pulse" />
            ) : openJob ? (
              <Workspace
                job={openJob}
                onClear={(note) => clear({ id: openJob.id, note })}
                onSuspend={() => setSuspending(true)}
                busy={clearing}
              />
            ) : null
          ) : (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
              px-6 py-12 text-center mb-4">
              <p className="text-sm font-semibold text-[var(--text-2)]">
                {tip ? 'Ready for the next job' : 'Nothing to check'}
              </p>
              <p className="text-xs text-[var(--text-3)] mt-1">
                {tip
                  ? 'Take the job at the top of the queue when you are ready for it'
                  : 'Everything that has arrived has been looked at'}
              </p>
              {tip && (
                <button onClick={() => setOpenJobId(tip.id)}
                  className="mt-4 px-4 py-2 text-xs font-bold bg-[var(--text)] text-white
                    rounded-lg hover:opacity-90 transition-opacity">
                  Take {tip.job_number}
                </button>
              )}
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
                    className={`bg-[var(--panel)] border px-3 py-2.5 flex items-center gap-3
                      ${stuck
                        ? 'border-l-[3px] border-l-red-500 border-[var(--border)] rounded-none'
                        : 'border-[var(--border)] rounded-xl'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[10px] text-[var(--text-3)]">
                        {job.job_number}
                      </div>
                      <div className="text-xs font-semibold text-[var(--text)] leading-snug">
                        {services(job)}
                      </div>
                    </div>

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

      {suspending && openJob && (
        <SuspendDialog
          job={openJob}
          onClose={() => setSuspending(false)}
          onSuspend={(outcome, note) =>
            suspend({ id: openJob.id, outcome, note })}
          busy={suspendingNow}
        />
      )}
    </div>
  )
}

/**
 * Where a job is inspected. Three steps, laid out rather than stepped
 * through: read the file, read what was asked for, decide. A coordinator
 * with a queue judges in seconds, and clicking through stages to reach a
 * decision they have already made is friction they will route around.
 *
 * The file and the specification sit side by side deliberately — the
 * dimensions of one against the dimensions of the other is the check, and
 * it should be visible rather than held in someone's head.
 *
 * There is no close. A job here goes to production or to suspended; the
 * workspace holds it in the meantime, across tab changes and reloads.
 */
function Workspace({ job, onClear, onSuspend, busy }) {
  const [note, setNote] = useState('')
  const ready = clockTime(job.predicted?.ready_at)
  const files = job.files || []

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-5 mb-4
      transition-all duration-500 ease-out">
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
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0
          bg-amber-100 text-amber-700">Being checked</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">

        <div className="bg-[var(--bg)] rounded-xl px-3 py-2.5">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
            tracking-wider mb-2">
            {files.length > 1 ? `Files · ${files.length}` : 'The file'}
          </div>
          {files.length === 0 ? (
            <p className="text-xs text-[var(--text-3)]">
              Nothing attached. The customer sent this without a file.
            </p>
          ) : (
            <div className="space-y-2.5">
              {files.map(f => <FileRow key={f.id} file={f} />)}
            </div>
          )}
        </div>

        <div className="bg-[var(--bg)] rounded-xl px-3 py-2.5">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
            tracking-wider mb-2">What was ordered</div>
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
          <div className="border-t border-[var(--border)] mt-2.5 pt-2">
            <div className="text-xs text-[var(--text)]">
              {job.payment_state === 'SETTLED' ? 'Paid in full'
                : job.payment_state === 'DEPOSIT_PAID' ? 'Deposit paid'
                : 'Unpaid'}
              {' · '}{fmt(job.estimated_cost)}
            </div>
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
      </div>

      <input type="text" value={note} onChange={e => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--border)]
          rounded-lg outline-none mb-2" />

      <div className="flex gap-2 items-center">
        <button onClick={() => onClear(note)} disabled={busy}
          className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white
            rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity">
          {busy ? 'Clearing…' : 'Clear for production'}
        </button>
        <button onClick={onSuspend} disabled={busy}
          className="px-4 py-2 text-xs font-bold border border-[var(--border-dark)]
            rounded-lg text-[var(--text-2)] hover:border-[var(--text-3)]
            disabled:opacity-40 transition-colors">
          Suspend
        </button>
        {job.customer_phone && (
          <a href={`tel:${job.customer_phone}`}
            className="ml-auto px-4 py-2 text-xs font-bold border border-[var(--border)]
              rounded-lg text-[var(--text-2)] hover:border-[var(--border-dark)]
              transition-colors">
            Call customer
          </a>
        )}
      </div>
    </div>
  )
}

/**
 * What the file is, measured on upload. Facts, not verdicts — nothing here
 * says whether it will print well, because the standard to judge it
 * against has not been written yet.
 */
function FileRow({ file }) {
  const dims = file.width_mm && file.height_mm
    ? `${Math.round(file.width_mm)} × ${Math.round(file.height_mm)} mm`
    : file.width_px && file.height_px
      ? `${file.width_px} × ${file.height_px} px`
      : null

  const facts = [
    file.size_kb ? `${(file.size_kb / 1024).toFixed(1)} MB` : null,
    file.dpi ? `${file.dpi} dpi` : null,
    dims,
    file.colour_mode || null,
    file.page_count ? `${file.page_count} ${file.page_count === 1 ? 'page' : 'pages'}` : null,
  ].filter(Boolean)

  return (
    <div>
      <a href={file.url} target="_blank" rel="noreferrer"
        className="text-xs font-semibold text-[var(--text)] hover:underline break-all">
        {file.filename}
      </a>
      {facts.length > 0 && (
        <div className="text-[10px] text-[var(--text-2)] mt-0.5 leading-relaxed">
          {facts.join(' · ')}
        </div>
      )}
      {file.metadata_state === 'UNSUPPORTED' && (
        <div className="text-[10px] text-[var(--text-3)] mt-0.5">
          Open it to check — this format cannot be read here
        </div>
      )}
      {file.metadata_state === 'FAILED' && (
        <div className="text-[10px] text-amber-700 mt-0.5">
          Could not be read. It may be damaged.
        </div>
      )}
    </div>
  )
}

function SuspendDialog({ job, onClose, onSuspend, busy }) {
  const [outcome, setOutcome] = useState('ARTWORK_PROBLEM')
  const [note, setNote]       = useState('')

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-sm
        overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="text-sm font-bold text-[var(--text)]">Hold this job</div>
          <div className="text-[11px] text-[var(--text-3)] mt-0.5">
            It waits until someone answers. {job.job_number}
          </div>
        </div>

        <div className="p-4 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {SUSPEND_REASONS.map(r => (
              <button key={r.value} onClick={() => setOutcome(r.value)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border
                  transition-colors
                  ${outcome === r.value
                    ? 'bg-[var(--text)] text-white border-transparent'
                    : 'border-[var(--border)] text-[var(--text-2)]'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
            placeholder="What needs answering"
            className="w-full px-3 py-2 text-xs bg-[var(--bg)] border
              border-[var(--border)] rounded-lg outline-none resize-none" />
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-2)]">Cancel</button>
          <button onClick={() => onSuspend(outcome, note)}
            disabled={busy || (outcome === 'OTHER' && !note.trim())}
            className="px-4 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg
              disabled:opacity-40 hover:opacity-90 transition-opacity">
            {busy ? 'Holding…' : 'Hold job'}
          </button>
        </div>
      </div>
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