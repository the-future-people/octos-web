// src/components/eye/lenses/Health.jsx
import { eyeHealth } from '../../../api/eye'
import Network from '../Network'
import { C, STATUS, TONE } from '../theme'
import { Pane, Failed, Loading, Row } from '../ui'
import { grid, useEye } from './common'

export default function Health() {
  const q = useEye(['health'], () => eyeHealth())
  if (q.isLoading) return <Loading />
  if (q.error) return <Failed error={q.error} />
  const d = q.data
  const well = d.parts.filter(p => p.state === 'ok').length
  return (
    <div>
      <div className="px-3 pt-3"><div className="text-[9.5px] font-bold tracking-[.6px]" style={{ color: C.muted }}>THE SYSTEM ITSELF</div>
        <div className="font-bold text-[19px]" style={{ color: C.text, fontFamily: "'Syne', sans-serif" }}>Octos · Health</div></div>
      <Network
        centre={{ value: 'Octos', sub: `${well} of ${d.parts.length} well`, colour: d.paid_without_job.length ? C.red : well === d.parts.length ? C.green : C.amber }}
        ring1={d.parts.map(p => ({ id: p.part, label: p.part, sub: p.note, colour: STATUS[p.state] || C.grey,
                                  shape: p.state === 'unknown' ? 'hollow' : 'circle', weight: 1 }))}
      />
      <div className={`px-3 pb-3 ${grid}`}>
        <Pane title="SAFETY NETS" tone={d.paid_without_job.length ? 'red' : undefined}>
          <Row label="Paid orders with no job" value={d.paid_without_job.length} tone={d.paid_without_job.length ? 'red' : 'green'} />
          {d.paid_without_job.map(o => <div key={o.order} className="text-[11px] py-1" style={{ color: TONE.red.text, borderTop: `1px solid ${C.line}` }}>
            <b>{o.order}</b> · {o.branch || 'not routed'} · paid {new Date(o.paid_at).toLocaleString('en-GH', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</div>)}
        </Pane>
        <Pane title="PARTS">{d.parts.map(p => <Row key={p.part} label={p.part} value={p.note} tone={p.state === 'ok' ? undefined : 'grey'} />)}</Pane>
      </div>
    </div>
  )
}
