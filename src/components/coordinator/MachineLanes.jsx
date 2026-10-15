// src/components/coordinator/MachineLanes.jsx
//
// The floor as lanes, one per machine. On the left, the machine: its
// colour, its icon, whether it is running, idle or down. In the middle,
// the job on it, with how far through its expected time it is and Done.
// On the right, the jobs waiting for it, each with how long until it is
// done counting everything ahead of it, and Move.
//
// Done is the coordinator's word for the technician's: the job is off
// that machine. Octos moves it to its next machine, or on towards
// Finishing, and brings the next job up.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { channelLabel, dueTime } from './shared'

// ── Colour and icon per kind of work ────────────────────────────

const LOOK = {
  LARGE_FORMAT: { tile: 'bg-blue-50',    icon: 'bg-blue-600',    soft: 'bg-blue-50 border-blue-200',       bar: 'bg-blue-600',    glyph: 'printer' },
  DIGITAL_PRESS:{ tile: 'bg-emerald-50', icon: 'bg-emerald-600', soft: 'bg-emerald-50 border-emerald-200', bar: 'bg-emerald-600', glyph: 'doc' },
  LAMINATE:     { tile: 'bg-violet-50',  icon: 'bg-violet-600',  soft: 'bg-violet-50 border-violet-200',   bar: 'bg-violet-600',  glyph: 'layers' },
  BIND:         { tile: 'bg-slate-100',  icon: 'bg-slate-600',   soft: 'bg-slate-50 border-slate-200',     bar: 'bg-slate-600',   glyph: 'book' },
  CUT:          { tile: 'bg-pink-50',    icon: 'bg-pink-600',    soft: 'bg-pink-50 border-pink-200',       bar: 'bg-pink-600',    glyph: 'cut' },
  BENCH:        { tile: 'bg-amber-50',   icon: 'bg-amber-500',   soft: 'bg-amber-50 border-amber-200',     bar: 'bg-amber-500',   glyph: 'hand' },
  DOWN:         { tile: 'bg-red-50',     icon: 'bg-red-600',     soft: 'bg-red-50 border-red-200',         bar: 'bg-red-600',     glyph: 'printer' },
}

function lookOf(machine) {
  if (!machine.is_available) return LOOK.DOWN
  if (machine.bench) return LOOK.BENCH
  const byType = (machine.type || '').toUpperCase()
  if (byType.includes('LARGE')) return LOOK.LARGE_FORMAT
  if (byType.includes('DIGITAL')) return LOOK.DIGITAL_PRESS
  return LOOK[machine.station] || LOOK.BIND
}

const PATHS = {
  printer: <><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>,
  doc:     <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
  layers:  <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  book:    <><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3Z" /><path d="M4 17a3 3 0 0 1 3-3h11" /></>,
  cut:     <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" /></>,
  hand:    <><path d="M8 13V5a2 2 0 0 1 4 0v6" /><path d="M12 11V4a2 2 0 0 1 4 0v7" /><path d="M16 9a2 2 0 0 1 4 0v5a8 8 0 0 1-8 8h-1a7 7 0 0 1-6-3l-2.5-4a2 2 0 0 1 3.4-2L8 15" /></>,
  check:   <path d="M5 12l5 5L20 7" />,
  play:    <path d="M7 4v16l13-8z" />,
  pause:   <><path d="M9 5v14M15 5v14" /></>,
  alert:   <><path d="M12 3 2 21h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></>,
  moon:    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  clock:   <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  swap:    <><path d="M7 7h13l-3-3M17 17H4l3 3" /></>,
  globe:   <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  chat:    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />,
  shop:    <><path d="M3 9 5 4h14l2 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></>,
  inbox:   <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z" /></>,
  help:    <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4M12 17h.01" /></>,
}

function Glyph({ name, size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={className}>
      {PATHS[name]}
    </svg>
  )
}

function channelGlyph(channel) {
  if (channel === 'ONLINE') return 'globe'
  if (channel === 'WHATSAPP') return 'chat'
  return 'shop'
}

// ── Pieces ──────────────────────────────────────────────────────

