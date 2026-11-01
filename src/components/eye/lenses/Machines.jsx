// src/components/eye/lenses/Machines.jsx
import { eyeMachine, eyeMachines } from '../../../api/eye'
import Network from '../Network'
import { C, DISPLAY, STATUS, TONE, since } from '../theme'
import { Alerts, BackLink, Failed, Loading, Pane, Row, Tile } from '../ui'
import { ScopeHead, grid, tiles, useEye } from './common'

const SL = { printing: 'Printing', idle: 'Idle', down: 'Down' }

// A live trace like a hospital monitor: spikes while printing, a slow line
// when idle, flat red when down.
export function Beat({ state, width = 150 }) {
  if (state === 'down') return <svg viewBox="0 0 150 28" width={width} height="28"><line x1="0" y1="14" x2="150" y2="14" stroke={C.red} strokeWidth="1.6" /></svg>
  const seg = state === 'printing' ? [[12, 14], [16, 4], [20, 24], [24, 9], [28, 14], [60, 14]] : [[40, 14], [44, 11], [48, 14], [60, 14]]
  let d = 'M0 14 '
  for (let i = 0; i < 5; i++) seg.forEach(([x, y]) => { d += `L${x + i * 60} ${y} ` })
  return (
    <svg viewBox="0 0 150 28" width={width} height="28" style={{ overflow: 'hidden' }}>
      <style>{'@keyframes eyebeat{from{transform:translateX(0)}to{transform:translateX(-60px)}}'}</style>
      <g style={{ animation: `eyebeat ${state === 'idle' ? 4 : 1.6}s linear infinite` }}>
        <path d={d} fill="none" stroke={STATUS[state]} strokeWidth="1.6" strokeLinejoin="round" /></g>
    </svg>
  )
}

export default function Machines({ nav }) {
  return nav.entity ? <MachinePage nav={nav} id={nav.entity} /> : <Fleet nav={nav} />
}

function Fleet({ nav }) {
  const q = useEye(['machines', nav.scope, nav.day], () => eyeMachines({ scope: nav.scope, day: nav.day }))
  if (q.isLoading) return <Loading />
  if (q.error) return <Failed error={q.error} />
  const d = q.data
  const atBranch = d.scope.kind === 'branch'
  const gk = (m) => atBranch ? m.type : String(m.branch_id)
  const groups = {}
  d.machines.forEach(m => { (groups[gk(m)] ||= { label: atBranch ? m.type : m.branch, items: [] }).items.push(m) })
  return (
    <div>
      <ScopeHead data={d} lensName="Machines" nav={nav} />
      <Network
        centre={{ value: `${d.up}/${d.total}`, sub: 'machines up', colour: d.down ? C.red : C.green }}
        ring1={Object.entries(groups).map(([k, g]) => ({
          id: k, label: g.label, colour: C.text2, weight: g.items.length,
          sub: `${g.items.filter(m => m.state !== 'down').length}/${g.items.length}`,
          onClick: atBranch ? undefined : () => nav.go(`branch:${k}`),
        }))}
        ring2={d.machines.map(m => ({
          id: m.id, parent: gk(m), label: m.name, shape: 'square', colour: STATUS[m.state],
          alert: m.state === 'down', pulse: m.state === 'printing',
          title: `${m.name} · ${m.branch} · ${SL[m.state]}${m.operators.length ? ' · ' + m.operators.map(o => o.name).join(', ') : ''}`,
          onClick: () => nav.open(m.id),
        }))}
        labelsRing2={d.machines.length <= 12}
      />
      <div className="px-3 pb-3 flex flex-col gap-2.5">
        <Pane title="HEARTBEATS">
          {d.machines.map(m => <div key={m.id} onClick={() => nav.open(m.id)}
            className="grid gap-2.5 items-center py-1.5 text-[11.5px] cursor-pointer hover:opacity-80"
            style={{ gridTemplateColumns: 'minmax(0,1.3fr) 150px 54px 54px', borderTop: `1px solid ${C.line}` }}>
            <span className="min-w-0"><b style={{ color: C.text }}>{m.name}</b><br />
              <span className="text-[10.5px]" style={{ color: C.muted }}>{m.branch}{m.operators.length ? ` · ${m.operators.map(o => o.name).join(', ')}` : ''}</span></span>
            <span><Beat state={m.state} />{m.state === 'down' && <div className="text-[10px]" style={{ color: TONE.red.text }}>down {m.down_minutes != null ? since(new Date(Date.now() - m.down_minutes * 60000).toISOString()) : ''}</div>}</span>
            <b style={{ color: C.text }}>{m.busy_pct}%</b>
            <span style={{ color: C.text2 }}>{m.queue} queued</span>
          </div>)}
          {!d.machines.length && <div className="text-[11px] mt-1" style={{ color: C.muted }}>No machines registered here.</div>}
        </Pane>
        <div className={grid}>
          <Pane title="BY TYPE">{Object.entries(d.by_type).map(([t, n]) => <Row key={t} label={t} value={n} />)}</Pane>
          <Pane title="TODAY">
            <Row label="Printing · idle · down" value={`${d.printing} · ${d.idle} · ${d.down}`} />
            <Row label="Average busy" value={`${d.average_busy}%`} />
            <Row label="With an operator" value={`${d.with_operator} of ${d.total}`} />
          </Pane>
          <Alerts alerts={d.alerts} title="MACHINE ALERTS" onOpen={(a) => a.target && nav.open(a.target)} />
        </div>
      </div>
    </div>
  )
}

