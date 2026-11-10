// List: everyone, current and past, for looking things up. No actions here
// except "Work on this now", which hands the person to Focus.

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getApplication } from '../../../api/hr'
import {
  PANEL, STAGE, STATUS_TEXT, Avatar, chipFor, laneOf, waited, fmtDay, fmtDateTime, channel, errorText,
} from './shared'
import { CvPanel, OnboardingLink } from './actions'
import FilterBar from './FilterBar'

const isClosed = (a) => ['REJECTED', 'WITHDRAWN', 'DECLINED'].includes(a.status)
const stageKey = (a) => (laneOf(a) ? 'waiting' : isClosed(a) ? 'closed' : 'hired')

function history(a) {
  const rows = [[a.created_at, `Applied (${a.track === 'RECOMMENDATION' ? 'recommended' : a.track === 'APPOINTMENT' ? 'appointed' : 'website'})`]]
  for (const sc of a.stage_scores || []) {
    if (sc.stage === 'SCREENING') rows.push([sc.created_at, `Screened ${sc.raw_score}/25, ${sc.passed ? 'passed' : 'below the pass mark'}`])
    if (sc.stage === 'INTERVIEW') {
      if (sc.interview_scheduled_at) rows.push([sc.created_at, `Interview booked for ${fmtDateTime(sc.interview_scheduled_at)}`])
      if (sc.raw_score) rows.push([sc.interview_conducted_at || sc.created_at, `Interview scored ${sc.raw_score}/25`])
    }
  }
  if (a.offer_responded_at) rows.push([a.offer_responded_at, a.offer_accepted ? 'Accepted the offer' : 'Declined the offer'])
  if (a.rejected_at) rows.push([a.rejected_at, `Rejected${a.rejection_reason ? `: ${a.rejection_reason}` : ''}`])
  return rows.filter((r) => r[0]).sort((x, y) => new Date(x[0]) - new Date(y[0]))
}

function Record({ id, onWorkNow }) {
  const q = useQuery({ queryKey: ['hrApplication', id], queryFn: () => getApplication(id).then((r) => r.data) })
  if (q.isLoading) return <div className={PANEL + ' p-8 text-center text-sm text-[var(--text-3)]'}>Loading…</div>
  if (q.error) return <div className={PANEL + ' p-8 text-center text-sm'}>{errorText(q.error, "Couldn't load this record.")}</div>
  const a = q.data
  const { label, s } = chipFor(a)
  const lane = laneOf(a)
  const interview = (a.stage_scores || []).find((x) => x.stage === 'INTERVIEW')
  return (
    <div className={PANEL + ' overflow-hidden'}>
      <div className="px-4 py-3" style={{ background: s.bg }}>
        <p className="font-bold" style={{ color: s.text }}>{a.full_name}{a.is_priority && <span style={{ color: '#BA7517' }}> ★</span>}</p>
        <p className="text-xs" style={{ color: s.soft }}>{a.vacancy_title || 'General application'}{a.branch_name ? ` · ${a.branch_name}` : ''} · applied {fmtDay(a.created_at)}</p>
      </div>
      <div className="flex flex-col gap-3 p-4 text-sm">
        <p className="text-[var(--text-2)]">
          <a href={`tel:${a.phone}`}>{a.phone}</a> · <a href={`mailto:${a.email}`} className="break-all">{a.email}</a> · {channel(a.preferred_channel)}
        </p>
        <span className="self-start rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: s.bg, color: s.soft }}>
          {label}{a.status === 'INTERVIEW_SCHEDULED' && interview?.interview_scheduled_at ? ` · ${fmtDateTime(interview.interview_scheduled_at)}` : ''}
        </span>
        {a.recommendation_note && <p className="rounded-lg px-3 py-2 text-xs" style={{ background: '#FAEEDA', color: '#633806' }}><b>Recommended:</b> {a.recommendation_note}</p>}
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">History</p>
          <ul className="grid gap-1 text-xs text-[var(--text-2)]">
            {history(a).map(([when, text], i) => <li key={i}><span className="text-[var(--text-3)]">{fmtDay(when)} ·</span> {text}</li>)}
          </ul>
        </div>
        <OnboardingLink app={a} />
        <CvPanel app={a} s={s} tall={300} />
        {lane ? (
          <button type="button" onClick={() => onWorkNow(a, lane.key)}
                  className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white" style={{ background: STAGE[lane.stage].solid }}>
            Work on this now
          </button>
        ) : (
          <p className="text-xs text-[var(--text-3)]">{STATUS_TEXT[a.status] || a.status}. Nothing waiting on HR here.</p>
        )}
      </div>
    </div>
  )
}

