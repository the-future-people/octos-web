// src/components/attendant/QuickPriceCheck.jsx
//
// "How much is…?" at the counter (16 Nov 2026): pick a service, set how many,
// and the branch's real price comes back from the pricing engine, the same
// one New job uses. Services that need sizes or options say so instead.
import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { getServices, calculatePrice } from '../../api/bm'
import { todayCard, CardHead } from './TodayCard'

const money = n => `GHS ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

export default function QuickPriceCheck() {
  const { user } = useAuth()
  const branchId = typeof user?.branch === 'object' ? user?.branch?.id : user?.branch
  const [search, setSearch] = useState('')
  const [service, setService] = useState(null)
  const [qty, setQty] = useState(1)
  const quantity = useDebounced(qty)

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => getServices().then(r => (Array.isArray(r.data) ? r.data : (r.data?.results || []))),
    staleTime: 120_000,
  })

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q || service) return []
    return services.filter(s => s.is_active !== false && !s.addon_only && s.name.toLowerCase().includes(q)).slice(0, 5)
  }, [search, services, service])

  const { data: price, isFetching, isError } = useQuery({
    queryKey: ['quickPrice', service?.id, quantity, branchId],
    queryFn: () => calculatePrice({ service: service.id, branch: branchId, quantity }).then(r => r.data),
    enabled: !!service && !!branchId && quantity > 0,
    staleTime: 60_000,
    retry: false,
  })

  const pick = s => { setService(s); setSearch(s.name); setQty(1) }
  const clear = () => { setService(null); setSearch('') }
  const total = price?.total != null ? Number(price.total) : null

  return (
    <section className={`today-rise ${todayCard} p-4`} style={{ animationDelay: '160ms' }}>
      <CardHead tone="blue" icon="tag" title="Quick price check" />

      <div className="relative">
        <input value={search} onChange={e => { setSearch(e.target.value); setService(null) }}
          placeholder="What does the customer want?"
          className="w-full h-10 pl-9 pr-9 rounded-xl border border-[var(--today-line)] bg-[var(--bg)] text-sm text-[var(--text)] outline-none focus:border-[var(--text-3)] transition-colors" />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        {search && (
          <button onClick={clear} aria-label="Clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-full text-[var(--text-3)] hover:text-[var(--text)]">✕</button>
        )}
        {matches.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-lg overflow-hidden">
            {matches.map(s => (
              <button key={s.id} onClick={() => pick(s)}
                className="w-full text-left px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg)] flex justify-between gap-3">
                <span className="truncate">{s.name}</span>
                {s.unit && <span className="text-[11px] text-[var(--text-3)] shrink-0">per {s.unit.toLowerCase()}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {service ? (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-[var(--border)] overflow-hidden">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Fewer"
              className="w-8 h-9 text-[var(--text-2)] hover:bg-[var(--bg)]">−</button>
            <input value={qty} inputMode="numeric" aria-label="How many"
              onChange={e => setQty(Math.max(1, parseInt(e.target.value.replace(/\D/g, '') || '1', 10)))}
              className="w-12 h-9 text-center text-sm font-semibold bg-transparent text-[var(--text)] outline-none" />
            <button onClick={() => setQty(q => q + 1)} aria-label="More"
              className="w-8 h-9 text-[var(--text-2)] hover:bg-[var(--bg)]">+</button>
          </div>
          <div className="ml-auto text-right min-h-[36px]">
            {isError ? (
              <p className="text-xs text-[var(--text-3)] max-w-[170px]">This one needs sizes or options. Price it in New job.</p>
            ) : total != null ? (
              <>
                <div className={`text-lg font-black text-[var(--text)] tabular-nums transition-opacity ${isFetching ? 'opacity-50' : ''}`}>{money(total)}</div>
                {quantity > 1 && <div className="text-[11px] text-[var(--text-3)]">{money(total / quantity)} each</div>}
              </>
            ) : (
              <div className="text-xs text-[var(--text-3)] pt-2">Working it out…</div>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[11.5px] text-[var(--text-3)]">The branch's own prices, the same as New job.</p>
      )}
    </section>
  )
}
