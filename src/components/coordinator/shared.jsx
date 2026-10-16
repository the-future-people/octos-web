// src/components/coordinator/shared.jsx
//
// What the coordinator board's pieces have in common: how a job is
// described, how a file is shown, and the two dialogs that stop work.
// Moved out of the old ProductionBoard so that each new piece reads the
// same rules instead of keeping its own copy.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// ── Time ─────────────────────────────────────────────────────────

export function waited(iso) {
  if (!iso) return ''
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (mins < 60)   return `${mins}m`
  if (mins < 1440) return `${Math.floor(mins / 60)}h`
  return `${Math.floor(mins / 1440)}d`
}

export function clockTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('en-GH', {
    hour: 'numeric', minute: '2-digit',
  })
}

/**
 * "4:30 pm" today, "tomorrow 9:00 am", otherwise "Thu 2:00 pm". The day
 * is only named when it is not today, because nearly everything on the
 * floor is due today and saying so on every row is noise.
 */
export function dueTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  const time = clockTime(iso)
  if (d.toDateString() === today.toDateString()) return time
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow ${time}`
  return `${d.toLocaleDateString('en-GH', { weekday: 'short' })} ${time}`
}

/**
 * The due line every row carries, and its colour. Red only when the
 * promise has already been broken; amber when the floor's own prediction
 * says it will be. Colour is never the only signal — the words say it too.
 */
export function dueLine(row) {
  if (!row?.promise) return { text: 'No promise yet', tone: 'muted' }
  const due = `Due ${dueTime(row.promise)}`
  if (row.late) {
    const mins = Math.floor((Date.now() - new Date(row.promise)) / 60000)
    const by = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
    return { text: `${due} · ${by} late`, tone: 'late' }
  }
  if (row.at_risk) return { text: `${due} · at risk`, tone: 'risk' }
  return { text: due, tone: 'normal' }
}

// ── Chips ────────────────────────────────────────────────────────
//
// Colour that means something: where a job came from, and whether its
// promise is safe. Never colour alone; the chip always says it in words.

const CHANNEL_TONE = {
  ONLINE:   'bg-blue-50 text-blue-700',
  WHATSAPP: 'bg-emerald-50 text-emerald-700',
  EMAIL:    'bg-violet-50 text-violet-700',
  PHONE:    'bg-sky-50 text-sky-700',
}

const NEUTRAL_CHIP = 'bg-[var(--bg)] text-[var(--text-2)] border border-[var(--border)]'

export function Chip({ children, className = NEUTRAL_CHIP }) {
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5
      rounded-full whitespace-nowrap ${className}`}>
      {children}
    </span>
  )
}

export function ChannelChip({ channel }) {
  if (!channel) return null
  return <Chip className={CHANNEL_TONE[channel] || NEUTRAL_CHIP}>{channelLabel(channel)}</Chip>
}

const DUE_TONE = {
  late:   'bg-red-50 text-red-700',
  risk:   'bg-amber-50 text-amber-800',
  normal: NEUTRAL_CHIP,
  muted:  NEUTRAL_CHIP,
}

export function DueChip({ row }) {
  const due = dueLine(row)
  return <Chip className={DUE_TONE[due.tone]}>{due.text}</Chip>
}

export const TONE_TEXT = {
  late:   'text-red-600 font-semibold',
  risk:   'text-amber-700 font-semibold',
  normal: 'text-[var(--text-2)]',
  muted:  'text-[var(--text-3)]',
}

// ── What a job is ────────────────────────────────────────────────

// A job's pieces: the lines that are not add-ons. Lamination, binding
// and envelopes finish a piece; they are listed under it, not beside it.
export function pieces(job) {
  return (job.line_items || []).filter(li => !li.parent)
}

export function addonsOf(job, piece) {
  return (job.line_items || []).filter(li => li.parent === piece.id)
}

// "A4 Binding (8mm ring) × 2"
export function addonText(li) {
  const detail = li.specifications?.detail
  return `${li.service_name || li.label}${detail ? ` (${detail})` : ''} × ${li.quantity}`
}

export function services(job) {
  const items = pieces(job)
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

// Online work has no attendant and nobody counted the money. The
// database leaves intake_by and cashier empty because that is what is
// true; the screen says where the job came from instead of reading the
// empty field as "the counter".
export function isOnline(job) {
  return job.intake_channel === 'ONLINE'
}

export function channelLabel(channel) {
  if (!channel) return ''
  if (channel === 'ONLINE') return 'Print Octos'
  const words = channel.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// ── Files ────────────────────────────────────────────────────────

// file.url is a path, not an origin. In an API call Axios prefixes the
// base for us; in an <img src> or an <iframe> the browser resolves it
// against wherever the app is served from, which is not the API.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function fileSrc(file) {
  return file.url?.startsWith('http') ? file.url : `${API_BASE}${file.url}`
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export function isImage(file) {
  if (file.content_type && IMAGE_TYPES.includes(file.content_type)) return true
  return /\.(jpe?g|png|gif|webp)$/i.test(file.filename || '')
}

export function isPdf(file) {
  return file.content_type === 'application/pdf'
    || /\.pdf$/i.test(file.filename || '')
}

/**
 * A PDF the page can frame. The file lives on the backend, another site
 * from this page, and the backend forbids being shown inside another
 * site's frame, so pointing an iframe at it shows Chrome's torn page.
 * Fetched here and held as a local file instead, it is the page's own,
 * and nothing can refuse it.
 */
export function usePdfUrl(file) {
  const [state, setState] = useState({ url: null, failed: false })
  const src = file && isPdf(file) ? fileSrc(file) : null

  useEffect(() => {
    if (!src) return undefined
    let gone = false
    let made = null
    setState({ url: null, failed: false })
    fetch(src)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob() })
      .then(blob => {
        if (gone) return
        made = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
        setState({ url: made, failed: false })
      })
      .catch(() => { if (!gone) setState({ url: null, failed: true }) })
    return () => {
      gone = true
      if (made) URL.revokeObjectURL(made)
    }
  }, [src])

  return state
}

