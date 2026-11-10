// src/components/hr/Vacancies.jsx
// HR's vacancies: the list on the left, the editor on the right.
// Everything under "Shown on the careers page" is public, word for word.
// base_salary is never edited here and never public; pay shows only as
// HR writes it in pay_text, and a blank pay_text reads "Discussed at interview".

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getVacancies, createVacancy, updateVacancy,
  getBranchOptions, getRoleOptions, careersUrl,
} from '../../api/hr'

// Same look as the other portals
const TONE = {
  blue:  { bg: 'var(--blue-bg, #dce8ff)',  border: 'var(--blue-border, #a8c4ff)',  text: 'var(--blue-text, #1a4fcc)' },
  green: { bg: 'var(--green-bg, #d6f5e8)', border: 'var(--green-border, #6ddba8)', text: 'var(--green-text, #1a7a4a)' },
  amber: { bg: 'var(--amber-bg, #fff0c2)', border: 'var(--amber-border, #f5c842)', text: 'var(--amber-text, #b8860b)' },
  red:   { bg: 'var(--red-bg, #fddde0)',   border: 'var(--red-border, #f5a0aa)',   text: 'var(--red-text, #cc1a2e)' },
  gray:  { bg: 'var(--bg)',                border: 'var(--border)',                text: 'var(--text-2)' },
}
const PANEL = 'bg-[var(--panel)] border border-[var(--border)] rounded-xl'
const BTN = 'rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--panel)] px-3.5 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg)] transition-colors disabled:opacity-50'
const BTN_PRIMARY = 'rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-[var(--panel)] hover:opacity-90 transition-opacity disabled:opacity-50'
const INPUT = 'w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--border-dark)]'
const LABEL = 'block text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-1'

const STATUS = {
  OPEN:   { label: 'Open',   tone: 'green' },
  PAUSED: { label: 'Paused', tone: 'amber' },
  FILLED: { label: 'Filled', tone: 'blue'  },
  CLOSED: { label: 'Closed', tone: 'gray'  },
}
const FILTERS = ['OPEN', 'PAUSED', 'FILLED', 'CLOSED', 'ALL']

// Must match JobPosition.TEAM_CHOICES
const TEAMS = [
  ['FRONT_OF_HOUSE', 'Front of house'],
  ['PRODUCTION',     'Production'],
  ['OPERATIONS',     'Operations'],
  ['FINISHING',      'Finishing'],
]
const TEAM_LABEL = Object.fromEntries(TEAMS)

const TYPES = [
  ['FULL_TIME', 'Full-time'],
  ['PART_TIME', 'Part-time'],
  ['CONTRACT',  'Contract'],
]
const TYPE_LABEL = Object.fromEntries(TYPES)

// ── Helpers ──────────────────────────────────────────────────

function Chip({ tone, children }) {
  const t = TONE[tone]
  return (
    <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold"
          style={{ background: t.bg, color: t.text, border: `1px solid ${t.border}` }}>
      {children}
    </span>
  )
}

const todayISO = () => new Date().toISOString().slice(0, 10)

function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysLeft(closesAt) {
  if (!closesAt) return null
  const end = new Date(closesAt + 'T23:59:59')
  return Math.ceil((end - new Date()) / 86400000)
}

function deadlineText(v) {
  const d = daysLeft(v.closes_at)
  if (d === null) return 'No closing date'
  if (d < 0) return 'Closing date passed'
  if (d === 0) return 'Closes today'
  return d === 1 ? '1 day left' : `${d} days left`
}

// DRF errors come back as { field: ['message'] } or { detail: '…' }
function errorText(err, fallback) {
  const data = err?.response?.data
  if (!data) return fallback
  if (typeof data === 'string') return fallback
  if (data.detail) return data.detail
  const first = Object.entries(data)[0]
  if (!first) return fallback
  const [field, msgs] = first
  const msg = Array.isArray(msgs) ? msgs[0] : String(msgs)
  return field === 'non_field_errors' ? msg : `${field.replace(/_/g, ' ')}: ${msg}`
}

