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
  claimJob, getFloor, getJobDetail, getProductionBoard, getSuspendedJobs,
  getVerificationQueue, haltJob, markStepDone, moveJobAxis, moveStep,
  releaseJob, resumeJob, submitCheck, suspendJob, verifyJob,
} from '../../api/coordinator'
import ArrivalQueue from './ArrivalQueue'
import FinalCheckModal from './FinalCheckModal'
import InspectionModal from './InspectionModal'
import MachineLanes from './MachineLanes'
import ReadyModal from './ReadyModal'
import StageFlow from './StageFlow'
import StageList from './StageList'
import { HaltDialog } from './shared'

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

export default function ProductionBoard({ openJobId, setOpenJobId }) {
  const queryClient = useQueryClient()

  const [stage, setStage]         = useState('arrived')
  const [error, setError]         = useState('')
  const [leavingId, setLeavingId] = useState(null)
  const [busyId, setBusyId]       = useState(null)
  const [halting, setHalting]     = useState(null)
  const [readyRow, setReadyRow]   = useState(null)
  const [busyStep, setBusyStep]   = useState(null)
  const [checking, setChecking]   = useState(null)
  const [notice, setNotice]       = useState('')

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

  // Every machine with its line-up. Refreshed often: the progress bars
  // and minutes left are only as good as the last look.
  const { data: floor } = useQuery({
    queryKey: ['floor'],
    queryFn:  () => getFloor().then(r => r.data),
    refetchInterval: 20_000,
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
    queryClient.invalidateQueries({ queryKey: ['floor'] })
  }, [queryClient])

  // ── Lanes ──────────────────────────────────────────────────────

  const columns = board?.columns || {}
  const halted  = board?.halted || []
  const haltedIn = (...states) => halted.filter(j => states.includes(j.work_state))

  const press     = [...(columns.IN_PRODUCTION || []), ...haltedIn('IN_PRODUCTION')]
  const finishing = [
    ...(columns.FINISHING || []), ...(columns.QUALITY_CHECK || []),
    ...haltedIn('FINISHING', 'QUALITY_CHECK'),
  ]
  const ready = columns.READY || []

  const stages = [
    // Arrived is the inspection queue alone. Clearing sends a job
    // straight to press; there is no separate step to start it.
    { id: 'arrived',   label: 'Arrived',   count: queue.length, tone: laneTone(queue) },
    { id: 'press',     label: 'In press',  count: press.length,     tone: laneTone(press) },
    { id: 'finishing', label: 'Finishing', count: finishing.length, tone: laneTone(finishing) },
    { id: 'ready',     label: 'Ready',     count: ready.length,     tone: null },
  ]

  const openRow = queue.find(j => j.id === openJobId)

  // Jobs with steps live in the machine lanes. What is left in a stage
  // without a lane is work from before machine tracking, and, in
  // Finishing, jobs whose every step is done and which wait only for
  // the final check.
  const pressLanes     = floor?.press || []
  const finishingLanes = floor?.finishing || []
  const unassigned     = floor?.unassigned || []
  const allLanes       = [...pressLanes, ...finishingLanes]
  const onFloor = new Set([
    ...allLanes.flatMap(e => e.queue.map(r => r.job)),
    ...unassigned.map(r => r.job),
  ])
  const pressLegacy     = press.filter(j => !onFloor.has(j.id))
  const finishingOthers = finishing.filter(j => !onFloor.has(j.id))

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
    // The payload carries the note and, when the order was corrected
    // after a call, that the customer was contacted and what they said.
    mutationFn: ({ id, ...payload }) => verifyJob(id, payload),
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

  const stepDone = async (row, override) => {
    setBusyStep(row.step)
    try {
      await markStepDone(row.step, override)
      setError('')
      refresh()
    } catch (e) {
      setError(detail(e, 'Could not mark that done.'))
    } finally {
      setBusyStep(null)
    }
  }

  const stepMove = async (row, machineId) => {
    setBusyStep(row.step)
    try {
      await moveStep(row.step, machineId)
      setError('')
      refresh()
    } catch (e) {
      setError(detail(e, 'Could not move that job.'))
    } finally {
      setBusyStep(null)
    }
  }

  const finishCheck = async (made, note) => {
    if (!checking) return
    setBusyStep(checking.step)
    try {
      const { data } = await submitCheck(checking.step, made, note)
      setError('')
      setNotice(data.outcome === 'PASSED'
        ? `${checking.job_number} checked and finished.`
        : `${checking.job_number} sent back to be made again.`)
      setChecking(null)
      refresh()
    } catch (e) {
      setError(detail(e, 'Could not save the check.'))
    } finally {
      setBusyStep(null)
    }
  }

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

      {notice && (
        <div role="status"
          className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm
            text-emerald-800 flex items-center justify-between gap-3">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss" className="w-8 h-8 shrink-0 font-bold">✕</button>
        </div>
      )}

      <StageFlow
        stages={stages}
        held={{ count: suspended.length }}
        current={stage}
        onSelect={setStage}
      />

      {stage === 'arrived' && (
        <ArrivalQueue
          queue={queue}
          onInspect={inspect}
          claiming={claimingNow ? claimingId : null}
          leavingId={leavingId}
          blocked={!!openJobId}
        />
      )}

      {stage === 'press' && (
        <div className="space-y-6">
          {(pressLanes.length > 0 || unassigned.length > 0) && (
            <MachineLanes lanes={pressLanes} unassigned={unassigned} allLanes={allLanes}
              onDone={stepDone} onCheck={setChecking} onMove={stepMove} busyStep={busyStep} />
          )}
          {(pressLegacy.length > 0 || pressLanes.length === 0) && (
            <section>
              {pressLanes.length > 0 && (
                <h3 className="text-xs font-semibold text-[var(--text-3)] mb-2">
                  From before machine tracking
                </h3>
              )}
              <StageList stage="press" jobs={pressLegacy} busyId={busyId} blocked={!!openJobId} on={on} />
            </section>
          )}
        </div>
      )}
      {stage === 'finishing' && (
        <div className="space-y-6">
          {/* Waiting on a person, not a machine: shown first, never below
              the lanes where it can be scrolled past. */}
          {(finishingOthers.length > 0 || finishingLanes.length === 0) && (
            <section>
              {finishingLanes.length > 0 && (
                <h3 className="text-xs font-semibold text-[var(--text-3)] mb-2">
                  Ready for the final check
                </h3>
              )}
              <StageList stage="finishing" jobs={finishingOthers} busyId={busyId} blocked={!!openJobId} on={on} />
            </section>
          )}
          {finishingLanes.length > 0 && (
            <MachineLanes lanes={finishingLanes} allLanes={allLanes}
              onDone={stepDone} onCheck={setChecking} onMove={stepMove} busyStep={busyStep} />
          )}
        </div>
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
          onClear={(payload) => clear({ id: openJobId, ...payload })}
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

      {checking && (
        <FinalCheckModal
          row={checking}
          busy={busyStep === checking.step}
          onClose={() => setChecking(null)}
          onSubmit={finishCheck}
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