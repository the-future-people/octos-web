// src/components/eye/lenses/People.jsx
import { eyePeople, eyePerson } from '../../../api/eye'
import Network from '../Network'
import { C, STATUS, TONE, DISPLAY, cedis, pct } from '../theme'
import { Alerts, BackLink, Chip, Failed, Loading, NotYet, Pane, Row, Tile } from '../ui'
import { ScopeHead, grid, tiles, useEye } from './common'

const LABEL = { on: 'on time', late: 'late', absent: 'absent', leave: 'on leave', not_yet: 'not in yet', off: 'day off', untracked: 'not tracked' }

// Hooks must run in the same order every render, so the lens and the
// person page are separate components rather than an early return.
export default function People({ nav }) {
  return nav.entity ? <Person nav={nav} id={nav.entity} /> : <PeopleNetwork nav={nav} />
}

function PeopleNetwork({ nav }) {
  const q = useEye(['people', nav.scope, nav.day], () => eyePeople({ scope: nav.scope, day: nav.day }))
  if (q.isLoading) return <Loading />
  if (q.error) return <Failed error={q.error} />
  const d = q.data, t = d.today
  const atBranch = d.scope.kind === 'branch'
  const groupOf = (p) => atBranch ? p.role : String(p.branch_id)
  const groupName = (key, p) => atBranch ? key : p.branch
  const groups = {}
  d.people.forEach(p => { const k = groupOf(p); (groups[k] ||= { label: groupName(k, p), members: [] }).members.push(p) })
  return (
    <div>
      <ScopeHead data={d} lensName="People" nav={nav} />
      {!t.tracking && <div className="px-3 pt-2"><NotYet title="Clock-ins aren't being recorded here yet,">so attendance is shown as not tracked rather than absent. Who signed in to Octos, and when, is still shown.</NotYet></div>}
      <Network
        centre={{ value: t.tracking ? `${t.present}/${t.total}` : `${t.signed_in}/${t.total}`, sub: t.tracking ? 'in today' : 'signed in', colour: C.gold }}
        ring1={Object.entries(groups).map(([k, g]) => ({
          id: k, label: g.label, colour: C.text2, weight: g.members.length,
          sub: t.tracking ? `${g.members.filter(m => m.status === 'on' || m.status === 'late').length}/${g.members.length}` : `${g.members.length}`,
          onClick: atBranch ? undefined : () => nav.go(`branch:${k}`),
        }))}
        ring2={d.people.map(p => ({
          id: p.id, parent: groupOf(p), label: p.name.split(' ')[0] + (p.status === 'late' ? ` · ${p.clocked_in}` : ''),
          colour: STATUS[p.status], pulse: p.status !== 'leave' && p.status !== 'off',
          title: `${p.name} · ${LABEL[p.status]}${p.clocked_in ? ' ' + p.clocked_in : ''}`,
          onClick: () => nav.open(p.id),
        }))}
        labelsRing2={d.people.length <= 24}
      />
      <div className="flex gap-3 justify-center text-[10.5px] -mt-2 mb-2 flex-wrap" style={{ color: C.muted }}>
        {['on', 'late', 'absent', 'leave', 'not_yet'].map(k => <span key={k}><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: STATUS[k] }} />{t[k === 'on' ? 'present' : k] ?? 0} {LABEL[k]}</span>)}
      </div>
      <div className={`px-3 pb-3 ${grid}`}>
        <Pane title="HEADCOUNT BY ROLE">{Object.entries(d.by_role).map(([r, n]) => <Row key={r} label={r} value={n} />)}</Pane>
        <Pane title="THIS MONTH">
          <Row label="Attendance" value={pct(d.month.attendance_pct)} />
          <Row label="Average arrival" value={d.month.average_arrival || '—'} />
          <Row label="Late (10 min grace)" value={d.month.late} />
          <Row label="Open positions" value={d.openings ?? '—'} />
          <Row label="Applicants" value={d.applicants ?? '—'} />
        </Pane>
        <Pane title="TODAY">
          {d.people.slice(0, 12).map(p => <Row key={p.id} label={p.name} onClick={() => nav.open(p.id)}
            value={<span style={{ color: STATUS[p.status] }}>{LABEL[p.status]}{p.clocked_in ? ` · ${p.clocked_in}` : ''}</span>} />)}
          {d.people.length > 12 && <div className="text-[10.5px] mt-1" style={{ color: C.muted }}>and {d.people.length - 12} more on the network</div>}
        </Pane>
        <Alerts alerts={d.alerts} title="PEOPLE ALERTS" onOpen={(a) => a.target && nav.open(a.target)} />
      </div>
    </div>
  )
}