const EMPTY = {
  title: '', role: '', branch: '', team: '',
  employment_type: 'FULL_TIME', positions_available: 1,
  opens_at: todayISO(), closes_at: addDays(todayISO(), 21),
  description: '', responsibilities: '', requirements: '',
  pay_mode: 'interview', pay_text: '', working_hours: '', benefits: '',
}

function toForm(v) {
  return {
    title: v.title || '',
    role: v.role ? String(v.role) : '',
    branch: v.branch ? String(v.branch) : '',
    team: v.team || '',
    employment_type: v.employment_type || 'FULL_TIME',
    positions_available: v.positions_available ?? 1,
    opens_at: v.opens_at || todayISO(),
    closes_at: v.closes_at || addDays(todayISO(), 21),
    description: v.description || '',
    responsibilities: v.responsibilities || '',
    requirements: v.requirements || '',
    pay_mode: v.pay_text ? 'show' : 'interview',
    pay_text: v.pay_text || '',
    working_hours: v.working_hours || '',
    benefits: v.benefits || '',
  }
}

function toPayload(f) {
  return {
    title: f.title.trim(),
    role: Number(f.role),
    branch: f.branch ? Number(f.branch) : null,
    team: f.team,
    employment_type: f.employment_type,
    positions_available: Number(f.positions_available),
    opens_at: f.opens_at,
    closes_at: f.closes_at,
    description: f.description.trim(),
    responsibilities: f.responsibilities.trim(),
    requirements: f.requirements.trim(),
    pay_text: f.pay_mode === 'show' ? f.pay_text.trim() : '',
    working_hours: f.working_hours.trim(),
    benefits: f.benefits.trim(),
    track: 'PUBLIC',
  }
}

function validate(f) {
  if (!f.title.trim()) return 'Give the vacancy a title.'
  if (!f.role) return 'Choose the role this vacancy hires for.'
  if (!f.team) return 'Choose the team, so the careers page can group it.'
  const n = Number(f.positions_available)
  if (!Number.isInteger(n) || n < 1) return 'Positions must be 1 or more.'
  if (!f.opens_at || !f.closes_at) return 'Set the opening and closing dates.'
  if (f.closes_at < f.opens_at) return 'The closing date is before the opening date.'
  if (f.pay_mode === 'show' && !f.pay_text.trim()) return 'Write the pay, or choose "Discussed at interview".'
  return ''
}

// ── List ─────────────────────────────────────────────────────

function VacancyRow({ v, selected, onSelect }) {
  const s = STATUS[v.status] || STATUS.CLOSED
  const d = daysLeft(v.closes_at)
  const urgent = v.status === 'OPEN' && d !== null && d <= 5
  return (
    <button
      onClick={onSelect}
      className={'w-full text-left rounded-lg border px-3 py-2.5 transition-colors ' +
        (selected ? 'border-[var(--text)] bg-[var(--bg)]' : 'border-[var(--border)] hover:bg-[var(--bg)]')}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold text-[var(--text)]">{v.title}</span>
        <Chip tone={s.tone}>{s.label}</Chip>
      </div>
      <div className="mt-0.5 text-xs text-[var(--text-2)]">
        {[TEAM_LABEL[v.team] || 'No team', v.branch_name || 'Any branch', TYPE_LABEL[v.employment_type]].join(' · ')}
      </div>
      <div className="mt-1 text-xs text-[var(--text-3)]">
        {v.applicant_count || 0} applicant{v.applicant_count === 1 ? '' : 's'} · {v.positions_available} position{v.positions_available === 1 ? '' : 's'} ·{' '}
        <span style={urgent ? { color: TONE.red.text, fontWeight: 700 } : undefined}>{deadlineText(v)}</span>
      </div>
    </button>
  )
}