export function PdfFrame({ file, className = '' }) {
  const { url, failed } = usePdfUrl(file)
  if (failed) {
    return (
      <div className={`${className} flex flex-col items-center justify-center gap-2 text-center p-6`}>
        <p className="text-sm text-[var(--text-2)]">This PDF can’t be shown here.</p>
        <a href={fileSrc(file)} target="_blank" rel="noreferrer"
          className="text-sm font-semibold underline underline-offset-4">Open it in a new tab</a>
      </div>
    )
  }
  if (!url) return <div className={`${className} animate-pulse bg-[var(--bg)]`} />
  return <iframe src={url} title={file.filename} className={className} />
}

function fileFacts(file) {
  const dims = file.width_mm && file.height_mm
    ? `${Math.round(file.width_mm)} × ${Math.round(file.height_mm)} mm`
    : file.width_px && file.height_px
      ? `${file.width_px} × ${file.height_px} px`
      : null

  return [
    file.size_kb ? (file.size_kb > 1024
      ? `${(file.size_kb / 1024).toFixed(1)} MB`
      : `${Math.round(file.size_kb)} KB`) : null,
    file.dpi ? `${file.dpi} dpi` : null,
    dims,
    file.colour_mode || null,
    file.page_count
      ? `${file.page_count} ${file.page_count === 1 ? 'page' : 'pages'}`
      : null,
  ].filter(Boolean)
}

/**
 * What the shown file measures. Dark by default; red only when something
 * is wrong with the file itself. Red means stopped everywhere else in
 * this portal, and a correct 300 dpi file painted red would say the
 * opposite of what is true.
 */
export function MeasurementBand({ file }) {
  const facts = fileFacts(file)
  const broken = file.metadata_state === 'FAILED' || file.size_kb === null

  if (broken) {
    return (
      <div className="bg-red-600 rounded-lg px-3 py-2 mb-3">
        <div className="text-[11px] font-semibold text-white">
          {file.metadata_state === 'FAILED'
            ? 'Could not be read. It may be damaged.'
            : 'The file is missing from storage.'}
        </div>
      </div>
    )
  }

  if (!facts.length) {
    return (
      <div className="bg-[var(--panel)] border border-[var(--border)]
        rounded-lg px-3 py-2 mb-3">
        <div className="text-[11px] text-[var(--text-3)]">
          {file.metadata_state === 'UNSUPPORTED'
            ? 'Cannot be read here — open it to check'
            : 'Not measured'}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--text)] rounded-lg px-3 py-2 mb-3">
      <div className="text-[11px] font-semibold text-white leading-relaxed">
        {facts.join(' · ')}
      </div>
    </div>
  )
}

/**
 * The file as large as the space allows. A CMYK JPEG is press-ready and
 * ordinary here, and no browser will render one, so a failed image falls
 * back to its type rather than a broken-image icon that reads as a
 * broken file.
 */
export function FilePreview({ file, onOpen, tall = 'h-80' }) {
  const [failed, setFailed] = useState(false)
  const ext = (file.filename || '').split('.').pop().toUpperCase()

  return (
    <button onClick={onOpen}
      className={`w-full ${tall} bg-[var(--bg)] rounded-xl flex items-center
        justify-center overflow-hidden cursor-zoom-in hover:opacity-95
        transition-opacity`}>
      {isImage(file) && !failed ? (
        <img src={fileSrc(file)} alt={file.filename}
          onError={() => setFailed(true)}
          className="max-h-full max-w-full object-contain p-3" />
      ) : (
        <div className="text-center">
          <div className="font-mono text-base font-bold text-[var(--text-2)]">{ext}</div>
          <div className="text-[11px] text-[var(--text-3)] mt-1">
            {isPdf(file) ? 'Tap to read' : 'Tap to open'}
          </div>
        </div>
      )}
    </button>
  )
}

