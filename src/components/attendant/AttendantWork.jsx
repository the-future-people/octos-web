// src/components/attendant/AttendantWork.jsx
// The Work tab (14 Nov 2026): front-desk jobs the attendants do themselves.
//
// Online orders for photocopies, printing, binding, passport photos and the
// rest of the instant work land here instead of with the coordinator. Each
// job goes: Take it → check (the file opened, the order matches) → Start →
// Done. Done tells the customer it's ready and puts it in Pickup.
//
// "Problem with this job" holds it while the customer is asked (message
// them from the Inbox), and Resume picks it up again. Only the attendant
// who took a job can move it; everyone sees who has what.

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LATE_MINUTES, clock, deskQuery, errorText, finishDeskJob, holdDeskJob,
  minutesSince, openDeskFile, resumeDeskJob, startDeskJob, takeDeskJob,
} from '../../api/desk'

const CHECK_TEXT = {
  file_opened:   'I opened the file and it looks right',
  order_matches: 'What was ordered matches what was paid for',
}

function useDeskAction(fn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['deskQueue'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

function PromiseTime({ iso }) {
  if (!iso) return null
  const late = new Date(iso).getTime() < Date.now()
  return (
    <div className="text-right shrink-0">
      <div className="text-[10px] font-bold tracking-wider text-[var(--text-3)]">PROMISED</div>
      <div className={`text-[14px] font-black ${late ? 'text-[#B42318]' : 'text-[var(--text)]'}`}>
        {clock(iso)}{late ? ' · late' : ''}
      </div>
    </div>
  )
}

function Lines({ lines }) {
  return (
    <ul className="rounded-xl bg-[var(--bg)] divide-y divide-[var(--border)]">
      {lines.map((line, i) => {
        const specs = Object.entries(line.specs || {})
          .filter(([k, v]) => v !== '' && v !== null && typeof v !== 'object' && k !== 'pages')
          .map(([, v]) => String(v))
        return (
          <li key={i} className={`px-3 py-2 text-[13px] ${line.addon ? 'pl-7' : ''}`}>
            <div className="flex items-center justify-between gap-3">
              <span className={`min-w-0 truncate ${line.addon ? 'text-[var(--text-2)]' : 'font-semibold text-[var(--text)]'}`}>
                {line.addon ? '+ ' : ''}{line.name}
              </span>
              <span className="shrink-0 text-[var(--text-3)]">
                {line.quantity > 1 ? `× ${line.quantity}` : ''}{line.pages > 1 ? ` · ${line.pages} pages` : ''}
              </span>
            </div>
            {specs.length > 0 && <div className="text-[11.5px] text-[var(--text-3)] mt-0.5">{specs.join(' · ')}</div>}
          </li>
        )
      })}
    </ul>
  )
}

function Files({ files }) {
  if (!files.length) return <div className="text-[12px] text-[var(--text-3)]">No file with this order.</div>
  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map(f => (
        <button key={f.id} type="button" onClick={() => openDeskFile(f)}
          className="h-8 px-3 rounded-lg bg-[#16181D] text-white text-[12px] font-semibold max-w-full truncate">
          Open {f.name}{f.pages ? ` · ${f.pages} p` : ''}
        </button>
      ))}
    </div>
  )
}

function Button({ children, onClick, disabled, kind = 'dark' }) {
  const look = {
    dark:  'bg-[#16181D] text-white hover:bg-black',
    light: 'bg-white border border-[var(--border)] text-[var(--text)] hover:border-[var(--text)]',
    green: 'bg-[#067647] text-white hover:bg-[#05603A]',
  }[kind]
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`h-10 px-4 rounded-xl text-[13px] font-bold disabled:opacity-40 transition-colors ${look}`}>
      {children}
    </button>
  )
}

