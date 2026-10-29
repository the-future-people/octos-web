// src/components/coordinator/InspectionModal.jsx
//
// Can this file be printed as ordered? One question, one screen.
//
// Octos compares what was ordered with what the file measures, row by row,
// and marks each one; nobody ticks a box for what a machine can check. A
// row that needs attention brings its ways out: settle it, or hold and ask
// the customer. Two things only a person can judge are signed: the text,
// and the edges (with the margins drawn over the artwork). Clear counts
// what is left and the server refuses until nothing is.
//
// Nothing repeats, and nothing about money: every job here is paid.
//
// While open, the claim is kept alive every two minutes so nobody else
// can take this job. Closing releases it.

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { getIntakeCheck } from '../../api/coordinator'
import { ChannelChip, PdfFrame, SuspendDialog, fileSrc, isImage, isPdf } from './shared'

const HEARTBEAT_MS = 2 * 60 * 1000

const TONE = {
  amber: { bg: 'var(--amber-bg, #fff0c2)', border: 'var(--amber-border, #f5c842)', text: 'var(--amber-text, #b8860b)' },
  green: { bg: 'var(--green-bg, #d6f5e8)', border: 'var(--green-border, #6ddba8)', text: 'var(--green-text, #1a7a4a)' },
  red:   { bg: 'var(--red-bg, #fddde0)',   border: 'var(--red-border, #f5a0aa)',   text: 'var(--red-text, #cc1a2e)' },
}

const BTN = 'rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--panel)] px-3.5 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg)] transition-colors disabled:opacity-50'
const BTN_SMALL = 'rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[var(--bg)]'

// ── Small pieces ─────────────────────────────────────────────

function Pill({ tone, children }) {
  const t = TONE[tone]
  return (
    <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold"
          style={{ background: t.bg, color: t.text, border: `1px solid ${t.border}` }}>
      {children}
    </span>
  )
}

function ago(iso) {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function readyBy(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === new Date().toDateString()) return `${time} today`
  return `${d.toLocaleDateString('en-GH', { weekday: 'short' })} ${time}`
}

function clock() {
  return new Date().toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' })
}

// ── The artwork, with the margins drawn over it ──────────────

