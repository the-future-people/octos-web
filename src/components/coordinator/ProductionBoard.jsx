// src/components/coordinator/ProductionBoard.jsx
//
// The coordinator's production board. One stage at a time, chosen from the
// flow across the top; the arrivals queue is strict; inspection and the
// quality check happen in modals over the board.
//
// Every write to the server happens here, so the pieces only show things
// and report taps. When a write lands, the lists are refreshed from the
// server rather than patched by hand: the server decides what is next,
// what is late and where a job now is.

import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  claimJob, getJobDetail, getProductionBoard, getSuspendedJobs,
  getVerificationQueue, haltJob, moveJobAxis, releaseJob, resumeJob,
  suspendJob, verifyJob,
} from '../../api/coordinator'
import ArrivalQueue from './ArrivalQueue'
import InspectionModal from './InspectionModal'
import ReadyModal from './ReadyModal'
import StageFlow from './StageFlow'
import StageList from './StageList'
import {
  HaltDialog, TONE_TEXT, channelLabel, dueLine, services,
} from './shared'

// How long a cleared job takes to slide out before the queue refreshes
// and the rest glide up. Matches the transition in ArrivalQueue.
const SLIDE_MS = 450

function laneTone(rows) {
  if (rows.some(r => r.late)) return 'late'
  if (rows.some(r => r.at_risk)) return 'risk'
  return null
}

function detail(e, fallback) {
  return e?.response?.data?.detail || fallback
}

/**
 * Counter production jobs at RECEIVED. The customer was standing there,
 * so there is nothing to inspect; they wait only to be started.
 */