function Pill({ className, children }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5
      rounded-full whitespace-nowrap ${className}`}>
      {children}
    </span>
  )
}

function MachineTile({ machine, count }) {
  const look = lookOf(machine)
  const status = !machine.is_available
    ? { text: `Down${machine.reason ? ` · ${machine.reason}` : ''}`, glyph: 'alert', cls: 'text-red-700' }
    : count > 0
      ? { text: machine.bench ? 'Working' : 'Running', glyph: 'check', cls: 'text-emerald-700' }
      : { text: 'Idle', glyph: 'moon', cls: 'text-[var(--text-3)]' }

  return (
    <div className={`rounded-xl p-3 flex flex-col gap-2 ${look.tile}`}>
      <span className={`w-10 h-10 rounded-xl text-white flex items-center justify-center ${look.icon}`}>
        <Glyph name={machine.is_available ? look.glyph : 'alert'} size={20} />
      </span>
      <div className="text-sm font-bold text-[var(--text)] leading-tight">{machine.name}</div>
      <Pill className={`bg-[var(--panel)] ${status.cls}`}>
        <Glyph name={status.glyph} size={12} />{status.text}
      </Pill>
    </div>
  )
}

function progressOf(row) {
  if (!row.reached_at) return 0
  const elapsed = (Date.now() - new Date(row.reached_at)) / 60000
  const total = elapsed + (row.minutes_until_done || 0)
  return total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 0
}

function OnTheMachine({ row, machine, onDone, busy }) {
  const look = lookOf(machine)
  const halted = row.is_halted || !machine.is_available
  const tone = halted ? LOOK.DOWN : look

  return (
    <div className={`rounded-xl border px-4 py-3 flex flex-col gap-2 ${tone.soft}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Pill className={`text-white ${tone.icon}`}>
          <Glyph name={halted ? 'pause' : 'play'} size={11} />
          {halted ? 'Halted' : machine.bench ? 'On the bench' : 'On the machine'}
        </Pill>
        <Pill className="bg-[var(--panel)] text-[var(--text-2)]">
          <Glyph name={channelGlyph(row.intake_channel)} size={12} />{channelLabel(row.intake_channel)}
        </Pill>
        <span className="ml-auto font-mono text-[11px] text-[var(--text-3)]">{row.job_number}</span>
      </div>
      <div>
        <div className="text-sm font-bold text-[var(--text)] leading-snug">{row.line}</div>
        <div className={`text-xs ${row.late ? 'text-red-600 font-semibold' : row.at_risk ? 'text-amber-700 font-semibold' : 'text-[var(--text-2)]'}`}>
          {row.customer_name}
          {row.promise ? ` · due ${dueTime(row.promise)}` : ''}
          {row.late ? ' · late' : row.at_risk ? ' · at risk' : ''}
        </div>
      </div>
      {!halted && (
        <div className="h-1.5 rounded-full bg-[var(--panel)] overflow-hidden">
          <div className={`h-full ${tone.bar}`} style={{ width: `${progressOf(row)}%` }} />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--text-2)] inline-flex items-center gap-1">
          <Glyph name="clock" size={13} />
          {halted
            ? (machine.is_available ? 'Halted — resume it to carry on' : 'Waiting for this machine')
            : row.running_over ? 'Taking a little longer than usual' : `~${row.minutes_until_done} min left`}
        </span>
        {!halted && (
          <button onClick={() => onDone(row)} disabled={busy}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 text-sm font-bold
              bg-emerald-600 text-white rounded-xl hover:opacity-90 disabled:opacity-40">
            <Glyph name="check" size={15} />{busy ? 'Saving…' : 'Done'}
          </button>
        )}
      </div>
    </div>
  )
}

