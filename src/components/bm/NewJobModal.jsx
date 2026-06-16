// src/components/bm/NewJobModal.jsx
import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getServices, calculatePrice, getBulkPricing, createJob, getCustomers } from '../../api/bm'
import { invalidateAfterJobCreated } from '../../api/invalidations'
import { useAuth } from '../../context/AuthContext'
import JobSuccessOverlay from '../shared/JobSuccessOverlay'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toFixed(2)}`
}
const JOB_TYPE_THEME = {
  INSTANT:    { accent: 'bg-zinc-900',   tab: 'bg-zinc-900',   tint: 'bg-zinc-50'   },
  PRODUCTION: { accent: 'bg-blue-600',   tab: 'bg-blue-600',   tint: 'bg-blue-50'   },
  DESIGN:     { accent: 'bg-violet-600', tab: 'bg-violet-600', tint: 'bg-violet-50' },
}

export default function NewJobModal({ onClose, onSuccess }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [jobType,       setJobType]       = useState('INSTANT')
  const [search,        setSearch]        = useState('')
  const [cart,          setCart]          = useState([])
  const [customer,      setCustomer]      = useState(null)
  const [custSearch,    setCustSearch]    = useState('')
  const [error,         setError]         = useState('')
  const [successJob,    setSuccessJob]    = useState(null)
  const [selected,      setSelected]      = useState(null)
  const [selQty,        setSelQty]        = useState(1)
  const [selPages,      setSelPages]      = useState(1)
  const [selRingSize,   setSelRingSize]   = useState(null)
  const [selOutputMode, setSelOutputMode] = useState(null)

  // Debounced values for pricing query — prevents a request on every keystroke
  const [debouncedQty,   setDebouncedQty]   = useState(1)
  const [debouncedPages, setDebouncedPages] = useState(1)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQty(selQty), 400)
    return () => clearTimeout(t)
  }, [selQty])
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPages(selPages), 400)
    return () => clearTimeout(t)
  }, [selPages])

  const isBinding  = (s) => s?.name?.toLowerCase().includes('binding')
  const isPassport = (s) => s?.name?.toLowerCase().includes('passport')
  const theme = JOB_TYPE_THEME[jobType]

  const { data: servicesRaw = [] } = useQuery({
    queryKey: ['services'],
    queryFn:  () => getServices().then(r => r.data),
    staleTime: 60_000,
  })

  const branchId = user?.branch || 2
  const { data: bulkPricing = {} } = useQuery({
    queryKey: ['bulkPricing', branchId],
    queryFn:  () => getBulkPricing(branchId).then(r => r.data),
    staleTime: 300_000,
  })

  // Local price calculation from bulk map — instant, no network call
  // Falls back to network only for conditional/tiered services (binding, passport)
  const needsNetworkPrice = !!(selRingSize || selOutputMode)

  const localPrice = useMemo(() => {
    if (!selected || needsNetworkPrice) return null
    const rule = bulkPricing[selected.id] || bulkPricing[String(selected.id)]
    if (!rule) return null

    const base       = parseFloat(rule.base_price)
    const multiplier = parseFloat(rule.color_multiplier)
    const unit       = (rule.unit || '').toUpperCase().replace('PER_', '')

    let total
    if (['COPY', 'PIECE', 'PAGE', 'SHEET'].includes(unit)) {
      total = base * debouncedPages * debouncedQty
    } else if (['SQFT', 'SQCM', 'SQM'].includes(unit)) {
      total = base * multiplier * debouncedQty
    } else if (unit === 'JOB') {
      total = base * multiplier
    } else {
      total = base * debouncedPages * debouncedQty
    }
    return { total: total.toFixed(2) }
  }, [selected, bulkPricing, debouncedQty, debouncedPages, needsNetworkPrice])

  const { data: networkPrice } = useQuery({
    queryKey: ['selPrice', selected?.id, debouncedQty, debouncedPages, selRingSize, selOutputMode],
    queryFn: () => calculatePrice({
      service:  selected.id,
      branch:   branchId,
      quantity: debouncedQty,
      pages:    debouncedPages,
      ...(selRingSize   ? { ring_size:   selRingSize   } : {}),
      ...(selOutputMode ? { output_mode: selOutputMode } : {}),
    }).then(r => r.data),
    enabled: !!selected && needsNetworkPrice,
    staleTime: 3_000,
  })

  const selPrice = needsNetworkPrice ? networkPrice : localPrice

  // Alias map — normalises user intent to tokens present in service names.
  // Keys are what users type, values are what the service name contains.
  const SERVICE_ALIASES = [
    { patterns: ['black', 'blk', 'bw', 'b&w', 'mono', 'monochrome', 'grayscale'], resolves: 'b&w' },
    { patterns: ['colour', 'color', 'col', 'clr'],                                 resolves: 'colour' },
    { patterns: ['print'],                                                          resolves: 'print' },
    { patterns: ['copy', 'cop', 'copi'],                                            resolves: 'cop'   },
    { patterns: ['bind', 'ring'],                                                   resolves: 'bind'  },
    { patterns: ['passport', 'pass', 'pas'],                                        resolves: 'passport' },
    { patterns: ['laminate', 'lam'],                                                resolves: 'laminat' },
  ]

  const resolveToken = (tok) => {
    for (const { patterns, resolves } of SERVICE_ALIASES) {
      if (patterns.some(p => p.startsWith(tok) || tok.startsWith(p))) return resolves
    }
    return tok
  }

  const matchesSearch = (name, query) => {
    if (!query) return true
    const target = name.toLowerCase()
    const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
    // Every token must match — either directly or via alias — order independent
    return tokens.every(tok => {
      const resolved = resolveToken(tok)
      return target.includes(tok) || target.includes(resolved)
    })
  }

  const grouped = useMemo(() => {
    const groups = {}
    servicesRaw
      .filter(s => s.is_active && s.category === jobType)
      .filter(s => matchesSearch(s.name, search))
      .forEach(s => {
        const key = s.name.match(/^(A3|A4|A5|DL|Zeta)/)?.[0] || 'Other'
        if (!groups[key]) groups[key] = []
        groups[key].push(s)
      })
    return groups
  }, [servicesRaw, jobType, search])

  const { data: custResults = [] } = useQuery({
    queryKey: ['custLookup', custSearch],
    queryFn:  () => getCustomers({ search: custSearch.trim(), page_size: 5 }).then(r => {
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
    console.log('ADDING TO CART — selQty:', selQty, 'selPages:', selPages)
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
    mutationFn: (payload) => createJob(payload),
    onSuccess: (res) => {
      invalidateAfterJobCreated(queryClient)
      setSuccessJob(res.data?.job_number || res.data?.id || '—')
    },
    onError: (err) => {
      const d = err.response?.data
      if (!d) { setError('Failed to create job.'); return }
      if (typeof d === 'string') { setError(d); return }
      if (d.detail) { setError(d.detail); return }
      if (d.non_field_errors) { setError(Array.isArray(d.non_field_errors) ? d.non_field_errors[0] : d.non_field_errors); return }
      // Field errors — pick the first one
      const first = Object.values(d).flat().find(v => typeof v === 'string')
      setError(first || 'Failed to create job.')
    },
  })

  const handleSubmit = () => {
    if (isPending) return
    setError('')
    if (cart.length === 0) { setError('Add at least one service.'); return }
    const payload = {
      job_type:           jobType,
      branch:             user?.branch || 2,
      intake_channel:     'WALK_IN',
      deposit_percentage: 100,
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
    console.log('JOB PAYLOAD:', JSON.stringify(payload, null, 2))
    mutate(payload)
  }

  const modal = createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 animate-fadeIn">
      <div className={`rounded-2xl shadow-2xl w-full max-w-3xl h-[92vh] flex flex-col
        overflow-hidden animate-slideUp transition-colors duration-300 ${theme.tint}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 shrink-0">
          <div>
            <div className="font-bold text-lg text-[var(--text)]">New Job</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">Record a new job for this branch</div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
              hover:bg-black/10 text-[var(--text-3)] transition-colors text-lg">✕
          </button>
        </div>

        {/* Job type tabs */}
        <div className="px-6 pt-4 shrink-0">
          <div className="grid grid-cols-3 gap-1 bg-black/10 p-1 rounded-xl">
            {['INSTANT', 'PRODUCTION', 'DESIGN'].map(t => (
              <button key={t}
                onClick={() => { setJobType(t); setCart([]); setSelected(null) }}
                className={`py-2 text-sm font-bold rounded-lg transition-colors
                  ${jobType === t
                    ? `${JOB_TYPE_THEME[t].tab} text-white shadow-sm`
                    : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                  }`}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Customer input */}
        <div className="px-6 pt-4 shrink-0">
          <div className="relative">
            <input
              type="text"
              value={custSearch}
              onChange={e => { setCustSearch(e.target.value); setCustomer(null) }}
              placeholder="Whose job is this? (leave blank for walk-in)"
              className={`w-full px-3 py-2.5 text-sm border rounded-xl outline-none transition-colors
                ${customer
                  ? 'bg-green-50 border-green-300 text-green-800 font-semibold'
                  : 'bg-red-100 border-red-300 text-red-600 placeholder-red-400 focus:border-red-400'
                }`}
            />
            {custSearch && (
              <button onClick={() => { setCustSearch(''); setCustomer(null) }}
                className="absolute right-3 top-2.5 text-black/30 hover:text-black/50 text-sm">
                ✕
              </button>
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
                    {c.affiliation_name && c.affiliation_active && (
                      <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5
                        bg-blue-50 border border-blue-200 rounded text-[10px] font-semibold text-blue-700">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        </svg>
                        {c.affiliation_name}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Body — 2 columns */}
        <div className="flex flex-1 overflow-hidden mt-4 gap-0">

          {/* Left — services */}
          <div className="flex-1 flex flex-col overflow-hidden px-6 border-r border-black/10">
            <input type="text" value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null) }}
              placeholder="Search services..."
              className="w-full px-3 py-2 text-sm bg-white/60 border border-black/10
                rounded-lg outline-none focus:border-black/20 mb-3 shrink-0"
            />

            <div className="flex-1 overflow-y-auto space-y-3 pb-2">
              {Object.keys(grouped).length === 0 ? (
                <div className="text-sm text-[var(--text-3)] text-center py-8">No services found</div>
              ) : (
                Object.entries(grouped).map(([grp, items]) => (
                  <div key={grp}>
                    <div className="text-[9px] font-bold text-[var(--text-3)] uppercase
                      tracking-widest mb-1.5">{grp}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map(s => (
                        <button key={s.id} onClick={() => selectService(s)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border
                            transition-colors
                            ${selected?.id === s.id
                              ? `${theme.accent} text-white border-transparent`
                              : 'bg-white/60 border-black/10 text-[var(--text-2)] hover:border-black/20'
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
              <div className="shrink-0 border-t border-black/10 pt-3 pb-1">
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                  tracking-wider mb-2">{selected.name}</div>

                {isPassport(selected) && (
                  <div className="mb-2">
                    <label className="text-[9px] font-bold text-[var(--text-3)] uppercase
                      tracking-wider block mb-1">Output Mode</label>
                    <div className="flex gap-1.5">
                      {[
                        { label: 'Print',           value: 'PRINT'         },
                        { label: 'Print + Digital', value: 'PRINT_DIGITAL' },
                        { label: 'Digital Only',    value: 'DIGITAL'       },
                      ].map(opt => (
                        <button key={opt.value} onClick={() => setSelOutputMode(opt.value)}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors
                            ${selOutputMode === opt.value
                              ? `${theme.accent} text-white border-transparent`
                              : 'bg-white/60 border-black/10 text-[var(--text-2)]'
                            }`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isBinding(selected) && (
                  <div className="mb-2">
                    <label className="text-[9px] font-bold text-[var(--text-3)] uppercase
                      tracking-wider block mb-1">Ring Size (mm)</label>
                    <div className="flex flex-wrap gap-1">
                      {[6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36].map(size => (
                        <button key={size} onClick={() => setSelRingSize(size)}
                          className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors
                            ${selRingSize === size
                              ? `${theme.accent} text-white border-transparent`
                              : 'bg-white/60 border-black/10 text-[var(--text-2)]'
                            }`}>
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[9px] font-bold text-[var(--text-3)] uppercase
                      tracking-wider block mb-1">
                      {isBinding(selected) ? 'Documents' : 'Sheets'}
                    </label>
                    <input type="number" min="1" value={selPages}
                      onChange={e => setSelPages(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2 py-1.5 text-sm bg-white/60 border border-black/10
                        rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-[var(--text-3)] uppercase
                      tracking-wider block mb-1">Copies</label>
                    <input type="number" min="1" value={selQty}
                      onChange={e => setSelQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2 py-1.5 text-sm bg-white/60 border border-black/10
                        rounded-lg outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-green-50 border border-green-200
                    rounded-lg flex items-center justify-between">
                    <span className="text-xs font-bold text-green-700 uppercase tracking-wider">
                      Total
                    </span>
                    <span className="font-mono font-black text-sm text-green-700">
                      {selPrice ? fmt(selPrice.total) : '...'}
                    </span>
                  </div>
                  <button onClick={addToCart}
                    className={`px-4 py-2 text-white text-sm font-bold rounded-lg
                      hover:opacity-90 transition-opacity flex items-center gap-1.5
                      whitespace-nowrap ${theme.accent}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Add to Cart
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right — cart (hidden on mobile, visible on md+) */}
          <div className="hidden md:flex w-60 flex-col px-4 shrink-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Cart</span>
              <span className="text-xs text-[var(--text-3)]">
                {cart.length} item{cart.length !== 1 ? 's' : ''}
              </span>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <svg className="w-8 h-8 text-black/15 mb-2" fill="none"
                  stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-xs text-[var(--text-3)]">No items yet</p>
                <p className="text-[10px] text-[var(--text-3)] mt-1">Select a service to begin</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1.5 pb-2">
                {cart.map(item => (
                  <div key={item._id}
                    className="flex items-start justify-between gap-2 px-3 py-2
                      bg-white/60 border border-black/10 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[var(--text)] truncate leading-tight">
                        {item.service.name}
                      </div>
                      <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                        {item.quantity} × {item.pages}pp
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-xs font-bold text-[var(--text)]">
                        {fmt(item._price)}
                      </span>
                      <button onClick={() => removeFromCart(item._id)}
                        className="text-black/25 hover:text-red-500 transition-colors">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="shrink-0 pt-3 border-t border-black/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">
                    Total
                  </span>
                  <span className="font-mono font-black text-base text-[var(--text)]">
                    {fmt(cartTotal)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-2 px-3 py-2 bg-red-50 border border-red-200
            rounded-lg text-xs text-red-600 shrink-0">{error}</div>
        )}

        {/* Mobile cart bar */}
        <div className="md:hidden shrink-0 border-t border-black/10 px-4 py-3">
          {cart.length > 0 && (
            <div className="mb-2 space-y-1 max-h-24 overflow-y-auto">
              {cart.map(item => (
                <div key={item._id} className="flex items-center justify-between
                  px-2 py-1 bg-white/60 border border-black/10 rounded-lg">
                  <span className="text-xs font-medium text-[var(--text)] truncate flex-1 mr-2">
                    {item.service.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs font-bold">{fmt(item._price)}</span>
                    <button onClick={() => removeFromCart(item._id)}
                      className="text-black/25 hover:text-red-500">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-3 py-2.5 text-sm font-semibold text-[var(--text-2)]
                hover:text-[var(--text)] transition-colors border border-black/10
                rounded-xl">
              Cancel
            </button>
            <button onClick={handleSubmit}
              disabled={isPending || cart.length === 0}
              className={`flex-1 py-2.5 text-white text-sm font-bold rounded-xl
                disabled:opacity-40 hover:opacity-90 transition-opacity
                flex items-center justify-center gap-2 ${theme.accent}`}>
              {cart.length > 0 && (
                <span className="bg-white/20 text-white text-xs font-black
                  px-1.5 py-0.5 rounded-full">{cart.length}</span>
              )}
              {isPending ? 'Creating...' : `Create Job · ${fmt(cartTotal)}`}
            </button>
          </div>
        </div>

        {/* Desktop footer */}
        <div className="hidden md:flex px-6 py-4 items-center justify-end gap-3 shrink-0
          border-t border-black/10">
          <button onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)]
              hover:text-[var(--text)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit}
            disabled={isPending || cart.length === 0}
            className={`px-5 py-2.5 text-white text-sm font-bold rounded-xl
              disabled:opacity-40 hover:opacity-90 transition-opacity
              flex items-center gap-2 ${theme.accent}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {isPending ? 'Creating...' : 'Create Job'}
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
  return (
    <>
      {modal}
      {successJob && (
        <JobSuccessOverlay
          jobNumber={successJob}
          onDone={() => {
            setSuccessJob(null)
            onSuccess?.()
            onClose()
          }}
        />
      )}
    </>
  )
}