export function FilePreviewModal({ file, onClose }) {
  const facts = fileFacts(file)

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-6xl
        max-h-[94vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        <div className="px-5 py-3 border-b border-[var(--border)]
          flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--text)] truncate">
              {file.filename}
            </div>
            {facts.length > 0 && (
              <div className="text-[11px] text-[var(--text-3)] mt-0.5">
                {facts.join(' · ')}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={fileSrc(file)} target="_blank" rel="noreferrer"
              className="px-3 py-1.5 text-xs font-bold border border-[var(--border)]
                rounded-lg text-[var(--text-2)] hover:border-[var(--border-dark)]
                transition-colors">
              Open in new tab
            </a>
            <button onClick={onClose} aria-label="Close"
              className="w-9 h-9 flex items-center justify-center rounded-full
                hover:bg-[var(--bg)] text-[var(--text-3)]">✕</button>
          </div>
        </div>

        <div className="flex-1 bg-[var(--bg)] overflow-auto flex items-center
          justify-center p-4 min-h-[320px]">
          {isImage(file) ? (
            <img src={fileSrc(file)} alt={file.filename}
              className="max-w-full max-h-[80vh] object-contain" />
          ) : isPdf(file) ? (
            // fileSrc, not file.url: a bare path in an iframe resolves
            // against this app's address rather than the API's.
            <PdfFrame file={file} className="w-full h-[80vh] bg-white rounded-lg border border-[var(--border)]" />
          ) : (
            <div className="text-center px-6">
              <p className="text-sm font-semibold text-[var(--text-2)]">
                This format cannot be shown here
              </p>
              <p className="text-xs text-[var(--text-3)] mt-1">
                Open it in the application it was made in to check it properly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Stopping work ────────────────────────────────────────────────

export const HALT_REASONS = [
  { value: 'MACHINE_BREAKDOWN', label: 'Machine down'        },
  { value: 'MATERIALS_OUT',     label: 'Materials out'       },
  { value: 'AWAITING_CUSTOMER', label: 'Waiting on customer' },
  { value: 'QUALITY_FAILURE',   label: 'Quality problem'     },
  { value: 'OTHER',             label: 'Other'               },
]

export const SUSPEND_REASONS = [
  { value: 'ARTWORK_PROBLEM', label: 'Artwork not usable'      },
  { value: 'WRONG_FILE',      label: 'Wrong or missing file'   },
  { value: 'SPEC_UNCLEAR',    label: 'Specification unclear'   },
  { value: 'SPEC_IMPOSSIBLE', label: 'Cannot be made as asked' },
  { value: 'OTHER',           label: 'Other'                   },
]

export const FINDING_LABEL = Object.fromEntries(
  SUSPEND_REASONS.map(r => [r.value, r.label])
)

function ReasonDialog({
  title, subtitle, reasons, initial, notePlaceholder, noteAlways,
  confirmLabel, busyLabel, confirmTone, busy, onClose, onConfirm,
}) {
  const [reason, setReason] = useState(initial)
  const [note, setNote]     = useState('')
  const showNote = noteAlways || reason === 'OTHER'

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-sm
        overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="text-sm font-bold text-[var(--text)]">{title}</div>
          <div className="text-[11px] text-[var(--text-3)] mt-0.5">{subtitle}</div>
        </div>

        <div className="p-4 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {reasons.map(r => (
              <button key={r.value} onClick={() => setReason(r.value)}
                className={`px-3 py-2 text-xs font-bold rounded-lg border
                  transition-colors
                  ${reason === r.value
                    ? 'bg-[var(--text)] text-white border-transparent'
                    : 'border-[var(--border)] text-[var(--text-2)]'}`}>
                {r.label}
              </button>
            ))}
          </div>
          {showNote && (
            <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
              placeholder={notePlaceholder}
              className="w-full px-3 py-2 text-xs bg-[var(--bg)] border
                border-[var(--border)] rounded-lg outline-none resize-none" />
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-2 text-xs font-semibold text-[var(--text-2)]">Cancel</button>
          <button onClick={() => onConfirm(reason, note)}
            disabled={busy || (reason === 'OTHER' && !note.trim())}
            className={`px-4 py-2 text-xs font-bold text-white rounded-lg
              disabled:opacity-40 hover:opacity-90 transition-opacity ${confirmTone}`}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function SuspendDialog({ job, onClose, onSuspend, busy }) {
  return (
    <ReasonDialog
      title="Hold this job"
      subtitle={`It waits until someone answers. ${job.job_number}`}
      reasons={SUSPEND_REASONS}
      initial="ARTWORK_PROBLEM"
      notePlaceholder="What needs answering"
      noteAlways
      confirmLabel="Hold job"
      busyLabel="Holding…"
      confirmTone="bg-amber-600"
      busy={busy}
      onClose={onClose}
      onConfirm={onSuspend}
    />
  )
}

export function HaltDialog({ job, onClose, onHalt, busy }) {
  return (
    <ReasonDialog
      title="Stop this job"
      subtitle={job.job_number}
      reasons={HALT_REASONS}
      initial="MACHINE_BREAKDOWN"
      notePlaceholder="What happened"
      noteAlways={false}
      confirmLabel="Stop job"
      busyLabel="Stopping…"
      confirmTone="bg-red-600"
      busy={busy}
      onClose={onClose}
      onConfirm={onHalt}
    />
  )
}