function Waiting({ row, position, onMove }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)]
      bg-[var(--panel)] px-3 py-2">
      <span className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center
        shrink-0 ${position === 2 ? 'bg-amber-100 text-amber-800' : 'bg-[var(--bg)] text-[var(--text-3)]'}`}>
        {position}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[var(--text)] truncate">{row.line}</div>
        <div className={`text-[11px] truncate inline-flex items-center gap-1
          ${row.late ? 'text-red-600' : row.at_risk ? 'text-amber-700' : 'text-[var(--text-3)]'}`}>
          <Glyph name={channelGlyph(row.intake_channel)} size={11} />
          {row.customer_name} · ~{row.minutes_until_done} min
        </div>
      </div>
      <button onClick={() => onMove(row)} aria-label={`Move ${row.job_number} to another machine`}
        className="w-9 h-9 rounded-lg border border-[var(--border)] flex items-center justify-center
          text-[var(--text-2)] hover:border-[var(--border-dark)] shrink-0">
        <Glyph name="swap" size={15} />
      </button>
    </div>
  )
}

function Empty({ children, wide }) {
  return (
    <div className={`rounded-xl border border-dashed border-[var(--border)] flex items-center
      justify-center gap-2 text-xs text-[var(--text-3)] px-4 py-6 ${wide ? 'md:col-span-2' : ''}`}>
      <Glyph name="inbox" size={15} />{children}
    </div>
  )
}

function Lane({ entry, busyStep, onDone, onMove }) {
  const { machine, queue } = entry
  const [first, ...rest] = queue
  const onIt = first && first.state === 'ACTIVE' ? first : null
  const waiting = onIt ? rest : queue

  return (
    <div className={`grid grid-cols-1 md:grid-cols-[170px_minmax(0,1.3fr)_minmax(0,1fr)] gap-3
      bg-[var(--panel)] border rounded-2xl p-3
      ${machine.is_available ? 'border-[var(--border)]' : 'border-red-300'}`}>
      <MachineTile machine={machine} count={queue.length} />

      {queue.length === 0 ? (
        <Empty wide>Nothing on it. Work for it lands here.</Empty>
      ) : (
        <>
          {onIt
            ? <OnTheMachine row={onIt} machine={machine} onDone={onDone} busy={busyStep === onIt.step} />
            : <Empty>{machine.is_available ? 'Starting the next job…' : 'Down'}</Empty>}
          <div className="flex flex-col gap-1.5">
            {waiting.length === 0
              ? <Empty>Nothing waiting</Empty>
              : waiting.map((row, i) => (
                  <Waiting key={row.step} row={row} position={i + (onIt ? 2 : 1)} onMove={onMove} />
                ))}
          </div>
        </>
      )}
    </div>
  )
}

function MovePicker({ row, choices, onPick, onClose, busy }) {
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="text-sm font-bold text-[var(--text)]">Move to another machine</div>
          <div className="text-xs text-[var(--text-3)] mt-0.5">{row.job_number} · {row.line}</div>
        </div>
        <div className="p-3 space-y-1.5">
          {choices.length === 0 ? (
            <p className="text-sm text-[var(--text-3)] px-2 py-3">
              No other machine that does this work is up right now.
            </p>
          ) : choices.map(m => {
            const look = lookOf(m)
            return (
              <button key={m.id} onClick={() => onPick(m.id)} disabled={busy}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-[var(--border)]
                  hover:border-[var(--border-dark)] disabled:opacity-40 text-left">
                <span className={`w-9 h-9 rounded-lg text-white flex items-center justify-center ${look.icon}`}>
                  <Glyph name={look.glyph} size={18} />
                </span>
                <span className="text-sm font-semibold text-[var(--text)]">{m.name}</span>
              </button>
            )
          })}
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end">
          <button onClick={onClose} className="text-sm font-semibold text-[var(--text-2)] px-3 py-2">
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/**
 * lanes:      floor entries for this stage: [{ machine, queue }]
 * unassigned: steps waiting for a machine to be chosen (press only)
 * allLanes:   every lane on the floor, to offer machines to move to
 * onDone:     (row) => mark the job on a machine done
 * onMove:     (row, machineId) => put a step on another machine
 * busyStep:   a step with a request in flight
 */
export default function MachineLanes({ lanes, unassigned = [], allLanes, onDone, onMove, busyStep }) {
  const [moving, setMoving] = useState(null)

  // Machines that do this step's work and are up, other than the one
  // it is already on. Width is checked by the server, which knows the
  // piece's size; a refusal comes back with the reason.
  const choicesFor = (row) => allLanes
    .filter(e => !e.machine.bench && e.machine.is_available && e.machine.station === row.station)
    .filter(e => !e.queue.some(q => q.step === row.step))
    .map(e => e.machine)

  return (
    <div className="space-y-3">
      {lanes.map(entry => (
        <Lane key={entry.machine.id ?? `bench-${entry.machine.station}`} entry={entry}
          busyStep={busyStep} onDone={onDone} onMove={setMoving} />
      ))}

      {unassigned.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
              <Glyph name="help" size={16} />
            </span>
            <span className="text-sm font-bold text-amber-800">
              {unassigned.length} waiting for a machine
            </span>
            <span className="text-xs text-amber-800/80">No machine that fits was up when it was cleared</span>
          </div>
          {unassigned.map(row => (
            <div key={row.step} className="flex items-center gap-3 bg-[var(--panel)] rounded-xl px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[var(--text)] truncate">{row.line}</div>
                <div className="text-[11px] text-[var(--text-3)]">{row.job_number} · {row.customer_name}</div>
              </div>
              <button onClick={() => setMoving(row)}
                className="min-h-[38px] px-4 text-sm font-bold bg-amber-500 text-white rounded-xl">
                Place
              </button>
            </div>
          ))}
        </div>
      )}

      {moving && (
        <MovePicker
          row={moving}
          choices={choicesFor(moving)}
          busy={busyStep === moving.step}
          onClose={() => setMoving(null)}
          onPick={(machineId) => { onMove(moving, machineId); setMoving(null) }}
        />
      )}
    </div>
  )
}