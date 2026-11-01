// src/components/eye/lenses/Online.jsx
import { eyeOnline } from '../../../api/eye'
import { Funnel } from '../Flows'
import { C, cedis, pct } from '../theme'
import { Change, Failed, Loading, NotYet, Pane, Row, Tile } from '../ui'
import { PeriodPills, ScopeHead, grid, tiles, useEye } from './common'

export default function Online({ nav }) {
  const q = useEye(['online', nav.scope, nav.day, nav.period],
                   () => eyeOnline({ scope: nav.scope, day: nav.day, period: nav.period }))
  if (q.isLoading) return <Loading />
  if (q.error) return <Failed error={q.error} />
  const d = q.data
  return (
    <div>
      <ScopeHead data={{ scope: d.scope, path: [] }} lensName="Online" nav={nav} right={<PeriodPills nav={nav} />} />
      <Funnel steps={d.funnel.map(s => ({ ...s, note: s.state === 'NOT_TRACKED' ? 'not counted yet' : undefined }))} />
      <div className="px-3 pb-3 flex flex-col gap-2.5">
        <div className={tiles}>
          <Tile label="ONLINE ORDERS" value={d.paid} sub={<><Change value={d.paid_change} /> vs {d.compared_with}</>} />
          <Tile label="ONLINE REVENUE" value={cedis(d.revenue)} sub={`${pct(d.share_of_revenue)} of all money in`} />
          <Tile label="CHECKOUTS NEVER PAID" value={d.abandoned} />
        </div>
        <div className={grid}>
          <NotYet title="Website visits aren't counted yet.">Octos will count them itself, with no outside trackers, so the funnel starts at the first visit.</NotYet>
          <NotYet title="Texts aren't logged yet.">Once they are, you'll see how many were sent, how many failed, and what they cost.</NotYet>
        </div>
      </div>
    </div>
  )
}