function MachinePage({ nav, id }) {
  const q = useEye(['machine', id, nav.day], () => eyeMachine(id, { day: nav.day }))
  if (q.isLoading) return <Loading />
  if (q.error) return <Failed error={q.error} />
  const m = q.data
  return (
    <div className="p-3 flex flex-col gap-2.5">
      <BackLink label="Machines" onClick={() => nav.open(null)} />
      <Pane>
        <div className="flex gap-3.5 items-center flex-wrap">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-[24px]"
               style={{ background: C.raised, border: `2px solid ${STATUS[m.state]}`, color: STATUS[m.state] }}>▣</div>
          <div className="flex-1 min-w-[160px]">
            <div className="font-bold text-[20px]" style={{ color: C.text, fontFamily: DISPLAY }}>{m.name}</div>
            <div className="text-[12px]" style={{ color: C.muted }}>{m.type} · {m.branch} · {m.operators.length ? 'run by ' + m.operators.map(o => o.name).join(', ') : 'no operator'}</div>
            <div className="mt-1.5"><Beat state={m.state} /></div>
          </div>
        </div>
      </Pane>
      {m.state === 'down' && <div className="rounded-xl px-3 py-2 text-[11.5px]" style={{ background: TONE.red.bg, border: `1px solid ${C.red}`, color: TONE.red.text }}>
        <b>Down {m.down_minutes != null ? `for ${Math.floor(m.down_minutes / 60)} h ${m.down_minutes % 60} min` : ''}</b>{m.down_reason ? ` · ${m.down_reason}` : ''}</div>}
      <div className={tiles}>
        <Tile label="NOW" value={SL[m.state]} sub={m.now || 'nothing running'} />
        <Tile label="BUSY TODAY" value={`${m.busy_pct}%`} sub={`${m.queue} in the queue`} />
        <Tile label="THIS MONTH" value={`${m.month.jobs} jobs`} sub={`${m.month.made} made · ${m.month.spoilt} spoilt`} />
        <Tile label="BREAKDOWNS" value={m.breakdowns_month} sub="this month" subTone={m.breakdowns_month >= 3 ? 'red' : undefined} />
      </div>
      <div className={grid}>
        <Pane title="THIS MONTH, DAY BY DAY">
          <div className="grid gap-[3px] mt-1.5" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
            {m.calendar.map(c => <div key={c.date} title={`${c.date} · ${c.breakdown ? 'breakdown' : 'up'}`}
              className="aspect-square rounded-[3px]" style={{ background: c.breakdown ? C.red : C.green, opacity: .85 }} />)}
          </div>
          {m.breakdowns.map(b => <Row key={b} label="Breakdown" value={new Date(b).toLocaleString('en-GH', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} />)}
        </Pane>
        <Pane title="VALUE">
          <Row label="In service since" value={m.commissioned_on || '—'} />
          <Row label="Model" value={m.model_number || '—'} />
          <Row label="Purchase price" value="not recorded yet" tone="grey" />
          <Row label="Repairs" value="not recorded yet" tone="grey" />
        </Pane>
      </div>
    </div>
  )
}