// ── One of my jobs: check → start → done, or held ─────────────────
function MyJob({ job, checks, problems }) {
  const [ticked, setTicked] = useState({})
  const [reporting, setReporting] = useState(false)
  const [outcome, setOutcome] = useState(problems[0]?.value || '')
  const [note, setNote] = useState('')
  const start  = useDeskAction(() => startDeskJob(job.id, checks.filter(c => ticked[c])))
  const finish = useDeskAction(() => finishDeskJob(job.id))
  const hold   = useDeskAction(() => holdDeskJob(job.id, outcome, note))
  const resume = useDeskAction(() => resumeDeskJob(job.id))
  const failed = [start, finish, hold, resume].find(m => m.isError)
  const busy = [start, finish, hold, resume].some(m => m.isPending)

  const allTicked = checks.every(c => ticked[c])
  const stage = job.held ? 'held' : job.work_state === 'IN_PRODUCTION' ? 'doing' : 'check'
  const label = { held: 'HELD · WAITING ON THE CUSTOMER', doing: 'DOING IT', check: 'CHECK IT FIRST' }[stage]
  const labelTone = { held: 'text-[#B54708]', doing: 'text-[#067647]', check: 'text-[var(--text-3)]' }[stage]

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className={`text-[10.5px] font-black tracking-wider ${labelTone}`}>{label}</div>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-black text-[var(--text)] leading-snug">{job.title}</h3>
          <div className="text-[12px] text-[var(--text-3)]">
            {job.job_number} · {job.customer}{job.phone ? ` · ${job.phone}` : ''} · {job.source}
          </div>
        </div>
        <PromiseTime iso={job.promise} />
      </div>

      <div className="mt-3"><Lines lines={job.lines} /></div>
      <div className="mt-3"><Files files={job.files} /></div>

      {stage === 'check' && !reporting && (
        <div className="mt-4 space-y-2">
          {checks.map(c => (
            <label key={c} className="flex items-center gap-2.5 text-[13px] text-[var(--text)] cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-[#16181D]" checked={!!ticked[c]}
                onChange={e => setTicked(t => ({ ...t, [c]: e.target.checked }))} />
              {CHECK_TEXT[c] || c.replace('_', ' ')}
            </label>
          ))}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={() => start.mutate()} disabled={!allTicked || busy}>
              {start.isPending ? 'Starting…' : 'Start'}
            </Button>
            <Button kind="light" onClick={() => setReporting(true)} disabled={busy}>Problem with this job</Button>
          </div>
        </div>
      )}

      {stage === 'doing' && !reporting && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button kind="green" onClick={() => finish.mutate()} disabled={busy}>
            {finish.isPending ? 'Finishing…' : 'Done: tell the customer'}
          </Button>
          <Button kind="light" onClick={() => setReporting(true)} disabled={busy}>Problem with this job</Button>
        </div>
      )}

      {reporting && (
        <div className="mt-4 rounded-xl border border-[var(--border)] p-3 space-y-2">
          <div className="text-[12.5px] font-bold text-[var(--text)]">What's wrong?</div>
          <select value={outcome} onChange={e => setOutcome(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[13px]">
            {problems.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="What you found, in a few words (the BM and the next person will read this)"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[13px]" />
          <div className="text-[11.5px] text-[var(--text-3)]">
            The job is held until you resume it. Message the customer from the Inbox.
          </div>
          <div className="flex gap-2">
            <Button onClick={() => hold.mutate(undefined, { onSuccess: () => setReporting(false) })}
              disabled={!outcome || !note.trim() || busy}>
              {hold.isPending ? 'Holding…' : 'Hold it'}
            </Button>
            <Button kind="light" onClick={() => setReporting(false)} disabled={busy}>Back</Button>
          </div>
        </div>
      )}

      {stage === 'held' && (
        <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5">
          <div className="text-[12.5px] font-bold text-amber-900">
            {(problems.find(p => p.value === job.held.finding) || {}).label || 'Held'}
          </div>
          {job.held.note && <div className="text-[12.5px] text-amber-900 mt-0.5">{job.held.note}</div>}
          <div className="mt-2">
            <Button onClick={() => resume.mutate()} disabled={busy}>
              {resume.isPending ? 'Resuming…' : 'The customer answered: resume'}
            </Button>
          </div>
        </div>
      )}

      {failed && (
        <div className="mt-3 rounded-lg bg-red-50 text-red-800 text-[12.5px] font-semibold px-3 py-2">
          {errorText(failed.error, 'That did not go through. Try again.')}
        </div>
      )}
    </article>
  )
}

// ── Waiting: nobody has taken it ──────────────────────────────────
function WaitingRow({ job }) {
  const take = useDeskAction(() => takeDeskJob(job.id))
  const waited = minutesSince(job.landed_at)
  const late = waited >= LATE_MINUTES
  return (
    <li className={`flex items-center gap-3 rounded-xl border px-3 py-2.5
      ${late ? 'border-[#FDA29B] bg-[#FEF3F2]' : 'border-[var(--border)] bg-[var(--panel)]'}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold text-[var(--text)] truncate">{job.title}</div>
        <div className="text-[11.5px] text-[var(--text-3)] truncate">
          {job.job_number} · {job.customer} · {waited < 1 ? 'just now' : `waiting ${waited} min`}
          {job.promise ? ` · promised ${clock(job.promise)}` : ''}
        </div>
        {take.isError && <div className="text-[11.5px] font-semibold text-red-700">{errorText(take.error, 'Could not take it.')}</div>}
      </div>
      <Button onClick={() => take.mutate()} disabled={take.isPending}>{take.isPending ? 'Taking…' : 'Take it'}</Button>
    </li>
  )
}

export default function AttendantWork() {
  const { data, isLoading } = useQuery(deskQuery)
  const jobs = data?.jobs || []
  const checks = data?.checks || []
  const problems = data?.problems || []
  const waiting = jobs.filter(j => !j.taken_by)
  const mine = jobs.filter(j => j.taken_is_me)
  const others = jobs.filter(j => j.taken_by && !j.taken_is_me)

  return (
    <div className="px-4 sm:px-6 py-5 max-w-3xl">
      <div className="mb-4">
        <h1 className="text-[20px] font-black text-[var(--text)]">Work</h1>
        <p className="text-[12.5px] text-[var(--text-3)]">
          Front-desk jobs from Print Octos and WhatsApp: photocopies, printing, binding, passport photos and the like.
        </p>
      </div>

      {isLoading && <div className="text-[13px] text-[var(--text-3)]">Loading…</div>}

      {!isLoading && jobs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--border)] px-5 py-8 text-center">
          <div className="text-[14px] font-bold text-[var(--text)]">Nothing waiting</div>
          <div className="text-[12.5px] text-[var(--text-3)] mt-1">
            When a front-desk order comes in, you'll hear it and see it here.
          </div>
        </div>
      )}

      {waiting.length > 0 && (
        <section className="mb-6">
          <div className="text-[10.5px] font-black tracking-wider text-[var(--text-3)] mb-2">WAITING · {waiting.length}</div>
          <ul className="space-y-2">{waiting.map(j => <WaitingRow key={j.id} job={j} />)}</ul>
        </section>
      )}

      {mine.length > 0 && (
        <section className="mb-6">
          <div className="text-[10.5px] font-black tracking-wider text-[var(--text-3)] mb-2">MINE · {mine.length}</div>
          <div className="space-y-3">
            {mine.map(j => <MyJob key={j.id} job={j} checks={checks} problems={problems} />)}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <div className="text-[10.5px] font-black tracking-wider text-[var(--text-3)] mb-2">WITH OTHERS · {others.length}</div>
          <ul className="space-y-1.5">
            {others.map(j => (
              <li key={j.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg)] px-3 py-2 text-[12.5px]">
                <span className="min-w-0 truncate text-[var(--text)]">
                  <span className="font-semibold">{j.title}</span> · {j.job_number}
                </span>
                <span className="shrink-0 text-[var(--text-3)]">
                  {j.taken_by} · {j.held ? 'held' : j.work_state === 'IN_PRODUCTION' ? 'doing it' : 'checking'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
