// src/components/eye/lenses/Jobs.jsx
import { useState } from 'react'
import { eyeJob, eyeJobs } from '../../../api/eye'
import { Conveyor } from '../Flows'
import { C, MONO, STATUS, TONE, pct } from '../theme'
import { Alerts, BackLink, Change, Chip, Failed, Loading, Pane, Row, Tile } from '../ui'
import { PeriodPills, ScopeHead, grid, tiles, useEye } from './common'

const SL = { ON_TRACK: 'On time', AT_RISK: 'At risk', LATE: 'Late' }
const time = (iso) => iso ? new Date(iso).toLocaleString('en-GH', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '—'

export default function Jobs({ nav }) {
  return nav.entity ? <Journey nav={nav} id={nav.entity} /> : <Line nav={nav} />
}

function Line({ nav }) {
  const [stage, setStage] = useState(null)
  const q = useEye(['jobs', nav.scope, nav.day, nav.period],
                   () => eyeJobs({ scope: nav.scope, day: nav.day, period: nav.period }))
  if (q.isLoading) return <Loading />
  if (q.error) return <Failed error={q.error} />
  const d = q.data
  const st = stage != null ? d.stages[stage] : null
  const order = { LATE: 0, AT_RISK: 1, ON_TRACK: 2 }
  return (
    <div>
      <ScopeHead data={d} lensName="Jobs" nav={nav} right={<PeriodPills nav={nav} />} />
      <Conveyor sources={d.sources} stages={d.stages} instant={d.instant_done} collected={d.collected}
                selected={stage} onStage={(i) => setStage(stage === i ? null : i)} onJob={(id) => nav.open(id)} />
      <div className="flex gap-3 justify-center text-[10.5px] -mt-1.5 mb-2 flex-wrap" style={{ color: C.muted }}>
        {Object.entries(SL).map(([k, l]) => <span key={k}><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: STATUS[k] }} />{l}</span>)}
        <span>Dashed ring: halted</span><span>Click a stage or a dot</span>
      </div>
      <div className="px-3 pb-3 flex flex-col gap-2.5">
        {st && <Pane title={`${st.label.toUpperCase()} · ${st.jobs.length} JOBS, LATE FIRST`}>
          {[...st.jobs].sort((a, b) => order[a.state] - order[b.state]).map(j =>
            <div key={j.id} onClick={() => nav.open(j.id)} className="grid gap-2 items-center py-1.5 text-[11.5px] cursor-pointer hover:opacity-80"
                 style={{ gridTemplateColumns: '120px minmax(0,1fr) 100px 70px', borderTop: `1px solid ${C.line}` }}>
              <span style={{ fontFamily: MONO, color: C.text2, fontSize: 11 }}>{j.code}</span>
              <span className="truncate"><b style={{ color: C.text }}>{j.title}</b> · {j.branch}</span>
              <span style={{ color: C.muted }}>{time(j.promise)}</span>
              <Chip tone={j.halted ? 'red' : j.state === 'LATE' ? 'red' : j.state === 'AT_RISK' ? 'amber' : 'green'}>{j.halted ? 'Halted' : SL[j.state]}</Chip>
            </div>)}
          {!st.jobs.length && <div className="text-[11px] mt-1" style={{ color: C.muted }}>Nothing at this stage.</div>}
        </Pane>}
        <div className={tiles}>
          <Tile label="TAKEN" value={d.taken} sub={<><Change value={d.taken_change} /> vs {d.compared_with}</>} />
          <Tile label="PROMISES KEPT" value={pct(d.promises.kept_pct)} sub={`${d.promises.kept} kept · ${d.promises.broken} broken`} />
          <Tile label="TURNAROUND" value={d.turnaround_minutes != null ? `${Math.floor(d.turnaround_minutes / 60)} h ${d.turnaround_minutes % 60} min` : '—'} sub="production, taken to collected" />
          <Tile label="LATE · AT RISK" value={`${d.late} · ${d.at_risk}`} sub={`${d.halted} halted`} subTone={d.halted ? 'red' : undefined} />
        </div>
        <div className={grid}>
          <Pane title="BY TYPE"><Row label="Instant" value={d.by_type.instant} /><Row label="Production" value={d.by_type.production} /><Row label="Design" value={d.by_type.design} /></Pane>
          <Pane title="INSPECTION · FINAL CHECK">
            <Row label="Cleared at inspection" value={d.inspection.cleared} /><Row label="Held" value={d.inspection.held} />
            <Row label="Passed final check" value={d.final_check.passed} /><Row label="Sent back to reprint" value={d.final_check.sent_back} tone={d.final_check.sent_back ? 'amber' : undefined} />
          </Pane>
          <Pane title="WASTE"><Row label="Spoilt pieces" value={d.spoilt_pieces} /><Row label="Their cost" value="not priced yet" tone="grey" /></Pane>
          <Alerts alerts={d.alerts} title="JOB ALERTS" onOpen={(a) => a.lens === 'jobs' && a.target ? nav.open(a.target) : a.lens && nav.setLens(a.lens)} />
        </div>
      </div>
    </div>
  )
}

function Journey({ nav, id }) {
  const q = useEye(['job', id], () => eyeJob(id))
  if (q.isLoading) return <Loading />
  if (q.error) return <Failed error={q.error} />
  const j = q.data
  const tone = j.halted ? 'red' : j.promise_state === 'LATE' || j.promise_state === 'BROKEN' ? 'red' : j.promise_state === 'AT_RISK' ? 'amber' : 'green'
  return (
    <div className="p-3 flex flex-col gap-2.5">
      <BackLink label="Jobs" onClick={() => nav.open(null)} />
      <Pane>
        <div className="flex justify-between gap-2 flex-wrap">
          <div>
            <div style={{ fontFamily: MONO, color: C.gold, fontSize: 12 }}>{j.code}</div>
            <div className="font-bold text-[19px]" style={{ color: C.text, fontFamily: "'Syne', sans-serif" }}>{j.title}</div>
            <div className="text-[11.5px]" style={{ color: C.muted }}>{j.customer} · {j.branch} · {j.channel}</div>
          </div>
          <div className="text-right"><Chip tone={tone}>{j.halted ? 'Halted' : (j.promise_state || 'On track').replace('_', ' ').toLowerCase()}</Chip>
            <div className="text-[11px] mt-1" style={{ color: C.muted }}>Promised {time(j.promise)}</div></div>
        </div>
        {j.halted && <div className="mt-2 rounded-lg px-2.5 py-2 text-[11.5px]" style={{ background: TONE.red.bg, border: `1px solid ${C.red}`, color: TONE.red.text }}>
          <b>Halted</b> since {time(j.halted.since)} · {j.halted.reason}</div>}
      </Pane>
      <Pane title="THE JOURNEY">
        {j.events.map((e, i) => <div key={i} className="flex gap-2.5 py-1.5 text-[11.5px]" style={{ borderTop: `1px solid ${C.line}` }}>
          <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: e.label === 'Halted' ? C.red : C.green }} />
          <div className="flex-1"><b style={{ color: C.text }}>{e.label}</b>{e.detail ? <span style={{ color: C.text2 }}> · {e.detail}</span> : null}
            <div className="text-[10.5px]" style={{ color: C.muted }}>{time(e.at)}{e.who ? ` · ${e.who}` : ''}</div></div>
        </div>)}
      </Pane>
    </div>
  )
}
