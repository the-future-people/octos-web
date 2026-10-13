// src/components/coordinator/InspectionModal.jsx
//
// Where a job is inspected. The file leads: it takes most of the width,
// because the file is what gets printed and what is being judged. The
// order sits beside it, so the size of one is read against the size of
// the other.
//
// Two checks are ticked by hand before Clear will go: the quantity and
// finishing read, and the content looked over. They guard against the
// two failures the branch fears most — the wrong job printed, and more
// or fewer than were asked for. Checks Octos can compute itself (size,
// resolution) will join them once it can; a tick nothing checked would
// be a lie.
//
// While open, the claim is kept alive every two minutes so nobody else
// can take this job. Closing releases it.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  FilePreview, FilePreviewModal, MeasurementBand, SuspendDialog,
  TONE_TEXT, channelLabel, clockTime, dueLine, dueTime, isOnline, waited,
} from './shared'

const HEARTBEAT_MS = 2 * 60 * 1000

const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07
      19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0
      0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0
      6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

function Check({ on, onToggle, children }) {
  return (
    <button onClick={onToggle} role="checkbox" aria-checked={on}
      className="w-full flex items-center gap-3 py-2.5 text-left min-h-[44px]">
      <span className={`w-5 h-5 rounded-md border flex items-center justify-center
        shrink-0 transition-colors
        ${on
          ? 'bg-[var(--text)] border-transparent text-white'
          : 'border-[var(--text-3)] bg-[var(--panel)]'}`}>
        {on && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </span>
      <span className="text-sm text-[var(--text)]">{children}</span>
    </button>
  )
}

function quantitySummary(job) {
  const lines = job.line_items || []
  if (!lines.length) return 'as ordered'
  return lines
    .map(li => `${li.quantity} × ${li.label || li.service_name}`)
    .join(', ')
}

/**
 * job:         the job detail, with files and line items; may still be loading
 * row:         the job's queue row, which carries the promise and its flags
 * onHeartbeat: keeps the claim alive; the board closes the modal if refused
 * onClose:     closes and releases the claim
 * onClear:     (note) => clear for production
 * onSuspend:   (outcome, note) => hold the job
 */
export default function InspectionModal({
  job, row, onHeartbeat, onClose, onClear, clearing, onSuspend, suspending,
}) {
  const [note, setNote]         = useState('')
  const [fileIndex, setIndex]   = useState(0)
  const [checks, setChecks]     = useState({ quantity: false, content: false })
  const [nudge, setNudge]       = useState('')
  const [preview, setPreview]   = useState(null)
  const [holding, setHolding]   = useState(false)

  const jobId = job?.id

  // Keep the claim alive while the workspace is open.
  useEffect(() => {
    if (!jobId) return undefined
    const timer = setInterval(() => onHeartbeat(jobId), HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [jobId, onHeartbeat])

  // Escape closes, unless a dialog on top is open — that dialog gets it.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !preview && !holding) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, preview, holding])

  const files = job?.files || []
  const shown = files[Math.min(fileIndex, Math.max(0, files.length - 1))]

  const due = dueLine(row)
  const floor = job?.predicted?.ready_at

  const specs = Object.entries(job?.specifications || {})
    .filter(([, v]) => v !== null && v !== '' && v !== undefined)

  // Description repeats the title on jobs taken at the counter, where the
  // form has nowhere else to type. Showing it then is noise.
  const words = job?.description && job.description.trim() !== (job.title || '').trim()
    ? job.description.trim()
    : null

  const ticked = checks.quantity && checks.content

  const tryClear = () => {
    if (!ticked) {
      setNudge('Tick both checks first')
      return
    }
    onClear(note)
  }

  const toggle = (key) => {
    setChecks(c => ({ ...c, [key]: !c[key] }))
    setNudge('')
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center
      bg-black/55 p-3 sm:p-5">
      <div role="dialog" aria-modal="true" aria-label={`Inspecting ${job?.job_number || ''}`}
        className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-[1100px]
          max-h-[94vh] flex flex-col overflow-hidden">

        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-[var(--border)]">
          <div className="flex-1 min-w-0">
            <div className="font-mono text-base font-bold text-[var(--text)]">
              {job?.job_number || row?.job_number}
            </div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">
              {(job || row)?.customer_name || 'Walk-in'}
              {(job || row)?.intake_channel
                ? ` · ${channelLabel((job || row).intake_channel)}` : ''}
              {job?.created_at ? ` · waited ${waited(job.created_at)}` : ''}
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0
            bg-amber-100 text-amber-800">Inspecting</span>
          <button onClick={onClose} aria-label="Close and put back in the queue"
            className="w-10 h-10 -mt-1 -mr-2 flex items-center justify-center rounded-full
              hover:bg-[var(--bg)] text-[var(--text-3)] shrink-0">✕</button>
        </div>

        {!job ? (
          <div className="p-6">
            <div className="h-[52vh] bg-[var(--bg)] rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 p-6">

              {/* ── The file ─────────────────────────────── */}
              <div className="min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[var(--text-3)]">
                    {files.length > 1
                      ? `File ${fileIndex + 1} of ${files.length}`
                      : 'The file'}
                  </span>
                  {files.length > 1 && (
                    <div className="flex gap-1">
                      <button onClick={() => setIndex(i => Math.max(0, i - 1))}
                        disabled={fileIndex === 0} aria-label="Previous file"
                        className="w-10 h-10 rounded-lg border border-[var(--border)]
                          text-[var(--text-2)] disabled:opacity-30">‹</button>
                      <button onClick={() => setIndex(i => Math.min(files.length - 1, i + 1))}
                        disabled={fileIndex === files.length - 1} aria-label="Next file"
                        className="w-10 h-10 rounded-lg border border-[var(--border)]
                          text-[var(--text-2)] disabled:opacity-30">›</button>
                    </div>
                  )}
                </div>

                {shown ? (
                  <>
                    <FilePreview file={shown} onOpen={() => setPreview(shown)}
                      tall="h-[52vh]" />
                    <div className="flex items-center justify-between gap-3 mt-2">
                      <span className="text-sm font-semibold text-[var(--text)] truncate">
                        {shown.filename}
                      </span>
                      <button onClick={() => setPreview(shown)}
                        className="text-xs font-bold text-[var(--text-2)] underline
                          underline-offset-2 shrink-0 min-h-[44px]">
                        View full size
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="h-[52vh] bg-[var(--bg)] rounded-xl flex items-center
                    justify-center text-center px-6">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-2)]">
                        Nothing attached
                      </p>
                      <p className="text-xs text-[var(--text-3)] mt-1">
                        The customer sent this without a file.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── The order ────────────────────────────── */}
              <div className="min-w-0 flex flex-col gap-3">
                <div className="bg-[var(--bg)] rounded-xl p-4">
                  <div className="text-xs font-semibold text-[var(--text-3)] mb-2">
                    The order
                  </div>
                  {/* The file's measurements sit directly above what was
                      ordered. That adjacency is the size check. */}
                  {shown && <MeasurementBand file={shown} />}
                  <div className="space-y-1">
                    {(job.line_items || []).map(li => (
                      <div key={li.id} className="text-sm text-[var(--text)]">
                        <span className="font-semibold">{li.label || li.service_name}</span>
                        <span className="text-[var(--text-3)]">
                          {' · '}{li.quantity} × {li.pages}pp{li.is_color ? ' · colour' : ''}
                        </span>
                      </div>
                    ))}
                  </div>

                  {specs.length > 0 && (
                    <div className="border-t border-[var(--border)] mt-3 pt-3
                      grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {specs.map(([k, v]) => (
                        <div key={k} className="text-xs">
                          <span className="text-[var(--text-3)]">{k.replace(/_/g, ' ')}</span>
                          <span className="text-[var(--text)] ml-1.5 font-semibold">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {words && (
                    <div className="border-t border-[var(--border)] mt-3 pt-3">
                      <div className="text-[11px] text-[var(--text-3)] mb-1">In their words</div>
                      <p className="text-sm text-[var(--text-2)] italic leading-relaxed">{words}</p>
                    </div>
                  )}
                </div>

                <div className="bg-[var(--bg)] rounded-xl p-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-[var(--text-3)]">Promised</div>
                    <div className={`text-sm mt-0.5 ${TONE_TEXT[due.tone]}`}>
                      {row?.promise ? dueTime(row.promise) : 'No promise yet'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--text-3)]">Floor says</div>
                    <div className="text-sm text-[var(--text)] mt-0.5">
                      {floor
                        ? `${job.predicted.is_next_day ? 'tomorrow ' : ''}${clockTime(floor)}`
                        : '—'}
                      {job.predicted?.confidence === 'estimated' && (
                        <span className="text-[11px] text-[var(--text-3)]"> · estimated</span>
                      )}
                    </div>
                  </div>
                  {(row?.late || row?.at_risk) && (
                    <div className={`col-span-2 text-xs ${TONE_TEXT[due.tone]}`}>
                      {row.late
                        ? 'Already past the promise. Clear it quickly.'
                        : 'The floor will finish after the promise.'}
                    </div>
                  )}
                </div>

                <div className="bg-[var(--bg)] rounded-xl px-4 py-1">
                  <Check on={checks.quantity} onToggle={() => toggle('quantity')}>
                    Quantity and finishing read: {quantitySummary(job)}
                  </Check>
                  <div className="border-t border-[var(--border)]" />
                  <Check on={checks.content} onToggle={() => toggle('content')}>
                    Content looks right: spelling, numbers, nothing cut off
                  </Check>
                </div>

                <div className="text-xs text-[var(--text-3)] px-1">
                  {job.payment_state === 'SETTLED'
                    ? (isOnline(job) ? 'Paid online' : 'Paid in full')
                    : job.payment_state === 'DEPOSIT_PAID' ? 'Deposit paid' : 'Unpaid'}
                  {' · '}
                  {isOnline(job)
                    ? 'Ordered on Print Octos'
                    : job.intake_by_name ? `Taken by ${job.intake_by_name}` : 'Taken at the counter'}
                </div>

                <input type="text" value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Note for the floor (optional)"
                  className="w-full px-3 py-2.5 text-sm bg-[var(--panel)]
                    border border-[var(--border)] rounded-xl outline-none
                    focus:border-[var(--text-3)]" />
              </div>
            </div>
          </div>
        )}

        {/* ── Actions ──────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-[var(--border)]">
          <button onClick={tryClear} disabled={!job || clearing}
            className="min-h-[48px] px-6 text-sm font-bold bg-emerald-600 text-white
              rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity">
            {clearing ? 'Clearing…' : 'Clear for production'}
          </button>
          <button onClick={() => setHolding(true)} disabled={!job || clearing}
            className="min-h-[48px] px-5 text-sm font-bold border border-[var(--border-dark)]
              rounded-xl text-[var(--text-2)] hover:border-[var(--text-3)]
              disabled:opacity-40 transition-colors">
            Suspend
          </button>
          {job?.customer_phone && (
            <a href={`tel:${job.customer_phone}`}
              aria-label={`Call ${job.customer_name || 'the customer'}`}
              className="w-12 h-12 flex items-center justify-center border
                border-[var(--border-dark)] rounded-xl text-[var(--text-2)]
                hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors">
              <PhoneIcon />
            </a>
          )}
          {nudge && (
            <span role="alert" className="text-sm text-red-600 font-semibold ml-2">
              {nudge}
            </span>
          )}
        </div>
      </div>

      {preview && (
        <FilePreviewModal file={preview} onClose={() => setPreview(null)} />
      )}

      {holding && job && (
        <SuspendDialog
          job={job}
          busy={suspending}
          onClose={() => setHolding(false)}
          onSuspend={(outcome, n) => onSuspend(outcome, n)}
        />
      )}
    </div>,
    document.body
  )
}