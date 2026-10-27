// src/pages/operator/OperatorPortal.jsx
// The machine screen. Whoever is assigned to a machine sees its work in
// Octos's order: what is running, what comes next, and what waits behind.
// No prices, no customer contacts. Start, Done and Problem are theirs;
// the order is not.

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import {
  getOperatorQueue, startStep, finishStep, reportProblem, unlockStation, fileUrl,
} from '../../api/operator'

const IDLE_LOCK_MS = 30 * 60 * 1000
const LOCK_KEY = 'operator_locked'

// Meaning colours, from the operator spec.
const TONE = {
  blue:   { bg: '#dce8ff', border: '#a8c4ff', text: '#1a4fcc' },
  green:  { bg: '#d6f5e8', border: '#6ddba8', text: '#1a7a4a' },
  amber:  { bg: '#fff0c2', border: '#f5c842', text: '#b8860b' },
  orange: { bg: '#ffe4d0', border: '#ffb085', text: '#cc4400' },
  red:    { bg: '#fddde0', border: '#f5a0aa', text: '#cc1a2e' },
}

const PANEL  = 'bg-[var(--panel,#ffffff)] border border-[var(--border,#e8e5df)] rounded-xl'
const BTN    = 'rounded-lg border-[1.5px] border-[var(--border-dark,#d0cdc6)] bg-[var(--panel,#ffffff)] px-4 py-3 text-sm font-medium text-[var(--text,#1a1a1a)] disabled:opacity-50'
const BTN_PRIMARY = 'rounded-lg bg-[#1a1a1a] px-4 py-3 text-sm font-medium text-white disabled:opacity-50'

// ── Small pieces ─────────────────────────────────────────────

function Chip({ tone, children }) {
  const t = TONE[tone]
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-bold"
      style={{ background: t.bg, color: t.text, border: `1px solid ${t.border}` }}
    >
      {children}
    </span>
  )
}

function formatMinutes(m) {
  const a = Math.abs(Math.round(m))
  if (a >= 1440) {
    const d = Math.round(a / 1440)
    return `${d} day${d === 1 ? '' : 's'}`
  }
  const h = Math.floor(a / 60)
  const r = a % 60
  if (!h) return `${r} min`
  return r ? `${h} h ${r} min` : `${h} h`
}

function SlackChip({ minutes }) {
  if (minutes === null || minutes === undefined) return <Chip tone="blue">No promise yet</Chip>
  if (minutes <= 0) return <Chip tone="red">Late by {formatMinutes(minutes)}</Chip>
  return <Chip tone={minutes <= 60 ? 'amber' : 'green'}>{formatMinutes(minutes)} slack</Chip>
}

function readyLabel(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === new Date().toDateString()) return time
  return `${d.toLocaleDateString('en-GH', { weekday: 'short' })} ${time}`
}

function errorText(err, fallback) {
  return err?.response?.data?.detail || fallback
}

function specLine(row) {
  const parts = [`${row.quantity} pcs`]
  if (row.pages > 1) parts.push(`${row.pages} pages`)
  if (row.paper_size) parts.push(row.paper_size)
  if (row.is_color === true) parts.push('Colour')
  if (row.is_color === false) parts.push('Black and white')
  Object.entries(row.specifications || {}).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) parts.push(`${k.replace(/_/g, ' ')}: ${v}`)
  })
  return parts.join(' · ')
}

function Files({ files }) {
  if (!files?.length) {
    return <p className="text-xs text-[var(--text-3,#9a9690)]">No file on this job. Ask the coordinator.</p>
  }
  const [first, ...rest] = files
  return (
    <div className="flex flex-col gap-2">
      <a
        href={fileUrl(first.url)} target="_blank" rel="noreferrer"
        className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border,#e8e5df)] px-3 py-2"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{first.name}</span>
          <span className="text-xs text-[var(--text-3,#9a9690)]">Print file · {first.type.toLowerCase()}</span>
        </span>
        <span className={BTN_PRIMARY + ' px-3 py-2 text-xs'}>Open file</span>
      </a>
      {rest.map(f => (
        <a key={f.id} href={fileUrl(f.url)} target="_blank" rel="noreferrer"
           className="truncate text-xs text-[#1a4fcc] underline">
          {f.name} ({f.type.toLowerCase()})
        </a>
      ))}
    </div>
  )
}

