// src/components/eye/lenses/Stock.jsx
import { eyeStock } from '../../../api/eye'
import Network from '../Network'
import { C } from '../theme'
import { Failed, Loading, NotYet } from '../ui'
import { useEye } from './common'

// Until a branch has done its first count, there is nothing true to show.
export default function Stock({ nav }) {
  const q = useEye(['stock', nav.scope], () => eyeStock({ scope: nav.scope }))
  if (q.isLoading) return <Loading />
  if (q.error) return <Failed error={q.error} />
  return (
    <div>
      <div className="px-3 pt-3"><div className="font-bold text-[19px]" style={{ color: C.text, fontFamily: "'Syne', sans-serif" }}>{q.data.scope.name} · Inventory</div></div>
      <Network centre={{ value: 'Not counted', colour: C.faint }}
               ring1={['Media', 'Ink', 'Finishing'].map(k => ({ id: k, label: k, shape: 'hollow', colour: C.faint, weight: 1 }))} />
      <div className="px-3 pb-3"><NotYet title="No branch has done its first stock count yet.">Octos knows what's bought through procurement, but not what's on the shelf. After a first count, each item shows as a gauge against its reorder level, and every later count is checked against what Octos expected.</NotYet></div>
    </div>
  )
}
