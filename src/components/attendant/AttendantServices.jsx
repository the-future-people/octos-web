// src/components/attendant/AttendantServices.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import { useAuth } from '../../context/AuthContext'

function fmt(n) { return `GHS ${parseFloat(n||0).toLocaleString('en-GH',{minimumFractionDigits:2})}` }

const CATEGORY_CONFIG = {
  INSTANT:    { label:'Instant',    bg:'bg-zinc-800',   text:'text-white' },
  PRODUCTION: { label:'Production', bg:'bg-blue-600',   text:'text-white' },
  DESIGN:     { label:'Design',     bg:'bg-violet-600', text:'text-white' },
}

export default function AttendantServices() {
  const { user } = useAuth()
  const branchId = typeof user?.branch==='object' ? user?.branch?.id : (user?.branch||2)
  const [category, setCategory] = useState('ALL')
  const [search,   setSearch]   = useState('')

  const { data: services = [], isLoading: svcLoading } = useQuery({
    queryKey: ['services'],
    queryFn:  () => client.get('/api/v1/jobs/services/').then(r => r.data),
    staleTime: 120_000,
  })

  const { data: pricing = [] } = useQuery({
    queryKey: ['pricing', branchId],
    queryFn:  () => client.get(`/api/v1/jobs/pricing/?branch=${branchId}`).then(r => {
      const d=r.data; return Array.isArray(d)?d:(d?.results||[])
    }),
    staleTime: 120_000,
  })

  const pricingMap = pricing.reduce((acc,p) => {
    const key = typeof p.service==='object' ? p.service?.id : p.service
    acc[key]=p; return acc
  }, {})

  const filtered = services
    .filter(s => category==='ALL' || s.category===category)
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))

  const grouped = filtered.reduce((acc,s) => {
    if (!acc[s.category]) acc[s.category]=[]
    acc[s.category].push(s); return acc
  }, {})

  return (
    <div className="p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[var(--text)]">Services</h2>
        <p className="text-xs text-[var(--text-3)] mt-0.5">{services.length} services · read-only</p>
      </div>

      {/* Search */}
      <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Search services…"
        className="w-full px-3 py-2.5 bg-[var(--panel)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] outline-none focus:border-[var(--border-dark)] transition-colors" />

      {/* Category tabs */}
      <div className="flex gap-1 bg-black/5 p-1 rounded-xl">
        {[
          {key:'ALL',        label:`All (${services.length})`},
          {key:'INSTANT',    label:`Instant (${services.filter(s=>s.category==='INSTANT').length})`},
          {key:'PRODUCTION', label:`Production (${services.filter(s=>s.category==='PRODUCTION').length})`},
          {key:'DESIGN',     label:`Design (${services.filter(s=>s.category==='DESIGN').length})`},
        ].map(t=>(
          <button key={t.key} onClick={()=>setCategory(t.key)}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors
              ${category===t.key?'bg-[var(--panel)] text-[var(--text)] shadow-sm':'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {svcLoading ? (
        <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse"/>)}</div>
      ) : category==='ALL' ? (
        <div className="space-y-5">
          {['INSTANT','PRODUCTION','DESIGN'].map(cat=>{
            const items=grouped[cat]||[]; if (!items.length) return null
            const cfg=CATEGORY_CONFIG[cat]
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                  <div className="flex-1 h-px bg-[var(--border)]"/>
                  <span className="text-[10px] text-[var(--text-3)]">{items.length}</span>
                </div>
                <div className="space-y-1.5">
                  {items.map(s=>{
                    const p=pricingMap[s.id]
                    return (
                      <div key={s.id} className="bg-[var(--panel)] border border-[var(--border)] rounded-xl flex items-center gap-4 px-4 py-3">
                        {s.image ? (
                          <img src={s.image} alt={s.name} className="w-12 h-10 object-cover rounded-lg shrink-0 bg-[var(--bg)]"/>
                        ) : (
                          <div className="w-12 h-10 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--border-dark)]">
                              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-[var(--text)]">{s.name}</div>
                          {s.description && <div className="text-[10px] text-[var(--text-3)] mt-0.5 truncate">{s.description}</div>}
                          <div className="flex items-center gap-2 mt-1">
                            {p ? (
                              <>
                                <span className="text-xs font-mono font-bold text-emerald-600">{fmt(p.base_price)} <span className="text-[10px] text-[var(--text-3)] font-normal">B&W</span></span>
                                {parseFloat(p.color_multiplier)>1 && (
                                  <span className="text-xs font-mono font-bold text-amber-600">{fmt(parseFloat(p.base_price)*parseFloat(p.color_multiplier))} <span className="text-[10px] text-[var(--text-3)] font-normal">Colour</span></span>
                                )}
                              </>
                            ) : (
                              <span className="text-[10px] text-[var(--text-3)] italic">No pricing set</span>
                            )}
                            <span className="text-[10px] text-[var(--text-3)]">{s.code}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(s=>{
            const p=pricingMap[s.id]
            return (
              <div key={s.id} className="bg-[var(--panel)] border border-[var(--border)] rounded-xl flex items-center gap-4 px-4 py-3">
                {s.image ? (
                  <img src={s.image} alt={s.name} className="w-12 h-10 object-cover rounded-lg shrink-0"/>
                ) : (
                  <div className="w-12 h-10 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--border-dark)]"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[var(--text)]">{s.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {p ? (
                      <>
                        <span className="text-xs font-mono font-bold text-emerald-600">{fmt(p.base_price)} B&W</span>
                        {parseFloat(p.color_multiplier)>1 && <span className="text-xs font-mono font-bold text-amber-600">{fmt(parseFloat(p.base_price)*parseFloat(p.color_multiplier))} Colour</span>}
                      </>
                    ) : <span className="text-[10px] text-[var(--text-3)] italic">No pricing</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}