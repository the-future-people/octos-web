// src/components/eye/lenses/App.jsx
// The Print Octos app: downloads, sign-ins, who's active, what they do.
import { eyeApp } from '../../../api/eye'
import { Funnel } from '../Flows'
import { C } from '../theme'
import { Bar, Change, Failed, Loading, NotYet, Pane, Row, Tile } from '../ui'
import { PeriodPills, grid, tiles, useEye } from './common'

export default function AppLens({ nav }) {
  const q = useEye(['app', nav.day, nav.period], () => eyeApp({ day: nav.day, period: nav.period }))
  if (q.isLoading) return <Loading />
  if (q.error) return <Failed error={q.error} />
  const d = q.data
  const plat = Object.entries(d.platforms)
  const pCol = { ios: '#cfccc6', android: C.green }
  return (
    <div>
      <div className="flex justify-between items-end gap-2 flex-wrap px-3 pt-3">
        <div><div className="text-[9.5px] font-bold tracking-[.6px]" style={{ color: C.muted }}>PRINT OCTOS</div>
          <div className="font-bold text-[19px]" style={{ color: C.text, fontFamily: "'Syne', sans-serif" }}>The app</div></div>
        <PeriodPills nav={nav} />
      </div>
      <Funnel colour={C.gold} steps={[
        { stage: 'Downloads', count: null, note: 'stores not connected yet' },
        { stage: 'Signed in, ever', count: d.users },
        { stage: 'Active this period', count: d.active },
      ]} />
      <div className="px-3 pb-3 flex flex-col gap-2.5">
        <div className={tiles}>
          <Tile label="APP USERS" value={d.users} sub="signed in at least once" />
          <Tile label="ACTIVE" value={d.active} sub={<><Change value={d.active_change} /> vs {d.compared_with}</>} />
          <Tile label="NEW SIGN-INS" value={d.new_sign_ins} sub="this period" />
          <Tile label="CUSTOMERS WITH THE APP" value={d.customers_with_app ?? '—'} />
        </div>
        <div className={grid}>
          <Pane title="PHONES">
            <Bar parts={plat.map(([k, v]) => ({ value: v, colour: pCol[k.toLowerCase()] || C.blue }))} />
            {plat.map(([k, v]) => <Row key={k} label={k === 'ios' ? 'iPhone' : k === 'android' ? 'Android' : k} value={v} />)}
            {!plat.length && <div className="text-[11px]" style={{ color: C.muted }}>No phones set up for notifications yet.</div>}
            <Row label="Signed in right now" value={d.signed_in_now} />
          </Pane>
          <Pane title="NOTIFICATIONS">
            <Row label="Sent" value={d.notifications.sent} /><Row label="By push" value={d.notifications.pushed} />
            <Row label="By text" value={d.notifications.texted} /><Row label="Read" value={d.notifications.read} />
          </Pane>
          <NotYet title="Store downloads aren't connected yet.">The App Store and Google Play report them; Octos will import those reports every night.</NotYet>
          <NotYet title="Orders from the app aren't told apart yet.">Each online order will be stamped app or website at checkout.</NotYet>
        </div>
      </div>
    </div>
  )
}
