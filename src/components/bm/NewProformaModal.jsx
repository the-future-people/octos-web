// src/components/bm/NewProformaModal.jsx
import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getServices, calculatePrice, getBulkPricing, getCustomers, createProforma } from '../../api/bm'
import { useAuth } from '../../context/AuthContext'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toFixed(2)}`
}

export default function NewProformaModal({ onClose, onSuccess }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [search,        setSearch]        = useState('')
  const [cart,          setCart]          = useState([])
  const [customer,      setCustomer]      = useState(null)
  const [custSearch,    setCustSearch]    = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactPhone,  setContactPhone]  = useState('')
  const [contactEmail,  setContactEmail]  = useState('')
  const [notes,         setNotes]         = useState('')
  const [error,         setError]         = useState('')
  const [selected,      setSelected]      = useState(null)
  const [selQty,        setSelQty]        = useState(1)
  const [selPages,      setSelPages]      = useState(1)
  const [selRingSize,   setSelRingSize]   = useState(null)
  const [selOutputMode, setSelOutputMode] = useState(null)

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

  const needsNetworkPrice = !!(selRingSize || selOutputMode)

  const localPrice = useMemo(() => {
    if (!selected || needsNetworkPrice) return null
    const rule = bulkPricing[selected.id] || bulkPricing[String(selected.id)]
    if (!rule) return null
    const base = parseFloat(rule.base_price)
    const multiplier = parseFloat(rule.color_multiplier)
    const unit = (rule.unit || '').toUpperCase().replace('PER_', '')
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

  // Proformas quote work that gets made. Instant counter services are not
  // quoted — a customer standing at the till is told the price.
  const grouped = useMemo(() => {
    const groups = {}
    servicesRaw
      .filter(s => s.is_active && s.category !== 'INSTANT')
      .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))
      .forEach(s => {
        const key = s.name.match(/^(A3|A4|A5|DL|Zeta)/)?.[0] || 'Other'
        if (!groups[key]) groups[key] = []
        groups[key].push(s)
      })
    return groups
  }, [servicesRaw, search])

  const { data: custResults = [] } = useQuery({
    queryKey: ['custLookup', custSearch],
    queryFn:  () => getCustomers({ search: custSearch.trim(), page_size: 5 }).then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d?.results || [])
    }),
    enabled:  custSearch.length >= 2 && !customer,
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
    // A zero line on a proforma is worse than on a job: it is a price
    // promised to a customer. Conditional services price over the network,
    // so there is a window after selection where selPrice is undefined.
    if (!selPrice || parseFloat(selPrice.total) <= 0) return
    setCart(c => [...c, {
      _id: Date.now(),
      service: selected,
      quantity: selQty,
      pages: selPages,
      ring_size: selRingSize,
      output_mode: selOutputMode,
      _price: selPrice?.total || 0,
    }])
    setSelected(null)
  }

  const removeFromCart = (id) => setCart(c => c.filter(i => i._id !== id))
  const cartTotal = cart.reduce((s, i) => s + parseFloat(i._price || 0), 0)

  const { mutate, isPending } = useMutation({
    mutationFn: (payload) => createProforma(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proformas'] })
      onSuccess?.()
      onClose()
    },
    onError: (err) => {
      const d = err.response?.data
      if (!d) { setError('Could not save this proforma.'); return }
      if (typeof d === 'string') { setError(d); return }
      if (d.detail) { setError(d.detail); return }
      const first = Object.values(d).flat().find(v => typeof v === 'string')
      setError(first || 'Could not save this proforma.')
    },
  })

  const handleSubmit = () => {
    if (isPending) return
    setError('')
    if (!customer)      { setError('Choose a registered customer first.'); return }
    if (cart.length === 0) { setError('Add at least one service.'); return }
    mutate({
      customer:       customer.id,
      contact_person: contactPerson,
      contact_phone:  contactPhone,
      contact_email:  contactEmail,
      notes,
      line_items: cart.map(item => ({
        service:  item.service.id,
        quantity: item.quantity,
        pages:    item.pages,
        is_color: item.service.smart_defaults?.is_color ?? false,
        ...(item.ring_size   ? { ring_size:   item.ring_size   } : {}),
        ...(item.output_mode ? { output_mode: item.output_mode } : {}),
      })),
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 animate-fadeIn">
      <div className="rounded-2xl shadow-2xl w-full max-w-3xl h-[92vh] flex flex-col
        overflow-hidden animate-slideUp bg-[var(--bg)]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 shrink-0">
          <div>
            <div className="font-bold text-lg text-[var(--text)]">New Proforma</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">
              Saved as a draft — issue it when you are ready to send
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
              hover:bg-black/10 text-[var(--text-3)] transition-colors text-lg">✕
          </button>
        </div>

        <div className="px-6 pt-4 shrink-0 space-y-2">
          <div className="relative">
            <input type="text" value={custSearch}
              onChange={e => { setCustSearch(e.target.value); setCustomer(null) }}
              placeholder="Which customer is this for?"
              className={`w-full px-3 py-2.5 text-sm border rounded-xl outline-none transition-colors
                ${customer
                  ? 'bg-green-50 border-green-300 text-green-800 font-semibold'
                  : 'bg-white/60 border-black/15 focus:border-black/30'
                }`}
            />
            {custSearch && (
              <button onClick={() => { setCustSearch(''); setCustomer(null) }}
                className="absolute right-3 top-2.5 text-black/30 hover:text-black/50 text-sm">✕</button>
            )}
            {custResults.length > 0 && !customer && (
              <div className="absolute top-11 left-0 right-0 bg-[var(--panel)]
                border border-[var(--border)] rounded-xl shadow-lg z-20 overflow-hidden">
                {custResults.slice(0, 5).map(c => (
                  <button key={c.id}
                    onClick={() => {
                      setCustomer(c)
                      setCustSearch(c.customer_type !== 'INDIVIDUAL' ? (c.company_name || c.full_name) : c.full_name)
                      if (c.customer_type !== 'INDIVIDUAL' && c.full_name) setContactPerson(c.full_name)
                      if (c.phone) setContactPhone(c.phone)
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
            {custSearch.length >= 2 && !customer && custResults.length === 0 && (
              <div className="mt-1.5 text-[11px] text-[var(--text-3)]">
                Not found. Proformas go to registered customers only — register them under Customers first.
              </div>
            )}
          </div>

          {customer && (
            <div className="grid grid-cols-3 gap-2">
              <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)}
                placeholder="Contact person"
                className="px-2.5 py-2 text-xs bg-white/60 border border-black/10 rounded-lg outline-none" />
              <input type="text" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                placeholder="Phone"
                className="px-2.5 py-2 text-xs bg-white/60 border border-black/10 rounded-lg outline-none" />
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                placeholder="Email"
                className="px-2.5 py-2 text-xs bg-white/60 border border-black/10 rounded-lg outline-none" />
            </div>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden mt-4">
          <div className="flex-1 flex flex-col overflow-hidden px-6 border-r border-black/10">
            <input type="text" value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null) }}
              placeholder="Search services..."
              className="w-full px-3 py-2 text-sm bg-white/60 border border-black/10
                rounded-lg outline-none focus:border-black/20 mb-3 shrink-0" />

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
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
                            ${selected?.id === s.id
                              ? 'bg-zinc-900 text-white border-transparent'
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
                              ? 'bg-zinc-900 text-white border-transparent'
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
                      {Array.from({ length: 27 }, (_, i) => 8 + i * 2).map(size => (
                        <button key={size} onClick={() => setSelRingSize(size)}
                          className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors
                            ${selRingSize === size
                              ? 'bg-zinc-900 text-white border-transparent'
                              : 'bg-white/60 border-black/10 text-[var(--text-2)]'
                            }`}>
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isBinding(selected) ? (
                  <div className="mb-2">
                    <label className="text-[9px] font-bold text-[var(--text-3)] uppercase
                      tracking-wider block mb-1">Documents</label>
                    <input type="number" min="1" value={selQty}
                      onChange={e => setSelQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2 py-1.5 text-sm bg-white/60 border border-black/10
                        rounded-lg outline-none" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="text-[9px] font-bold text-[var(--text-3)] uppercase
                        tracking-wider block mb-1">Sheets</label>
                      <input type="number" min="1" value={selPages}
                        onChange={e => setSelPages(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-2 py-1.5 text-sm bg-white/60 border border-black/10
                          rounded-lg outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-[var(--text-3)] uppercase
                        tracking-wider block mb-1">Copies</label>
                      <input type="number" min="1" value={selQty}
                        onChange={e => setSelQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-2 py-1.5 text-sm bg-white/60 border border-black/10
                          rounded-lg outline-none" />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-green-50 border border-green-200
                    rounded-lg flex items-center justify-between">
                    <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Total</span>
                    <span className="font-mono font-black text-sm text-green-700">
                      {selPrice ? fmt(selPrice.total) : '...'}
                    </span>
                  </div>
                  <button onClick={addToCart}
                    disabled={!selPrice || parseFloat(selPrice.total) <= 0}
                    className="px-4 py-2 bg-zinc-900 text-white text-sm font-bold rounded-lg
                      hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-40">
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="hidden md:flex w-60 flex-col px-4 shrink-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Lines</span>
              <span className="text-xs text-[var(--text-3)]">
                {cart.length} item{cart.length !== 1 ? 's' : ''}
              </span>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <p className="text-xs text-[var(--text-3)]">Nothing quoted yet</p>
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
                        {item.ring_size ? `${item.quantity} × ${item.ring_size}mm` : `${item.quantity} × ${item.pages}pp`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-xs font-bold text-[var(--text)]">
                        {fmt(item._price)}
                      </span>
                      <button onClick={() => removeFromCart(item._id)}
                        className="text-black/25 hover:text-red-500 transition-colors text-xs">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="shrink-0 pt-3 border-t border-black/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">Total</span>
                  <span className="font-mono font-black text-base text-[var(--text)]">{fmt(cartTotal)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-2 px-3 py-2 bg-red-50 border border-red-200
            rounded-lg text-xs text-red-600 shrink-0">{error}</div>
        )}

        <div className="px-6 py-4 flex items-center justify-between gap-3 shrink-0
          border-t border-black/10">
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Note for this proforma (optional)"
            className="flex-1 px-3 py-2 text-xs bg-white/60 border border-black/10
              rounded-lg outline-none" />
          <button onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)]
              hover:text-[var(--text)] transition-colors">Cancel</button>
          <button onClick={handleSubmit}
            disabled={isPending || cart.length === 0 || !customer}
            className="px-5 py-2.5 bg-zinc-900 text-white text-sm font-bold rounded-xl
              disabled:opacity-40 hover:opacity-90 transition-opacity whitespace-nowrap">
            {isPending ? 'Saving...' : `Save Draft · ${fmt(cartTotal)}`}
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}