function Person({ nav, id }) {
  const q = useEye(['person', id, nav.day], () => eyePerson(id, { day: nav.day }))
  if (q.isLoading) return <Loading />
  if (q.error) return <Failed error={q.error} />
  const p = q.data, att = p.month.attendance_pct
  const initials = p.name.split(' ').map(x => x[0]).join('').slice(0, 2)
  const C2 = 2 * Math.PI * 30
  return (
    <div className="p-3 flex flex-col gap-2.5">
      <BackLink label="People" onClick={() => nav.open(null)} />
      <Pane>
        <div className="flex gap-3.5 items-center flex-wrap">
          <div className="relative w-16 h-16 rounded-full flex items-center justify-center text-[20px] font-bold"
               style={{ background: '#e9e4da', color: '#1a1a1a', fontFamily: DISPLAY }}>{initials}
            <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full" style={{ background: STATUS[p.status], border: `2px solid ${C.panel}` }} /></div>
          <div className="flex-1 min-w-[150px]">
            <div className="font-bold text-[20px]" style={{ color: C.text, fontFamily: DISPLAY }}>{p.name}</div>
            <div className="text-[12px]" style={{ color: C.muted }}>{p.role} · {p.branch}</div>
            <div className="mt-1"><Chip tone={p.status === 'on' ? 'green' : p.status === 'late' ? 'amber' : p.status === 'absent' ? 'red' : 'grey'}>
              Today: {LABEL[p.status]}{p.clocked_in ? ` · ${p.clocked_in}` : ''}</Chip></div>
            {p.phone && <div className="flex gap-1.5 mt-2">
              <a href={`tel:${p.phone}`} className="text-[11.5px] px-2.5 py-1 rounded-lg" style={{ border: '1px solid #3a3833', color: C.text }}>Call</a>
              <a href={`sms:${p.phone}`} className="text-[11.5px] px-2.5 py-1 rounded-lg" style={{ border: '1px solid #3a3833', color: C.text }}>SMS</a>
              <a href={`https://wa.me/${p.phone.replace(/\D/g, '').replace(/^0/, '233')}`} target="_blank" rel="noreferrer" className="text-[11.5px] px-2.5 py-1 rounded-lg" style={{ border: '1px solid #3a3833', color: C.text }}>WhatsApp</a>
            </div>}
          </div>
          {att != null && <svg viewBox="0 0 80 80" width="76" role="img" aria-label="Attendance">
            <circle cx="40" cy="40" r="30" fill="none" stroke="#2f2d29" strokeWidth="6" />
            <circle cx="40" cy="40" r="30" fill="none" stroke={att > 92 ? C.green : C.amber} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${C2 * att / 100} 999`} transform="rotate(-90 40 40)" />
            <text x="40" y="43" textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff" style={{ fontFamily: DISPLAY }}>{att}</text>
            <text x="40" y="55" textAnchor="middle" fontSize="7" fill={C.muted}>attendance</text></svg>}
        </div>
      </Pane>
      <div className={tiles}>
        <Tile label="AVG ARRIVAL" value={p.month.average_arrival || '—'} sub={p.shift_start ? `shift ${p.shift_start}` : ''} />
        <Tile label="LATE" value={`${p.month.late} times`} sub="this month" />
        <Tile label="JOBS TAKEN" value={p.work.jobs} sub={cedis(p.work.value)} />
        <Tile label="SIGNED IN TODAY" value={p.signed_in || '—'} sub={`clocked in ${p.clocked_in || '—'}`} />
      </div>
      <div className={grid}>
        <Pane title="THIS MONTH, DAY BY DAY">
          <div className="grid gap-[3px] mt-1.5" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
            {p.calendar.map(c => <div key={c.date} title={`${c.date} · ${LABEL[c.status]}`}
              className="aspect-square rounded-[3px]" style={{ background: c.status === 'off' ? '#24231f' : STATUS[c.status], opacity: .85 }} />)}
          </div>
        </Pane>
        <Pane title="HIERARCHY">
          {p.manager && <Row label="Reports to" value={p.manager.name} onClick={() => nav.open(p.manager.id)} />}
          {p.reports.length > 0 ? p.reports.map(r => <Row key={r.id} label={r.name} onClick={() => nav.open(r.id)}
              value={<span style={{ color: STATUS[r.status] }}>{LABEL[r.status]}</span>} />)
            : !p.manager && <div className="text-[11px]" style={{ color: C.muted }}>No one recorded above or below.</div>}
        </Pane>
        <Pane title="MISTAKES · THIS MONTH">
          <Row label="Work sent back" value={p.mistakes.sent_back} />
          <Row label="Done overridden" value={p.mistakes.overrides} />
          <Row label="Refunds" value="not recorded yet" tone="grey" />
        </Pane>
      </div>
    </div>
  )
}
