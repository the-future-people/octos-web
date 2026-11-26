// src/components/bm/NewJobModal.jsx
//
// Recording a job at the counter.
//
// One window for every kind of job (7 Nov 2026, from Khofi's mock): what to
// make on the left, the item being set up in the middle, the cart on the
// right. Production and design carry more: the customer and who the job is
// for, each item's sizes, finishing and file, and a promise. The cart holds
// everything the customer is told (total, deposit, ready time) above the
// button that creates the job.
//
// Every price and promise comes from the server; the browser does no
// pricing of its own. Files are checked exactly as the app checks them and
// go with the job, so they reach the floor through Octos and nothing else.

import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import usePhone from '../../hooks/usePhone'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getServices, calculatePrice, createJob, getCustomers, getPromise, createProforma, issueProforma,
  getProformaDetail, reviseProforma } from '../../api/bm'
import { invalidateAfterJobCreated } from '../../api/invalidations'
import { useAuth } from '../../context/AuthContext'
import JobSuccessOverlay from '../shared/JobSuccessOverlay'
import CounterArtwork from '../shared/CounterArtwork'
import NewCustomerModal from './NewCustomerModal'
import client from '../../api/client'

const fmt = n => `GHS ${parseFloat(n || 0).toFixed(2)}`
const TYPES = [['INSTANT', 'Instant', 'bolt'], ['PRODUCTION', 'Production', 'layers'], ['DESIGN', 'Design', 'pen']]
const BADGE = { INSTANT: 'Instant job', PRODUCTION: 'Production job', DESIGN: 'Design job' }
const UNIT = { PER_SQFT: 'per sq ft', PER_SQCM: 'per sq cm', PER_COPY: 'per copy', PER_PAGE: 'per page',
               PER_SHEET: 'per sheet', PER_PIECE: 'per piece', PER_JOB: 'per job' }
const ROLE = { REP: 'Rep', STAFF: 'Staff', OWNER: 'Owner', MEMBER: 'Member' }
// The shop's rings and how many 80 gsm sheets each holds: the same chart the
// server uses to choose a ring for printed work (jobs/services/availability.py).
const RING_HOLDS = { 8: 45, 10: 65, 12: 95, 14: 120, 16: 145, 19: 165, 22: 200, 25: 240, 28: 270, 32: 300, 38: 340, 45: 425, 51: 500 }
const FIELD = `w-full px-3 h-9 text-[13px] bg-white border border-black/15 rounded-xl outline-none
               focus:border-zinc-900 transition-colors disabled:bg-black/[0.03] disabled:text-[var(--text-2)]`
const LABEL = 'block text-[11px] font-semibold text-[var(--text-2)] mb-1'

// ── Icons: one stroke set, drawn in the current text colour ─────────
const PATHS = {
  doc:    <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M10 13h6M10 17h6" /></>,
  copy:   <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  cert:   <><circle cx="12" cy="9" r="5" /><path d="M9 13.5L8 21l4-2 4 2-1-7.5" /></>,
  bind:   <><path d="M6 4h12v16H6z" /><path d="M4 7h4M4 11h4M4 15h4M4 19h4" /></>,
  lam:    <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8l6 6M9 12l3 3" /></>,
  scan:   <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" />,
  env:    <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  photo:  <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 8" /></>,
  type:   <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" /></>,
  form:   <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  bolt:   <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  layers: <><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></>,
  pen:    <><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13 7l4 4" /></>,
  plus:   <path d="M12 5v14M5 12h14" />,
  minus:  <path d="M5 12h14" />,
  cart:   <><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M3 4h2l2.4 11h11.6l2-8H6.3" /></>,
  tag:    <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.4" /></>,
  check:  <path d="M5 12l5 5 9-10" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  person: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  close:  <path d="M6 6l12 12M18 6L6 18" />,
  clock:  <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
}
function Icon({ kind, size = 20, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      {PATHS[kind] || PATHS.doc}
    </svg>
  )
}

// What a service is, for its icon and its group in the list.
function kindOf(s) {
  const n = (s?.name || '').toLowerCase()
  if (n.includes('binding')) return 'bind'
  if (n.includes('laminat')) return 'lam'
  if (n.includes('scan')) return 'scan'
  if (n.includes('envelope') && !n.includes('printing')) return 'env'
  if (n.includes('passport') || n.includes('photo print')) return 'photo'
  if (n.includes('typing')) return 'type'
  if (n.includes('form filling')) return 'form'
  if (n.includes('flyer')) return 'flyer'
  if (n.includes('certificate') || n.includes('art card') || n.includes('art paper') || n.includes('card')) return 'cert'
  if (n.includes('photocopy')) return 'copy'
  if (n.includes('banner') || n.includes('sticker')) return 'layers'
  if (n.includes('logo') || n.includes('design')) return 'pen'
  return 'doc'
}
const ICON_OF = { flyer: 'doc' }
const GROUPS = [
  ['doc', 'Printing'], ['copy', 'Photocopy'], ['cert', 'Certificates and cards'], ['flyer', 'Flyers'],
  ['bind', 'Binding and lamination'], ['lam', 'Binding and lamination'], ['scan', 'Scanning'],
  ['photo', 'Photos'], ['env', 'Envelopes'], ['type', 'Typing and forms'], ['form', 'Typing and forms'],
  ['layers', 'Large format'], ['pen', 'Design'],
]
const GROUP_OF = Object.fromEntries(GROUPS)
const GROUP_ORDER = [...new Set(GROUPS.map(g => g[1]))]

function readyLabel(iso) {
  const at = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const time = at.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (at.toDateString() === today.toDateString()) return `${time} today`
  if (at.toDateString() === tomorrow.toDateString()) return `${time} tomorrow`
  return `${at.toLocaleDateString('en-GB', { weekday: 'long' })} ${time}`
}

const initials = c => {
  if (c?.customer_type !== 'INDIVIDUAL' && c?.company_name) return c.company_name.slice(0, 2).toUpperCase()
  const fromParts = `${c?.first_name?.[0] || ''}${c?.last_name?.[0] || ''}`
  // Some records hold only a full name ("Mr Joe Costy"): its words, a title aside.
  const words = (c?.full_name || '').replace(/^(mr|mrs|ms|miss|dr|prof|rev|madam)\.?\s+/i, '').split(/\s+/).filter(Boolean)
  const fromFull = words.length ? words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '') : ''
  return (fromParts || fromFull || '?').toUpperCase()
}
const nameOf = c => (c?.customer_type !== 'INDIVIDUAL' ? (c?.company_name || c?.full_name) : c?.full_name)

