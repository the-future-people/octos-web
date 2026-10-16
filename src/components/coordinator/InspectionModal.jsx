// src/components/coordinator/InspectionModal.jsx
//
// Order review and pre-production check. Three columns, read left to
// right the way the check is actually done: what the order is, the file
// that will be printed, and what was asked for set against what the
// floor can do.
//
// The coordinator may correct a specification when it is critical, and
// only after the customer agreed on the recorded company line. The price
// never moves. A correction makes customer approval a required check,
// ticked by the record of that call, and clearing carries the call onto
// the inspection record.
//
// Nobody sets a promise here. Octos calculates it; this shows it.
//
// While open, the claim is kept alive every two minutes so nobody else
// can take this job. Closing releases it.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { changeSpecs } from '../../api/coordinator'
import {
  Chip, ChannelChip, FilePreviewModal, SuspendDialog, clockTime, dueTime,
  PdfFrame, addonText, addonsOf, fileSrc, isImage, isOnline, isPdf, pieces, services, waited,
} from './shared'

const HEARTBEAT_MS = 2 * 60 * 1000

// Spec keys the server will refuse, never offered for editing here.
const PRICED = new Set(['quantity', 'sets', 'pages', 'unit_price', 'line_total'])

// ── Small pieces ────────────────────────────────────────────────

const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
)

const I = {
  user:    <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  bag:     <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a4 4 0 0 1 8 0v2" /></>,
  layers:  <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  cal:     <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  wallet:  <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M16 13h2" /><path d="M3 10h18" /></>,
  note:    <><path d="M4 4h16v12H8l-4 4Z" /><path d="M8 9h8M8 12h5" /></>,
  file:    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
  list:    <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  check:   <><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /></>,
  clock:   <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  copy:    <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
  ext:     <><path d="M14 3h7v7" /><path d="M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></>,
  zin:     <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4M11 8v6M8 11h6" /></>,
  zout:    <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4M8 11h6" /></>,
  full:    <><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>,
  rotate:  <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></>,
  down:    <><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>,
  phone:   <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
  pause:   <><circle cx="12" cy="12" r="9" /><path d="M10 9v6M14 9v6" /></>,
  play:    <path d="M7 4v16l13-8z" />,
  warn:    <><path d="M12 3 2 21h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></>,
  pencil:  <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /></>,
  x:       <path d="M6 6l12 12M18 6 6 18" />,
}

function Panel({ icon, title, action, children, className = '' }) {
  return (
    <section className={`bg-[var(--panel)] border border-[var(--border)] rounded-2xl
      ${className}`}>
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2.5">
        <span className="text-[var(--text-2)]"><Icon d={icon} /></span>
        <h3 className="text-sm font-bold text-[var(--text)] flex-1">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function SmallButton({ icon, children, onClick, href, disabled }) {
  const cls = `inline-flex items-center gap-1.5 min-h-[36px] px-3 text-xs font-semibold
    border border-[var(--border)] rounded-lg text-[var(--text-2)] bg-[var(--panel)]
    hover:border-[var(--border-dark)] disabled:opacity-40 transition-colors`
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {icon && <Icon d={icon} size={14} />}{children}
      </a>
    )
  }
  return (
    <button onClick={onClick} disabled={disabled} className={cls}>
      {icon && <Icon d={icon} size={14} />}{children}
    </button>
  )
}

