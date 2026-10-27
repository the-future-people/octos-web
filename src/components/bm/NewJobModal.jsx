// src/components/bm/NewJobModal.jsx
//
// Recording a job at the counter.
//
// Instant work (a photocopy, a quick print) keeps a compact window: it is
// done there and then. Production and design open the window out, because
// they carry more: the customer and who the job is for, each item's sizes,
// finishing and file, and a promise. Three columns: what to make, the item
// being set up, and the cart with everything the customer is told (total,
// deposit, ready time) above the button that creates the job.
//
// Every price and promise comes from the server; the browser does no
// pricing of its own. Files are checked exactly as the app checks them and
// go with the job, so they reach the floor through Octos and nothing else.

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getServices, calculatePrice, createJob, getCustomers, getPromise } from '../../api/bm'
import { invalidateAfterJobCreated } from '../../api/invalidations'
import { useAuth } from '../../context/AuthContext'
import JobSuccessOverlay from '../shared/JobSuccessOverlay'
import CounterArtwork from '../shared/CounterArtwork'
import NewCustomerModal from './NewCustomerModal'
import client from '../../api/client'

const fmt = n => `GHS ${parseFloat(n || 0).toFixed(2)}`
const TYPES = [['INSTANT', 'Instant'], ['PRODUCTION', 'Production'], ['DESIGN', 'Design']]
const UNIT = { PER_SQFT: 'per sq ft', PER_SQCM: 'per sq cm', PER_COPY: 'per copy', PER_PAGE: 'per page',
               PER_SHEET: 'per sheet', PER_PIECE: 'per piece', PER_JOB: 'per job' }
const ROLE = { REP: 'Rep', STAFF: 'Staff', OWNER: 'Owner', MEMBER: 'Member' }
const H = 'text-[10px] font-black uppercase tracking-[0.08em] text-[var(--text-3)]'
const FIELD = `w-full px-3 py-2.5 text-sm bg-white border border-black/10 rounded-xl outline-none
               focus:border-blue-400 transition-colors disabled:bg-black/[0.03] disabled:text-[var(--text-2)]`

function readyLabel(iso) {
  const at = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const time = at.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (at.toDateString() === today.toDateString()) return `${time} today`
  if (at.toDateString() === tomorrow.toDateString()) return `${time} tomorrow`
  return `${at.toLocaleDateString('en-GB', { weekday: 'long' })} ${time}`
}

const initials = c => ((c?.customer_type !== 'INDIVIDUAL' && c?.company_name)
  ? c.company_name.slice(0, 2)
  : `${c?.first_name?.[0] || ''}${c?.last_name?.[0] || ''}`).toUpperCase() || '?'
const nameOf = c => (c?.customer_type !== 'INDIVIDUAL' ? (c?.company_name || c?.full_name) : c?.full_name)