// ── Editor ───────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--text-3)]">{hint}</span>}
    </label>
  )
}

// Keyed by vacancy id in the parent, so picking another vacancy starts a fresh form.
// The "Saved" notice lives in the parent so it survives the remount after a create.
function Editor({ vacancy, branches, roles, notice, onSaved, onCancelNew, onEdit }) {
  const qc = useQueryClient()
  const isNew = !vacancy
  const [form, setForm] = useState(() => (vacancy ? toForm(vacancy) : EMPTY))
  const [error, setError] = useState('')

  const set = (key) => (e) => {
    setForm(f => ({ ...f, [key]: e.target.value }))
    setError('')
    onEdit()
  }

  const save = useMutation({
    mutationFn: (payload) => (isNew ? createVacancy(payload) : updateVacancy(vacancy.id, payload)).then(r => r.data),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['hrVacancies'] })
      onSaved(saved, isNew ? 'Vacancy created.' : 'Changes saved.')
    },
    onError: (err) => setError(errorText(err, "Couldn't save. Try again.")),
  })

  const setStatus = useMutation({
    mutationFn: (status) => updateVacancy(vacancy.id, { status }).then(r => r.data),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['hrVacancies'] })
      onSaved(saved, `Marked ${STATUS[saved.status]?.label.toLowerCase() || saved.status}.`)
    },
    onError: (err) => setError(errorText(err, "Couldn't change the status. Try again.")),
  })

  const submit = (e) => {
    e.preventDefault()
    const problem = validate(form)
    if (problem) { setError(problem); return }
    save.mutate(toPayload(form))
  }

  const busy = save.isPending || setStatus.isPending
  const status = vacancy?.status
  const live = status === 'OPEN' && daysLeft(vacancy?.closes_at) >= 0 && vacancy?.opens_at <= todayISO()

  return (
    <form onSubmit={submit} className={PANEL + ' flex flex-col gap-4 p-5'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">
            {isNew ? 'New vacancy' : 'Vacancy'}
          </div>
          <div className="font-display text-lg font-bold text-[var(--text)]">
            {form.title.trim() || 'Untitled'}
          </div>
        </div>
        {!isNew && (
          live ? (
            <a href={careersUrl(vacancy)} target="_blank" rel="noreferrer"
               className="shrink-0 text-xs font-semibold underline" style={{ color: TONE.blue.text }}>
              View on careers page
            </a>
          ) : (
            <span className="shrink-0 text-xs text-[var(--text-3)]">Not on the careers page</span>
          )
        )}
      </div>

      {/* Basics */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input className={INPUT} value={form.title} onChange={set('title')} placeholder="Attendant" maxLength={150} />
        </Field>
        <Field label="Role">
          <select className={INPUT} value={form.role} onChange={set('role')}>
            <option value="">Choose a role</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.display_name || r.name}</option>)}
          </select>
        </Field>
        <Field label="Branch">
          <select className={INPUT} value={form.branch} onChange={set('branch')}>
            <option value="">Any branch</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Team">
          <select className={INPUT} value={form.team} onChange={set('team')}>
            <option value="">Choose a team</option>
            {TEAMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select className={INPUT} value={form.employment_type} onChange={set('employment_type')}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Positions">
          <input className={INPUT} type="number" min="1" step="1" value={form.positions_available} onChange={set('positions_available')} />
        </Field>
        <Field label="Opens">
          <input className={INPUT} type="date" value={form.opens_at} onChange={set('opens_at')} />
        </Field>
        <Field label="Closes">
          <input className={INPUT} type="date" value={form.closes_at} onChange={set('closes_at')} />
        </Field>
      </div>

      {/* Public */}
      <div className="border-t border-[var(--border)] pt-4">
        <div className="mb-3 text-xs font-bold text-[var(--text)]">
          Shown on the careers page
          <span className="ml-1 font-normal text-[var(--text-3)]">· candidates read this word for word</span>
        </div>
        <div className="flex flex-col gap-3">
          <Field label="The role" hint="A short paragraph: what this person does and why it matters.">
            <textarea className={INPUT + ' min-h-[72px]'} value={form.description} onChange={set('description')} />
          </Field>
          <Field label="What you'll do" hint="One duty per line. Each line becomes a ticked point.">
            <textarea className={INPUT + ' min-h-[96px]'} value={form.responsibilities} onChange={set('responsibilities')}
                      placeholder={'Welcome customers and take their orders\nCheck files and quantities before printing'} />
          </Field>
          <Field label="What we're looking for" hint="One requirement per line.">
            <textarea className={INPUT + ' min-h-[80px]'} value={form.requirements} onChange={set('requirements')}
                      placeholder={'WASSCE or equivalent\nComfortable with a computer and smartphone'} />
          </Field>

          <div>
            <span className={LABEL}>Pay</span>
            <div className="mb-2 flex flex-wrap gap-2">
              {[['show', 'Show pay'], ['interview', 'Discussed at interview']].map(([mode, label]) => (
                <button key={mode} type="button"
                        onClick={() => { setForm(f => ({ ...f, pay_mode: mode })); setError(''); onEdit() }}
                        className={BTN + ' py-1.5 text-xs'}
                        style={form.pay_mode === mode ? { borderColor: TONE.green.text, background: TONE.green.bg, color: TONE.green.text } : undefined}>
                  {label}
                </button>
              ))}
            </div>
            {form.pay_mode === 'show' ? (
              <>
                <input className={INPUT} value={form.pay_text} onChange={set('pay_text')} maxLength={150}
                       placeholder="GHS 1,800 – 2,200 a month" />
                <span className="mt-1 block text-[11px] text-[var(--text-3)]">
                  Shown exactly as written. Check it's not above what current staff in this role earn.
                </span>
              </>
            ) : (
              <span className="block text-[11px] text-[var(--text-3)]">The careers page will say "Discussed at interview".</span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Hours">
              <input className={INPUT} value={form.working_hours} onChange={set('working_hours')} maxLength={150}
                     placeholder="Mon – Sat, rotating shifts" />
            </Field>
            <Field label="Benefits" hint="Optional. One per line.">
              <textarea className={INPUT + ' min-h-[40px]'} value={form.benefits} onChange={set('benefits')}
                        placeholder={'Paid training\nStaff uniform'} />
            </Field>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg px-3 py-2 text-sm" style={{ background: TONE.red.bg, color: TONE.red.text, border: `1px solid ${TONE.red.border}` }}>
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg px-3 py-2 text-sm" style={{ background: TONE.green.bg, color: TONE.green.text, border: `1px solid ${TONE.green.border}` }}>
          {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
        <div className="flex flex-wrap gap-2">
          {isNew && <button type="button" className={BTN} onClick={onCancelNew} disabled={busy}>Cancel</button>}
          {!isNew && status !== 'OPEN' && (
            <button type="button" className={BTN} disabled={busy} onClick={() => setStatus.mutate('OPEN')}>Reopen</button>
          )}
          {!isNew && status === 'OPEN' && (
            <button type="button" className={BTN} disabled={busy} onClick={() => setStatus.mutate('PAUSED')}>Pause</button>
          )}
          {!isNew && status !== 'FILLED' && (
            <button type="button" className={BTN} disabled={busy} onClick={() => setStatus.mutate('FILLED')}>Mark filled</button>
          )}
          {!isNew && status !== 'CLOSED' && (
            <button type="button" className={BTN} disabled={busy}
                    style={{ color: TONE.red.text, borderColor: TONE.red.border }}
                    onClick={() => setStatus.mutate('CLOSED')}>
              Close
            </button>
          )}
        </div>
        <button type="submit" className={BTN_PRIMARY} disabled={busy}>
          {save.isPending ? 'Saving…' : isNew ? 'Create vacancy' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

// ── The pane ─────────────────────────────────────────────────

export default function Vacancies() {
  const [filter, setFilter] = useState('OPEN')
  const [selectedId, setSelectedId] = useState(null)   // null + creating=false → nothing open
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')

  const vacanciesQ = useQuery({
    queryKey: ['hrVacancies'],
    queryFn: () => getVacancies().then(r => r.data),
  })
  const branchesQ = useQuery({
    queryKey: ['hrBranchOptions'],
    queryFn: () => getBranchOptions().then(r => r.data),
    staleTime: 10 * 60_000,
  })
  const rolesQ = useQuery({
    queryKey: ['hrRoleOptions'],
    queryFn: () => getRoleOptions().then(r => r.data),
    staleTime: 10 * 60_000,
  })

  const all = vacanciesQ.data || []
  const counts = useMemo(() => {
    const c = { ALL: all.length }
    all.forEach(v => { c[v.status] = (c[v.status] || 0) + 1 })
    return c
  }, [all])

  const shown = useMemo(() => {
    const rows = filter === 'ALL' ? all : all.filter(v => v.status === filter)
    // Soonest closing first, so nothing quietly expires
    return [...rows].sort((a, b) => (a.closes_at || '9999').localeCompare(b.closes_at || '9999'))
  }, [all, filter])

  const selected = all.find(v => v.id === selectedId) || null

  const startNew = () => { setCreating(true); setSelectedId(null); setNotice('') }
  const pick = (id) => { setCreating(false); setSelectedId(id); setNotice('') }
  const afterSave = (saved, message) => {
    setCreating(false)
    setSelectedId(saved.id)
    setNotice(message)
    if (filter !== 'ALL' && saved.status !== filter) setFilter(saved.status)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-[var(--text)]">Vacancies</h1>
          <p className="text-sm text-[var(--text-3)]">What's open, and what the careers page shows for each role.</p>
        </div>
        <button className={BTN_PRIMARY} onClick={startNew}>New vacancy</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* List */}
        <div className={PANEL + ' flex flex-col gap-3 self-start p-4'}>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                      className={BTN + ' py-1 text-xs'}
                      style={filter === f ? { background: 'var(--text)', color: 'var(--panel)', borderColor: 'var(--text)' } : undefined}>
                {f === 'ALL' ? 'All' : STATUS[f].label}{counts[f] ? ` ${counts[f]}` : ''}
              </button>
            ))}
          </div>

          {vacanciesQ.isLoading && <p className="py-6 text-center text-sm text-[var(--text-3)]">Loading vacancies…</p>}
          {vacanciesQ.error && (
            <p className="py-6 text-center text-sm" style={{ color: TONE.red.text }}>
              {errorText(vacanciesQ.error, "Couldn't load vacancies. Check the connection.")}
            </p>
          )}
          {vacanciesQ.data && shown.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--text-3)]">
              {filter === 'OPEN' ? 'No open vacancies. Create one to start hiring.' : 'Nothing here.'}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {shown.map(v => (
              <VacancyRow key={v.id} v={v} selected={!creating && v.id === selectedId} onSelect={() => pick(v.id)} />
            ))}
          </div>
        </div>

        {/* Editor */}
        {creating || selected ? (
          <Editor
            key={creating ? 'new' : selected.id}
            vacancy={creating ? null : selected}
            branches={branchesQ.data || []}
            roles={rolesQ.data || []}
            notice={notice}
            onSaved={afterSave}
            onCancelNew={() => setCreating(false)}
            onEdit={() => setNotice('')}
          />
        ) : (
          <div className={PANEL + ' flex items-center justify-center p-10 text-center text-sm text-[var(--text-3)] self-start'}>
            Pick a vacancy to edit it, or create a new one.
          </div>
        )}
      </div>
    </div>
  )
}
