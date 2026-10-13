// src/components/coordinator/ReadyModal.jsx
//
// Mark ready is the quality check. The job moved into QUALITY_CHECK when
// this opened; confirming moves it to DONE, which puts it on the shelf
// and texts the customer. Closing without confirming leaves it being
// checked, so nothing half-looked-at reaches a customer and nothing
// started is lost.
//
// Finishing quality is what the branch means to be known for, so the
// check is a real one: every line counted against the order, the finish
// looked at, nothing damaged. "Printed 80 instead of 100" is caught here,
// before the customer arrives, not at the counter.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { getJobDetail } from '../../api/coordinator'
import {
  FilePreview, FilePreviewModal, channelLabel, isOnline, services,
} from './shared'

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

/**
 * row:        the job's board row
 * onClose:    leave it being checked
 * onConfirm:  move it to DONE
 * confirming: the move is in flight
 */
export default function ReadyModal({ row, onClose, onConfirm, confirming }) {
  const [ticked, setTicked] = useState({})
  const [nudge, setNudge]   = useState('')
  const [preview, setPreview] = useState(null)

  const { data: job } = useQuery({
    queryKey: ['job-detail', row.id],
    queryFn:  () => getJobDetail(row.id).then(r => r.data),
  })

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !preview) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, preview])

  const lines = (job || row).line_items || []

  // One count per line, then the finish, then the condition. Built from
  // the order so the coordinator counts against what was asked for, not
  // against memory.
  const checks = [
    ...lines.map(li => ({
      key: `line-${li.id}`,
      text: `Counted ${li.quantity} × ${li.label || li.service_name}`,
    })),
    { key: 'finish',    text: 'Size and finishing match the order' },
    { key: 'condition', text: 'Nothing damaged, smudged or cut wrong' },
  ]

  const done = checks.every(c => ticked[c.key])
  const file = job?.files?.[0]
  const online = isOnline(job || row)

  const toggle = (key) => {
    setTicked(t => ({ ...t, [key]: !t[key] }))
    setNudge('')
  }

  const confirm = () => {
    if (!done) {
      setNudge('Tick every check first')
      return
    }
    onConfirm()
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center
      bg-black/55 p-3 sm:p-5">
      <div role="dialog" aria-modal="true" aria-label={`Checking ${row.job_number}`}
        className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-[880px]
          max-h-[94vh] flex flex-col overflow-hidden">

        <div className="flex items-start gap-3 px-6 py-4 border-b border-[var(--border)]">
          <div className="flex-1 min-w-0">
            <div className="font-mono text-base font-bold text-[var(--text)]">
              {row.job_number}
            </div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">
              {services(row)}
              {' · '}{row.customer_name || 'Walk-in'}
              {row.intake_channel ? ` · ${channelLabel(row.intake_channel)}` : ''}
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0
            bg-amber-100 text-amber-800">Quality check</span>
          <button onClick={onClose} aria-label="Close and keep it being checked"
            className="w-10 h-10 -mt-1 -mr-2 flex items-center justify-center rounded-full
              hover:bg-[var(--bg)] text-[var(--text-3)] shrink-0">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-4 p-6">

            {/* What was sent, to hold the finished piece against. */}
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[var(--text-3)] mb-2">
                What they sent
              </div>
              {file ? (
                <FilePreview file={file} onOpen={() => setPreview(file)} tall="h-72" />
              ) : (
                <div className="h-72 bg-[var(--bg)] rounded-xl flex items-center
                  justify-center text-xs text-[var(--text-3)]">
                  {job ? 'No file on this job' : 'Loading…'}
                </div>
              )}
            </div>

            <div className="min-w-0 flex flex-col gap-3">
              <div className="text-xs font-semibold text-[var(--text-3)]">
                Check it against the order
              </div>
              <div className="bg-[var(--bg)] rounded-xl px-4 py-1">
                {checks.map((c, i) => (
                  <div key={c.key}>
                    {i > 0 && <div className="border-t border-[var(--border)]" />}
                    <Check on={!!ticked[c.key]} onToggle={() => toggle(c.key)}>
                      {c.text}
                    </Check>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--text-3)] px-1">
                {online
                  ? 'Marking it ready texts the customer to come and collect.'
                  : 'Marking it ready puts it on the shelf for collection.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t border-[var(--border)]">
          <button onClick={confirm} disabled={confirming}
            className="min-h-[48px] px-6 text-sm font-bold bg-emerald-600 text-white
              rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity">
            {confirming ? 'Marking ready…' : 'Mark ready'}
          </button>
          <button onClick={onClose} disabled={confirming}
            className="min-h-[48px] px-5 text-sm font-bold border border-[var(--border-dark)]
              rounded-xl text-[var(--text-2)] hover:border-[var(--text-3)]
              disabled:opacity-40 transition-colors">
            Not yet
          </button>
          {nudge && (
            <span role="alert" className="text-sm text-red-600 font-semibold ml-2">
              {nudge}
            </span>
          )}
        </div>
      </div>

      {preview && <FilePreviewModal file={preview} onClose={() => setPreview(null)} />}
    </div>,
    document.body
  )
}