export default function NewJobModal({ onClose, onSuccess }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [jobType,       setJobType]       = useState('INSTANT')
  const [search,        setSearch]        = useState('')
  const [cart,          setCart]          = useState([])
  const [customer,      setCustomer]      = useState(null)
  // For an organisation the person is linked to: its job, with them as who
  // ordered it. null means for the person themself.
  const [orderFor,      setOrderFor]      = useState(null)
  const [custSearch,    setCustSearch]    = useState('')
  const [registering,   setRegistering]   = useState(false)
  const [error,         setError]         = useState('')
  const [successJob,    setSuccessJob]    = useState(null)
  const [selected,      setSelected]      = useState(null)
  const [selQty,        setSelQty]        = useState(1)
  const [selPages,      setSelPages]      = useState(1)
  const [selRingSize,   setSelRingSize]   = useState(null)
  const [specValues,    setSpecValues]    = useState({})
  const [selOutputMode, setSelOutputMode] = useState(null)
  const [selArtwork,    setSelArtwork]    = useState(null)
  // The finishing ticked for the item being set up: add-on ids, or, for an
  // envelope, { service, per_copy }. Priced by the server as it's chosen.
  const [selAddons,     setSelAddons]     = useState([])

  const roomy = jobType !== 'INSTANT'
  const wantsFile = jobType === 'PRODUCTION'

  // One request per pause in typing, not per keystroke.
  const [debouncedQty,   setDebouncedQty]   = useState(1)
  const [debouncedPages, setDebouncedPages] = useState(1)
  useEffect(() => { const t = setTimeout(() => setDebouncedQty(selQty), 400); return () => clearTimeout(t) }, [selQty])
  useEffect(() => { const t = setTimeout(() => setDebouncedPages(selPages), 400); return () => clearTimeout(t) }, [selPages])

  const isBinding  = s => s?.name?.toLowerCase().includes('binding')
  const isPassport = s => s?.name?.toLowerCase().includes('passport')

  const { data: servicesRaw = [] } = useQuery({
    queryKey: ['services'],
    queryFn:  () => getServices().then(r => r.data),
    staleTime: 60_000,
  })

  const branchId = typeof user?.branch === 'object' ? user?.branch?.id : user?.branch
  const branchName = typeof user?.branch === 'object' ? user?.branch?.name : ''

  const { data: selPrice, isFetching: priceLoading } = useQuery({
    queryKey: ['selPrice', selected?.id, debouncedQty, debouncedPages,
               selRingSize, selOutputMode, JSON.stringify(specValues)],
    queryFn: () => calculatePrice({
      service:  selected.id,
      branch:   branchId,
      quantity: debouncedQty,
      pages:    debouncedPages,
      ...specValues,
      ...(selRingSize   ? { ring_size:   selRingSize   } : {}),
      ...(selOutputMode ? { output_mode: selOutputMode } : {}),
    }).then(r => r.data),
    enabled: !!selected,
    staleTime: 3_000,
    retry: false,
  })

  // The ticked finishing, priced with the app's own rules (by the sheet,
  // by the copy, one per copy or one for all). Job creation prices it again.
  const { data: addonQuote, isFetching: addonLoading, error: addonError } = useQuery({
    queryKey: ['addonQuote', selected?.id, debouncedQty, debouncedPages, JSON.stringify(specValues), JSON.stringify(selAddons)],
    queryFn: () => client.post('/api/v1/jobs/addons/quote/', {
      service: selected.id, quantity: debouncedQty, pages: debouncedPages,
      specifications: specValues, addons: selAddons,
    }).then(r => r.data),
    enabled: !!selected && selAddons.length > 0,
    staleTime: 3_000,
    retry: false,
  })
  const addonsPriced = selAddons.length ? (addonQuote?.addons || []) : []
  const itemTotal = (parseFloat(selPrice?.total || 0) + (selAddons.length ? parseFloat(addonQuote?.total || 0) : 0))

  function toggleAddon(a) {
    setSelAddons(list => (list.some(x => (x.service ?? x) === a.id)
      ? list.filter(x => (x.service ?? x) !== a.id)
      : [...list, a.packing ? { service: a.id, per_copy: (selQty || 1) > 1 } : a.id]))
  }
  function setPerCopy(id, perCopy) {
    setSelAddons(list => list.map(x => ((x.service ?? x) === id ? { service: id, per_copy: perCopy } : x)))
  }

  const SERVICE_ALIASES = [
    { patterns: ['black', 'blk', 'bw', 'b&w', 'mono', 'monochrome', 'grayscale'], resolves: 'b&w' },
    { patterns: ['colour', 'color', 'col', 'clr'], resolves: 'colour' },
    { patterns: ['print'], resolves: 'print' },
    { patterns: ['copy', 'cop', 'copi'], resolves: 'cop' },
    { patterns: ['bind', 'ring'], resolves: 'bind' },
    { patterns: ['passport', 'pass', 'pas'], resolves: 'passport' },
    { patterns: ['laminate', 'lam'], resolves: 'laminat' },
  ]
  const resolveToken = tok => {
    for (const { patterns, resolves } of SERVICE_ALIASES) {
      if (patterns.some(p => p.startsWith(tok) || tok.startsWith(p))) return resolves
    }
    return tok
  }
  const matchesSearch = (name, query) => {
    if (!query) return true
    const target = name.toLowerCase()
    return query.toLowerCase().trim().split(/\s+/).filter(Boolean)
      .every(tok => target.includes(tok) || target.includes(resolveToken(tok)))
  }

  const grouped = useMemo(() => {
    const groups = {}
    servicesRaw
      .filter(s => s.is_active && s.category === jobType)
      .filter(s => matchesSearch(s.name, search))
      .forEach(s => {
        const key = s.name.match(/^(A3|A4|A5|DL|Zeta)/)?.[0] || 'Other'
        ;(groups[key] = groups[key] || []).push(s)
      })
    return groups
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicesRaw, jobType, search])

  const { data: custResults = [] } = useQuery({
    queryKey: ['custLookup', custSearch],
    queryFn:  () => getCustomers({ search: custSearch.trim(), page_size: 6 }).then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d?.results || [])
    }),
    enabled:  !customer && custSearch.length >= 2,
    staleTime: 10_000,
  })

  function chooseCustomer(c) {
    setCustomer(c); setOrderFor(null); setCustSearch('')
  }

  const selectService = service => {
    setSelected(service)
    setSelQty(service.smart_defaults?.quantity || 1)
    setSelPages(service.smart_defaults?.pages || 1)
    setSelRingSize(isBinding(service) ? 10 : null)
    setSelOutputMode(isPassport(service) ? 'PRINT' : null)
    setSelArtwork(null)
    setSelAddons([])
    // quantity and pages are held in their own state and sent as their
    // own fields; leaving them in specValues too gave two sources for one
    // number, and multi-page jobs were charged for a single page.
    setSpecValues(Object.fromEntries(
      (service.spec_template || [])
        .filter(f => f.key !== 'quantity' && f.key !== 'pages')
        .map(f => [f.key, f.default ?? '']),
    ))
  }

  const needsFile = wantsFile && !!selected?.requires_file_upload
  const fileReady = !needsFile || (selArtwork && selArtwork.verdict !== 'refuse')
  const addonsReady = !selAddons.length || (!!addonQuote && !addonError && !addonLoading)
  const canAdd = !!selPrice && parseFloat(selPrice.total) > 0 && fileReady && addonsReady

  const addToCart = () => {
    if (!selected || !canAdd) return
    setCart(c => [...c, {
      _id: Date.now(),
      service: selected,
      quantity: selQty,
      pages: selPages,
      ring_size: selRingSize,
      output_mode: selOutputMode,
      specifications: { ...specValues },
      _price: itemTotal.toFixed(2),
      artwork: selArtwork,
      addons: selAddons,
      addonsPriced,
    }])
    setSelected(null)
    setSelArtwork(null)
    setSelAddons([])
  }

  // When it would be ready: production and design only. The whole cart,
  // plus whatever is being set up, so "and if I add the flyers?" has an answer.
  const promiseLines = [
    ...cart.map(i => ({ service: i.service.id, quantity: i.quantity, pages: i.pages })),
    ...(selected ? [{ service: selected.id, quantity: debouncedQty, pages: debouncedPages }] : []),
  ]
  const { data: promise, isFetching: promiseLoading, error: promiseError } = useQuery({
    queryKey: ['counterPromise', JSON.stringify(promiseLines)],
    queryFn: () => getPromise(promiseLines).then(r => r.data),
    enabled: roomy && promiseLines.length > 0,
    staleTime: 30_000,
    retry: false,
  })

  const removeFromCart = id => setCart(c => c.filter(i => i._id !== id))
  const cartTotal = cart.reduce((s, i) => s + parseFloat(i._price || 0), 0)

  const { mutate, isPending } = useMutation({
    mutationFn: payload => createJob(payload),
    onSuccess: res => {
      invalidateAfterJobCreated(queryClient)
      setSuccessJob(res.data?.job_number || res.data?.id || '—')
    },
    onError: err => {
      const d = err.response?.data
      if (!d) { setError('That job didn’t save. Try again.'); return }
      if (typeof d === 'string') { setError(d); return }
      if (d.detail) { setError(d.detail); return }
      if (d.non_field_errors) { setError([].concat(d.non_field_errors)[0]); return }
      setError(Object.values(d).flat().find(v => typeof v === 'string') || 'That job didn’t save.')
    },
  })

  const handleSubmit = () => {
    if (isPending) return
    setError('')
    if (cart.length === 0) { setError('Add at least one item.'); return }
    if (jobType !== 'INSTANT' && !customer) {
      setError('Production and design jobs need a customer, for their ready message and collection PIN.')
      return
    }
    if (jobType !== 'INSTANT' && !orderFor && !customer?.phone) {
      setError('This customer has no phone number. Add one, so they can be told when it is ready.')
      return
    }
    mutate({
      job_type: jobType,
      branch: branchId,
      intake_channel: 'WALK_IN',
      deposit_percentage: 100,
      line_items: cart.map(item => ({
        service: item.service.id,
        quantity: item.quantity,
        pages: item.pages,
        is_color: item.service.smart_defaults?.is_color ?? false,
        sets: item.quantity,
        ...(item.ring_size   ? { ring_size: item.ring_size } : {}),
        ...(item.output_mode ? { output_mode: item.output_mode } : {}),
        ...(item.specifications && Object.keys(item.specifications).length ? { specifications: item.specifications } : {}),
        ...(item.artwork?.token ? { artwork_token: item.artwork.token } : {}),
        ...(item.addons?.length ? { addons: item.addons } : {}),
      })),
      // For an organisation: its job, and the person who ordered it.
      ...(customer ? (orderFor
        ? { customer: orderFor.organisation, ordered_by: customer.id }
        : { customer: customer.id }) : {}),
    })
  }

  // What the size reads as, for the file check's words.
  const sizeLabel = (() => {
    const w = specValues.width_in ?? specValues.width_ft
    const h = specValues.height_in ?? specValues.height_ft
    if (!w || !h) return ''
    return `${w} × ${h} ${specValues.width_in != null ? 'in' : 'ft'}`
  })()

  const forName = orderFor ? orderFor.name : null
  const deposit = roomy ? cartTotal * 0.7 : cartTotal

  // ── The parts ──────────────────────────────────────────────────

  const typeTabs = (
    <div className="flex p-[3px] rounded-xl bg-black/[0.06]">
      {TYPES.map(([v, label]) => (
        <button key={v} onClick={() => { setJobType(v); setCart([]); setSelected(null); setSelArtwork(null) }}
                className={`px-4 py-1.5 rounded-[9px] text-[13px] font-bold transition-colors
                            ${jobType === v ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
          {label}
        </button>
      ))}
    </div>
  )

  const customerBar = customer ? (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-black/[0.06] bg-black/[0.015]">
      <span className="w-8 h-8 rounded-full bg-emerald-600 text-white grid place-items-center text-[11px] font-black shrink-0">
        {initials(customer)}
      </span>
      <div className="leading-tight min-w-0">
        <div className="text-sm font-bold truncate">{nameOf(customer)}</div>
        <div className="text-[11px] text-[var(--text-3)]">{customer.phone}</div>
      </div>
      {customer.customer_type === 'INDIVIDUAL' && customer.links?.length > 0 && (
        <div className="flex items-center gap-1.5 ml-4 min-w-0 overflow-x-auto">
          <span className="text-xs text-[var(--text-3)] mr-0.5">For</span>
          <button onClick={() => setOrderFor(null)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap
                              ${!orderFor ? 'bg-[var(--text)] text-white border-transparent' : 'bg-white border-black/10 text-[var(--text-2)]'}`}>
            {customer.gender === 'FEMALE' ? 'Herself' : customer.gender === 'MALE' ? 'Himself' : 'Themself'}
          </button>
          {customer.links.map(l => (
            <button key={l.organisation} onClick={() => setOrderFor(l)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap
                                ${orderFor?.organisation === l.organisation ? 'bg-[var(--text)] text-white border-transparent' : 'bg-white border-black/10 text-[var(--text-2)]'}`}>
              {l.name}<span className="font-normal opacity-70"> · {ROLE[l.role] || l.role}</span>
            </button>
          ))}
        </div>
      )}
      <button onClick={() => { setCustomer(null); setOrderFor(null) }}
              className="ml-auto text-xs font-bold text-blue-700 shrink-0">Change customer</button>
    </div>
  ) : (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-black/[0.06]">
      <div className="relative flex-1">
        <input value={custSearch} onChange={e => setCustSearch(e.target.value)}
               placeholder={jobType === 'INSTANT' ? 'Whose job is this? Leave blank for a walk-in' : 'Whose job is this? Name or number'}
               className={`${FIELD} ${jobType !== 'INSTANT' ? 'border-red-200 bg-red-50/40' : ''}`} />
        {custResults.length > 0 && (
          <div className="absolute z-30 top-full left-0 right-0 mt-1 rounded-xl border border-black/10 bg-[var(--panel)] shadow-xl overflow-hidden">
            {custResults.map(c => (
              <button key={c.id} onClick={() => chooseCustomer(c)}
                      className="w-full px-4 py-2.5 text-left hover:bg-black/[0.03] border-b border-black/[0.05] last:border-0">
                <div className="text-sm font-semibold">{nameOf(c)}</div>
                <div className="text-[11px] text-[var(--text-3)]">
                  {c.customer_type !== 'INDIVIDUAL' && c.full_name ? `Contact: ${c.full_name} · ` : ''}{c.phone}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={() => setRegistering(true)}
              className="px-3.5 py-2.5 rounded-xl border border-black/10 bg-white text-sm font-bold text-blue-700 whitespace-nowrap">
        + Register new
      </button>
    </div>
  )

  const serviceList = (
    <div className="flex flex-col min-h-0">
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className={`${FIELD} mb-3`} />
      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        {Object.keys(grouped).length === 0 && <p className="text-sm text-[var(--text-3)] py-6 text-center">Nothing matches</p>}
        {Object.entries(grouped).map(([grp, items]) => (
          <div key={grp} className="mb-3">
            <div className={`${H} px-2 mb-1`}>{grp}</div>
            {items.map(s => (
              <button key={s.id} onClick={() => selectService(s)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-[13px] transition-colors
                                  ${selected?.id === s.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-[var(--text-2)] hover:bg-black/[0.03]'}`}>
                {s.name}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )

  const specField = field => (
    <div key={field.key}>
      <div className={`${H} mb-1`}>{field.label}{field.unit ? ` (${field.unit})` : ''}</div>
      {field.type === 'select' ? (
        <select value={specValues[field.key] ?? ''} onChange={e => setSpecValues(v => ({ ...v, [field.key]: e.target.value }))}
                className={FIELD}>
          {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : (
        <input type="number" min={field.min ?? 1} max={field.max}
               disabled={field.key === 'pages' && !!selArtwork?.page_count}
               value={field.key === 'quantity' ? selQty : field.key === 'pages' ? selPages : (specValues[field.key] ?? '')}
               onChange={e => {
                 // Raw while typing: clamping each keystroke turned 168 into 6.
                 const raw = e.target.value
                 const n = raw === '' ? '' : parseInt(raw)
                 if (field.key === 'quantity') setSelQty(n)
                 else if (field.key === 'pages') { if (!selArtwork?.page_count) setSelPages(n) }
                 else setSpecValues(v => ({ ...v, [field.key]: n }))
               }}
               onBlur={e => {
                 const n = Math.max(field.min ?? 1, parseInt(e.target.value) || (field.min ?? 1))
                 if (field.key === 'quantity') setSelQty(n)
                 else if (field.key === 'pages') { if (!selArtwork?.page_count) setSelPages(n) }
                 else setSpecValues(v => ({ ...v, [field.key]: n }))
               }}
               onKeyDown={e => { if (e.key === 'Enter') addToCart() }}
               className={FIELD} />
      )}
    </div>
  )

  const editor = !selected ? (
    <div className="h-full grid place-items-center text-center px-6">
      <div>
        <div className="text-sm font-semibold text-[var(--text-2)]">Choose what to make</div>
        <div className="text-xs text-[var(--text-3)] mt-1">Pick a service on the left to set it up</div>
      </div>
    </div>
  ) : (
    <div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-lg font-black">{selected.name}</span>
        {UNIT[selected.unit] && <span className="text-xs text-[var(--text-3)]">priced {UNIT[selected.unit]}</span>}
      </div>

      {isPassport(selected) && (
        <div className="mt-4">
          <div className={`${H} mb-1`}>Output</div>
          <div className="flex gap-1.5">
            {[['PRINT', 'Print'], ['PRINT_DIGITAL', 'Print + digital'], ['DIGITAL', 'Digital only']].map(([v, t]) => (
              <button key={v} onClick={() => setSelOutputMode(v)}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border ${selOutputMode === v ? 'bg-blue-600 text-white border-transparent' : 'bg-white border-black/10'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
      {isBinding(selected) && (
        <div className="mt-4">
          <div className={`${H} mb-1`}>Ring size (mm)</div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 27 }, (_, i) => 8 + i * 2).map(size => (
              <button key={size} onClick={() => setSelRingSize(size)}
                      className={`px-2 py-1 text-[11px] font-bold rounded-lg border ${selRingSize === size ? 'bg-blue-600 text-white border-transparent' : 'bg-white border-black/10'}`}>
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
        {(selected.spec_template || []).length > 0
          ? selected.spec_template.map(specField)
          : [
            { key: 'pages', label: 'Sheets', min: 1 },
            { key: 'quantity', label: 'Copies', min: 1 },
          ].map(specField)}
      </div>

      {roomy && (selected.addons || []).length > 0 && (
        <div className="mt-5">
          <div className={`${H} mb-1.5`}>Finishing</div>
          <div className="flex flex-wrap gap-2">
            {selected.addons.map(a => {
              const on = selAddons.some(x => (x.service ?? x) === a.id)
              const priced = addonsPriced.find(x => x.service === a.id)
              return (
                <button key={a.id} type="button" onClick={() => toggleAddon(a)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[13px] font-semibold transition-colors
                                    ${on ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-black/10 bg-white text-[var(--text-2)] hover:border-black/25'}`}>
                  <span className={`w-4 h-4 rounded grid place-items-center text-[10px] text-white
                                    ${on ? 'bg-blue-600' : 'border-[1.5px] border-black/20'}`}>{on ? '✓' : ''}</span>
                  {a.name}
                  {on && priced && (
                    <span className="font-normal text-[var(--text-3)]">
                      +{parseFloat(priced.total).toFixed(2)}{priced.detail ? ` · ${priced.detail}` : ''}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {selected.addons.filter(a => a.packing && selAddons.some(x => x.service === a.id)).map(a => {
            const choice = selAddons.find(x => x.service === a.id)
            return (selQty || 1) > 1 && (
              <div key={a.id} className="mt-2 inline-flex p-[3px] rounded-xl bg-black/[0.05]">
                {[[true, 'One per copy'], [false, 'One for all']].map(([v, t]) => (
                  <button key={t} type="button" onClick={() => setPerCopy(a.id, v)}
                          className={`px-3 py-1 rounded-[9px] text-xs font-bold ${choice?.per_copy === v ? 'bg-white shadow-sm text-[var(--text)]' : 'text-[var(--text-3)]'}`}>
                    {a.name}: {t.toLowerCase()}
                  </button>
                ))}
              </div>
            )
          })}
          {addonError && <p className="mt-1.5 text-xs text-red-600">{addonError.response?.data?.detail || 'That finishing couldn’t be priced.'}</p>}
        </div>
      )}

      {wantsFile && (
        <div className="mt-5">
          <div className={`${H} mb-1.5`}>
            Customer’s file{needsFile && <span className="text-red-600 normal-case tracking-normal font-bold"> · needed</span>}
          </div>
          <CounterArtwork
            service={selected}
            specifications={specValues}
            result={selArtwork}
            required={needsFile}
            sizeLabel={sizeLabel}
            onResult={r => {
              setSelArtwork(r)
              // A document's pages come from the file: front and back puts
              // two on a sheet. The server counts again from the file.
              if (r?.page_count) {
                const perSheet = /2[- ]?sided|front and back|double/i.test(selected.name) ? 2 : 1
                setSelPages(Math.max(1, Math.ceil(r.page_count / perSheet)))
              }
            }}
          />
        </div>
      )}

      <div className="mt-6 flex items-end gap-4">
        <div>
          <div className={H}>Item total</div>
          <div className="text-xl font-black tabular-nums" style={{ opacity: priceLoading || addonLoading ? 0.45 : 1 }}>
            {selPrice ? fmt(itemTotal) : '…'}
          </div>
          {selAddons.length > 0 && selPrice && (
            <div className="text-[11px] text-[var(--text-3)]">includes finishing {fmt(addonQuote?.total || 0)}</div>
          )}
        </div>
        <button onClick={addToCart} disabled={!canAdd}
                className="ml-auto px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-black disabled:bg-black/10 disabled:text-[var(--text-3)]">
          Add to cart ↵
        </button>
      </div>
      {needsFile && !fileReady && (
        <p className="mt-1.5 text-right text-[11px] text-[var(--text-3)]">Adds once the file is checked and printable</p>
      )}
    </div>
  )

  const cartPanel = (
    <div className="flex flex-col h-full min-h-0">
      <div className={`${H} mb-2`}>Cart{cart.length ? ` · ${cart.length} item${cart.length === 1 ? '' : 's'}` : ''}</div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {cart.length === 0 && <p className="text-xs text-[var(--text-3)] py-6 text-center">Nothing added yet</p>}
        {cart.map(item => (
          <div key={item._id} className="py-2.5 border-b border-black/[0.06] group">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold truncate">{item.service.name}</div>
                <div className="text-[11px] text-[var(--text-3)]">
                  {item.specifications?.width_in && item.specifications?.height_in
                    ? `${item.specifications.width_in} × ${item.specifications.height_in} in · ${item.quantity}`
                    : `${item.quantity} × ${item.pages}pp`}
                </div>
                {item.addonsPriced?.length > 0 && (
                  <div className="text-[11px] text-[var(--text-3)] truncate">
                    + {item.addonsPriced.map(x => x.service_name + (x.detail ? ` (${x.detail})` : '')).join(', ')}
                  </div>
                )}
                {item.artwork && (
                  <div className={`text-[11px] font-semibold truncate ${item.artwork.verdict === 'warn' ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {item.artwork.filename} · {item.artwork.verdict === 'warn' ? 'worth a look' : 'good to print'}
                  </div>
                )}
              </div>
              <span className="text-[13px] font-bold tabular-nums">{parseFloat(item._price).toFixed(2)}</span>
              <button onClick={() => removeFromCart(item._id)} aria-label="Remove"
                      className="text-[var(--text-3)] hover:text-red-600 text-xs opacity-60 group-hover:opacity-100">✕</button>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 mt-2 border-t border-black/[0.06]">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-[var(--text-3)]">Total</span>
          <span className="text-lg font-black tabular-nums">{fmt(cartTotal)}</span>
        </div>
        {roomy && cartTotal > 0 && (
          <div className="flex justify-between text-xs text-[var(--text-3)] mt-0.5">
            <span>Deposit to start (70%)</span><b className="text-[var(--text)] tabular-nums">{fmt(deposit)}</b>
          </div>
        )}
        {roomy && (promiseError ? (
          <p className="mt-2 text-[11px] text-amber-700">
            Octos couldn’t give a ready time: {promiseError.response?.data?.detail || 'it could not be reached.'}
          </p>
        ) : promise?.ready_at ? (
          <p className="mt-2 text-xs text-blue-700" style={{ opacity: promiseLoading ? 0.5 : 1 }}>
            <b>Ready about {readyLabel(promise.ready_at)}</b>{branchName ? ` · ${branchName}` : ''}
            {selected ? <span className="text-[var(--text-3)]"> (with this item)</span> : null}
          </p>
        ) : null)}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <button onClick={handleSubmit} disabled={isPending || cart.length === 0}
                className="mt-3 w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-black disabled:opacity-40">
          {isPending ? 'Creating…' : forName ? `Create job for ${forName}` : 'Create job'}
        </button>
        <button onClick={onClose} className="mt-1.5 w-full py-2 text-xs font-semibold text-[var(--text-3)]">Cancel</button>
      </div>
    </div>
  )


  // ── Instant: the compact window, as it has always been ─────────
  const THEME = { accent: 'bg-zinc-900', tab: 'bg-zinc-900', tint: 'bg-zinc-50' }
  const instantModal = (
    <div className={`rounded-2xl shadow-2xl w-full max-w-3xl h-[92vh] flex flex-col overflow-hidden animate-slideUp ${THEME.tint}`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 shrink-0">
        <div>
          <div className="font-bold text-lg text-[var(--text)]">New Job</div>
          <div className="text-xs text-[var(--text-3)] mt-0.5">Record a new job for this branch</div>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 text-[var(--text-3)] text-lg">✕</button>
      </div>

      <div className="px-6 pt-4 shrink-0">
        <div className="grid grid-cols-3 gap-1 bg-black/10 p-1 rounded-xl">
          {TYPES.map(([v, label]) => (
            <button key={v} onClick={() => { setJobType(v); setCart([]); setSelected(null); setSelArtwork(null) }}
                    className={`py-2 text-sm font-bold rounded-lg transition-colors
                                ${jobType === v ? 'bg-zinc-900 text-white shadow-sm' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pt-4 shrink-0">
        <div className="relative">
          <input type="text"
                 value={customer ? nameOf(customer) : custSearch}
                 onChange={e => { setCustSearch(e.target.value); setCustomer(null); setOrderFor(null) }}
                 placeholder="Whose job is this? (leave blank for walk-in)"
                 className={`w-full px-3 py-2.5 text-sm border rounded-xl outline-none transition-colors
                             ${customer ? 'bg-green-50 border-green-300 text-green-800 font-semibold'
                                        : 'bg-red-100 border-red-300 text-red-600 placeholder-red-400 focus:border-red-400'}`} />
          {(custSearch || customer) && (
            <button onClick={() => { setCustSearch(''); setCustomer(null); setOrderFor(null) }}
                    className="absolute right-3 top-2.5 text-black/30 hover:text-black/50 text-sm">✕</button>
          )}
          {custResults.length > 0 && !customer && (
            <div className="absolute top-11 left-0 right-0 bg-[var(--panel)] border border-[var(--border)] rounded-xl shadow-lg z-20 overflow-hidden">
              {custResults.slice(0, 5).map(c => (
                <button key={c.id} onClick={() => chooseCustomer(c)}
                        className="w-full px-4 py-2.5 text-left hover:bg-[var(--bg)] border-b border-[var(--border)] last:border-0">
                  <div className="text-sm font-medium text-[var(--text)]">{nameOf(c)}</div>
                  <div className="text-xs text-[var(--text-3)]">
                    {c.customer_type !== 'INDIVIDUAL' && c.full_name ? `Rep: ${c.full_name} · ` : ''}{c.phone}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden mt-4">
        <div className="flex-1 flex flex-col overflow-hidden px-6 border-r border-black/10">
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setSelected(null) }}
                 placeholder="Search services..."
                 className="w-full px-3 py-2 text-sm bg-white/60 border border-black/10 rounded-lg outline-none focus:border-black/20 mb-3 shrink-0" />
          <div className="flex-1 overflow-y-auto space-y-3 pb-2">
            {Object.keys(grouped).length === 0 ? (
              <div className="text-sm text-[var(--text-3)] text-center py-8">No services found</div>
            ) : Object.entries(grouped).map(([grp, items]) => (
              <div key={grp}>
                <div className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1.5">{grp}</div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map(s => (
                    <button key={s.id} onClick={() => selectService(s)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
                                        ${selected?.id === s.id ? 'bg-zinc-900 text-white border-transparent'
                                                                : 'bg-white/60 border-black/10 text-[var(--text-2)] hover:border-black/20'}`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {selected && (
            <div className="shrink-0 border-t border-black/10 pt-3 pb-1">
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-2">{selected.name}</div>
              {isPassport(selected) && (
                <div className="mb-2 flex gap-1.5">
                  {[['PRINT', 'Print'], ['PRINT_DIGITAL', 'Print + Digital'], ['DIGITAL', 'Digital Only']].map(([v, t]) => (
                    <button key={v} onClick={() => setSelOutputMode(v)}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${selOutputMode === v ? 'bg-zinc-900 text-white border-transparent' : 'bg-white/60 border-black/10 text-[var(--text-2)]'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
              {isBinding(selected) && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {Array.from({ length: 27 }, (_, i) => 8 + i * 2).map(size => (
                    <button key={size} onClick={() => setSelRingSize(size)}
                            className={`px-2 py-1 text-[10px] font-bold rounded border ${selRingSize === size ? 'bg-zinc-900 text-white border-transparent' : 'bg-white/60 border-black/10 text-[var(--text-2)]'}`}>
                      {size}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 mb-2">
                {(selected.spec_template || []).length > 0
                  ? selected.spec_template.map(specField)
                  : [{ key: 'pages', label: 'Sheets', min: 1 }, { key: 'quantity', label: 'Copies', min: 1 }].map(specField)}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                  <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Total</span>
                  <span className="font-mono font-black text-sm text-green-700" style={{ opacity: priceLoading ? 0.45 : 1 }}>
                    {selPrice ? fmt(selPrice.total) : '...'}
                  </span>
                </div>
                <button onClick={addToCart} disabled={!canAdd}
                        className="px-4 py-2 text-white text-sm font-bold rounded-lg bg-zinc-900 disabled:opacity-40 whitespace-nowrap">
                  + Add to Cart
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-60 flex flex-col px-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Cart</span>
            <span className="text-xs text-[var(--text-3)]">{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
          </div>
          {cart.length === 0 ? (
            <div className="flex-1 grid place-items-center text-center">
              <div><p className="text-xs text-[var(--text-3)]">No items yet</p><p className="text-[10px] text-[var(--text-3)] mt-1">Select a service to begin</p></div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1.5 pb-2">
              {cart.map(item => (
                <div key={item._id} className="flex items-start justify-between gap-2 px-3 py-2 bg-white/60 border border-black/10 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[var(--text)] truncate">{item.service.name}</div>
                    <div className="text-[10px] text-[var(--text-3)] mt-0.5">{item.quantity} × {item.pages}pp</div>
                  </div>
                  <span className="font-mono text-xs font-bold">{fmt(item._price)}</span>
                  <button onClick={() => removeFromCart(item._id)} className="text-black/25 hover:text-red-500 text-xs">✕</button>
                </div>
              ))}
            </div>
          )}
          {cart.length > 0 && (
            <div className="shrink-0 pt-3 border-t border-black/10 flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">Total</span>
              <span className="font-mono font-black text-base text-[var(--text)]">{fmt(cartTotal)}</span>
            </div>
          )}
        </div>
      </div>

      {error && <div className="mx-6 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 shrink-0">{error}</div>}

      <div className="flex px-6 py-4 items-center justify-end gap-3 shrink-0 border-t border-black/10">
        <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)]">Cancel</button>
        <button onClick={handleSubmit} disabled={isPending || cart.length === 0}
                className="px-5 py-2.5 text-white text-sm font-bold rounded-xl bg-zinc-900 disabled:opacity-40">
          {isPending ? 'Creating...' : 'Create Job'}
        </button>
      </div>
    </div>
  )

  const modal = createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-3 sm:p-5 animate-fadeIn">
      {!roomy ? instantModal : (
      <div className={`bg-[var(--panel)] rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden animate-slideUp
                       transition-[max-width] duration-300 max-w-6xl h-[94vh]`}>

        <div className="flex items-center gap-4 px-6 py-3.5 border-b border-black/[0.06] shrink-0">
          <span className="text-[17px] font-black">New job</span>
          {typeTabs}
          {branchName && <span className="ml-auto text-xs text-[var(--text-3)] hidden sm:inline">{branchName}</span>}
          <button onClick={onClose} aria-label="Close"
                  className={`${branchName ? '' : 'ml-auto'} w-8 h-8 grid place-items-center rounded-full hover:bg-black/5 text-[var(--text-3)]`}>✕</button>
        </div>

        <div className="shrink-0">{customerBar}</div>

        <div className={`flex-1 min-h-0 grid grid-cols-[220px_1fr_300px]`}>
          <div className="p-4 border-r border-black/[0.06] min-h-0 flex flex-col">{serviceList}</div>
          <div className="p-5 overflow-y-auto min-h-0">{editor}</div>
          <div className="p-4 bg-black/[0.015] border-l border-black/[0.06] min-h-0">{cartPanel}</div>
        </div>
      </div>
      )}
    </div>,
    document.body,
  )

  return (
    <>
      {modal}
      {registering && (
        <NewCustomerModal
          onClose={() => setRegistering(false)}
          onUseExisting={c => { chooseCustomer(c); setRegistering(false) }}
          onSuccess={() => setRegistering(false)}
        />
      )}
      {successJob && (
        <JobSuccessOverlay
          jobNumber={successJob}
          onDone={() => { setSuccessJob(null); onSuccess?.(); onClose() }}
        />
      )}
    </>
  )
}