function Fact({ icon, label, children }) {
  return (
    <div className="flex gap-3 py-2.5 border-t border-[var(--border)]">
      <span className="w-8 h-8 rounded-lg bg-[var(--bg)] text-[var(--text-2)] flex
        items-center justify-center shrink-0">
        <Icon d={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-[var(--text-3)]">{label}</div>
        <div className="text-sm text-[var(--text)] mt-0.5">{children}</div>
      </div>
    </div>
  )
}

function CheckRow({ on, auto, onToggle, children, detail }) {
  return (
    <button onClick={auto ? undefined : onToggle} role="checkbox" aria-checked={on}
      aria-disabled={auto}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border text-left
        min-h-[44px] transition-colors
        ${on ? 'bg-emerald-50 border-emerald-200' : 'bg-[var(--panel)] border-[var(--border)]'}
        ${auto ? 'cursor-default' : 'hover:border-[var(--border-dark)]'}`}>
      <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0
        ${on ? 'bg-emerald-600 border-transparent text-white' : 'border-[var(--text-3)]'}`}>
        {on && <Icon d={<path d="M5 12l5 5L20 7" />} size={12} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-[var(--text)]">{children}</span>
        {detail && <span className="block text-[11px] text-[var(--text-3)] mt-0.5">{detail}</span>}
      </span>
      {auto && <span className="text-[10px] font-semibold text-[var(--text-3)] shrink-0">Octos</span>}
      {!on && !auto && (
        <span className="text-amber-600 shrink-0"><Icon d={I.warn} size={16} /></span>
      )}
    </button>
  )
}

// ── Artwork viewer ──────────────────────────────────────────────

function Viewer({ files, onOpenLarge }) {
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [turn, setTurn] = useState(0)
  const [failed, setFailed] = useState(false)
  const box = useRef(null)

  const file = files[Math.min(index, Math.max(0, files.length - 1))]

  useEffect(() => { setZoom(1); setTurn(0); setFailed(false) }, [index])

  if (!file) {
    return (
      <div className="h-[46vh] bg-[var(--bg)] rounded-xl mx-4 mb-4 flex items-center
        justify-center text-center px-6">
        <div>
          <p className="text-sm font-semibold text-[var(--text-2)]">Nothing attached</p>
          <p className="text-xs text-[var(--text-3)] mt-1">The customer sent this without a file.</p>
        </div>
      </div>
    )
  }

  const ext = (file.filename || '').split('.').pop().toUpperCase()
  const facts = [
    file.size_kb ? (file.size_kb > 1024
      ? `${(file.size_kb / 1024).toFixed(1)} MB` : `${Math.round(file.size_kb)} KB`) : null,
    file.dpi ? `${file.dpi} dpi` : null,
    file.width_mm && file.height_mm
      ? `${Math.round(file.width_mm)} × ${Math.round(file.height_mm)} mm`
      : file.width_px && file.height_px ? `${file.width_px} × ${file.height_px} px` : null,
    file.colour_mode || null,
  ].filter(Boolean)

  const full = () => box.current?.requestFullscreen?.()

  const tool = 'w-10 h-10 rounded-xl bg-black/55 text-white flex items-center justify-center hover:bg-black/70'

  return (
    <div className="px-4 pb-4">
      <div ref={box}
        className="relative h-[46vh] bg-neutral-800 rounded-xl overflow-auto
          flex items-center justify-center">
        {isImage(file) && !failed ? (
          <img src={fileSrc(file)} alt={file.filename} onError={() => setFailed(true)}
            style={{ transform: `scale(${zoom}) rotate(${turn}deg)` }}
            className="max-h-full max-w-full object-contain transition-transform duration-200" />
        ) : isPdf(file) ? (
          <PdfFrame file={file} className="w-full h-full bg-white" />
        ) : (
          <button onClick={() => onOpenLarge(file)} className="text-center text-white/80">
            <div className="font-mono text-lg font-bold">{ext}</div>
            <div className="text-xs mt-1">Cannot be shown here — open it to check</div>
          </button>
        )}
        {isImage(file) && !failed && (
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <button className={tool} aria-label="Zoom in"
              onClick={() => setZoom(z => Math.min(4, z + 0.5))}><Icon d={I.zin} /></button>
            <button className={tool} aria-label="Zoom out"
              onClick={() => setZoom(z => Math.max(1, z - 0.5))}><Icon d={I.zout} /></button>
            <button className={tool} aria-label="Full screen" onClick={full}><Icon d={I.full} /></button>
            <button className={tool} aria-label="Rotate"
              onClick={() => setTurn(t => (t + 90) % 360)}><Icon d={I.rotate} /></button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--text)] truncate">{file.filename}</div>
          <div className="text-xs text-[var(--text-3)] mt-0.5">{facts.join(' · ') || 'Not measured'}</div>
        </div>
        <SmallButton icon={I.down} href={fileSrc(file)}>Download</SmallButton>
      </div>

      {files.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {files.map((f, i) => (
            <button key={f.id || i} onClick={() => setIndex(i)}
              aria-label={`Show ${f.filename}`}
              className={`w-20 h-16 rounded-lg overflow-hidden shrink-0 border-2 bg-[var(--bg)]
                flex items-center justify-center
                ${i === index ? 'border-blue-500' : 'border-transparent'}`}>
              {isImage(f)
                ? <img src={fileSrc(f)} alt="" className="w-full h-full object-cover" />
                : <span className="font-mono text-[10px] font-bold text-[var(--text-3)]">
                    {(f.filename || '').split('.').pop().toUpperCase()}
                  </span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Specifications ──────────────────────────────────────────────

// "width_in" reads as "Width (in)": the unit is part of the name.
function prettyKey(k) {
  if (k === 'paper_size') return 'Paper size'
  const m = k.match(/^(.*)_(in|mm|cm|ft|m)$/)
  const base = (m ? m[1] : k).replace(/_/g, ' ')
  const word = base.charAt(0).toUpperCase() + base.slice(1)
  return m ? `${word} (${m[2]})` : word
}

/**
 * A line's own width and height, if it has them. Every line carries a
 * paper_size that defaults to A4, so a 6 × 6 in banner also said "A4" —
 * two sizes, one of them false. When real dimensions exist they are the
 * size, and the paper size is not shown at all.
 */
function dimensionsOf(line) {
  const specs = line.specifications || {}
  for (const unit of ['in', 'ft', 'cm', 'mm', 'm']) {
    const w = specs[`width_${unit}`]
    const h = specs[`height_${unit}`]
    if (w !== undefined && w !== '' && h !== undefined && h !== '') {
      return { text: `${w} × ${h} ${unit}`, keys: [`width_${unit}`, `height_${unit}`] }
    }
  }
  return null
}

function specRows(line, addons = []) {
  const dims = dimensionsOf(line)
  const rows = [
    { label: 'Product', value: line.service_name || line.label },
    { label: 'Size',    value: dims ? dims.text : line.paper_size },
  ]
  const skip = new Set(dims ? dims.keys : [])
  for (const [k, v] of Object.entries(line.specifications || {})) {
    if (PRICED.has(k) || skip.has(k) || v === null || v === '' || v === undefined) continue
    rows.push({ label: prettyKey(k), value: String(v) })
  }
  rows.push({ label: 'Sides', value: line.sides === 'DOUBLE' ? 'Double-sided' : 'Single-sided' })
  rows.push({ label: 'Quantity', value: `${line.quantity}${line.pages > 1 ? ` × ${line.pages}pp` : ''}` })
  if (addons.length) {
    rows.push({ label: 'Add-ons', value: addons.map(addonText).join(', ') })
  }
  return rows
}

function SpecTable({ job, onSaved }) {
  // One block per piece; its add-ons are a row in it, not blocks of
  // their own with sizes and sides that mean nothing for an envelope.
  const lines = pieces(job)
  const [editing, setEditing] = useState(null)   // line id
  const [draft, setDraft] = useState({})
  const [said, setSaid] = useState('')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState('')

  const start = (line) => {
    const d = dimensionsOf(line) ? {} : { paper_size: line.paper_size || '' }
    for (const [k, v] of Object.entries(line.specifications || {})) {
      if (!PRICED.has(k)) d[k] = v ?? ''
    }
    setDraft(d); setSaid(''); setProblem(''); setEditing(line.id)
  }

  const save = async (line) => {
    const changes = {}
    if ('paper_size' in draft && (draft.paper_size || '') !== (line.paper_size || '')) {
      changes.paper_size = draft.paper_size
    }
    for (const [k, v] of Object.entries(line.specifications || {})) {
      if (!PRICED.has(k) && draft[k] !== undefined && String(draft[k]) !== String(v ?? '')) {
        changes[k] = draft[k]
      }
    }
    if (!Object.keys(changes).length) { setEditing(null); return }
    if (!said.trim()) { setProblem('Write what the customer agreed to on the call.'); return }
    setSaving(true); setProblem('')
    try {
      await changeSpecs(job.id, line.id, { changes, customer_response: said.trim() })
      setEditing(null)
      onSaved()
    } catch (e) {
      setProblem(e?.response?.data?.detail || 'Could not change the order.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 pb-3.5 space-y-2.5">
      {lines.map(line => {
        const open = editing === line.id
        return (
          <div key={line.id} className="border border-[var(--border)] rounded-xl overflow-hidden">
            {!open && (
              <div className="pl-3 pr-1.5 py-1.5 bg-[var(--bg)] text-xs font-semibold
                text-[var(--text-2)] flex items-center gap-2">
                <span className="flex-1 truncate">{line.label || line.service_name}</span>
                <SmallButton icon={I.pencil} onClick={() => start(line)} disabled={editing !== null}>
                  Edit
                </SmallButton>
              </div>
            )}
            {!open ? (
              <table className="w-full text-sm">
                <tbody>
                  {specRows(line, addonsOf(job, line)).map((r, i) => (
                    <tr key={i} className="border-t border-[var(--border)] first:border-t-0">
                      <td className="px-3 py-1.5 text-[var(--text-3)] w-[38%] align-top">{r.label}</td>
                      <td className="px-3 py-1.5 text-[var(--text)]">{r.value || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-3 space-y-2.5">
                {Object.keys(draft).map(k => (
                  <label key={k} className="block">
                    <span className="text-xs text-[var(--text-3)]">{prettyKey(k)}</span>
                    <input value={draft[k]} onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg
                        bg-[var(--panel)] outline-none focus:border-[var(--text-3)]" />
                  </label>
                ))}
                <p className="text-[11px] text-[var(--text-3)]">
                  Quantity and price cannot be changed here. A different quantity goes back through the counter.
                </p>
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--text)]">
                    What the customer agreed to on the call
                  </span>
                  <textarea rows={2} value={said} onChange={e => setSaid(e.target.value)}
                    placeholder="e.g. Customer agreed to A3 instead of A4, same price"
                    className="mt-1 w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg
                      bg-[var(--panel)] outline-none resize-none focus:border-[var(--text-3)]" />
                </label>
                {problem && <p role="alert" className="text-xs text-red-600 font-semibold">{problem}</p>}
                <div className="flex gap-2">
                  <button onClick={() => save(line)} disabled={saving}
                    className="min-h-[40px] px-4 text-sm font-bold bg-[var(--text)] text-white
                      rounded-lg disabled:opacity-40">
                    {saving ? 'Saving…' : 'Save change'}
                  </button>
                  <button onClick={() => setEditing(null)} disabled={saving}
                    className="min-h-[40px] px-4 text-sm font-semibold text-[var(--text-2)]">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── The modal ───────────────────────────────────────────────────

/**
 * job:         the job detail, with files, line items and spec_changes;
 *              may still be loading
 * row:         the job's queue row, which carries the promise and its flags
 * onHeartbeat: keeps the claim alive; the board closes the modal if refused
 * onClose:     closes and releases the claim
 * onClear:     ({ note, customer_contacted, customer_response }) => clear
 * onSuspend:   (outcome, note) => hold the job
 */
export default function InspectionModal({
  job, row, onHeartbeat, onClose, onClear, clearing, onSuspend, suspending,
}) {
  const queryClient = useQueryClient()
  const [checks, setChecks]   = useState({ dims: false, quantity: false, content: false })
  const [note, setNote]       = useState('')
  const [noting, setNoting]   = useState(false)
  const [preview, setPreview] = useState(null)
  const [holding, setHolding] = useState(false)
  const [copied, setCopied]   = useState(false)

  const jobId = job?.id

  useEffect(() => {
    if (!jobId) return undefined
    const timer = setInterval(() => onHeartbeat(jobId), HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [jobId, onHeartbeat])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !preview && !holding && !document.fullscreenElement) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, preview, holding])

  const source  = job || row || {}
  const files   = job?.files || []
  const changes = job?.spec_changes || []

  // What Octos can see for itself: the file is there and could be read.
  const fileOk = files.length > 0
    && files.every(f => f.metadata_state !== 'FAILED' && f.size_kb !== null)

  const approvalNeeded = changes.length > 0
  const lastChange = changes[changes.length - 1]

  const required = [
    fileOk, checks.dims, checks.quantity, checks.content,
    ...(approvalNeeded ? [true] : []),
  ]
  const remaining = required.filter(v => !v).length

  const promise = row?.promise
  const floor = job?.predicted?.ready_at
  const minsLeft = promise ? Math.round((new Date(promise) - Date.now()) / 60000) : null

  const payment = source.payment_state === 'SETTLED'
    ? { text: isOnline(source) ? 'Paid online' : 'Paid in full', cls: 'bg-emerald-50 text-emerald-700' }
    : source.payment_state === 'DEPOSIT_PAID'
      ? { text: 'Deposit paid', cls: 'bg-amber-50 text-amber-800' }
      : { text: 'Unpaid', cls: 'bg-red-50 text-red-700' }

  const words = job?.description && job.description.trim() !== (job.title || '').trim()
    ? job.description.trim() : null

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(source.job_number)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable; nothing to do */ }
  }

  const clear = () => {
    if (remaining > 0) return
    onClear({
      note,
      customer_contacted: approvalNeeded,
      customer_response:  changes.map(c => c.customer_response).filter(Boolean).join(' | '),
    })
  }

  const toggle = (key) => setChecks(c => ({ ...c, [key]: !c[key] }))

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-2 sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={`Inspecting ${source.job_number || ''}`}
        className="bg-[var(--bg)] rounded-2xl shadow-2xl w-full max-w-[1500px] max-h-[96vh]
          flex flex-col overflow-hidden">

        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex items-center gap-4 px-6 py-4 bg-[var(--panel)] border-b border-[var(--border)]">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[var(--text)]">Order review & pre-production check</h2>
            <p className="text-xs text-[var(--text-3)] mt-0.5">
              Review the artwork, check the details and confirm before clearing for production.
            </p>
          </div>
          <Chip className="bg-amber-100 text-amber-800">Inspecting</Chip>
          <button onClick={onClose} aria-label="Close and put back in the queue"
            className="w-10 h-10 flex items-center justify-center rounded-xl
              hover:bg-[var(--bg)] text-[var(--text-2)]">
            <Icon d={I.x} />
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4">
          {!job ? (
            <div className="h-[60vh] bg-[var(--panel)] rounded-2xl animate-pulse" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_380px] gap-4">

              {/* Order facts */}
              <section className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl px-5 py-4 self-start">
                <div className="text-[11px] font-semibold text-[var(--text-3)] tracking-wide">ORDER ID</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-lg font-bold text-[var(--text)] truncate">{job.job_number}</span>
                  <button onClick={copyId} aria-label="Copy order ID"
                    className="w-8 h-8 rounded-lg border border-[var(--border)] flex items-center
                      justify-center text-[var(--text-2)] shrink-0">
                    <Icon d={I.copy} size={14} />
                  </button>
                  {copied && <span className="text-[11px] text-emerald-700">Copied</span>}
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-sm text-[var(--text-2)]">{job.customer_name || 'Walk-in'}</span>
                  <ChannelChip channel={job.intake_channel} />
                </div>
                <div className="mt-2"><Chip>Arrived {waited(row?.created_at || job.created_at)} ago</Chip></div>

                <div className="mt-4">
                  <Fact icon={I.user} label="Customer">
                    {job.customer_name || 'Walk-in'}
                    {job.customer_phone && <span className="block text-xs text-[var(--text-3)]">{job.customer_phone}</span>}
                  </Fact>
                  <Fact icon={I.bag} label="Job type">{services(job)}</Fact>
                  <Fact icon={I.layers} label="Quantity">
                    {pieces(job).map(li => (
                      <span key={li.id} className="block">
                        {li.quantity} × {li.label || li.service_name}
                        {addonsOf(job, li).map(a => (
                          <span key={a.id} className="block text-xs text-[var(--text-3)]">
                            + {addonText(a)}
                          </span>
                        ))}
                      </span>
                    ))}
                  </Fact>
                  <Fact icon={I.wallet} label="Payment status">
                    <Chip className={payment.cls}>{payment.text}</Chip>
                  </Fact>
                  <Fact icon={I.note} label="Customer notes">
                    {words
                      ? <span className="italic text-[var(--text-2)]">{words}</span>
                      : <span className="text-[var(--text-3)]">—</span>}
                  </Fact>
                </div>
              </section>

              {/* Artwork */}
              <Panel icon={I.file} title="Artwork / file"
                action={files[0] && <SmallButton icon={I.ext} href={fileSrc(files[0])}>Open in new tab</SmallButton>}>
                <Viewer files={files} onOpenLarge={setPreview} />
              </Panel>

              {/* Specifications, checks, floor */}
              <div className="flex flex-col gap-3 min-w-0">
                <Panel icon={I.list} title="Order specifications">
                  <SpecTable job={job}
                    onSaved={() => queryClient.invalidateQueries({ queryKey: ['job-detail', job.id] })} />
                </Panel>

                <Panel icon={I.check} title="Pre-production checks">
                  <div className="px-4 pb-3.5 space-y-1.5">
                    <CheckRow on={fileOk} auto
                      detail={fileOk ? null : files.length ? 'A file could not be read' : 'No file attached'}>
                      File received and opens correctly
                    </CheckRow>
                    <CheckRow on={checks.dims} onToggle={() => toggle('dims')}>
                      Dimensions and material confirmed
                    </CheckRow>
                    <CheckRow on={checks.quantity} onToggle={() => toggle('quantity')}>
                      Quantity and finishing read correctly
                    </CheckRow>
                    <CheckRow on={checks.content} onToggle={() => toggle('content')}>
                      Content check: spelling, numbers, nothing cut off
                    </CheckRow>
                    {approvalNeeded && (
                      <CheckRow on auto
                        detail={`${lastChange.changed_by_name} · ${clockTime(lastChange.changed_at)} · “${lastChange.customer_response}”`}>
                        Customer approved the change by phone
                      </CheckRow>
                    )}
                  </div>
                </Panel>

                <Panel icon={I.clock} title="Floor information">
                  <div className="px-4 pb-3.5">
                    <div className="border border-[var(--border)] rounded-xl overflow-hidden text-sm">
                      <div className="flex items-center px-3 py-2">
                        <span className="text-[var(--text-3)] w-32">Floor says</span>
                        <span className="text-[var(--text)] flex-1">
                          {floor ? `${job.predicted.is_next_day ? 'tomorrow ' : ''}${clockTime(floor)}` : '—'}
                          {job.predicted?.confidence === 'estimated' &&
                            <span className="text-xs text-[var(--text-3)]"> (estimated)</span>}
                        </span>
                      </div>
                      <div className="flex items-center px-3 py-2 border-t border-[var(--border)]">
                        <span className="text-[var(--text-3)] w-32">Promised</span>
                        <span className="text-[var(--text)] flex-1">{promise ? dueTime(promise) : 'No promise yet'}</span>
                        {minsLeft !== null && (
                          <Chip className={minsLeft < 0 ? 'bg-red-50 text-red-700'
                            : row?.at_risk ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}>
                            {minsLeft < 0 ? `${-minsLeft} mins late` : `${minsLeft} mins left`}
                          </Chip>
                        )}
                      </div>
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="bg-[var(--panel)] border-t border-[var(--border)] px-6 py-4">
          {noting && (
            <input type="text" value={note} onChange={e => setNote(e.target.value)} autoFocus
              placeholder="Note for the floor"
              className="w-full mb-3 px-3 py-2.5 text-sm border border-[var(--border)] rounded-xl
                bg-[var(--panel)] outline-none focus:border-[var(--text-3)]" />
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <button onClick={clear} disabled={!job || clearing || remaining > 0}
                className="inline-flex items-center gap-2 min-h-[52px] px-7 text-sm font-bold
                  bg-emerald-600 text-white rounded-xl hover:opacity-90 disabled:opacity-40
                  transition-opacity">
                <Icon d={I.play} size={16} />
                {clearing ? 'Clearing…' : 'Clear for production'}
              </button>
              <div className="text-[11px] text-[var(--text-3)] mt-1">All required checks must be completed</div>
            </div>
            <button onClick={() => setHolding(true)} disabled={!job || clearing}
              className="inline-flex items-center gap-2 min-h-[48px] px-5 text-sm font-bold
                border border-[var(--border-dark)] rounded-xl text-[var(--text-2)]
                hover:border-[var(--text-3)] disabled:opacity-40">
              <Icon d={I.pause} size={16} /> Suspend
            </button>
            {job?.customer_phone && (
              <a href={`tel:${job.customer_phone}`}
                className="inline-flex items-center gap-2 min-h-[48px] px-5 text-sm font-bold
                  border border-[var(--border-dark)] rounded-xl text-[var(--text-2)]
                  hover:border-[var(--text-3)]">
                <Icon d={I.phone} size={16} /> Contact customer
              </a>
            )}
            <button onClick={() => setNoting(n => !n)}
              className="inline-flex items-center gap-2 min-h-[48px] px-5 text-sm font-bold
                border border-[var(--border-dark)] rounded-xl text-[var(--text-2)]
                hover:border-[var(--text-3)]">
              <Icon d={I.note} size={16} /> {note ? 'Edit note' : 'Add note'}
            </button>

            {job && (remaining > 0 ? (
              <div role="status" className="ml-auto flex items-start gap-3 bg-amber-50 border
                border-amber-200 rounded-xl px-4 py-3 max-w-sm">
                <span className="text-amber-600 mt-0.5"><Icon d={I.warn} size={20} /></span>
                <div>
                  <div className="text-sm font-bold text-amber-800">
                    {remaining} {remaining === 1 ? 'check' : 'checks'} remaining
                  </div>
                  <div className="text-xs text-amber-800/80">
                    {fileOk
                      ? 'Complete all pre-production checks before clearing for production.'
                      : 'The file is missing or unreadable. Suspend it and ask the customer for a new one.'}
                  </div>
                </div>
              </div>
            ) : (
              <div role="status" className="ml-auto flex items-center gap-2 bg-emerald-50 border
                border-emerald-200 rounded-xl px-4 py-3">
                <span className="text-emerald-700"><Icon d={<path d="M5 12l5 5L20 7" />} size={18} /></span>
                <span className="text-sm font-bold text-emerald-800">Ready to clear</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {preview && <FilePreviewModal file={preview} onClose={() => setPreview(null)} />}

      {holding && job && (
        <SuspendDialog job={job} busy={suspending}
          onClose={() => setHolding(false)}
          onSuspend={(outcome, n) => onSuspend(outcome, n)} />
      )}
    </div>,
    document.body
  )
}