// src/components/eye/lenses/Money.jsx
import { eyeMoney } from '../../../api/eye'
import { MoneyFlow } from '../Flows'
import { C, cedis } from '../theme'
import { Alerts, Bar, Change, Failed, Loading, NotYet, Pane, Row } from '../ui'
import { PeriodPills, ScopeHead, grid, useEye } from './common'

const METHOD = { CASH: ['Cash', C.green], MOMO: ['MoMo', C.amber], POS: ['Card', C.blue], ONLINE: ['Online', '#8fb0ff'], CREDIT: ['Credit', C.grey] }

export default function Money({ nav }) {
  const q = useEye(['money', nav.scope, nav.day, nav.period],
                   () => eyeMoney({ scope: nav.scope, day: nav.day, period: nav.period }))
  if (q.isLoading) return <Loading />
  if (q.error) return <Failed error={q.error} />
  const d = q.data
  const methods = Object.entries(d.methods).map(([k, v]) => ({ key: k, label: METHOD[k]?.[0] || k, value: v, colour: METHOD[k]?.[1] || C.grey }))
  const ch = d.channels
  return (
    <div>
      <ScopeHead data={d} lensName="Money" nav={nav} right={<PeriodPills nav={nav} />} />
      <MoneyFlow
        inflows={d.inflows}
        outflows={[{ name: 'Paystack fees', amount: d.reconciliation[0]?.fees ?? 0 },
                   { name: 'All other costs', amount: null, note: 'not recorded in Octos yet' }]}
        centre={{ label: 'COLLECTED', value: cedis(d.collected), state: 'PROFIT NOT TRACKED', colour: C.amber }}
        onIn={(key) => nav.go(key)}
      />
      <div className="px-3 pb-2"><NotYet title="Profit isn't shown yet.">Octos records every cedi in, but not yet the costs (materials, salaries, rent, ECG). Once expenses are recorded, profit appears here, marked provisional until the month closes.</NotYet></div>
      <div className={`px-3 pb-3 ${grid}`}>
        <Pane title={`COLLECTED · ${d.period.toUpperCase()}`}>
          <div className="font-bold text-[18px]" style={{ color: C.text, fontFamily: "'Syne', sans-serif" }}>{cedis(d.collected)}</div>
          <div className="text-[11px]" style={{ color: C.muted }}><Change value={d.collected_change} /> vs {d.compared_with}</div>
          <Row label="After Paystack fees" value={cedis(d.revenue_after_fees)} />
          <Row label="Counter" value={cedis(ch.counter)} />
          <Row label="Online" value={cedis(ch.online)} />
          <Row label="Credit issued (owed)" value={cedis(ch.credit_issued)} />
        </Pane>
        <Pane title="BY PAYMENT METHOD">
          <Bar parts={methods} />
          {methods.map(m => <Row key={m.key} label={<span><span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: m.colour }} />{m.label}</span>} value={cedis(m.value)} />)}
        </Pane>
        <Pane title="WHAT'S OWED TO US">
          <Row label="Balances due on jobs" value={cedis(d.owed.job_balances)} />
          <Row label="Credit accounts" value={`${d.owed.credit_accounts} · ${cedis(d.owed.credit_owed)}`} />
          <Row label="At their limit" value={d.owed.at_limit} tone={d.owed.at_limit ? 'red' : undefined} />
        </Pane>
        <Pane title="CASH SHEETS">
          <Row label="Closed" value={`${d.sheets.closed} of ${d.sheets.total}`} />
          <Row label="Still open" value={d.sheets.open} tone={d.sheets.open ? 'amber' : undefined} />
          <Row label="Refunds" value={cedis(d.sheets.refunds)} />
        </Pane>
        <Pane title="RECONCILED">
          {d.reconciliation.map(r => <div key={r.pair}>
            <div className="text-[11px] mt-1" style={{ color: C.text }}>{r.pair}</div>
            <Row label="Octos says" value={cedis(r.octos)} />
            <Row label="Landed" value={cedis(r.landed)} />
            <Row label={`Gap (${r.expected})`} value={cedis(r.gap)} />
          </div>)}
        </Pane>
        <Alerts alerts={d.alerts} title="MONEY ALERTS" onOpen={(a) => a.lens && nav.setLens(a.lens, a.target)} />
      </div>
    </div>
  )
}