export default function List({ apps, vacancies, vacancy, setVacancy, onWorkNow }) {
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('')
  const [extra, setExtra] = useState({ track: '', waited: '', priority: false })
  const [selected, setSelected] = useState(null)

  const activeExtra = [extra.track, extra.waited, extra.priority].filter(Boolean).length
  const passExtra = (a) =>
    (!extra.track || a.track === extra.track) &&
    (!extra.priority || a.is_priority) &&
    (!extra.waited || (laneOf(a) && (Date.now() - new Date(a.created_at)) / 86400000 > Number(extra.waited)))

  // Counts in the pickers reflect the other filters, so the numbers always add up
  const forVacancy = apps.filter((a) => (!stage || stageKey(a) === stage) && passExtra(a))
  const forStage = apps.filter((a) => (!vacancy || String(a.vacancy ?? 'general') === String(vacancy)) && passExtra(a))

  const vacancyOptions = [
    { value: '', label: 'All vacancies', count: forVacancy.length },
    ...vacancies.map((v) => ({
      value: String(v.id),
      label: `${v.title}${v.branch_name ? ` · ${v.branch_name.replace(/ Branch$/, '')}` : ''}`,
      count: forVacancy.filter((a) => String(a.vacancy) === String(v.id)).length,
    })),
    { value: 'general', label: 'General applications', count: forVacancy.filter((a) => !a.vacancy).length },
  ]
  const stageOptions = [
    { value: '', label: 'All stages', count: forStage.length },
    { value: 'waiting', label: 'Waiting on HR', dot: '#BA7517', count: forStage.filter((a) => stageKey(a) === 'waiting').length },
    { value: 'hired', label: 'Hired and onboarding', dot: '#3B6D11', count: forStage.filter((a) => stageKey(a) === 'hired').length },
    { value: 'closed', label: 'Rejected or declined', dot: '#888780', count: forStage.filter((a) => stageKey(a) === 'closed').length },
  ]

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase()
    return apps
      .filter((a) => !vacancy || String(a.vacancy ?? 'general') === String(vacancy))
      .filter((a) => !stage || stageKey(a) === stage)
      .filter(passExtra)
      .filter((a) => !t || [a.full_name, a.phone, a.email].some((v) => String(v || '').toLowerCase().includes(t)))
      .sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
  }, [apps, vacancy, stage, search, extra])

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={search} setSearch={setSearch}
        vacancy={vacancy} setVacancy={setVacancy} vacancyOptions={vacancyOptions}
        stage={stage} setStage={setStage} stageOptions={stageOptions}
        extra={extra} setExtra={setExtra} activeExtra={activeExtra}
      />
      {rows.length !== apps.length && (
        <p className="px-1 text-xs text-[var(--text-3)]">
          Showing {rows.length} of {apps.length}
          {' · '}
          <button type="button" className="font-semibold underline" onClick={() => {
            setSearch(''); setStage(''); setVacancy(''); setExtra({ track: '', waited: '', priority: false })
          }}>Clear all</button>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className={PANEL + ' self-start overflow-x-auto'}>
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wider text-[var(--text-3)]">
                <th className="px-4 py-2.5 font-bold">Applicant</th>
                <th className="px-2 py-2.5 font-bold">Stage</th>
                <th className="px-2 py-2.5 font-bold">Waited</th>
                <th className="px-4 py-2.5 font-bold">Scores</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-[var(--text-3)]">No applicants match.</td></tr>
              )}
              {rows.map((a) => {
                const { label, s } = chipFor(a)
                const on = selected === a.id
                return (
                  <tr key={a.id} onClick={() => setSelected(a.id)}
                      className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]"
                      style={on ? { background: s.bg } : undefined}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={a.full_name} size={28} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--text)]">{a.full_name}{a.is_priority && <span style={{ color: '#BA7517' }}> ★</span>}</p>
                          <p className="truncate text-xs text-[var(--text-3)]">{a.vacancy_title || 'General application'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: s.bg, color: s.soft }}>{label}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-[var(--text-2)]">{laneOf(a) ? waited(a.created_at) : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[var(--text-2)]">
                      {a.screening_score ?? '–'} · {a.interview_score ?? '–'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {selected ? <Record key={selected} id={selected} onWorkNow={onWorkNow} /> : (
          <div className={PANEL + ' self-start p-8 text-center text-sm text-[var(--text-3)]'}>Pick someone to see their record.</div>
        )}
      </div>
    </div>
  )
}