// A number typed straight in. Raw while typing (clamping each keystroke
// turned 168 into 6), settled on leaving.
// decimal: a size as measured, 2.5 or 36.75 (26 Nov 2026). It was cut to a
// whole number as it was typed; only the money is rounded, by the server.
function NumberField({ id, label, value, min = 1, max, disabled, onChange, onCommit, onEnter, stepper = false, decimal = false }) {
  const parse = v => (decimal ? Math.round(parseFloat(v) * 100) / 100 : parseInt(v))
  // While typing a decimal stays as typed: "2." would lose its point.
  const typed = e => (e.target.value === '' ? '' : decimal ? e.target.value : parseInt(e.target.value))
  const settle = e => onCommit(Math.max(min, parse(e.target.value) || min))
  const mode = decimal ? 'decimal' : 'numeric'
  // On a phone (18 Nov 2026): − and + either side, big enough for a thumb.
  if (stepper) {
    const n = parse(value) || min
    const step = d => { const v = Math.max(min, max ? Math.min(max, n + d) : n + d); onChange(v); onCommit(v) }
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <label htmlFor={id} className="text-[15.5px] text-[#1C1C1E]">{label}</label>
        <div className="flex items-center h-[40px] rounded-[12px] bg-[#F2F2F4] overflow-hidden shrink-0">
          <button type="button" onClick={() => step(-1)} disabled={disabled || n <= min} aria-label={`Fewer: ${label}`}
                  className="w-11 h-full grid place-items-center text-[#1C1C1E] disabled:text-black/20"><Icon kind="minus" size={18} /></button>
          <input id={id} type="number" inputMode={mode} step={decimal ? 'any' : undefined} min={min} max={max} disabled={disabled} value={value}
                 onChange={e => onChange(typed(e))}
                 onBlur={settle}
                 className="w-[56px] h-full text-center text-[17px] font-semibold tabular-nums bg-transparent outline-none
                            disabled:text-[#8A8A8E] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
          <button type="button" onClick={() => step(1)} disabled={disabled || (max && n >= max)} aria-label={`More: ${label}`}
                  className="w-11 h-full grid place-items-center text-[#1C1C1E] disabled:text-black/20"><Icon kind="plus" size={18} /></button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center">
      <label htmlFor={id} className={LABEL}>{label}</label>
      <input id={id} type="number" inputMode={mode} step={decimal ? 'any' : undefined} min={min} max={max} disabled={disabled} value={value}
             onChange={e => onChange(typed(e))}
             onBlur={settle}
             onKeyDown={e => { if (e.key === 'Enter') onEnter?.() }}
             className="w-[110px] h-9 rounded-lg border border-black/20 bg-white text-center text-sm font-semibold outline-none
                        focus:border-zinc-900 disabled:bg-black/[0.03] disabled:text-[var(--text-2)]
                        [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
    </div>
  )
}

/**
 * late   after closing: the same window, with a required reason (Branch
 *        Manager only; the server checks). held: no cashier on duty, so
 *        the job waits for the morning handover.
 * proforma  (16 Nov 2026) the same recorder makes a proforma: the same
 *        services, choices, finishing and prices as a job, so the total on
 *        screen is the total saved. A registered customer, any mix of
 *        instant, production and design, no files, deposit or ready time;
 *        saving issues it and hands it to onSuccess for sharing.
 * revise    (16 Nov 2026) a proforma's id: the same, opened with that
 *        proforma's customer (fixed) and its lines in the cart, re-priced at
 *        today's prices. Saving sends the customer the next version.
 */
// Where a job's files came from (JobLineItem.file_source), as icons in their colours.
const SOURCES = [
  { value: 'WHATSAPP', label: 'WhatsApp', colour: '#25D366',
    path: <><path d="M21 11.5a8.4 8.4 0 0 1-12.5 7.3L3 21l2.2-5.3A8.5 8.5 0 1 1 21 11.5z" /><path d="M9 10c.5 2 2 3.5 4 4l1.2-1.2 2 1-.5 1.7c-3.5.3-7.5-3.7-7.2-7.2l1.7-.5 1 2z" /></> },
  { value: 'USB', label: 'Pendrive', colour: '#2563EB',
    path: <><rect x="7" y="2" width="10" height="7" rx="1" /><path d="M5 9h14v8a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" /><path d="M10 5h.01M14 5h.01" /></> },
  { value: 'HARDCOPY', label: 'Photocopy / paper', colour: '#EA580C',
    path: <><path d="M8 3h9l3 3v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M4 7v13a1 1 0 0 0 1 1h11" /><path d="M10 9h6M10 13h6" /></> },
  { value: 'EMAIL', label: 'Email', colour: '#EA4335',
    path: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></> },
  { value: 'TYPING', label: 'Typing', colour: '#7C3AED',
    path: <><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></> },
]

export default function NewJobModal({ onClose, onSuccess, late = false, held = false, fromChat = null,
                                     proforma: proformaMode = false, revise = null }) {
  const proforma = proformaMode || !!revise
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
  const [lateReason,    setLateReason]    = useState('')
  const [successJob,    setSuccessJob]    = useState(null)
  const [selected,      setSelected]      = useState(null)
  // A phone shows one thing at a time: the services, the one being set up, or the cart (18 Nov 2026).
  const phone = usePhone()
  const [cartOpen,      setCartOpen]      = useState(false)
  const [selQty,        setSelQty]        = useState(1)
  const [selPages,      setSelPages]      = useState(1)
  const [selRingSize,   setSelRingSize]   = useState(null)
  const [specValues,    setSpecValues]    = useState({})
  const [selOutputMode, setSelOutputMode] = useState(null)
  const [selArtwork,    setSelArtwork]    = useState(null)
  // The finishing ticked for the item being set up: add-on ids, or, for an
  // envelope, { service, per_copy }. Priced by the server as it's chosen.
  const [selAddons,     setSelAddons]     = useState([])
  // One key per attempt: pressed twice, or retried after an error shown
  // once the job was made, it is still one job. Fresh after a success.
  const attemptKey = useRef(crypto.randomUUID().replace(/-/g, ''))

  const roomy = !proforma && jobType !== 'INSTANT'
  const wantsFile = !proforma && jobType === 'PRODUCTION'

  // One request per pause in typing, not per keystroke.
  const [debouncedQty,   setDebouncedQty]   = useState(1)
  const [debouncedPages, setDebouncedPages] = useState(1)
  useEffect(() => { const t = setTimeout(() => setDebouncedQty(selQty), 400); return () => clearTimeout(t) }, [selQty])
  useEffect(() => { const t = setTimeout(() => setDebouncedPages(selPages), 400); return () => clearTimeout(t) }, [selPages])

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
    // Packing: one for all copies unless the customer asks (decided 7 Nov).
    setSelAddons(list => (list.some(x => (x.service ?? x) === a.id)
      ? list.filter(x => (x.service ?? x) !== a.id)
      : [...list, a.packing ? { service: a.id, per_copy: false } : a.id]))
  }
  function setPerCopy(id, perCopy) {
    setSelAddons(list => list.map(x => ((x.service ?? x) === id ? { service: id, per_copy: perCopy } : x)))
  }

  const SERVICE_ALIASES = [
    { patterns: ['black', 'blk', 'bw', 'b&w', 'mono', 'monochrome', 'grayscale'], resolves: 'black' },
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

  // Each product once: its other-sides version lives with it, and add-ons
  // that only go with something else (a packed envelope, eyelets) are left
  // out. Grouped by what they are.
  const grouped = useMemo(() => {
    const groups = {}
    servicesRaw
      .filter(s => s.is_active && s.category === jobType && !s.variant_of && !s.addon_only)
      .filter(s => matchesSearch(s.name, search))
      .forEach(s => {
        const key = GROUP_OF[kindOf(s)] || 'More'
        ;(groups[key] = groups[key] || []).push(s)
      })
    Object.values(groups).forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)))
    return Object.fromEntries(
      Object.entries(groups).sort(([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicesRaw, jobType, search])

  // Each product once in the list; its other-sides version is a choice in
  // the middle (one side / both sides), with the same pages and copies.
  const versionsOf = useMemo(() => {
    const map = {}
    servicesRaw.filter(s => s.is_active).forEach(s => {
      const base = s.variant_of || s.id
      ;(map[base] = map[base] || []).push(s)
    })
    Object.values(map).forEach(list => list.sort((a, b) => (a.variant_of ? 1 : 0) - (b.variant_of ? 1 : 0)))
    return map
  }, [servicesRaw])
  const familyOf = s => (s ? (versionsOf[s.variant_of || s.id] || [s])[0] : null)
  const plainName = s => (s?.name || '').replace(/\s*\((one side|both sides)\)$/i, '')
  const bothSides = s => s?.smart_defaults?.sides === 'DOUBLE'
  const iconOf = s => ICON_OF[kindOf(s)] || kindOf(s)

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

  // Files received now (11 Nov 2026): the customers whose WhatsApp files are
  // waiting, offered first. One tap ties the job to that chat and to its
  // customer, made from the chat if they never registered.
  const [pickedChat, setPickedChat] = useState(null)
  const chat = fromChat || pickedChat
  // Where the files came from (JobLineItem.file_source, 11 Nov 2026): WhatsApp
  // when a chat was picked; otherwise one tap, never forced.
  // The attendant's choice, if they made one; otherwise the default from the
  // chat. Worked out while drawing, not set by an effect (derived state).
  const [chosenSource, setChosenSource] = useState(null)
  const fileSource = chosenSource ?? (chat?.conversationId ? 'WHATSAPP' : '')
  const setFileSource = update =>
    setChosenSource(update instanceof Function ? update(fileSource) : update)
  const { data: arrivals = [] } = useQuery({
    queryKey: ['arrivals'],
    queryFn: () => client.get('/api/v1/communications/arrivals/').then(r => r.data),
    enabled: !proforma && !fromChat && !customer,
    refetchInterval: 15_000,
  })
  function pickArrival(row) {
    setPickedChat({ conversationId: row.conversation_id, name: row.name, files: row.files })
    client.post(`/api/v1/communications/${row.conversation_id}/customer/`)
      .then(r => getCustomers({ search: r.data.phone, page_size: 10 })
        .then(res => (Array.isArray(res.data) ? res.data : (res.data?.results || []))
          .find(c => c.id === r.data.customer_id)))
      .then(c => { if (c) chooseCustomer(c) })
      .catch(() => {})   // a username chat: no record to make; the chip below names them
  }

  // From a chat linked to a customer: that customer, chosen already (9 Nov 2026).
  const [chatFile, setChatFile] = useState(null)
  // Only services that count pages take a file's pages: binding is priced per set (9 Nov 2026).
  const usesPages = s => (s?.spec_template || []).some(f => f.key === 'pages')
  useEffect(() => {
    if (!fromChat || customer) return
    const load = (id, phone) => getCustomers({ search: phone || fromChat.name || '', page_size: 10 })
      .then(r => (Array.isArray(r.data) ? r.data : (r.data?.results || [])).find(c => c.id === id))
      .then(c => { if (c) setCustomer(c) })
    if (fromChat.customerId) { load(fromChat.customerId, fromChat.phone).catch(() => {}); return }
    // Not registered, but the chat has a number: the server finds them or
    // makes a light record from the chat (11 Nov 2026).
    if (fromChat.conversationId && fromChat.phone) {
      client.post(`/api/v1/communications/${fromChat.conversationId}/customer/`)
        .then(r => load(r.data.customer_id, r.data.phone))
        .catch(() => {})
    }
  }, [fromChat?.conversationId])   // eslint-disable-line react-hooks/exhaustive-deps

  const selectService = service => {
    setSelected(service)
    setSelQty(service.smart_defaults?.quantity || 1)
    setSelPages((usesPages(service) && chatFile?.pages) || service.smart_defaults?.pages || 1)
    setSelRingSize(null)   // binding's ring size is a field of its own form
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

  // The other-sides version of the same product: the same pages and copies.
  const switchVersion = v => {
    if (v.id === selected?.id) return
    const offered = new Set((v.addons || []).map(a => a.id))
    setSelected(v)
    setSelAddons(list => list.filter(x => offered.has(x.service ?? x)))
  }

  // ── Revising a proforma: its customer and lines, priced at today's prices ──
  const { data: source } = useQuery({
    queryKey: ['proforma', revise],
    queryFn: () => getProformaDetail(revise).then(r => r.data),
    enabled: !!revise,
  })
  const [seeded, setSeeded] = useState(false)
  const [withdrawn, setWithdrawn] = useState([])
  const [revNote, setRevNote] = useState('')

  // One line's price now: the product, then its finishing, as the recorder does.
  async function quoteItem(item) {
    try {
      const { data: p } = await calculatePrice({
        service: item.service.id, branch: branchId, quantity: item.quantity, pages: item.pages,
        ...item.specifications,
        ...(item.ring_size   ? { ring_size: item.ring_size } : {}),
        ...(item.output_mode ? { output_mode: item.output_mode } : {}),
      })
      let total = parseFloat(p.total || 0)
      let addonsPriced = []
      if (item.addons.length) {
        const { data: a } = await client.post('/api/v1/jobs/addons/quote/', {
          service: item.service.id, quantity: item.quantity, pages: item.pages,
          specifications: item.specifications, addons: item.addons,
        })
        total += parseFloat(a.total || 0)
        addonsPriced = a.addons || []
      }
      return { _price: total.toFixed(2), addonsPriced, _quoting: false }
    } catch {
      return { _quoting: false, _quoteFailed: true }
    }
  }

  useEffect(() => {
    if (!revise || seeded || !source || !servicesRaw.length || !branchId) return
    setSeeded(true)
    setCustomer({ id: source.customer, full_name: source.customer_name || source.issued_to,
                  phone: source.contact_phone, customer_type: 'INDIVIDUAL', links: [] })
    const byId = Object.fromEntries(servicesRaw.map(sv => [sv.id, sv]))
    const gone = []
    const items = []
    ;(source.line_items || []).forEach((li, i) => {
      const service = byId[li.service_id]
      if (!service || !service.is_active) { gone.push(li.service_name); return }
      const specifications = { ...(li.specifications || {}) }
      delete specifications.is_color; delete specifications.ring_size; delete specifications.output_mode
      // Finishing back into the form the recorder sends: ids, and packing
      // with whether it was one per copy.
      const addons = (li.addons || []).map(a => {
        const def = (service.addons || []).find(x => x.id === a.service)
        return def?.packing ? { service: a.service, per_copy: li.quantity > 1 && a.quantity === li.quantity } : a.service
      })
      items.push({
        _id: `rev-${i}`, service, quantity: li.quantity, pages: li.pages || 1,
        ring_size: li.ring_size || null, output_mode: li.output_mode || null,
        specifications, addons, addonsPriced: li.addons || [], _price: li.total, _quoting: true,
      })
    })
    setWithdrawn(gone)
    setCart(items)
    Promise.all(items.map(quoteItem)).then(prices =>
      setCart(c => c.map(it => {
        const k = items.findIndex(x => x._id === it._id)
        return k >= 0 ? { ...it, ...prices[k] } : it
      })))
  }, [revise, seeded, source, servicesRaw, branchId])   // eslint-disable-line react-hooks/exhaustive-deps

  // A line back in the editor to change it (copies, pages, size, finishing).
  const editItem = item => {
    setCart(c => c.filter(i => i._id !== item._id))
    setJobType(item.service.category)
    setSelected(item.service)
    setSelQty(item.quantity); setDebouncedQty(item.quantity)
    setSelPages(item.pages); setDebouncedPages(item.pages)
    setSelRingSize(item.ring_size)
    setSelOutputMode(item.output_mode)
    setSelArtwork(item.artwork || null)
    setSelAddons(item.addons || [])
    setSpecValues(item.specifications || {})
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
      // The ring picker keeps the ring in the form (specValues); the job needs it too (9 Nov 2026).
      ring_size: selRingSize || (specValues.ring_size ? parseInt(specValues.ring_size) : null),
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

  // A proforma: saved, then issued (the 14 days start now), then shared.
  const { mutate: saveProforma, isPending: savingProforma } = useMutation({
    mutationFn: async payload => {
      const { data: saved } = await createProforma(payload)
      try {
        return (await issueProforma(saved.id)).data
      } catch (err) {
        err.savedAs = saved
        throw err
      }
    },
    onSuccess: p => {
      queryClient.invalidateQueries({ queryKey: ['proformas'] })
      onSuccess?.(p)
      onClose()
    },
    onError: err => {
      if (err.savedAs) {
        queryClient.invalidateQueries({ queryKey: ['proformas'] })
        onSuccess?.(null, `Saved as ${err.savedAs.proforma_number}, but it couldn't be issued: ${err.response?.data?.detail || 'press Share on it in the list.'}`)
        onClose()
        return
      }
      const d = err.response?.data
      if (!d) { setError('That proforma didn’t save. Try again.'); return }
      if (typeof d === 'string') { setError(d); return }
      if (d.detail) { setError(d.detail); return }
      setError(Object.values(d).flat().find(v => typeof v === 'string') || 'That proforma didn’t save.')
    },
  })

  // A revision: the customer gets the next version, issued as it's made.
  const { mutate: saveRevision, isPending: savingRevision } = useMutation({
    mutationFn: payload => reviseProforma(revise, payload).then(r => r.data),
    onSuccess: p => {
      queryClient.invalidateQueries({ queryKey: ['proformas'] })
      queryClient.invalidateQueries({ queryKey: ['proforma', revise] })
      onSuccess?.(p)
      onClose()
    },
    onError: err => {
      const d = err.response?.data
      setError(d?.detail || (d && Object.values(d).flat().find(v => typeof v === 'string')) || 'That revision didn’t save. Try again.')
    },
  })

  const { mutate, isPending: creatingJob } = useMutation({
    mutationFn: payload => createJob(payload),
    onSuccess: res => {
      invalidateAfterJobCreated(queryClient)
      setSuccessJob(res.data?.job_number || res.data?.id || '—')
      // Recorded from a chat: the server linked it as it was made (17 Nov
      // 2026), so the chat shows it and the receipt can reach the customer
      // there, even one with no number.
      if (chat?.conversationId) {
        queryClient.invalidateQueries({ queryKey: ['conversation', chat.conversationId] })
        queryClient.invalidateQueries({ queryKey: ['arrivals'] })
      }
      attemptKey.current = crypto.randomUUID().replace(/-/g, '')
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

  const isPending = creatingJob || savingProforma || savingRevision
  const quoting = cart.some(i => i._quoting)

  const lineOf = item => ({
    service: item.service.id,
    quantity: item.quantity,
    pages: item.pages,
    is_color: item.service.smart_defaults?.is_color ?? false,
    ...(item.ring_size   ? { ring_size: item.ring_size } : {}),
    ...(item.output_mode ? { output_mode: item.output_mode } : {}),
    ...(item.specifications && Object.keys(item.specifications).length ? { specifications: item.specifications } : {}),
    ...(item.addons?.length ? { addons: item.addons } : {}),
  })

  const handleSubmit = () => {
    if (isPending) return
    setError('')
    if (cart.length === 0) { setError('Add at least one item.'); return }
    if (revise) {
      if (withdrawn.length) { setError('Something on it is no longer offered. Raise a new proforma at current prices.'); return }
      if (quoting) return
      saveRevision({ line_items: cart.map(lineOf), notes: revNote.trim() })
      return
    }
    if (proforma) {
      if (!customer) { setError('Choose a registered customer first. Proformas go to registered customers only.'); return }
      saveProforma({
        // For an organisation: its proforma, addressed to the person who asked.
        customer: orderFor ? orderFor.organisation : customer.id,
        ...(orderFor ? { contact_person: nameOf(customer), contact_phone: customer.phone || '' } : {}),
        line_items: cart.map(lineOf),
      })
      return
    }
    if (late && !lateReason.trim()) { setError('Say why this job is being recorded after closing.'); return }
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
      idempotency_key: attemptKey.current,
      // The chat it was recorded from, linked to the job as it is made.
      ...(chat?.conversationId ? { conversation: chat.conversationId } : {}),
      ...(late ? { post_closing_reason: lateReason.trim() } : {}),
      deposit_percentage: 100,
      line_items: cart.map(item => ({
        ...lineOf(item),
        sets: item.quantity,
        ...(item.artwork?.token ? { artwork_token: item.artwork.token } : {}),
        file_source: fileSource || 'NA',
      })),
      // Who it was for, even with no customer record (a WhatsApp username).
      ...(!customer && chat ? { notes: `For ${chat.name} (WhatsApp${chat.username ? ' @' + chat.username : ''})` } : {}),
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

  // ── After closing: the note, and the reason ────────────────────
  const lateNote = late && (
    <div className="flex items-center gap-2.5 px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-sm shrink-0">
      <Icon kind="clock" size={18} />
      <span>
        <b>Recording after closing.</b>{' '}
        {held ? 'The cashier has signed off: this job is held until the morning handover.'
              : 'The cashier is still on duty: the job is paid for as usual.'}
      </span>
    </div>
  )
  const lateBox = late && (
    <div>
      <label htmlFor="late-reason" className="block text-xs font-semibold text-amber-900 mb-1">Why is it being recorded late?</label>
      <textarea id="late-reason" rows={2} maxLength={500} value={lateReason} onChange={e => setLateReason(e.target.value)}
                placeholder="e.g. Customer arrived as we were closing with an urgent job"
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-lg outline-none focus:border-amber-500 resize-none" />
    </div>
  )

  // ── The parts ──────────────────────────────────────────────────

  const typeTabs = (
    <div role="tablist" aria-label="Kind of job" className="flex gap-0.5 p-[3px] rounded-xl bg-black/[0.05]">
      {TYPES.map(([v, label, icon]) => (
        <button key={v} type="button" role="tab" aria-selected={jobType === v}
                onClick={() => { setJobType(v); if (!proforma) setCart([]); setSelected(null); setSelArtwork(null) }}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[9px] text-[13px] transition-colors
                            ${jobType === v ? 'bg-zinc-900 text-white font-semibold shadow-sm' : 'text-[var(--text-2)] font-medium hover:text-[var(--text)]'}`}>
          <Icon kind={icon} size={15} />{label}
        </button>
      ))}
    </div>
  )

  // From a chat (9 Nov 2026): who wrote, and the files they sent. Choosing a
  // file fills in its pages, as Octos measured them.
  const chatBand = fromChat ? (
    <div className="px-6 py-2.5 border-b border-black/[0.07] bg-white shrink-0 flex flex-col gap-2">
      {!customer && (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="px-2 py-0.5 rounded-full bg-[#E9F6EF] text-[#1E7A4C] text-[11px] font-bold">WhatsApp</span>
          <b>{fromChat.name}</b>
          <span className="text-[var(--text-3)]">{fromChat.phone || (fromChat.username ? '@' + fromChat.username : 'number hidden')}</span>
          <span className="text-[var(--text-3)]">· not registered: recorded as a walk-in from this chat</span>
          <button type="button" onClick={() => setRegistering(true)} className="ml-auto text-[13px] font-bold text-blue-700">Register them</button>
        </div>
      )}
      {fromChat.files?.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-semibold text-[var(--text-3)] shrink-0">Their files</span>
          {fromChat.files.map(f => {
            const on = chatFile?.id === f.id
            return (
              <button key={f.id} type="button" title={f.info}
                onClick={() => { setChatFile(on ? null : f); if (!on && f.pages && usesPages(selected)) setSelPages(f.pages) }}
                className={`h-8 px-3 rounded-full text-xs font-semibold border whitespace-nowrap shrink-0
                  ${on ? 'bg-zinc-900 text-white border-transparent' : 'bg-white border-black/15 text-[var(--text-2)] hover:border-black/40'}`}>
                {f.name}{f.pages ? ` · ${f.pages} page${f.pages === 1 ? '' : 's'}` : ''}
              </button>
            )
          })}
        </div>
      )}
    </div>
  ) : null

  // Who the job is for: prominent, because production and design can't be
  // created without it, and instant work is better with it.
  const customerTag = proforma
    ? <span className="text-xs font-semibold text-red-700">Needed: proformas go to registered customers</span>
    : jobType === 'INSTANT'
    ? <span className="text-xs text-[var(--text-3)]">Optional for instant work: leave blank for a walk-in</span>
    : <span className="text-xs font-semibold text-red-700">Needed: for the ready message and the collection PIN</span>

  const customerBand = (
    <div className="px-6 py-3 border-b border-black/[0.07] bg-[#fafaf9] shrink-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1.5">
        <label htmlFor="job-customer" className="text-sm font-bold">{revise ? 'For' : proforma ? 'Who is this proforma for?' : 'Who is this job for?'}</label>
        {!customer && customerTag}
      </div>
      {customer ? (
        <div className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-xl border-2 border-zinc-900 bg-white">
          <span className="w-8 h-8 rounded-full bg-zinc-900 text-white grid place-items-center text-xs font-black shrink-0">
            {initials(customer)}
          </span>
          <div className="leading-tight min-w-0">
            <div className="text-sm font-bold truncate">{nameOf(customer)}</div>
            <div className="text-[13px] text-[var(--text-3)]">{customer.phone}</div>
          </div>
          {!revise && customer.customer_type === 'INDIVIDUAL' && customer.links?.length > 0 && (
            <div className="flex items-center gap-1.5 ml-4 min-w-0 overflow-x-auto">
              <span className="text-sm text-[var(--text-3)] mr-0.5">For</span>
              <button type="button" onClick={() => setOrderFor(null)}
                      className={`h-9 px-3 rounded-full text-[13px] font-bold border whitespace-nowrap
                                  ${!orderFor ? 'bg-zinc-900 text-white border-transparent' : 'bg-white border-black/15 text-[var(--text-2)]'}`}>
                {customer.gender === 'FEMALE' ? 'Herself' : customer.gender === 'MALE' ? 'Himself' : 'Themself'}
              </button>
              {customer.links.map(l => (
                <button key={l.organisation} type="button" onClick={() => setOrderFor(l)}
                        className={`h-9 px-3 rounded-full text-[13px] font-bold border whitespace-nowrap
                                    ${orderFor?.organisation === l.organisation ? 'bg-zinc-900 text-white border-transparent' : 'bg-white border-black/15 text-[var(--text-2)]'}`}>
                  {l.name}<span className="font-normal opacity-70"> · {ROLE[l.role] || l.role}</span>
                </button>
              ))}
            </div>
          )}
          {revise ? (
            <span className="ml-auto text-[13px] text-[var(--text-3)]">A revision goes to the same customer</span>
          ) : (
            <button type="button" onClick={() => { setCustomer(null); setOrderFor(null) }}
                    className="ml-auto h-11 px-3 text-sm font-bold text-blue-700 shrink-0">Change customer</button>
          )}
        </div>
      ) : (
        <>
        {arrivals.length > 0 && !chat && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-bold text-[#8A5A00] mr-1">Files received now:</span>
            {arrivals.map(row => (
              <button key={row.conversation_id} type="button" onClick={() => pickArrival(row)}
                      className="h-9 px-3 rounded-full border border-[#F1DFC0] bg-[#FFF8EC] text-[13px] font-semibold hover:border-[#8A5A00]">
                {row.name}{row.number_tail ? ` · …${row.number_tail}` : ''}
                <span className="font-normal text-[var(--text-3)]"> · {row.files.length} file{row.files.length === 1 ? '' : 's'}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Icon kind="person" size={18} className="absolute left-3.5 top-[13px] text-[var(--text)] pointer-events-none" />
            <input id="job-customer"
                   value={custSearch || (chat && !chat.phone ? `${chat.name} · WhatsApp${chat.username ? ' @' + chat.username : ''}` : '')}
                   onChange={e => setCustSearch(e.target.value)}
                   placeholder="Search by name or phone number"
                   className={`w-full h-11 pl-10 pr-4 text-[15px] font-medium rounded-xl outline-none border-2 transition-colors
                               ${jobType === 'INSTANT' && !proforma ? 'border-zinc-900 bg-white' : 'border-red-600 bg-red-50/60'}`} />
            {custResults.length > 0 && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 rounded-xl border border-black/10 bg-[var(--panel)] shadow-xl overflow-hidden">
                {custResults.map(c => (
                  <button key={c.id} type="button" onClick={() => chooseCustomer(c)}
                          className="w-full px-4 py-3 text-left hover:bg-black/[0.03] border-b border-black/[0.05] last:border-0">
                    <div className="text-[15px] font-semibold">{nameOf(c)}</div>
                    <div className="text-[13px] text-[var(--text-3)]">
                      {c.customer_type !== 'INDIVIDUAL' && c.full_name ? `Contact: ${c.full_name} · ` : ''}{c.phone}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={() => setRegistering(true)}
                  className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-black/15 bg-white text-sm font-semibold whitespace-nowrap hover:border-black/30">
            <Icon kind="plus" size={16} />Register customer
          </button>
        </div>
        </>
      )}
      {!proforma && <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] font-bold text-[var(--text-3)] mr-1">Files came by:</span>
        {SOURCES.map(({ value, label, colour, path }) => {
          const on = fileSource === value
          return (
            <button key={value} type="button" title={label} aria-label={label} aria-pressed={on}
                    onClick={() => setFileSource(s => (s === value ? '' : value))}
                    className={`w-10 h-9 rounded-xl grid place-items-center border transition
                                ${on ? 'ring-2 ring-zinc-900 border-transparent' : 'border-black/15 bg-white hover:border-black/30'}`}
                    style={on ? { background: colour + '22' } : undefined}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round">{path}</svg>
            </button>
          )
        })}
      </div>}
      {chat?.conversationId && fileSource && fileSource !== 'WHATSAPP' && (
        <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-[#FFF4DC] border border-[#F1DFC0] text-[12.5px] font-semibold text-[#8A5A00]">
          Their files came on WhatsApp.
        </div>
      )}
    </div>
  )

  const serviceList = (
    <div className="flex flex-col min-h-0 h-full">
      <div className="relative mb-3">
        <Icon kind="search" size={16} className="absolute left-3 top-[10px] text-[var(--text-3)] pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services" aria-label="Search services"
               className="w-full h-9 pl-9 pr-3 text-[13px] bg-white border border-black/15 rounded-xl outline-none focus:border-zinc-900" />
      </div>
      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-3">
        {Object.keys(grouped).length === 0 && <p className="text-sm text-[var(--text-3)] py-6 text-center">Nothing matches</p>}
        {Object.entries(grouped).map(([grp, items]) => (
          <div key={grp}>
            {Object.keys(grouped).length > 1 && <div className="text-[11px] font-semibold text-[var(--text-3)] px-2 mb-1">{grp}</div>}
            {items.map(s => (
              <button key={s.id} type="button" onClick={() => selectService(s)}
                      className={`w-full flex items-center gap-2.5 text-left min-h-9 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors
                                  ${familyOf(selected)?.id === s.id ? 'bg-zinc-900 text-white font-semibold' : 'text-[var(--text)] hover:bg-black/[0.04]'}`}>
                <Icon kind={iconOf(s)} size={16} />
                <span>{plainName(s)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )

  // One field of a product's form: − and + for numbers, a list for choices.
  const specField = field => {
    if (field.type === 'select' && phone) {
      return (
        <div key={field.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <label htmlFor={`spec-${field.key}`} className="text-[15.5px] text-[#1C1C1E]">{field.label}{field.unit ? ` (${field.unit})` : ''}</label>
          <select id={`spec-${field.key}`} value={specValues[field.key] ?? ''}
                  onChange={e => setSpecValues(v => ({ ...v, [field.key]: e.target.value }))}
                  className="h-[40px] px-3 rounded-[12px] bg-[#F2F2F4] text-[15.5px] font-semibold outline-none max-w-[60%]">
            {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      )
    }
    if (field.type === 'select') {
      return (
        <div key={field.key} className="min-w-[160px] flex flex-col items-center">
          <label htmlFor={`spec-${field.key}`} className={LABEL}>{field.label}{field.unit ? ` (${field.unit})` : ''}</label>
          <select id={`spec-${field.key}`} value={specValues[field.key] ?? ''}
                  onChange={e => setSpecValues(v => ({ ...v, [field.key]: e.target.value }))} className={FIELD}>
            {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      )
    }
    const locked = field.key === 'pages' && !!selArtwork?.page_count
    const value = field.key === 'quantity' ? selQty : field.key === 'pages' ? selPages : (specValues[field.key] ?? '')
    const put = n => {
      if (field.key === 'quantity') setSelQty(n)
      else if (field.key === 'pages') { if (!locked) setSelPages(n) }
      else setSpecValues(v => ({ ...v, [field.key]: n }))
    }
    return (
      <NumberField key={field.key} id={`spec-${field.key}`} value={value} min={field.min ?? 1} max={field.max}
               label={`${field.label}${field.unit ? ` (${field.unit})` : ''}`} disabled={locked}
               onChange={put} onCommit={put} onEnter={addToCart} stepper={phone}
               decimal={['width_in', 'height_in', 'width_ft', 'height_ft'].includes(field.key)} />
    )
  }

  // Binding's ring sizes, laid out to click (7 Nov 2026 mock): each with the
  // sheets it holds, so the ring is matched to the document, not guessed.
  const ringPicker = field => {
    const chosen = parseInt(specValues[field.key]) || null
    const sets = parseInt(selQty) || 0
    const each = selPrice && sets ? parseFloat(selPrice.total) / sets : null
    return (
      <fieldset className="flex flex-col items-center">
        <legend className="text-[13px] font-bold mb-1.5 mx-auto text-center">Ring size</legend>
        <div className="grid grid-cols-4 sm:grid-cols-[repeat(7,66px)] gap-1.5">
          {(field.options || []).map(mm => {
            const on = parseInt(mm) === chosen
            return (
              <button key={mm} type="button" aria-pressed={on} onClick={() => setSpecValues(v => ({ ...v, [field.key]: mm }))}
                      className={`h-[42px] rounded-lg flex flex-col items-center justify-center leading-tight transition-colors
                                  ${on ? 'bg-zinc-900 text-white border-2 border-zinc-900' : 'bg-white border border-black/20 hover:border-black/40'}`}>
                <span className="text-[13px] font-bold">{mm} mm</span>
                {RING_HOLDS[mm] && <span className={`text-[10px] ${on ? 'text-white/85' : 'text-[var(--text-3)]'}`}>up to {RING_HOLDS[mm]}</span>}
              </button>
            )
          })}
        </div>
        {chosen && (
          <p className="mt-2 text-[11px] text-[var(--text-3)] text-center">
            {chosen} mm holds up to {RING_HOLDS[chosen] ?? 'an unknown number of'} sheets.{each ? ` GHS ${each.toFixed(2)} a set.` : ''}
          </p>
        )}
      </fieldset>
    )
  }

  const sideCard = on => `flex items-center gap-2.5 min-h-[44px] px-3 py-1.5 rounded-lg border-2 text-left transition-colors
                          ${on ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-black/15 text-[var(--text)] hover:border-black/30'}`

  const editor = !selected ? (
    <div className="h-full grid place-items-center text-center px-6">
      <div>
        <div className="text-sm font-semibold">Choose what to make</div>
        <div className="text-xs text-[var(--text-3)] mt-1">Pick a service on the left to set it up</div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-3.5 min-h-full">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-lg bg-black/[0.05] grid place-items-center shrink-0">
          <Icon kind={iconOf(selected)} size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-bold leading-tight">{plainName(selected)}</h2>
          {selected.description && <p className="mt-0.5 text-xs leading-snug text-[var(--text-3)] max-w-[60ch]">{selected.description}</p>}
          {UNIT[selected.unit] && <p className="mt-0.5 text-[11px] text-[var(--text-3)]">Priced {UNIT[selected.unit]}</p>}
        </div>
        {!phone && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/[0.05] text-[11px] font-semibold shrink-0">
          <Icon kind={TYPES.find(t => t[0] === jobType)[2]} size={12} />{BADGE[jobType]}
        </span>
        )}
      </div>

      <div className={`flex-1 flex flex-col items-center gap-4 py-2 ${phone ? '' : 'justify-center'}`}>
      {(versionsOf[selected.variant_of || selected.id] || []).length > 1 && (
        <fieldset className="flex flex-col items-center">
          <legend className="text-[13px] font-bold mb-1.5 mx-auto text-center">One side or both sides?</legend>
          <div className="grid grid-cols-2 sm:grid-cols-[repeat(2,190px)] gap-2">
            {versionsOf[selected.variant_of || selected.id].map(v => {
              const on = selected.id === v.id
              return (
                <button key={v.id} type="button" aria-pressed={on} onClick={() => switchVersion(v)} className={sideCard(on)}>
                  <Icon kind={bothSides(v) ? 'copy' : 'doc'} size={18} />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-bold leading-tight">{bothSides(v) ? 'Both sides' : 'One side'}</span>
                    {v.base_price && (
                      <span className={`text-[11px] leading-tight ${on ? 'text-white/85' : 'text-[var(--text-3)]'}`}>
                        GHS {v.base_price} {['sheet', 'PER_PAGE', 'PER_SHEET'].includes(v.unit) ? 'a sheet' : 'each'}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {isPassport(selected) && (
        <fieldset className="flex flex-col items-center">
          <legend className={`${LABEL} mx-auto text-center`}>Output</legend>
          <div className="flex gap-2 w-full sm:w-[388px]">
            {[['PRINT', 'Print'], ['PRINT_DIGITAL', 'Print + digital'], ['DIGITAL', 'Digital only']].map(([v, t]) => (
              <button key={v} type="button" onClick={() => setSelOutputMode(v)}
                      className={`flex-1 h-8 text-xs font-bold rounded-lg border ${selOutputMode === v ? 'bg-zinc-900 text-white border-transparent' : 'bg-white border-black/15'}`}>
                {t}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {(() => {
        // Pages × copies = sheets, worked out beside the numbers typed (7 Nov
        // 2026 mock). Both sides puts two pages on a sheet; the server prices
        // the same count, so the sum and the total always agree.
        const fields = (selected.spec_template || []).length > 0 ? selected.spec_template
          : [{ key: 'pages', label: 'Pages per copy', min: 1 }, { key: 'quantity', label: 'Number of copies', min: 1 }]
        const keys = fields.map(f => f.key)
        const ringField = fields.find(f => f.key === 'ring_size')
        if (phone) {
          // On a phone: one white card, a row per number, and the sheets worked out at the foot.
          const both = keys.includes('pages') && keys.includes('quantity')
          const pagesN = parseInt(selPages) || 0, copiesN = parseInt(selQty) || 0
          const each = bothSides(selected) ? Math.ceil(pagesN / 2) : pagesN
          return (
            <div className="w-full flex flex-col gap-3.5">
              <div className="w-full rounded-[16px] bg-white border border-black/[0.04] shadow-[0_3px_12px_rgba(17,24,39,0.05)] divide-y divide-black/[0.07]">
                {/* Pages, then copies, then what they make: the order they are asked in. */}
                {fields.filter(f => f !== ringField && f.key !== 'pages' && f.key !== 'quantity').map(specField)}
                {fields.filter(f => f.key === 'pages').map(specField)}
                {fields.filter(f => f.key === 'quantity').map(specField)}
                {both && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[15.5px] text-[#1C1C1E]">Sheets</span>
                    <span className="text-right">
                      <output aria-live="polite" className="block text-[18px] font-bold tabular-nums">{each * copiesN || '—'}</output>
                      {pagesN > 0 && copiesN > 0 && <span className="block text-[12.5px] text-[#8A8A8E]">{each} a copy{bothSides(selected) ? ', both sides' : ''}</span>}
                    </span>
                  </div>
                )}
              </div>
              {ringField && ringPicker(ringField)}
            </div>
          )
        }
        if (!(keys.includes('pages') && keys.includes('quantity'))) {
          const ring = ringField
          return (
            <div className="flex flex-col items-center gap-3.5">
              <div className="flex flex-wrap justify-center gap-2.5">{fields.filter(f => f !== ring).map(specField)}</div>
              {ring && ringPicker(ring)}
            </div>
          )
        }
        const pages = parseInt(selPages) || 0
        const copies = parseInt(selQty) || 0
        const perCopy = bothSides(selected) ? Math.ceil(pages / 2) : pages
        const sign = 'h-9 inline-flex items-center text-[15px] text-[var(--text-3)]'
        const field = k => specField(fields.find(f => f.key === k))
        return (
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex flex-wrap items-end justify-center gap-2.5">
              {fields.filter(f => f.key !== 'pages' && f.key !== 'quantity').map(specField)}
              {field('pages')}
              <span aria-hidden="true" className={sign}>×</span>
              {field('quantity')}
              <span aria-hidden="true" className={sign}>=</span>
              <div className="flex flex-col items-center">
                <span className={LABEL}>Sheets</span>
                <output aria-live="polite"
                        className="min-w-[110px] h-9 px-3 rounded-lg bg-zinc-900 text-white grid place-items-center text-[15px] font-bold tabular-nums">
                  {perCopy * copies || '—'}
                </output>
              </div>
            </div>
            {pages > 0 && copies > 0 && (
              <p className="text-[11px] text-[var(--text-3)] text-center">
                {bothSides(selected)
                  ? `${pages} page${pages === 1 ? '' : 's'} on both sides is ${perCopy} sheet${perCopy === 1 ? '' : 's'} a copy, ${perCopy * copies} in all.`
                  : `${perCopy} sheet${perCopy === 1 ? '' : 's'} a copy, ${perCopy * copies} in all.`}
              </p>
            )}
          </div>
        )
      })()}

      {(selected.addons || []).length > 0 && (
        <fieldset className="flex flex-col items-center">
          <legend className={`${LABEL} mx-auto text-center`}>Add-ons</legend>
          <div className="flex flex-wrap justify-center gap-2">
            {selected.addons.map(a => {
              const on = selAddons.some(x => (x.service ?? x) === a.id)
              const priced = addonsPriced.find(x => x.service === a.id)
              return (
                <button key={a.id} type="button" aria-pressed={on} onClick={() => toggleAddon(a)}
                        className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-xs font-semibold transition-colors
                                    ${on ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-black/15 bg-white text-[var(--text)] hover:border-black/30'}`}>
                  {on && <Icon kind="check" size={12} />}
                  {a.name}
                  {on && priced && (
                    <span className="font-normal text-white/80">
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
              <div key={a.id} className="mt-2.5 inline-flex p-1 rounded-xl bg-black/[0.05]">
                {[[false, 'One for all'], [true, 'One per copy']].map(([v, t]) => (
                  <button key={t} type="button" onClick={() => setPerCopy(a.id, v)}
                          className={`h-7 px-2.5 rounded-md text-xs font-bold ${choice?.per_copy === v ? 'bg-white shadow-sm text-[var(--text)]' : 'text-[var(--text-3)]'}`}>
                    {a.name}: {t.toLowerCase()}
                  </button>
                ))}
              </div>
            )
          })}
          {addonError && <p className="mt-1.5 text-sm text-red-700">{addonError.response?.data?.detail || 'That finishing couldn’t be priced.'}</p>}
        </fieldset>
      )}

      </div>

      {wantsFile && (
        <div>
          <div className={LABEL}>
            Customer’s file{needsFile && <span className="text-red-700 font-bold"> · needed</span>}
          </div>
          <CounterArtwork
            service={selected}
            specifications={specValues}
            result={selArtwork}
            required={needsFile}
            sizeLabel={sizeLabel}
            onResult={r => {
              setSelArtwork(r)
              // A document's pages come from the file, as they are: the
              // server halves them for both sides, and counts again.
              if (r?.page_count) setSelPages(r.page_count)
            }}
          />
        </div>
      )}

      {/* On a phone the total and Add to cart stay pinned along the bottom instead. */}
      {!phone && <div className="mt-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-3">
            <Icon kind="tag" size={17} className="text-emerald-800" />
            <div>
              <div className="text-[11px] text-emerald-900">Item total</div>
              <div className="text-lg leading-tight font-bold text-emerald-800 tabular-nums" style={{ opacity: priceLoading || addonLoading ? 0.45 : 1 }}>
                {selPrice ? fmt(itemTotal) : '…'}
              </div>
              {selAddons.length > 0 && selPrice && (
                <div className="text-[11px] text-emerald-900/80">includes finishing {fmt(addonQuote?.total || 0)}</div>
              )}
            </div>
          </div>
          <button type="button" onClick={addToCart} disabled={!canAdd}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-zinc-900 text-white text-[13px] font-semibold disabled:bg-black/20">
            <Icon kind="cart" size={15} />Add to cart
          </button>
        </div>
        {needsFile && !fileReady && (
          <p className="mt-1.5 text-right text-[13px] text-[var(--text-3)]">Adds once the file is checked and printable</p>
        )}
      </div>}
    </div>
  )

  // What a cart line is, in a few words; and what the last button says.
  const sizeOf = item => (item.specifications?.width_in && item.specifications?.height_in
    ? `${item.specifications.width_in} × ${item.specifications.height_in} in · ${item.quantity}`
    : item.specifications?.width_ft && item.specifications?.height_ft
      ? `${item.specifications.width_ft} × ${item.specifications.height_ft} ft · ${item.quantity}`
      : `${item.pages} page${item.pages == 1 ? '' : 's'} × ${item.quantity}`)
  const submitWords = revise ? (isPending ? 'Saving…' : quoting ? 'Checking today’s prices…' : `Save revision and share · ${fmt(cartTotal)}`)
    : proforma ? (isPending ? 'Saving…' : `Save and share · ${fmt(cartTotal)}`)
    : isPending ? 'Creating…' : late ? 'Record late job' : forName ? `Create job for ${forName}` : 'Create job'

  const cartPanel = (
    <div className="flex flex-col h-full min-h-0 gap-2.5">
      <div className="flex items-center gap-1.5">
        <Icon kind="cart" size={16} />
        <h2 className="text-[13px] font-bold">Cart ({cart.length})</h2>
        {cart.length > 0 && (
          <button type="button" onClick={() => setCart([])} className="ml-auto h-7 px-1 text-xs font-semibold text-blue-700">Clear</button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
        {cart.length === 0 && (
          <div className="border border-dashed border-black/15 rounded-lg py-4 px-3 flex flex-col items-center gap-1 text-center text-[var(--text-3)]">
            <Icon kind="cart" size={22} />
            <div className="text-[13px] font-semibold text-[var(--text)]">Nothing added yet</div>
            <div className="text-[11px]">Pick a service on the left to set it up.</div>
          </div>
        )}
        {cart.map(item => (
          <div key={item._id} className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg border border-black/[0.08] bg-white">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold">{item.service.name}</div>
              <div className="text-[11px] text-[var(--text-3)]">{sizeOf(item)}</div>
              {item.addonsPriced?.length > 0 && (
                <div className="text-[13px] text-[var(--text-3)] truncate">
                  + {item.addonsPriced.map(x => x.service_name + (x.detail ? ` (${x.detail})` : '')).join(', ')}
                </div>
              )}
              {item.artwork && (
                <div className={`text-[13px] font-semibold truncate ${item.artwork.verdict === 'warn' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {item.artwork.filename} · {item.artwork.verdict === 'warn' ? 'worth a look' : 'good to print'}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[13px] font-bold tabular-nums" style={{ opacity: item._quoting ? 0.4 : 1 }}
                    title={item._quoteFailed ? 'Couldn’t check today’s price; the server prices it when saved' : undefined}>
                {fmt(item._price)}{item._quoteFailed ? ' ?' : ''}
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => editItem(item)} className="text-[11px] text-blue-700 py-0.5">Edit</button>
                <button type="button" onClick={() => removeFromCart(item._id)} className="text-[11px] text-red-700 py-0.5">Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2.5 border-t border-black/[0.08] space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-[var(--text-3)]">Total</span>
          <span className="text-base font-bold tabular-nums">{fmt(cartTotal)}</span>
        </div>
        {roomy && cartTotal > 0 && (
          <div className="flex justify-between text-xs text-[var(--text-3)]">
            <span>Deposit to start (70%)</span><b className="text-[var(--text)] tabular-nums">{fmt(deposit)}</b>
          </div>
        )}
        {roomy && (promiseError ? (
          <p className="text-[13px] text-amber-700">
            Octos couldn’t give a ready time: {promiseError.response?.data?.detail || 'it could not be reached.'}
          </p>
        ) : promise?.ready_at ? (
          <p className="text-xs text-[var(--text)]" style={{ opacity: promiseLoading ? 0.5 : 1 }}>
            <b>Ready about {readyLabel(promise.ready_at)}</b>{branchName ? ` · ${branchName}` : ''}
            {selected ? <span className="text-[var(--text-3)]"> (with this item)</span> : null}
          </p>
        ) : null)}
        {lateBox}
        {revise && withdrawn.length > 0 && (
          <p className="text-[13px] text-red-700">
            No longer offered: {withdrawn.join(', ')}. A revision can’t drop it quietly; raise a new proforma at current prices.
          </p>
        )}
        {revise && (
          <input value={revNote} onChange={e => setRevNote(e.target.value)} maxLength={300}
                 placeholder="What changed? (optional, kept with the revision)"
                 className="w-full h-8 px-2.5 text-xs bg-white border border-black/15 rounded-lg outline-none focus:border-zinc-900" />
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button type="button" onClick={handleSubmit} disabled={isPending || cart.length === 0 || quoting}
                className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-zinc-900 text-white text-[13px] font-semibold disabled:bg-black/20">
          <Icon kind="check" size={15} />
          {submitWords}
        </button>
        <button type="button" onClick={onClose} className="w-full h-8 text-xs font-semibold text-[var(--text-3)]">Cancel</button>
      </div>
    </div>
  )

  // ── The phone (18 Nov 2026), in the Overview's look ──────────────
  // One screen to choose: the kind of job, who it is for, how the files came,
  // and the services in white lists. A service slides in to be set up, with
  // its total and Add to cart pinned at the foot; the cart slides in the same
  // way, with Create job at the foot. Nothing hides behind a bar.
  const TINT_OF = {
    Printing: ['#DCE9FF', '#2563EB'], Photocopy: ['#F1F1F3', '#52525B'], 'Certificates and cards': ['#FFEDB8', '#B45309'],
    Flyers: ['#FCE7F3', '#BE185D'], 'Binding and lamination': ['#E7DCFF', '#7C3AED'], Scanning: ['#D3F2DE', '#15803D'],
    Photos: ['#FCE7F3', '#BE185D'], Envelopes: ['#FFEDB8', '#B45309'], 'Typing and forms': ['#D3F2DE', '#15803D'],
    'Large format': ['#DCE9FF', '#2563EB'], Design: ['#E7DCFF', '#7C3AED'],
  }
  const tintOf = grp => TINT_OF[grp] || ['#F1F1F3', '#52525B']
  const SOFT_AV = ['#DCE9FF', '#1D4ED8']
  const needed = !proforma && jobType !== 'INSTANT'
  const navBar = (left, title, right) => (
    <div className="ios-bar shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="h-[50px] px-2 grid grid-cols-[1fr_auto_1fr] items-center">
        <span className="justify-self-start">{left}</span>
        <span className="text-[16px] font-semibold text-[#111] truncate max-w-[200px]">{title}</span>
        <span className="justify-self-end">{right}</span>
      </div>
    </div>
  )
  const backButton = (label, onClick) => (
    <button type="button" onClick={onClick} className="flex items-center text-[17px] text-[#D70015] pr-2">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>{label}
    </button>
  )
  const sectionTitle = (text, extra) => (
    <div className="px-5 pt-5 pb-1.5 flex items-baseline justify-between gap-3">
      <span className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[#8A8A8E]">{text}</span>
      {extra}
    </div>
  )
  const card = 'mx-4 rounded-[16px] bg-white border border-black/[0.04] shadow-[0_3px_12px_rgba(17,24,39,0.05)]'
  const footer = children => (
    <div className="shrink-0 bg-white border-t border-black/[0.08] px-4 pt-2.5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
      {children}
    </div>
  )
  const redButton = 'w-full h-[50px] rounded-[16px] text-white text-[16px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40'
  const RED_FILL = { background: 'linear-gradient(135deg,#EF1C2C 0%,#C8000F 100%)' }

  const phoneCustomer = (
    <>
      {sectionTitle(revise ? 'For' : proforma ? 'Who is it for?' : 'Who is it for?',
        !customer && <span className={`text-[12.5px] ${needed || proforma ? 'text-[#D70015] font-semibold' : 'text-[#8A8A8E]'}`}>
          {proforma ? 'Needed for a proforma' : needed ? 'Needed for the ready message' : 'Optional · blank is a walk-in'}
        </span>)}
      <div className={`${card} overflow-hidden`}>
        {customer ? (
          <>
            <div className="flex items-center gap-3 px-3.5 py-3">
              <span className="w-11 h-11 rounded-full grid place-items-center text-[15px] font-semibold shrink-0" style={{ background: SOFT_AV[0], color: SOFT_AV[1] }}>{initials(customer)}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[16px] font-semibold text-[#1C1C1E] truncate">{nameOf(customer)}</span>
                <span className="block text-[13.5px] text-[#8A8A8E] tabular-nums">{customer.phone}</span>
              </span>
              {!revise && (
                <button type="button" onClick={() => { setCustomer(null); setOrderFor(null) }} className="text-[15px] font-semibold text-[#D70015] px-1">Change</button>
              )}
            </div>
            {!revise && customer.customer_type === 'INDIVIDUAL' && customer.links?.length > 0 && (
              <div className="flex gap-2 overflow-x-auto px-3.5 pb-3 [&::-webkit-scrollbar]:hidden">
                {[[null, customer.gender === 'FEMALE' ? 'Herself' : customer.gender === 'MALE' ? 'Himself' : 'Themself'],
                  ...customer.links.map(l => [l, `${l.name} · ${ROLE[l.role] || l.role}`])].map(([l, label]) => {
                  const on = (l?.organisation ?? null) === (orderFor?.organisation ?? null)
                  return (
                    <button key={label} type="button" onClick={() => setOrderFor(l)}
                            className={`shrink-0 h-8 px-3 rounded-full text-[13.5px] font-semibold whitespace-nowrap ${on ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F4] text-[#1C1C1E]'}`}>
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {arrivals.length > 0 && !chat && (
              <div className="px-3.5 pt-3 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                {arrivals.map(row => (
                  <button key={row.conversation_id} type="button" onClick={() => pickArrival(row)}
                          className="shrink-0 h-8 px-3 rounded-full bg-[#FFF4DC] text-[13px] font-semibold text-[#8A5A00] whitespace-nowrap">
                    Files from {row.name} · {row.files.length}
                  </button>
                ))}
              </div>
            )}
            <label className="mx-3.5 mt-3 h-[40px] px-3 rounded-[11px] bg-black/[0.05] flex items-center gap-2 text-[#8A8A8E]">
              <Icon kind="search" size={17} />
              <input id="job-customer" value={custSearch || (chat && !chat.phone ? `${chat.name} · WhatsApp` : '')}
                     onChange={e => setCustSearch(e.target.value)} placeholder="Name or phone number" enterKeyHint="search"
                     className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-[#111] placeholder:text-[#8A8A8E]" />
            </label>
            {custResults.length > 0 && (
              <div className="mt-2">
                {custResults.map((c, i) => (
                  <button key={c.id} type="button" onClick={() => chooseCustomer(c)}
                          className={`w-full flex items-center gap-3 pl-3.5 pr-3.5 py-2.5 text-left active:bg-black/[0.04] ${i ? 'border-t border-black/[0.06]' : ''}`}>
                    <span className="w-9 h-9 rounded-full grid place-items-center text-[13px] font-semibold shrink-0 bg-[#F1F1F3] text-[#3A3A3C]">{initials(c)}</span>
                    <span className="min-w-0">
                      <span className="block text-[15.5px] font-semibold text-[#1C1C1E] truncate">{nameOf(c)}</span>
                      <span className="block text-[13px] text-[#8A8A8E] tabular-nums">{c.phone}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setRegistering(true)}
                    className="mt-3 w-full flex items-center gap-3 px-3.5 h-[48px] border-t border-black/[0.06] text-[15.5px] font-semibold text-[#D70015] active:bg-black/[0.04]">
              <span className="w-7 h-7 rounded-full grid place-items-center" style={{ background: '#FFE1E1' }}><Icon kind="plus" size={16} /></span>
              Register a new customer
            </button>
          </>
        )}
      </div>
    </>
  )

  const phoneSources = !proforma && (
    <>
      {sectionTitle('Files came by')}
      <div className={`${card} px-2 py-3 grid grid-cols-5`}>
        {SOURCES.map(({ value, label, colour, path }) => {
          const on = fileSource === value
          return (
            <button key={value} type="button" aria-pressed={on} onClick={() => setFileSource(x => (x === value ? '' : value))}
                    className="flex flex-col items-center gap-1.5">
              <span className="w-12 h-12 rounded-[14px] grid place-items-center transition-shadow"
                    style={{ background: colour + '1F', boxShadow: on ? `0 0 0 2px #FFFFFF, 0 0 0 4px ${colour}` : 'none' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
              </span>
              <span className={`text-[11.5px] leading-tight text-center ${on ? 'font-semibold text-[#1C1C1E]' : 'text-[#6E6E73]'}`}>
                {label === 'Photocopy / paper' ? 'Paper' : label}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )

  const phoneServices = (
    <>
      {sectionTitle('Services')}
      <label className="mx-4 h-[40px] px-3 rounded-[11px] bg-black/[0.06] flex items-center gap-2 text-[#8A8A8E]">
        <Icon kind="search" size={17} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services" enterKeyHint="search"
               className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-[#111] placeholder:text-[#8A8A8E]" />
      </label>
      {Object.keys(grouped).length === 0 && <p className="m-0 px-5 py-6 text-center text-[15px] text-[#8A8A8E]">Nothing matches</p>}
      {Object.entries(grouped).map(([grp, items]) => {
        const [bg, ink] = tintOf(grp)
        return (
          <div key={grp}>
            <div className="px-5 pt-4 pb-1.5 text-[13px] font-semibold text-[#6E6E73]">{grp}</div>
            <div className={`${card} overflow-hidden`}>
              {items.map((sv, i) => (
                <button key={sv.id} type="button" onClick={() => selectService(sv)}
                        className="w-full flex items-center gap-3 pl-3.5 text-left active:bg-black/[0.04]">
                  <span className="w-8 h-8 rounded-[9px] grid place-items-center shrink-0" style={{ background: bg, color: ink }}><Icon kind={iconOf(sv)} size={17} /></span>
                  <span className={`flex-1 min-w-0 flex items-center gap-2 py-3 pr-3 ${i ? 'border-t border-black/[0.07]' : ''}`}>
                    <span className="flex-1 min-w-0 text-[15.5px] text-[#1C1C1E] truncate">{plainName(sv)}</span>
                    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="#C4C4C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 1l6 6-6 6" /></svg>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )

  const cartCount = cart.length
  const phoneSheet = createPortal(
    <div className="ios fixed inset-0 z-[9999] flex flex-col animate-slideUp" style={{ background: '#F6F6F8' }}>
      {navBar(
        <button type="button" onClick={onClose} className="text-[17px] text-[#D70015] px-2">Cancel</button>,
        revise ? `Revise ${source?.proforma_number || 'proforma'}` : proforma ? 'New Proforma' : 'New Job',
        null,
      )}

      <div className="flex-1 overflow-y-auto pb-6">
        {/* The kind of job, an iOS segmented control */}
        <div className="mx-4 mt-3 p-[3px] rounded-[12px] bg-black/[0.06] flex" role="tablist" aria-label="Kind of job">
          {TYPES.map(([v, label, icon]) => (
            <button key={v} type="button" role="tab" aria-selected={jobType === v}
                    onClick={() => { setJobType(v); if (!proforma) setCart([]); setSelected(null); setSelArtwork(null) }}
                    className={`flex-1 h-[36px] rounded-[9px] inline-flex items-center justify-center gap-1.5 text-[14px] font-semibold transition-colors
                                ${jobType === v ? 'bg-white text-[#111] shadow-[0_2px_6px_rgba(0,0,0,0.10)]' : 'text-[#3A3A3C]'}`}>
              <Icon kind={icon} size={16} />{label}
            </button>
          ))}
        </div>
        {late && (
          <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-[14px] bg-[#FFF8EC] text-[13.5px] text-[#8A5A00] flex gap-2.5">
            <Icon kind="clock" size={18} />
            <span><b>Recording after closing.</b> {held ? 'The cashier has signed off: this job waits for the morning handover.' : 'The cashier is still on duty: it is paid for as usual.'}</span>
          </div>
        )}
        {phoneCustomer}
        {chatBand && <div className="mx-4 mt-3 rounded-[16px] overflow-hidden">{chatBand}</div>}
        {phoneSources}
        {proforma && (
          <p className="m-0 mx-5 mt-4 text-[13px] text-[#8A8A8E]">
            {revise ? 'Its lines are in the cart at today’s prices. Saving sends the next version (valid 14 days).' : 'Mix instant, production and design: the cart keeps everything as you switch. Saving issues it (valid 14 days).'}
          </p>
        )}
        {phoneServices}
      </div>

      {footer(
        <button type="button" onClick={() => setCartOpen(true)} disabled={!cartCount} className={redButton}
                style={cartCount ? RED_FILL : { background: '#E5E5EA', color: '#8A8A8E', opacity: 1 }}>
          <Icon kind="cart" size={19} />
          {cartCount ? <>View cart · {cartCount} item{cartCount > 1 ? 's' : ''}<span className="opacity-60">·</span><span className="tabular-nums">{fmt(cartTotal)}</span></> : 'Cart is empty'}
        </button>
      )}

      {/* A service, being set up */}
      {selected && (
        <section aria-label={plainName(selected)} className="ios-push absolute inset-0 z-10 flex flex-col" style={{ background: '#F6F6F8' }}>
          {navBar(backButton('Services', () => setSelected(null)), BADGE[jobType], null)}
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">{editor}</div>
          {footer(
            <>
              <div className="flex items-center justify-between mb-2.5 px-0.5">
                <span className="text-[14px] text-[#6E6E73]">Item total{selAddons.length > 0 && selPrice ? ` · finishing ${fmt(addonQuote?.total || 0)}` : ''}</span>
                <span className="text-[20px] font-bold tabular-nums text-[#111]" style={{ opacity: priceLoading || addonLoading ? 0.45 : 1 }}>{selPrice ? fmt(itemTotal) : '…'}</span>
              </div>
              <button type="button" onClick={addToCart} disabled={!canAdd} className={redButton} style={RED_FILL}>
                <Icon kind="cart" size={18} />Add to cart
              </button>
              {needsFile && !fileReady && <p className="m-0 mt-1.5 text-center text-[13px] text-[#8A8A8E]">Adds once the file is checked and printable</p>}
            </>
          )}
        </section>
      )}

      {/* The cart */}
      {cartOpen && (
        <section aria-label="Cart" className="ios-push absolute inset-0 z-20 flex flex-col" style={{ background: '#F6F6F8' }}>
          {navBar(backButton('Add more', () => setCartOpen(false)), 'Cart',
            cartCount > 0 && <button type="button" onClick={() => setCart([])} className="text-[16px] text-[#D70015] px-2">Clear</button>)}
          <div className="flex-1 overflow-y-auto pb-6">
            {customer && (
              <div className={`${card} mt-4 flex items-center gap-3 px-3.5 py-3`}>
                <span className="w-9 h-9 rounded-full grid place-items-center text-[13px] font-semibold shrink-0" style={{ background: SOFT_AV[0], color: SOFT_AV[1] }}>{initials(customer)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15.5px] font-semibold truncate">{forName ? `${forName} · ordered by ${nameOf(customer)}` : nameOf(customer)}</span>
                  <span className="block text-[13px] text-[#8A8A8E]">{BADGE[jobType]}</span>
                </span>
              </div>
            )}
            {sectionTitle(`${cartCount} item${cartCount === 1 ? '' : 's'}`)}
            <div className={`${card} overflow-hidden`}>
              {cartCount === 0 && <p className="m-0 px-4 py-6 text-center text-[15px] text-[#8A8A8E]">Nothing added yet.</p>}
              {cart.map((item, i) => (
                <div key={item._id} className={`flex items-start gap-3 px-3.5 py-3 ${i ? 'border-t border-black/[0.07]' : ''}`}>
                  <span className="w-8 h-8 rounded-[9px] grid place-items-center shrink-0"
                        style={{ background: tintOf(GROUP_OF[kindOf(item.service)])[0], color: tintOf(GROUP_OF[kindOf(item.service)])[1] }}>
                    <Icon kind={iconOf(item.service)} size={17} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15.5px] font-semibold text-[#1C1C1E]">{item.service.name}</div>
                    <div className="text-[13px] text-[#8A8A8E]">{sizeOf(item)}</div>
                    {item.addonsPriced?.length > 0 && <div className="text-[13px] text-[#8A8A8E] truncate">+ {item.addonsPriced.map(x => x.service_name).join(', ')}</div>}
                    {item.artwork && <div className={`text-[13px] font-semibold truncate ${item.artwork.verdict === 'warn' ? 'text-[#B45309]' : 'text-[#15803D]'}`}>{item.artwork.filename}</div>}
                    <div className="flex gap-4 mt-1.5">
                      <button type="button" onClick={() => { editItem(item); setCartOpen(false) }} className="text-[14px] font-semibold text-[#1C1C1E]">Edit</button>
                      <button type="button" onClick={() => removeFromCart(item._id)} className="text-[14px] font-semibold text-[#D70015]">Remove</button>
                    </div>
                  </div>
                  <span className="text-[15.5px] font-semibold tabular-nums" style={{ opacity: item._quoting ? 0.4 : 1 }}>{fmt(item._price)}{item._quoteFailed ? ' ?' : ''}</span>
                </div>
              ))}
            </div>

            <div className={`${card} mt-3 px-4 py-3 space-y-1.5`}>
              <div className="flex items-baseline justify-between"><span className="text-[15px] text-[#6E6E73]">Total</span><span className="text-[20px] font-bold tabular-nums">{fmt(cartTotal)}</span></div>
              {roomy && cartTotal > 0 && <div className="flex items-baseline justify-between"><span className="text-[14px] text-[#6E6E73]">Deposit to start (70%)</span><span className="text-[15px] font-semibold tabular-nums">{fmt(deposit)}</span></div>}
              {roomy && (promiseError
                ? <p className="m-0 text-[13.5px] text-[#B45309]">Octos couldn’t give a ready time: {promiseError.response?.data?.detail || 'it could not be reached.'}</p>
                : promise?.ready_at ? <p className="m-0 text-[14px] text-[#1C1C1E]" style={{ opacity: promiseLoading ? 0.5 : 1 }}><b>Ready about {readyLabel(promise.ready_at)}</b></p> : null)}
            </div>
            {(lateBox || revise) && (
              <div className={`${card} mt-3 px-4 py-3 space-y-2`}>
                {lateBox}
                {revise && withdrawn.length > 0 && <p className="m-0 text-[13.5px] text-[#B91C1C]">No longer offered: {withdrawn.join(', ')}. Raise a new proforma at current prices.</p>}
                {revise && <input value={revNote} onChange={e => setRevNote(e.target.value)} maxLength={300} placeholder="What changed? (optional)"
                                  className="w-full h-10 px-3 text-[15px] rounded-[10px] bg-black/[0.05] outline-none" />}
              </div>
            )}
          </div>
          {footer(
            <>
              {error && <p className="m-0 mb-2 text-[14px] text-[#B91C1C]">{error}</p>}
              <button type="button" onClick={handleSubmit} disabled={isPending || cartCount === 0 || quoting} className={redButton} style={RED_FILL}>
                <Icon kind="check" size={18} />{submitWords}{!proforma && !isPending ? <span className="opacity-80 tabular-nums">· {fmt(cartTotal)}</span> : null}
              </button>
            </>
          )}
        </section>
      )}
    </div>,
    document.body,
  )

  // The whole window drawn at 96.3% (Khofi, 7 Nov: 10% smaller, then 7% back up). Its height is set in
  // pixels, which zoom scales in every browser, so it still fills 94% of the screen.
  const [screenH, setScreenH] = useState(() => window.innerHeight)
  useEffect(() => {
    const onResize = () => setScreenH(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const SCALE = 0.963

  const modal = phone ? phoneSheet : createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-0 sm:p-5 animate-fadeIn">
      <div className="relative bg-[var(--panel)] sm:rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden animate-slideUp max-w-[1280px]"
           style={{ zoom: SCALE, height: `${Math.round(screenH * 0.94 / SCALE)}px` }}>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-6 py-3 border-b border-black/[0.07] shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-zinc-900 text-white grid place-items-center"><Icon kind="plus" size={16} /></span>
            <span className="text-[17px] font-bold">{revise ? `Revise ${source?.proforma_number || 'proforma'}` : proforma ? 'New Proforma' : 'New Job'}</span>
          </div>
          {typeTabs}
          {branchName && <span className="ml-auto text-sm text-[var(--text-3)] hidden sm:inline">{branchName}</span>}
          <button type="button" onClick={onClose} aria-label="Close"
                  className={`${branchName ? '' : 'ml-auto'} w-9 h-9 grid place-items-center rounded-lg hover:bg-black/5 text-[var(--text-3)]`}>
            <Icon kind="close" size={18} />
          </button>
        </div>

        {lateNote}
        {customerBand}
        {chatBand}

        {proforma && (
          <div className="px-6 py-2 border-b border-black/[0.07] text-[12.5px] text-[var(--text-3)] shrink-0">
            {revise
              ? 'Its lines are in the cart at today’s prices: Edit or Remove them, or add more. Saving sends the next version (valid 14 days) and opens Share.'
              : 'Mix instant, production and design on one proforma: the cart keeps everything as you switch. Saving issues it (valid 14 days) and opens Share.'}
          </div>
        )}

          <div key={jobType} className="flex-1 min-h-0 grid grid-cols-[300px_1fr_280px] animate-unfold">
            <div className="p-4 border-r border-black/[0.07] min-h-0 flex flex-col">{serviceList}</div>
            <div className="p-4 overflow-y-auto min-h-0">{editor}</div>
            <div className="p-3.5 bg-[#fafaf9] border-l border-black/[0.07] min-h-0">{cartPanel}</div>
          </div>
      </div>
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