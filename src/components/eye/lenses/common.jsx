// src/components/eye/lenses/common.jsx
import { useQuery } from '@tanstack/react-query'
import { C } from '../theme'

// Every lens refreshes itself once a minute while it is open.
export function useEye(key, fn) {
  return useQuery({ queryKey: ['eye', ...key], queryFn: fn, refetchInterval: 60000, staleTime: 20000 })
}

// The breadcrumb, place name and child pills that head every lens.
export function ScopeHead({ data, lensName, nav, right }) {
  const path = data?.path || []
  return (
    <div className="flex justify-between items-end gap-2 flex-wrap px-3 pt-3">
      <div className="min-w-0">
        <div className="text-[9.5px] font-bold tracking-[.6px]" style={{ color: C.muted }}>
          {path.slice(0, -1).map((p, i) => <span key={p.key}>
            {i > 0 && ' › '}
            <span className="cursor-pointer underline" onClick={() => nav.go(p.key)}>{p.name.toUpperCase()}</span>
          </span>)}
          {path.length <= 1 && 'WHOLE COMPANY'}
        </div>
        <div className="font-bold text-[19px]" style={{ color: C.text, fontFamily: "'Syne', sans-serif" }}>
          {data?.scope?.name}{lensName ? ` · ${lensName}` : ''}
        </div>
        {data?.children?.length > 0 && <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {data.children.map(c => <button key={c.key} onClick={() => nav.go(c.key)}
            className="text-[11px] px-2.5 py-1 rounded-full" style={{ border: `1px solid #3a3833`, color: C.text2 }}>{c.name}</button>)}
        </div>}
      </div>
      {right}
    </div>
  )
}

export function PeriodPills({ nav }) {
  return (
    <div className="flex gap-1.5">
      {[['today', 'Today'], ['week', 'This week'], ['month', 'This month']].map(([k, l]) =>
        <button key={k} onClick={() => nav.setPeriod(k)} className="text-[11px] px-2.5 py-1 rounded-full"
                style={nav.period === k ? { background: C.gold, color: '#1a1a1a', fontWeight: 700 } : { border: '1px solid #3a3833', color: C.muted }}>
          {k === 'today' && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: C.green }} />}{l}
        </button>)}
    </div>
  )
}

export const grid = 'grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]'
export const tiles = 'grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]'
