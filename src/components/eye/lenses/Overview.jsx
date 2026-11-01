// src/components/eye/lenses/Overview.jsx
import { eyeOverview } from '../../../api/eye'
import Network from '../Network'
import { C, TONE, cedis, pct } from '../theme'
import { Alerts, Chip, Change, Failed, Loading, Pane, Row } from '../ui'
import { ScopeHead, grid, useEye } from './common'

const COL = { red: C.red, amber: C.amber, green: C.green }

export default function Overview({ nav }) {
  const q = useEye(['overview', nav.scope, nav.day], () => eyeOverview({ scope: nav.scope, day: nav.day }))
  if (q.isLoading) return <Loading />
  if (q.error) return <Failed error={q.error} />
  const d = q.data, h = d.headline, s = h.staff
  const parent = d.path.length > 1 ? d.path[d.path.length - 2] : null
  const isToday = !nav.dayChosen
  return (
    <div>
      <ScopeHead data={d} nav={nav} right={<div className="text-right">
        <div className="text-[9.5px] font-bold tracking-[.6px]" style={{ color: C.muted }}>TIME STONE</div>
        <div className="text-[13px] font-bold" style={{ color: C.gold }}>{isToday ? 'Today, live' : `Viewing ${d.day}`}</div>
        {!isToday && <button className="text-[11px] underline" style={{ color: C.muted }} onClick={() => nav.setDay(null)}>back to today</button>}
      </div>} />
      <div className="relative">
        <Network
          centre={{ value: d.health, sub: 'health', score: d.health, colour: COL[d.colour],
                    onClick: parent ? () => nav.go(parent.key) : undefined }}
          ring1={d.children.map(c => ({
            id: c.key, label: c.name, colour: COL[c.colour], weight: c.revenue || 1,
            size: Math.max(8, Math.min(15, 6 + Math.sqrt(Math.max(c.revenue, 0)) / 6)),
            alert: c.colour !== 'green', title: `${c.name} · ${cedis(c.revenue)} · ${c.health}% healthy`,
            onClick: () => nav.go(c.key),
          }))}
          dial={{ days: d.dial.map(x => ({ date: x.date, value: x.revenue, health: x.health })),
                  selected: d.day, onPick: (date) => nav.setDay(date) }}
        />
        <div className="absolute top-1 left-3 max-w-[200px] text-[11.5px] leading-[1.7]" style={{ color: C.text2 }}>
          <Chip tone={d.colour}>{d.health}% healthy</Chip>
          <div className="mt-1.5"><b style={{ color: C.text }}>{cedis(h.revenue)}</b> {isToday ? 'today' : 'that day'} <Change value={h.revenue_change} /></div>
          <div>{h.jobs} jobs</div>
          <div>{s.tracking === false ? `${s.signed_in} signed in · clock-ins not tracked`
               : `${s.present} of ${s.total} staff in`}</div>
          <div>{h.machines.up} of {h.machines.total} machines up</div>
        </div>
      </div>
      <div className={`px-3 pb-3 ${grid}`}>
        <Pane title="THE BUSINESS">
          <Row label="Jobs finished" value={d.business.finished} />
          <Row label="Promises kept, this month" value={pct(d.business.promises_kept_month)} />
          <Row label="Cash sheets closed" value={`${d.business.sheets.closed} of ${d.business.sheets.total}`} />
          <Row label="Profit" value="Costs not recorded yet" tone="grey" />
        </Pane>
        <Alerts alerts={d.alerts} title="ANYTHING WRONG" onOpen={(a) => a.lens && nav.setLens(a.lens, a.target)} />
        <Pane title="THE LEVEL BELOW">
          {d.children.length ? d.children.map(c => <Row key={c.key} label={c.name}
              value={<span><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: COL[c.colour] }} />{cedis(c.revenue)}</span>}
              onClick={() => nav.go(c.key)} />)
            : <div className="text-[11px]" style={{ color: C.muted }}>Open a lens to see this branch's people, jobs and machines.</div>}
        </Pane>
      </div>
    </div>
  )
}
