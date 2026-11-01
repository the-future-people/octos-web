// src/components/eye/lenses/Customers.jsx
import { eyeCustomer, eyeCustomers } from '../../../api/eye'
import Network from '../Network'
import { C, DISPLAY, MONO, STATUS, TONE, cedis } from '../theme'
import { Alerts, BackLink, Chip, Failed, Loading, Pane, Row, Tile } from '../ui'
import { PeriodPills, ScopeHead, grid, tiles, useEye } from './common'

const SL = { regular: 'Regular', quiet: 'Gone quiet', credit_limit: 'Credit limit reached', new: 'New this week' }
const HUB = { counter: ['Counter', C.text2], online: ['Online', C.blue], app: ['App', C.gold] }

export default function Customers({ nav }) {
  return nav.entity ? <CustomerPage nav={nav} id={nav.entity} /> : <Crowd nav={nav} />
}

function Crowd({ nav }) {
  const q = useEye(['customers', nav.scope, nav.day, nav.period],
                   () => eyeCustomers({ scope: nav.scope, day: nav.day, period: nav.period }))
  if (q.isLoading) return <Loading />
  if (q.error) return <Failed error={q.error} />
  const d = q.data
  const first = (c) => c.channels.app ? 'app' : c.channels.online ? 'online' : 'counter'
  const maxS = Math.max(...d.customers.map(c => Number(c.spend) || 0), 1)
  return (
    <div>
      <ScopeHead data={d} lensName="Customers" nav={nav} right={<PeriodPills nav={nav} />} />
      <Network
        centre={{ value: d.total.toLocaleString(), sub: 'customers', colour: C.gold }}
        ring1={Object.entries(HUB).map(([k, [label, col]]) => ({ id: k, label, colour: col, weight: 1, sub: d.hubs[k], size: 14 }))}
        ring2={d.customers.map(c => ({
          id: c.id, parent: first(c), label: c.name, shape: c.business ? 'square' : 'circle',
          colour: STATUS[c.state], size: 5 + Math.sqrt((Number(c.spend) || 0) / maxS) * 7,
          alert: c.state !== 'regular', title: `${c.name} · ${cedis(c.spend)} · ${SL[c.state]}`,
          onClick: () => nav.open(c.id),
        }))}
        labelsRing2={d.customers.length <= 16}
      />
      <div className="flex gap-3 justify-center text-[10.5px] -mt-2 mb-2 flex-wrap" style={{ color: C.muted }}>
        <span>● person</span><span>■ business</span><span>size = lifetime spend</span>
        {Object.entries(SL).map(([k, l]) => <span key={k} style={{ color: STATUS[k] }}>{l}</span>)}
      </div>
      <div className={`px-3 pb-3 ${grid}`}>
        <Pane title={`THIS ${d.period === 'today' ? 'DAY' : d.period.toUpperCase()}`}>
          <Row label="New customers" value={d.new} /><Row label="Came back" value={d.returning} />
          <Row label="People · businesses" value={`${d.people} · ${d.businesses}`} />
          {d.not_tied_to_a_branch != null && <Row label="Not tied to a branch yet" value={d.not_tied_to_a_branch} />}
        </Pane>
        <Pane title="TOP BY SPEND">{d.customers.slice(0, 5).map(c => <Row key={c.id} label={c.name} value={cedis(c.spend)} onClick={() => nav.open(c.id)} />)}</Pane>
        <Pane title="CREDIT CUSTOMERS">
          <Row label="Accounts" value={d.credit.accounts} /><Row label="Owed to us" value={cedis(d.credit.owed)} />
          <Row label="At their limit" value={d.credit.at_limit} tone={d.credit.at_limit ? 'red' : undefined} />
        </Pane>
        <Alerts alerts={d.alerts} title="CUSTOMER ALERTS" onOpen={(a) => a.target && nav.open(a.target)} />
      </div>
    </div>
  )
}

function CustomerPage({ nav, id }) {
  const q = useEye(['customer', id], () => eyeCustomer(id))
  if (q.isLoading) return <Loading />
  if (q.error) return <Failed error={q.error} />
  const c = q.data
  const initials = c.name.split(' ').map(x => x[0]).join('').slice(0, 2)
  return (
    <div className="p-3 flex flex-col gap-2.5">
      <BackLink label="Customers" onClick={() => nav.open(null)} />
      <Pane>
        <div className="flex gap-3.5 items-center flex-wrap">
          <div className="w-14 h-14 flex items-center justify-center text-[18px] font-bold"
               style={{ borderRadius: c.business ? 12 : '50%', background: C.raised, color: C.text, fontFamily: DISPLAY }}>{initials}</div>
          <div className="flex-1 min-w-[160px]">
            <div className="font-bold text-[20px]" style={{ color: C.text, fontFamily: DISPLAY }}>{c.name}</div>
            <div className="text-[12px]" style={{ color: C.muted }}>{c.business ? 'Business' : 'Person'}{c.branch ? ` · ${c.branch}` : ''} · customer since {c.since}</div>
            {c.phone && <div className="flex gap-1.5 mt-2">
              <a href={`tel:${c.phone}`} className="text-[11.5px] px-2.5 py-1 rounded-lg" style={{ border: '1px solid #3a3833', color: C.text }}>Call</a>
              <a href={`https://wa.me/${c.phone.replace(/\D/g, '').replace(/^0/, '233')}`} target="_blank" rel="noreferrer" className="text-[11.5px] px-2.5 py-1 rounded-lg" style={{ border: '1px solid #3a3833', color: C.text }}>WhatsApp</a>
            </div>}
          </div>
          {c.credit?.over_limit && <Chip tone="red">Credit limit reached</Chip>}
        </div>
      </Pane>
      <div className={tiles}>
        <Tile label="LIFETIME" value={cedis(c.spend)} sub={`${c.visits} visits`} />
        <Tile label="HOW OFTEN" value={c.usual_gap_days != null ? `every ${c.usual_gap_days} days` : '—'} sub="usual gap" />
        <Tile label="LAST ORDER" value={c.last_job ? new Date(c.last_job).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' }) : '—'} />
        <Tile label="CREDIT" value={c.credit ? cedis(c.credit.owed) : 'none'} sub={c.credit ? `of ${cedis(c.credit.limit)}` : 'pays upfront'} />
      </div>
      <Pane title="EVERY JOB">
        {c.jobs.map(j => <div key={j.id} onClick={() => nav.setLens('jobs', j.id)}
          className="grid gap-2 items-center py-1.5 text-[11.5px] cursor-pointer hover:opacity-80"
          style={{ gridTemplateColumns: '120px minmax(0,1fr) 90px 80px', borderTop: `1px solid ${C.line}` }}>
          <span style={{ fontFamily: MONO, color: C.text2, fontSize: 11 }}>{j.code}</span>
          <span className="truncate" style={{ color: C.text }}>{j.title}</span>
          <span style={{ color: C.muted }}>{new Date(j.at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}</span>
          <b style={{ color: C.text, textAlign: 'right' }}>{cedis(j.amount)}</b>
        </div>)}
        {c.sent_back > 0 && <div className="text-[11px] mt-1.5" style={{ color: TONE.amber.text }}>{c.sent_back} of these sent back for a reprint</div>}
      </Pane>
    </div>
  )
}