function Artwork({ piece }) {
  const [zoom, setZoom] = useState(1)
  const [margins, setMargins] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!piece.file) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-[var(--bg)] text-sm text-[var(--text-3)]">
        No file for this piece
      </div>
    )
  }

  const file = { url: piece.file.url, filename: piece.file.name, content_type: piece.file.content_type }
  const short = piece.ordered_mm?.[0]
  const inset = short ? Math.min(40, (piece.rules.safe_mm / short) * 100) : null
  const eyelets = (piece.finishing || []).some(f => /eyelet/i.test(f))

  return (
    <div>
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-[#26221f]">
        {isImage(file) && !failed ? (
          <div className="relative inline-block max-h-full max-w-full transition-transform duration-200"
               style={{ transform: `scale(${zoom})` }}>
            <img src={fileSrc(file)} alt={file.filename} onError={() => setFailed(true)}
                 className="block max-h-[min(60vh,520px)] max-w-full object-contain" />
            {margins && inset !== null && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute border-[1.5px] border-dashed"
                     style={{ inset: `${inset}%`, borderColor: '#6ddba8' }} />
                <span className="absolute text-[10px] font-bold"
                      style={{ top: `calc(${inset}% + 2px)`, left: `calc(${inset}% + 4px)`, color: '#6ddba8' }}>
                  safe area · {piece.rules.safe_mm} mm
                </span>
                {eyelets && ['top-[3%] left-[3%]', 'top-[3%] right-[3%]', 'bottom-[3%] left-[3%]', 'bottom-[3%] right-[3%]'].map(pos => (
                  <span key={pos} className={`absolute h-2.5 w-2.5 rounded-full border-2 border-white ${pos}`} />
                ))}
              </div>
            )}
          </div>
        ) : isPdf(file) ? (
          <PdfFrame file={file} className="h-full w-full bg-white" />
        ) : (
          <a href={fileSrc(file)} target="_blank" rel="noreferrer" className="text-center text-sm text-white/80 underline">
            Open {file.filename}
          </a>
        )}

        {isImage(file) && !failed && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-white px-3 py-1.5 text-xs text-[#1a1a1a] shadow">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} aria-label="Zoom out">−</button>
            <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} aria-label="Zoom in">+</button>
            {inset !== null && (
              <>
                <span className="h-3.5 w-px bg-[#e8e5df]" />
                <button onClick={() => setMargins(m => !m)} className={margins ? 'font-bold' : ''}>
                  Margins
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-[var(--text)]">{file.filename}</div>
          <div className="text-[11px] text-[var(--text-3)]">
            {piece.file.size_bytes ? `${(piece.file.size_bytes / 1048576).toFixed(1)} MB` : ''}
            {piece.file.content_type ? ` · ${piece.file.content_type.split('/').pop().toUpperCase()}` : ''}
          </div>
        </div>
        <a href={fileSrc(file)} target="_blank" rel="noreferrer" className={BTN_SMALL}>Open</a>
      </div>
    </div>
  )
}

// ── Ordered vs file ──────────────────────────────────────────

function Row({ piece, row, settledAs, settlements, onSettle, onHold }) {
  const needs = row.status === 'warn' || row.status === 'none'
  const done = needs && settledAs
  const amber = needs && !done

  return (
    <div className="border-t border-[var(--border)] py-2"
         style={amber ? { background: TONE.amber.bg, border: `1px solid ${TONE.amber.border}`, borderRadius: 8, margin: '4px -8px', padding: '8px' } : undefined}>
      <div className="grid grid-cols-[76px_minmax(0,1fr)_minmax(0,1fr)_18px] items-start gap-2 text-[13px]">
        <span className="text-xs" style={{ color: amber ? TONE.amber.text : 'var(--text-2)', fontWeight: amber ? 700 : 400 }}>
          {row.label}
        </span>
        <span className="text-[var(--text)]">{row.ordered}</span>
        <span className="text-[var(--text)]" style={amber ? { fontWeight: 700 } : undefined}>
          {row.file}
          {done && <span className="block text-[11px]" style={{ color: TONE.green.text }}>{settlements[settledAs]}</span>}
        </span>
        <span aria-hidden="true" style={{ color: amber ? TONE.amber.text : row.status === 'sign' ? 'var(--text-3)' : TONE.green.text }}>
          {row.status === 'ok' || done ? '✓' : row.status === 'sign' ? '✎' : amber ? '!' : ''}
        </span>
      </div>

      {amber && (
        <div className="mt-2">
          {row.note && <div className="mb-1.5 text-xs" style={{ color: TONE.amber.text }}>{row.note}</div>}
          <div className="flex flex-wrap gap-1.5">
            {row.fixes.map(code => (
              <button key={code} className={BTN_SMALL} onClick={() => onSettle(`${piece.line}:${row.key}`, code)}>
                {settlements[code]}
              </button>
            ))}
            <button className={BTN_SMALL} onClick={onHold}>Hold and ask the customer</button>
          </div>
          {row.fixes.length === 0 && (
            <div className="mt-1.5 text-[11px]" style={{ color: TONE.amber.text }}>
              This can only be held: there is no safe way to print it as it is.
            </div>
          )}
        </div>
      )}

      {done && (
        <button className="mt-1 text-[11px] text-[var(--text-3)] underline" onClick={() => onSettle(`${piece.line}:${row.key}`, null)}>
          Undo
        </button>
      )}
    </div>
  )
}

function SignBox({ label, hint, signed, name, onToggle }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border-[1.5px] px-3 py-2.5 text-[13px]"
           style={signed ? { borderColor: TONE.green.border, background: TONE.green.bg } : { borderColor: 'var(--border)' }}>
      <input type="checkbox" checked={!!signed} onChange={onToggle} className="mt-0.5 h-4 w-4" />
      <span>
        <span className="block font-bold text-[var(--text)]">{label}</span>
        <span className="text-xs text-[var(--text-2)]">{signed ? `Signed by ${name} · ${signed}` : hint}</span>
      </span>
    </label>
  )
}

const SIGN_HINTS = {
  TEXT: 'Names, dates, numbers and spelling.',
  EDGES: 'With Margins on: nothing important under the cut or the eyelets.',
}
const SIGN_LABELS = { TEXT: 'Text read', EDGES: 'Edges checked' }

// ── The modal ────────────────────────────────────────────────

/**
 * job:         the job being inspected (its id is what matters)
 * row:         the board's row for it, as a fallback for the id
 * onHeartbeat: keeps the claim alive; the board closes the modal if refused
 * onClose:     closes and releases the claim
 * onClear:     ({ signed_checks, settlements }) => clear
 * onSuspend:   (outcome, note) => hold the job
 */
export default function InspectionModal({
  job, row, onHeartbeat, onClose, onClear, clearing, onSuspend, suspending,
}) {
  const { user } = useAuth()
  const jobId = job?.id ?? row?.job
  const [settled, setSettled] = useState({})
  const [signed, setSigned] = useState({})
  const [active, setActive] = useState(0)
  const [holding, setHolding] = useState(false)
  const [error, setError] = useState('')

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['intakeCheck', jobId],
    queryFn: () => getIntakeCheck(jobId).then(r => r.data),
    enabled: !!jobId,
  })

  useEffect(() => {
    if (!jobId) return
    const timer = setInterval(() => onHeartbeat(jobId), HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [jobId, onHeartbeat])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !holding) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, holding])

  const pieces = data?.pieces || []
  const piece = pieces[active]
  const name = user?.first_name || user?.full_name || 'you'

  const left = useMemo(() => {
    const out = []
    pieces.forEach(p => p.rows.forEach(r => {
      if ((r.status === 'warn' || r.status === 'none') && !settled[`${p.line}:${r.key}`]) {
        out.push(`settle ${r.label.toLowerCase()}${pieces.length > 1 ? ` on ${p.product}` : ''}`)
      }
    }))
    if (!signed.TEXT) out.push('read the text')
    if (!signed.EDGES) out.push('check the edges')
    return out
  }, [pieces, settled, signed])

  const settle = (key, code) => {
    setError('')
    setSettled(s => {
      const next = { ...s }
      if (code) next[key] = code
      else delete next[key]
      return next
    })
  }
  const toggleSign = (key) => {
    setError('')
    setSigned(s => ({ ...s, [key]: s[key] ? null : clock() }))
  }

  const clear = () => {
    if (left.length) { setError(`First ${left.join(', ')}.`); return }
    onClear({
      signed_checks: Object.keys(signed).filter(k => signed[k]),
      settlements: settled,
    })
  }

  const header = data?.job
  const n = left.length

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[94vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">

        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[15px] font-semibold text-[var(--text)]">{header?.job_number || '…'}</span>
              {data && (n ? <Pill tone="amber">{n} check{n === 1 ? '' : 's'} left</Pill> : <Pill tone="green">Ready to clear</Pill>)}
              {header?.channel && <ChannelChip channel={header.channel} />}
            </div>
            {header && (
              <div className="mt-0.5 text-xs text-[var(--text-2)]">
                {header.customer} · arrived {ago(header.arrived_at)}{header.ready_by ? ` · ready by ${readyBy(header.ready_by)}` : ''}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-lg text-[var(--text-2)] hover:bg-[var(--bg)]">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading && <div className="py-16 text-center text-sm text-[var(--text-3)]">Comparing the order with the file…</div>}
          {loadError && (
            <div className="py-16 text-center text-sm" style={{ color: TONE.red.text }}>
              {loadError?.response?.data?.detail || "Couldn't load the check. Close and open it again."}
            </div>
          )}

          {data && pieces.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {pieces.map((p, i) => (
                <button key={p.line} onClick={() => setActive(i)}
                        className={`${BTN_SMALL} ${i === active ? '!bg-[var(--text)] !text-[var(--panel)]' : ''}`}>
                  {p.product}
                </button>
              ))}
            </div>
          )}

          {piece && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              <Artwork key={piece.line} piece={piece} />

              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-lg font-bold text-[var(--text)]">{piece.product}</span>
                  <span className="text-xs text-[var(--text-3)]">
                    {piece.quantity} {piece.quantity === 1 ? 'pc' : 'pcs'}
                    {piece.finishing?.length ? ` · ${piece.finishing.join(', ')}` : ''}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-[76px_minmax(0,1fr)_minmax(0,1fr)_18px] gap-2 text-[11px] text-[var(--text-3)]">
                  <span /><span>Ordered / needed</span><span>File</span><span />
                </div>
                {piece.rows.map(r => (
                  <Row key={r.key} piece={piece} row={r}
                       settledAs={settled[`${piece.line}:${r.key}`]}
                       settlements={data.settlements}
                       onSettle={settle} onHold={() => setHolding(true)} />
                ))}

                <div className="mt-4 mb-1.5 text-[11px] text-[var(--text-3)]">You sign these two:</div>
                <div className="flex flex-col gap-1.5">
                  {['TEXT', 'EDGES'].map(k => (
                    <SignBox key={k} label={SIGN_LABELS[k]} hint={SIGN_HINTS[k]}
                             signed={signed[k]} name={name} onToggle={() => toggleSign(k)} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
          <p className="m-0 text-[13px]" style={{ color: TONE.red.text }}>{error}</p>
          <div className="ml-auto flex gap-2">
            <button className={BTN} onClick={() => setHolding(true)} disabled={!job}>Hold and contact</button>
            <button onClick={clear} disabled={clearing || !data}
                    className={n
                      ? 'rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--text-2)]'
                      : 'rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-[var(--panel)] hover:opacity-90 disabled:opacity-50'}>
              {clearing ? 'Clearing…' : n ? `Clear · ${n} check${n === 1 ? '' : 's'} left` : 'Clear for production'}
            </button>
          </div>
        </div>
      </div>

      {holding && job && (
        <SuspendDialog job={job} busy={suspending}
          onClose={() => setHolding(false)}
          onSuspend={(outcome, note) => onSuspend(outcome, note)} />
      )}
    </div>,
    document.body,
  )
}