function FromTheCounter({ jobs, onStart, busyId }) {
  if (!jobs.length) return null
  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="text-xs font-semibold text-[var(--text-3)] mb-2 px-1">
        From the counter · ready to start
      </div>
      <div className="space-y-2">
        {jobs.map(job => {
          const due = dueLine(job)
          return (
            <div key={job.id}
              className="bg-[var(--panel)] border border-[var(--border)] rounded-xl
                px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[11px] text-[var(--text-3)]">{job.job_number}</div>
                <div className="text-sm font-semibold text-[var(--text)] truncate">{services(job)}</div>
                <div className="text-[11px] text-[var(--text-3)] truncate">
                  {job.customer_name || 'Walk-in'}
                  {job.intake_channel ? ` · ${channelLabel(job.intake_channel)}` : ''}
                </div>
              </div>
              <span className={`text-xs shrink-0 hidden sm:block ${TONE_TEXT[due.tone]}`}>
                {due.text}
              </span>
              <button onClick={() => onStart(job)} disabled={busyId === job.id}
                className="min-h-[44px] px-4 text-sm font-bold bg-[var(--text)] text-white
                  rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0">
                Start
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ProductionBoard({ openJobId, setOpenJobId }) {
  const queryClient = useQueryClient()

  const [stage, setStage]         = useState('arrived')
  const [error, setError]         = useState('')
  const [leavingId, setLeavingId] = useState(null)
  const [busyId, setBusyId]       = useState(null)
  const [halting, setHalting]     = useState(null)
  const [readyRow, setReadyRow]   = useState(null)

  // ── Reads ──────────────────────────────────────────────────────

  const { data: queue = [] } = useQuery({
    queryKey: ['verificationQueue'],
    queryFn:  () => getVerificationQueue().then(r => r.data),
    refetchInterval: 30_000,
    placeholderData: prev => prev,
  })

  const { data: board } = useQuery({
    queryKey: ['productionBoard'],
    queryFn:  () => getProductionBoard().then(r => r.data),
    refetchInterval: 30_000,
    placeholderData: prev => prev,
  })

  const { data: suspended = [] } = useQuery({
    queryKey: ['suspendedJobs'],
    queryFn:  () => getSuspendedJobs().then(r => r.data),
    refetchInterval: 60_000,
    placeholderData: prev => prev,
  })

  const { data: openJob } = useQuery({
    queryKey: ['job-detail', openJobId],
    queryFn:  () => getJobDetail(openJobId, { predict: true }).then(r => r.data),
    enabled:  !!openJobId,
  })

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['productionBoard'] })
    queryClient.invalidateQueries({ queryKey: ['verificationQueue'] })
    queryClient.invalidateQueries({ queryKey: ['suspendedJobs'] })
  }, [queryClient])

  // ── Lanes ──────────────────────────────────────────────────────

  const columns = board?.columns || {}
  const halted  = board?.halted || []
  const haltedIn = (...states) => halted.filter(j => states.includes(j.work_state))

  const counter   = columns.RECEIVED || []
  const press     = [...(columns.IN_PRODUCTION || []), ...haltedIn('IN_PRODUCTION')]
  const finishing = [
    ...(columns.FINISHING || []), ...(columns.QUALITY_CHECK || []),
    ...haltedIn('FINISHING', 'QUALITY_CHECK'),
  ]
  const ready = columns.READY || []

  const stages = [
    { id: 'arrived',   label: 'Arrived',   count: queue.length + counter.length,
      tone: laneTone([...queue, ...counter]) },
    { id: 'press',     label: 'In press',  count: press.length,     tone: laneTone(press) },
    { id: 'finishing', label: 'Finishing', count: finishing.length, tone: laneTone(finishing) },
    { id: 'ready',     label: 'Ready',     count: ready.length,     tone: null },
  ]

  const openRow = queue.find(j => j.id === openJobId)

  // ── Claiming ───────────────────────────────────────────────────

  const close = useCallback(() => {
    if (openJobId) releaseJob(openJobId).catch(() => {})
    setOpenJobId(null)
    refresh()
  }, [openJobId, setOpenJobId, refresh])

  const heartbeat = useCallback((id) => {
    claimJob(id).catch((e) => {
      // The claim lapsed and someone else has it, or it is no longer
      // waiting. Either way this workspace is no longer the coordinator's.
      setError(detail(e, 'This job is no longer yours to inspect.'))
      setOpenJobId(null)
      refresh()
    })
  }, [setOpenJobId, refresh])

  // Coming back to the board with a job still open (from Overview, say):
  // take the claim again straight away rather than waiting two minutes.
  useEffect(() => {
    if (openJobId) heartbeat(openJobId)
    // Only on arrival; the modal keeps it alive after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { mutate: claim, isPending: claimingNow, variables: claimingId } = useMutation({
    mutationFn: (id) => claimJob(id),
    onSuccess:  (_r, id) => { setError(''); setOpenJobId(id); refresh() },
    onError:    (e) => { setError(detail(e, 'Could not open that job.')); refresh() },
  })

  const inspect = (id) => {
    const row = queue.find(j => j.id === id)
    if (row?.inspecting_is_me) {
      setOpenJobId(id)
      heartbeat(id)
      return
    }
    claim(id)
  }

  // ── Inspection outcomes ────────────────────────────────────────

  const { mutate: clear, isPending: clearing } = useMutation({
    mutationFn: ({ id, note }) => verifyJob(id, { note }),
    onSuccess:  (_r, { id }) => {
      setError('')
      setOpenJobId(null)
      // Slide it out toward In press first; then refresh, and the rest
      // of the queue glides up into place.
      setLeavingId(id)
      setTimeout(() => { setLeavingId(null); refresh() }, SLIDE_MS)
    },
    onError: (e) => setError(detail(e, 'Could not clear that job.')),
  })

  const { mutate: suspend, isPending: suspending } = useMutation({
    mutationFn: ({ id, outcome, note }) => suspendJob(id, { outcome, note }),
    onSuccess:  () => { setError(''); setOpenJobId(null); refresh() },
    onError:    (e) => setError(detail(e, 'Could not hold that job.')),
  })

  // ── The floor ──────────────────────────────────────────────────

  const move = async (job, to_state) => {
    setBusyId(job.id)
    try {
      await moveJobAxis(job.id, { axis: 'WORK', to_state })
      setError('')
      refresh()
      return true
    } catch (e) {
      setError(detail(e, 'Could not move that job.'))
      return false
    } finally {
      setBusyId(null)
    }
  }

  // Opening Mark ready is where the quality check starts, so the job
  // moves into it now. A job already being checked just reopens.
  const markReady = async (job) => {
    if (job.work_state === 'FINISHING') {
      const ok = await move(job, 'QUALITY_CHECK')
      if (!ok) return
    }
    setReadyRow(job)
  }

  const { mutate: confirmReady, isPending: confirming } = useMutation({
    mutationFn: (row) => moveJobAxis(row.id, { axis: 'WORK', to_state: 'DONE' }),
    onSuccess:  () => { setError(''); setReadyRow(null); refresh() },
    onError:    (e) => setError(detail(e, 'Could not mark that job ready.')),
  })

  const resume = async (job) => {
    setBusyId(job.id)
    try {
      await resumeJob(job.id)
      setError('')
      refresh()
    } catch (e) {
      setError(detail(e, 'Could not resume that job.'))
    } finally {
      setBusyId(null)
    }
  }

  // A held job goes back into the arrivals queue and takes its place by
  // promise like any other. Opening it directly would let it jump the line.
  const bringBack = async (job) => {
    await resume(job)
    setStage('arrived')
  }

  const { mutate: halt, isPending: haltingNow } = useMutation({
    mutationFn: ({ id, reason, note }) => haltJob(id, { reason, note }),
    onSuccess:  () => { setError(''); setHalting(null); refresh() },
    onError:    (e) => setError(detail(e, 'Could not stop that job.')),
  })

  const on = {
    advance:   move,
    markReady,
    resume,
    halt:      (job) => setHalting(job),
    bringBack,
  }

  // ── Page ───────────────────────────────────────────────────────

  return (
    <div className="p-5 sm:p-6">
      {error && (
        <div role="alert"
          className="mb-4 px-4 py-3 bg-[var(--red-bg)] border border-[var(--red-border)]
            rounded-xl text-sm text-[var(--red-text)] flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss"
            className="w-8 h-8 shrink-0 font-bold">✕</button>
        </div>
      )}

      <StageFlow
        stages={stages}
        held={{ count: suspended.length }}
        current={stage}
        onSelect={setStage}
      />

      {stage === 'arrived' && (
        <>
          <ArrivalQueue
            queue={queue}
            onInspect={inspect}
            claiming={claimingNow ? claimingId : null}
            leavingId={leavingId}
            blocked={!!openJobId}
          />
          <FromTheCounter
            jobs={counter}
            busyId={busyId}
            onStart={(job) => move(job, 'IN_PRODUCTION')}
          />
        </>
      )}

      {stage === 'press' && (
        <StageList stage="press" jobs={press} busyId={busyId} blocked={!!openJobId} on={on} />
      )}
      {stage === 'finishing' && (
        <StageList stage="finishing" jobs={finishing} busyId={busyId} blocked={!!openJobId} on={on} />
      )}
      {stage === 'ready' && (
        <StageList stage="ready" jobs={ready} busyId={busyId} blocked={!!openJobId} on={on} />
      )}
      {stage === 'held' && (
        <StageList stage="held" jobs={suspended} busyId={busyId} blocked={!!openJobId} on={on} />
      )}

      {openJobId && (
        <InspectionModal
          job={openJob}
          row={openRow}
          onHeartbeat={heartbeat}
          onClose={close}
          onClear={(note) => clear({ id: openJobId, note })}
          clearing={clearing}
          onSuspend={(outcome, note) => suspend({ id: openJobId, outcome, note })}
          suspending={suspending}
        />
      )}

      {readyRow && (
        <ReadyModal
          row={readyRow}
          onClose={() => { setReadyRow(null); refresh() }}
          onConfirm={() => confirmReady(readyRow)}
          confirming={confirming}
        />
      )}

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