function JobDetail({ row }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{row.job_number}</span>
            {row.is_reprint && <Chip tone="orange">Reprint</Chip>}
          </div>
          <div className="mt-0.5 text-lg font-bold">{row.title}</div>
          <div className="text-xs text-[var(--text-2,#555550)]">{specLine(row)}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px] text-[var(--text-3,#9a9690)]">Ready</div>
          <div className="mb-1 text-sm font-bold">{readyLabel(row.ready_at)}</div>
          <SlackChip minutes={row.slack_minutes} />
        </div>
      </div>
      {row.instructions && (
        <div className="rounded-lg bg-[var(--bg,#f2f0eb)] px-3 py-2 text-xs text-[var(--text-2,#555550)]">
          <span className="font-bold text-[var(--text,#1a1a1a)]">Instructions: </span>{row.instructions}
        </div>
      )}
      <Files files={row.files} />
    </div>
  )
}

// ── Done and Problem ─────────────────────────────────────────

function DoneForm({ row, onCancel, onFinished }) {
  const qc = useQueryClient()
  const [made, setMade] = useState(String(row.quantity))
  const [spoilt, setSpoilt] = useState('0')
  const [error, setError] = useState('')

  const done = useMutation({
    mutationFn: (payload) => finishStep(row.step, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operatorQueue'] })
      onFinished(`${made} made${Number(spoilt) > 0 ? `, ${spoilt} spoilt (waiting for the coordinator)` : ''}. Sent to finishing.`)
    },
    onError: (err) => setError(errorText(err, "Couldn't record that. Try again.")),
  })

  const submit = () => {
    const m = Number(made)
    const s = Number(spoilt)
    if (made === '' || spoilt === '' || !Number.isInteger(m) || !Number.isInteger(s) || m < 0 || s < 0) {
      setError('Enter how many were made and spoilt.')
      return
    }
    setError('')
    done.mutate({ made: m, spoilt: s })
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-[var(--bg,#f2f0eb)] p-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-[var(--text-2,#555550)]">
          Made (ordered {row.quantity})
          <input type="number" min="0" step="1" value={made}
                 onChange={e => { setMade(e.target.value); setError('') }}
                 className="mt-1 w-full rounded-lg border-[1.5px] border-[var(--border,#e8e5df)] bg-white px-3 py-2 text-base" />
        </label>
        <label className="text-xs text-[var(--text-2,#555550)]">
          Spoilt
          <input type="number" min="0" step="1" value={spoilt}
                 onChange={e => { setSpoilt(e.target.value); setError('') }}
                 className="mt-1 w-full rounded-lg border-[1.5px] border-[var(--border,#e8e5df)] bg-white px-3 py-2 text-base" />
        </label>
      </div>
      {Number(spoilt) > 0 && (
        <div className="rounded-lg px-3 py-2 text-xs"
             style={{ background: TONE.amber.bg, border: `1px solid ${TONE.amber.border}`, color: '#633806' }}>
          The coordinator will confirm the spoilt pieces before a reprint is queued.
        </div>
      )}
      {error && <p className="text-sm" style={{ color: TONE.red.text }}>{error}</p>}
      <div className="grid grid-cols-[1fr_1.4fr] gap-2">
        <button className={BTN} onClick={onCancel} disabled={done.isPending}>Back</button>
        <button className={BTN_PRIMARY} onClick={submit} disabled={done.isPending}>
          {done.isPending ? 'Sending…' : 'Send to finishing'}
        </button>
      </div>
    </div>
  )
}

const PROBLEMS = [
  { kind: 'MACHINE_DOWN', label: 'Machine down', hint: "The machine isn't working. The whole machine stops." },
  { kind: 'FILE_FAULT',   label: 'File fault',   hint: 'Something is wrong with the file. Only this job is set aside.' },
  { kind: 'MATERIAL_OUT', label: 'Material out', hint: "We're out of what this job needs. This job is set aside." },
]

function ProblemPicker({ row, onCancel, onReported }) {
  const qc = useQueryClient()
  const [kind, setKind] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const report = useMutation({
    mutationFn: (payload) => reportProblem(row.step, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operatorQueue'] })
      onReported(kind === 'MACHINE_DOWN'
        ? 'Machine reported down. The coordinator has been told, and Octos is recalculating its promises.'
        : `${row.job_number} is set aside for the coordinator. The next job is coming up.`)
    },
    onError: (err) => setError(errorText(err, "Couldn't report that. Try again.")),
  })

  const submit = () => {
    if (!kind) { setError('Choose what happened.'); return }
    setError('')
    report.mutate({ kind, note })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-bold">What happened?</div>
      {PROBLEMS.map(p => (
        <button key={p.kind} onClick={() => { setKind(p.kind); setError('') }}
                className={BTN + ' text-left'}
                style={kind === p.kind ? { borderColor: TONE.red.text, background: TONE.red.bg } : undefined}>
          <span className="block font-bold">{p.label}</span>
          <span className="text-xs font-normal text-[var(--text-2,#555550)]">{p.hint}</span>
        </button>
      ))}
      <input value={note} onChange={e => setNote(e.target.value)} maxLength={200}
             placeholder="Add a short note (optional)"
             className="rounded-lg border-[1.5px] border-[var(--border,#e8e5df)] bg-white px-3 py-2 text-sm" />
      {error && <p className="text-sm" style={{ color: TONE.red.text }}>{error}</p>}
      <div className="grid grid-cols-[1fr_1.4fr] gap-2">
        <button className={BTN} onClick={onCancel} disabled={report.isPending}>Cancel</button>
        <button className={BTN_PRIMARY} onClick={submit} disabled={report.isPending}>
          {report.isPending ? 'Reporting…' : 'Report problem'}
        </button>
      </div>
    </div>
  )
}

// ── One machine ──────────────────────────────────────────────

function MachineCard({ machine }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState('view')       // view | done | problem
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const start = useMutation({
    mutationFn: (stepId) => startStep(stepId),
    onSuccess: () => { setError(''); setMessage(''); qc.invalidateQueries({ queryKey: ['operatorQueue'] }) },
    onError: (err) => setError(errorText(err, "Couldn't start. Try again.")),
  })

  const finish = (text) => { setMode('view'); setMessage(text) }

  if (!machine.available) {
    return (
      <div className="rounded-xl p-4" style={{ background: TONE.red.bg, border: `1px solid ${TONE.red.border}` }}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-base font-bold" style={{ color: TONE.red.text }}>{machine.name} is down</div>
          <Chip tone="red">Waiting for repair</Chip>
        </div>
        <p className="mt-1 text-sm" style={{ color: '#791f1f' }}>
          {machine.down_reason || 'Reported down.'} The coordinator brings it back when it's fixed.
        </p>
      </div>
    )
  }

  const running = machine.running
  const next = machine.next

  return (
    <div className={PANEL + ' flex flex-col gap-3 p-4'}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-base font-bold">
          {running ? `Running on ${machine.name}` : next ? `Next on ${machine.name}` : machine.name}
        </div>
        {running?.started_at && (
          <Chip tone="blue">
            Started {new Date(running.started_at).toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' })}
          </Chip>
        )}
      </div>

      {message && (
        <div className="rounded-lg px-3 py-2 text-sm"
             style={{ background: TONE.green.bg, border: `1px solid ${TONE.green.border}`, color: TONE.green.text }}>
          {message}
        </div>
      )}

      {!running && !next && (
        <p className="text-sm text-[var(--text-3,#9a9690)]">Nothing is waiting for this machine.</p>
      )}

      {running && (
        <>
          <JobDetail row={running} />
          {mode === 'done' && <DoneForm row={running} onCancel={() => setMode('view')} onFinished={finish} />}
          {mode === 'problem' && <ProblemPicker row={running} onCancel={() => setMode('view')} onReported={finish} />}
          {mode === 'view' && (
            <div className="grid grid-cols-[1fr_1.4fr] gap-2">
              <button className={BTN} style={{ color: TONE.red.text, borderColor: TONE.red.border }}
                      onClick={() => { setMessage(''); setMode('problem') }}>
                Problem
              </button>
              <button className={BTN_PRIMARY} onClick={() => { setMessage(''); setMode('done') }}>
                Done
              </button>
            </div>
          )}
        </>
      )}

      {!running && next && (
        <>
          <JobDetail row={next} />
          <button className={BTN_PRIMARY + ' py-4 text-base'} disabled={start.isPending}
                  onClick={() => start.mutate(next.step)}>
            {start.isPending ? 'Starting…' : 'Start'}
          </button>
        </>
      )}

      {error && <p className="text-sm" style={{ color: TONE.red.text }}>{error}</p>}
    </div>
  )
}

// ── The queue behind ─────────────────────────────────────────

function QueueList({ rows, firstNumber }) {
  return (
    <div className={PANEL + ' overflow-hidden'}>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-bold">Queue</span>
        <span className="text-xs text-[var(--text-3,#9a9690)]">{rows.length} job{rows.length === 1 ? '' : 's'}</span>
      </div>
      {rows.length === 0 && (
        <p className="border-t border-[var(--border,#e8e5df)] px-4 py-3 text-xs text-[var(--text-3,#9a9690)]">
          Nothing else is waiting.
        </p>
      )}
      {rows.map((row, i) => (
        <div key={row.step} className="flex items-center gap-3 border-t border-[var(--border,#e8e5df)] px-4 py-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border,#e8e5df)] bg-[var(--bg,#f2f0eb)] text-[11px] font-bold">
            {firstNumber + i}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11.5px]">{row.job_number}</span>
              {row.is_reprint && <Chip tone="orange">Reprint</Chip>}
            </div>
            <div className="truncate text-[13px] font-medium">{row.title}</div>
            <div className="text-[11px] text-[var(--text-3,#9a9690)]">{row.quantity} pcs · {row.machine?.name}</div>
          </div>
          <SlackChip minutes={row.slack_minutes} />
        </div>
      ))}
      <p className="border-t border-[var(--border,#e8e5df)] px-4 py-2.5 text-[11px] text-[var(--text-3,#9a9690)]">
        The queue can't be reordered. A job that falls behind rises on its own.
      </p>
    </div>
  )
}

// ── Locked and not assigned ──────────────────────────────────

function LockScreen({ name, onUnlocked, onSignOut }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const unlock = useMutation({
    mutationFn: () => unlockStation(password),
    onSuccess: () => { setPassword(''); onUnlocked() },
    onError: (err) => setError(errorText(err, "That password isn't right.")),
  })

  const submit = (e) => {
    e.preventDefault()
    if (!password) { setError('Enter your password.'); return }
    setError('')
    unlock.mutate()
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <form onSubmit={submit} className={PANEL + ' flex w-full max-w-sm flex-col gap-3 p-6 text-center'}>
        <div className="text-xl font-bold">Machine locked</div>
        <div className="text-sm text-[var(--text-2,#555550)]">{name} · enter your password to continue</div>
        <input type="password" autoFocus value={password}
               onChange={e => { setPassword(e.target.value); setError('') }}
               className="rounded-lg border-[1.5px] border-[var(--border,#e8e5df)] bg-white px-3 py-3 text-base" />
        {error && <p className="text-sm" style={{ color: TONE.red.text }}>{error}</p>}
        <button type="submit" className={BTN_PRIMARY} disabled={unlock.isPending}>
          {unlock.isPending ? 'Checking…' : 'Unlock'}
        </button>
        <button type="button" onClick={onSignOut} className="text-xs text-[#1a4fcc] underline">
          Not you? Sign out
        </button>
      </form>
    </div>
  )
}

function NotAssigned({ onSignOut }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className={PANEL + ' max-w-sm p-6 text-center'}>
        <div className="text-lg font-bold">You're not assigned to a machine</div>
        <p className="mt-1 text-sm text-[var(--text-2,#555550)]">
          Ask your branch manager to assign you, then sign in again.
        </p>
        <button onClick={onSignOut} className={BTN + ' mt-4'}>Sign out</button>
      </div>
    </div>
  )
}

// ── The page ─────────────────────────────────────────────────

export default function OperatorPortal() {
  const { user, logout } = useAuth()
  const [locked, setLocked] = useState(() => localStorage.getItem(LOCK_KEY) === '1')
  const lastActive = useRef(Date.now())

  const { data: board, isLoading, error } = useQuery({
    queryKey: ['operatorQueue'],
    queryFn: () => getOperatorQueue().then(r => r.data),
    refetchInterval: 15_000,
    retry: (count, err) => err?.response?.status !== 403 && count < 1,
  })

  const anyRunning = !!board?.machines?.some(m => m.running)

  const lock = () => { localStorage.setItem(LOCK_KEY, '1'); setLocked(true) }
  const unlock = () => { localStorage.removeItem(LOCK_KEY); lastActive.current = Date.now(); setLocked(false) }
  const signOut = () => { localStorage.removeItem(LOCK_KEY); logout() }

  // Lock after 30 minutes idle, but never while a job is on a machine.
  useEffect(() => {
    const touch = () => { lastActive.current = Date.now() }
    window.addEventListener('pointerdown', touch)
    window.addEventListener('keydown', touch)
    const timer = setInterval(() => {
      if (!locked && !anyRunning && Date.now() - lastActive.current > IDLE_LOCK_MS) lock()
    }, 30_000)
    return () => {
      window.removeEventListener('pointerdown', touch)
      window.removeEventListener('keydown', touch)
      clearInterval(timer)
    }
  }, [locked, anyRunning])

  const notAssigned = error?.response?.status === 403
  const nextCount = board?.machines?.filter(m => m.next && !m.running).length || 0
  const machineNames = board?.machines?.map(m => m.name).join(' + ') || ''

  return (
    <div className="min-h-screen bg-[var(--bg,#f2f0eb)] text-[var(--text,#1a1a1a)]">
      <header className="flex h-14 items-center justify-between border-b border-[var(--border,#e8e5df)] bg-[var(--panel,#ffffff)] px-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-extrabold tracking-tight">Octos</span>
          <span className="h-6 w-px bg-[var(--border,#e8e5df)]" />
          <div className="leading-tight">
            <div className="text-[10px] font-bold tracking-wide">OPERATOR</div>
            <div className="text-[11px] text-[var(--text-2,#555550)]">
              {board ? `${board.branch} · ${machineNames}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a4fcc] text-[11px] font-bold text-white">
            {board?.operator?.initials || '–'}
          </span>
          <span className="hidden text-sm font-medium sm:inline">{board?.operator?.name || user?.email}</span>
          {!locked && !notAssigned && (
            <button className={BTN + ' px-3 py-1.5 text-xs'} onClick={lock}>Lock</button>
          )}
          <button className={BTN + ' px-3 py-1.5 text-xs'} onClick={signOut}>Sign out</button>
        </div>
      </header>

      {notAssigned && <NotAssigned onSignOut={signOut} />}

      {!notAssigned && locked && (
        <LockScreen name={board?.operator?.name || user?.email} onUnlocked={unlock} onSignOut={signOut} />
      )}

      {!notAssigned && !locked && isLoading && !board && (
        <div className="p-8 text-center text-sm text-[var(--text-3,#9a9690)]">Loading your machines…</div>
      )}

      {!notAssigned && !locked && error && !board && (
        <div className="p-8 text-center text-sm" style={{ color: TONE.red.text }}>
          {errorText(error, "Couldn't load your machines. Check the connection.")}
        </div>
      )}

      {!notAssigned && !locked && board && (
        <main className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-4">
            {board.machines.map(m => <MachineCard key={m.id} machine={m} />)}
          </div>
          <QueueList rows={board.queue} firstNumber={nextCount + 1} />
        </main>
      )}
    </div>
  )
}