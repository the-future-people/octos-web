// src/components/bm/LateJobModal.jsx
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getServices, calculatePrice, getCustomers } from '../../api/bm'
import { useAuth } from '../../context/AuthContext'
import client from '../../api/client'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toFixed(2)}`
}

function normalisePhone(val) {
  if (!val) return val
  val = val.trim().replace(/[\s\-().]/g, '')
  if (val.startsWith('+233')) return '0' + val.slice(4)
  if (val.startsWith('233') && val.length >= 12) return '0' + val.slice(3)
  return val
}

const THEME = {
  accent: 'bg-amber-500',
  tab:    'bg-amber-500',
  tint:   'bg-amber-50',
}

const JOB_TYPE_THEME = {
  INSTANT:    { accent: 'bg-amber-600',  tab: 'bg-amber-600',  tint: 'bg-amber-50'   },
  PRODUCTION: { accent: 'bg-amber-700',  tab: 'bg-amber-700',  tint: 'bg-amber-50'   },
  DESIGN:     { accent: 'bg-amber-800',  tab: 'bg-amber-800',  tint: 'bg-amber-50'   },
}

export default function LateJobModal({ onClose, onSuccess }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [jobType,       setJobType]       = useState('INSTANT')
  const [search,        setSearch]        = useState('')
  const [cart,          setCart]          = useState([])
  const [customer,      setCustomer]      = useState(null)
  const [custSearch,    setCustSearch]    = useState('')
  const [reason,        setReason]        = useState('')
  const [error,         setError]         = useState('')
  const [selected,      setSelected]      = useState(null)
  const [selQty,        setSelQty]        = useState(1)
  const [selPages,      setSelPages]      = useState(1)
  const [selRingSize,   setSelRingSize]   = useState(null)
  const [selOutputMode, setSelOutputMode] = useState(null)

  const isBinding  = (s) => s?.name?.toLowerCase().includes('binding')
  const isPassport = (s) => s?.name?.toLowerCase().includes('passport')
  const theme = JOB_TYPE_THEME[jobType]

  const { data: servicesRaw = [] } = useQuery({
    queryKey: ['services'],
    queryFn:  () => getServices().then(r => r.data),
    staleTime: 60_000,
  })

  const { data: selPrice } = useQuery({
    queryKey: ['selPrice', selected?.id, selQty, selPages, selRingSize, selOutputMode],
    queryFn: () => calculatePrice({
      service:  selected.id,
      branch:   user?.branch || 2,
      quantity: selQty,
      pages:    selPages,
      ...(selRingSize   ? { ring_size:   selRingSize   } : {}),
      ...(selOutputMode ? { output_mode: selOutputMode } : {}),
    }).then(r => r.data),
    enabled: !!selected,
    staleTime: 3_000,
  })

  const grouped = useMemo(() => {
    const groups = {}
    servicesRaw
      .filter(s => s.is_active && s.category === jobType)
      .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))
      .forEach(s => {
        const key = s.name.match(/^(A3|A4|A5|DL|Zeta)/)?.[0] || 'Other'
        if (!groups[key]) groups[key] = []
        groups[key].push(s)
      })
    return groups
  }, [servicesRaw, jobType, search])

  const { data: custResults = [] } = useQuery({
    queryKey: ['custLookup', custSearch],
    queryFn:  () => getCustomers({ search: normalisePhone(custSearch), page_size: 5 }).then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d?.results || [])
    }),
    enabled:  custSearch.length >= 2,
    staleTime: 10_000,
  })

  const selectService = (service) => {
    setSelected(service)
    setSelQty(service.smart_defaults?.quantity || 1)
    setSelPages(service.smart_defaults?.pages || 1)
    setSelRingSize(isBinding(service) ? 10 : null)
    setSelOutputMode(isPassport(service) ? 'PRINT' : null)
  }

  const addToCart = () => {
    if (!selected) return
    setCart(c => [...c, {
      _id:     Date.now(),
      service: selected,
      quantity: selQty,
      pages:    selPages,
      ring_size:   selRingSize,
      output_mode: selOutputMode,
      _price:  selPrice?.total || 0,
    }])
    setSelected(null)
  }

  const removeFromCart = (id) => setCart(c => c.filter(i => i._id !== id))
  const cartTotal = cart.reduce((s, i) => s + parseFloat(i._price || 0), 0)

  const { mutate, isPending } = useMutation({
    mutationFn: (payload) => client.post('/api/v1/jobs/late/', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['jobStats']     })
      queryClient.invalidateQueries({ queryKey: ['recentJobs']   })
      queryClient.invalidateQueries({ queryKey: ['todaySummary'] })
      onSuccess?.(res.data)
      onClose()
    },
    onError: (err) => {
      const d = err.response?.data
      if (!d)              { setError('Failed to create job.'); return }
      if (typeof d === 'string') { setError(d); return }
      if (d.detail)        { setError(Array.isArray(d.detail) ? d.detail.join(' · ') : d.detail); return }
      if (d.non_field_errors) { setError(Array.isArray(d.non_field_errors) ? d.non_field_errors[0] : d.non_field_errors); return }
      const first = Object.values(d).flat().find(v => typeof v === 'string')
      setError(first || 'Failed to create late job.')
    },
  })

  const handleSubmit = () => {
    if (isPending) return
    setError('')
    if (cart.length === 0)  { setError('Add at least one service.'); return }
    if (!reason.trim())     { setError('Reason is required — this record is audited by HQ.'); return }

    const payload = {
      job_type:             jobType,
      branch:               user?.branch || 2,
      intake_channel:       'WALK_IN',
      deposit_percentage:   100,
      post_closing_reason:  reason.trim(),
      line_items: cart.map(item => ({
        service:     item.service.id,
        quantity:    item.quantity,
        pages:       item.pages,
        is_color:    item.service.smart_defaults?.is_color ?? false,
        sets:        item.quantity,
        ...(item.ring_size   ? { ring_size:   item.ring_size   } : {}),
        ...(item.output_mode ? { output_mode: item.output_mode } : {}),
      })),
      ...(customer ? { customer: customer.id } : {}),
    }
    mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 animate-fadeIn"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="rounded-2xl shadow-2xl w-full max-w-3xl h-[92vh] flex flex-col
        overflow-hidden animate-slideUp bg-amber-50 border-2 border-amber-300">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-200 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-amber-500 text-lg">⏰</span>
              <div className="font-bold text-lg text-amber-900">Record Late Job</div>
            </div>
            <div className="text-xs text-amber-600 mt-0.5">Post-closing · audited by HQ</div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
              hover:bg-amber-200 text-amber-600 transition-colors text-lg">✕
          </button>
        </div>

        {/* Warning banner */}
        <div className="mx-6 mt-4 px-4 py-3 bg-amber-100 border border-amber-300
          rounded-xl flex items-start gap-2.5 shrink-0">
          <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
          <div className="text-xs text-amber-800 leading-relaxed">
            Shift has ended. This job is flagged as post-closing and logged against your account.
            If the cashier has signed off, the job will be held — you keep the cash tonight
            and hand over to the cashier tomorrow morning.
          </div>
        </div>

        {/* Job type tabs */}
        <div className="px-6 pt-4 shrink-0">
          <div className="grid grid-cols-3 gap-1 bg-amber-200/50 p-1 rounded-xl">
            {['INSTANT', 'PRODUCTION', 'DESIGN'].map(t => (
              <button key={t}
                onClick={() => { setJobType(t); setCart([]); setSelected(null) }}
                className={`py-2 text-sm font-bold rounded-lg transition-colors
                  ${jobType === t
                    ? `${JOB_TYPE_THEME[t].tab} text-white shadow-sm`
                    : 'text-amber-700 hover:text-amber-900'
                  }`}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Customer input */}
        <div className="px-6 pt-3 shrink-0">
          <div className="relative">
            <input type="text" value={custSearch}
              onChange={e => { setCustSearch(e.target.value); setCustomer(null) }}
              placeholder="Whose job is this? (leave blank for walk-in)"
              className={`w-full px-3 py-2.5 text-sm border rounded-xl outline-none transition-colors
                ${customer
                  ? 'bg-green-50 border-green-300 text-green-800 font-semibold'
                  : 'bg-white/70 border-amber-200 text-amber-800 placeholder-amber-400 focus:border-amber-400'
                }`}
            />
            {custSearch && (
              <button onClick={() => { setCustSearch(''); setCustomer(null) }}
                className="absolute right-3 top-2.5 text-amber-400 hover:text-amber-600 text-sm">✕</button>
            )}
            {custResults.length > 0 && !customer && (
              <div className="absolute top-11 left-0 right-0 bg-[var(--panel)]
                border border-[var(--border)] rounded-xl shadow-lg z-20 overflow-hidden">
                {custResults.slice(0, 5).map(c => (
                  <button key={c.id}
                    onClick={() => {
                      setCustomer(c)
                      setCustSearch(c.customer_type !== 'INDIVIDUAL' ? (c.company_name || c.full_name) : c.full_name)
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-[var(--bg)]
                      border-b border-[var(--border)] last:border-0 transition-colors">
                    <div className="text-sm font-medium text-[var(--text)]">
                      {c.customer_type !== 'INDIVIDUAL' ? (c.company_name || c.full_name) : c.full_name}
                    </div>
                    <div className="text-xs text-[var(--text-3)]">
                      {c.customer_type !== 'INDIVIDUAL' && c.full_name ? `Rep: ${c.full_name} · ` : ''}{c.phone}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Body — 2 columns */}
        <div className="flex flex-1 overflow-hidden mt-3 gap-0">

          {/* Left — services */}
          <div className="flex-1 flex flex-col overflow-hidden px-6 border-r border-amber-200">
            <input type="text" value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null) }}
              placeholder="Search services..."
              className="w-full px-3 py-2 text-sm bg-white/60 border border-amber-200
                rounded-lg outline-none focus:border-amber-400 mb-3 shrink-0"
            />

            <div className="flex-1 overflow-y-auto space-y-3 pb-2">
              {Object.keys(grouped).length === 0 ? (
                <div className="text-sm text-amber-600 text-center py-8">No services found</div>
              ) : (
                Object.entries(grouped).map(([grp, items]) => (
                  <div key={grp}>
                    <div className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">{grp}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map(s => (
                        <button key={s.id} onClick={() => selectService(s)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
                            ${selected?.id === s.id
                              ? `${theme.accent} text-white border-transparent`
                              : 'bg-white/60 border-amber-200 text-amber-800 hover:border-amber-400'
                            }`}>
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Inline editor */}
            {selected && (
              <div className="shrink-0 border-t border-amber-200 pt-3 pb-1">
                <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2">{selected.name}</div>

                {isPassport(selected) && (
                  <div className="mb-2">
                    <label className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block mb-1">Output Mode</label>
                    <div className="flex gap-1.5">
                      {[{label:'Print',value:'PRINT'},{label:'Print + Digital',value:'PRINT_DIGITAL'},{label:'Digital Only',value:'DIGITAL'}].map(opt => (
                        <button key={opt.value} onClick={() => setSelOutputMode(opt.value)}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors
                            ${selOutputMode === opt.value ? `${theme.accent} text-white border-transparent` : 'bg-white/60 border-amber-200 text-amber-700'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isBinding(selected) && (
                  <div className="mb-2">
                    <label className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block mb-1">Ring Size (mm)</label>
                    <div className="flex flex-wrap gap-1">
                      {[6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36].map(size => (
                        <button key={size} onClick={() => setSelRingSize(size)}
                          className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors
                            ${selRingSize === size ? `${theme.accent} text-white border-transparent` : 'bg-white/60 border-amber-200 text-amber-700'}`}>
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block mb-1">
                      {isBinding(selected) ? 'Documents' : 'Sheets'}
                    </label>
                    <input type="number" min="1" value={selPages}
                      onChange={e => setSelPages(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2 py-1.5 text-sm bg-white/60 border border-amber-200 rounded-lg outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block mb-1">Copies</label>
                    <input type="number" min="1" value={selQty}
                      onChange={e => setSelQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2 py-1.5 text-sm bg-white/60 border border-amber-200 rounded-lg outline-none" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                    <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Total</span>
                    <span className="font-mono font-black text-sm text-green-700">{selPrice ? fmt(selPrice.total) : '...'}</span>
                  </div>
                  <button onClick={addToCart}
                    className={`px-4 py-2 text-white text-sm font-bold rounded-lg
                      hover:opacity-90 transition-opacity flex items-center gap-1.5 whitespace-nowrap ${theme.accent}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Add to Cart
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right — cart + reason */}
          <div className="w-60 flex flex-col px-4 shrink-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Cart</span>
              <span className="text-xs text-amber-600">{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <svg className="w-8 h-8 text-amber-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-xs text-amber-600">No items yet</p>
                <p className="text-[10px] text-amber-500 mt-1">Select a service to begin</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1.5 pb-2">
                {cart.map(item => (
                  <div key={item._id}
                    className="flex items-start justify-between gap-2 px-3 py-2 bg-white/60 border border-amber-200 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-amber-900 truncate leading-tight">{item.service.name}</div>
                      <div className="text-[10px] text-amber-600 mt-0.5">{item.quantity} × {item.pages}pp</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-xs font-bold text-amber-800">{fmt(item._price)}</span>
                      <button onClick={() => removeFromCart(item._id)} className="text-amber-300 hover:text-red-500 transition-colors">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="shrink-0 pt-2 border-t border-amber-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Total</span>
                  <span className="font-mono font-black text-base text-amber-900">{fmt(cartTotal)}</span>
                </div>
              </div>
            )}

            {/* Reason field */}
            <div className="shrink-0 mt-3 pt-3 border-t border-amber-200">
              <label className="text-[9px] font-bold text-amber-700 uppercase tracking-wider block mb-1.5">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Why is this job recorded after closing? Audited by HQ."
                className="w-full px-2 py-2 text-xs bg-white/70 border border-amber-200 rounded-lg
                  outline-none focus:border-amber-400 resize-none text-amber-900 placeholder-amber-400" />
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 shrink-0">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end gap-3 shrink-0 border-t border-amber-200">
          <button onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-amber-700 hover:text-amber-900 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isPending || cart.length === 0}
            className="px-5 py-2.5 bg-amber-500 text-white text-sm font-bold rounded-xl
              disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {isPending ? 'Recording…' : 'Record Late Job'}
          </button>
        </div>

      </div>
    </div>
  )
}