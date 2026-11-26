// src/components/bm/QuotePanel.jsx
//
// A quote from the inbox (25 Nov 2026, from Khofi's mock "Quote in the
// chat"). Beside the chat on a computer, the whole screen on a phone: pick
// a service, its sizes and pages, add-ons as chips, the customer's file
// from this chat, more lines if needed. The price is worked out by the
// server as it is built, by the same engine as Octos's orders, so what you
// see is what they get. Then send it:
//
//   Send with a payment link   the order, paid online; the job goes to the
//                              front desk or the coordinator by itself
//   Pay at the counter         a pickup code; printed ahead only for a
//                              customer we know (Octos's own rule)
//   Send as a proforma         the formal PDF, also in the Proformas tab
//
// "Attach the quote as a PDF" sends the quote on paper with the first two.
// QuoteCard is how a sent quote shows in the chat: it follows the order.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query'
import client from '../../api/client'
import { useAuth } from '../../context/AuthContext'

const PROFORMA_ROLES = ['BRANCH_MANAGER', 'REGIONAL_MANAGER', 'BELT_MANAGER', 'SUPER_ADMIN']
const getServices = () => client.get('/api/v1/communications/quote/services/').then(r => r.data.services)
const priceQuote = (id, lines) => client.post(`/api/v1/communications/${id}/quote/price/`, { lines }).then(r => r.data)
const sendQuote = (id, body) => client.post(`/api/v1/communications/${id}/quote/send/`, body).then(r => r.data)

const Svg = ({ size: s = 18, children, ...p }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
)
export const QuoteIcon = p => <Svg {...p}><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h6M9 16h4M14 3v4h4" /></Svg>
const CloseIcon = p => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>
const DownIcon = p => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
const CheckIcon = p => <Svg {...p}><path d="m5 12 5 5L20 7" /></Svg>

let nextKey = 1
const newLine = () => ({ key: nextKey++, service: null, quantity: 1, specs: {}, addons: [], file: null })
// What the server is sent: Octos's own line shape.
const payload = line => ({
  service_code: line.service.code,
  quantity: Math.max(1, parseInt(line.quantity) || 1),
  specifications: Object.fromEntries(Object.entries(line.specs).filter(([, v]) => v !== '' && v != null)),
  addon_codes: line.addons,
  ...(line.file ? { file: line.file } : {}),
})

// A field, 16px on a phone so it never zooms (Khofi's rule).
const FIELD = 'w-full h-[42px] px-3 rounded-[10px] border border-[#D4D4D4] bg-white text-[16px] sm:text-[14px] outline-none focus:border-[#080808]'
const LABEL = 'flex flex-col gap-1 text-[12px] font-semibold text-[#404040]'

function ServicePicker({ services, value, onPick, autoFocus }) {
  const [open, setOpen] = useState(!value)
  const [q, setQ] = useState('')
  const found = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    const all = services || []
    if (!words.length) return all.slice(0, 40)
    return all.filter(s => {
      const text = `${s.display} ${s.name} ${s.code} ${s.variant || ''}`.toLowerCase()
      return words.every(w => text.includes(w))
    }).slice(0, 40)
  }, [services, q])
  if (!open && value) {
    return (
      <div className={LABEL}>What is it?
        <button type="button" onClick={() => { setOpen(true); setQ('') }}
          className="h-[42px] px-3 rounded-[10px] border border-[#D4D4D4] bg-white flex items-center justify-between gap-2 text-left">
          <span className="min-w-0 truncate text-[14px] font-semibold text-[#080808]">{value.display}</span>
          <DownIcon size={14} />
        </button>
      </div>
    )
  }
  return (
    <div className={LABEL}>What is it?
      <input autoFocus={autoFocus} value={q} onChange={e => setQ(e.target.value)} placeholder="Search: A4 colour, banner, binding…"
        className={FIELD} aria-label="Search the catalogue" />
      <div role="listbox" aria-label="Services" className="max-h-[220px] overflow-y-auto rounded-[10px] border border-[#E6E6E6] bg-white">
        {!services && <p className="m-0 px-3 py-2.5 text-[13px] font-normal text-[#616161]">Loading the catalogue…</p>}
        {services && !found.length && <p className="m-0 px-3 py-2.5 text-[13px] font-normal text-[#616161]">Nothing matches “{q}”.</p>}
        {found.map(s => (
          <button key={s.code} type="button" role="option" aria-selected={value?.code === s.code}
            onClick={() => { onPick(s); setOpen(false) }}
            className="w-full px-3 py-2 flex flex-col items-start gap-px text-left border-b last:border-b-0 border-[#F0F0F0] hover:bg-[#F7F7F7]">
            <span className="text-[13.5px] font-semibold text-[#080808]">{s.display}</span>
            {s.about && <span className="text-[11.5px] font-normal text-[#616161] line-clamp-1">{s.about}</span>}
          </button>
        ))}
      </div>
      {value && <button type="button" onClick={() => setOpen(false)} className="self-start text-[12px] font-semibold text-[#616161] underline">Keep {value.display}</button>}
    </div>
  )
}

function SpecField({ field, value, onChange, placeholder }) {
  const id = useId()
  if (field.type === 'select' && Array.isArray(field.options)) {
    return (
      <label className={LABEL} htmlFor={id}>{field.label}
        <select id={id} value={value ?? ''} onChange={e => onChange(e.target.value)} className={FIELD}>
          <option value="">Choose…</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    )
  }
  if (field.type === 'boolean' || field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-[13px] font-semibold text-[#404040]">
        <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} className="w-[18px] h-[18px] accent-[#080808]" />
        {field.label}
      </label>
    )
  }
  const number = field.type === 'number' || ['pages', 'width_in', 'height_in', 'quantity'].includes(field.key)
  return (
    <label className={LABEL} htmlFor={id}>{field.label}
      <input id={id} type={number ? 'number' : 'text'} inputMode={number ? 'decimal' : undefined} min={number ? (field.min ?? 1) : undefined}
        value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} className={FIELD} />
    </label>
  )
}

function LineEditor({ line, n, services, files, onChange, onRemove, only }) {
  const s = line.service
  const fields = (s?.needs || [])
  const hasQuantity = fields.some(f => f.key === 'quantity')
  const file = files.find(f => f.id === line.file)
  const set = patch => onChange({ ...line, ...patch })
  const pick = svc => {
    const specs = {}
    for (const f of svc.needs || []) if (f.key !== 'quantity' && f.default != null) specs[f.key] = f.default
    const q = (svc.needs || []).find(f => f.key === 'quantity')
    // A file in this chat is ticked for a service that is printed from one.
    const auto = (svc.needs_file || svc.counts_pages) && files.length === 1 ? files[0].id : line.file
    onChange({ ...line, service: svc, specs, addons: [], quantity: q?.default ?? line.quantity ?? 1, file: auto })
  }
  return (
    <div className="border border-[#E6E6E6] rounded-[12px] p-3 flex flex-col gap-2.5 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold tracking-[0.08em] text-[#616161]">LINE {n}</span>
        {!only && <button type="button" onClick={onRemove} className="text-[12px] font-semibold text-[#616161] hover:text-[#080808]">Remove</button>}
      </div>
      <ServicePicker services={services} value={s} onPick={pick} autoFocus={!s} />
      {s && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            {fields.filter(f => f.key !== 'quantity').map(f => (
              <SpecField key={f.key} field={f} value={line.specs[f.key]}
                placeholder={f.key === 'pages' && file?.pages ? `${file.pages} from the file` : undefined}
                onChange={v => set({ specs: { ...line.specs, [f.key]: v } })} />
            ))}
            {hasQuantity
              ? <SpecField field={fields.find(f => f.key === 'quantity')} value={line.quantity} onChange={v => set({ quantity: v })} />
              : <SpecField field={{ key: 'quantity', label: s.unit === 'sheet' || s.counts_pages ? 'Copies' : 'Quantity', type: 'number', min: 1 }}
                  value={line.quantity} onChange={v => set({ quantity: v })} />}
          </div>
          {s.addons?.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[#404040]">Finishing</span>
              <div className="flex flex-wrap gap-1.5">
                {s.addons.map(a => {
                  const on = line.addons.includes(a.code)
                  return (
                    <button key={a.code} type="button" aria-pressed={on}
                      onClick={() => set({ addons: on ? line.addons.filter(c => c !== a.code) : [...line.addons, a.code] })}
                      className={`h-[30px] px-3 rounded-full border text-[12px] font-semibold ${on ? 'bg-[#080808] border-[#080808] text-white' : 'bg-white border-[#D4D4D4] text-[#080808]'}`}>
                      {a.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {files.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[#404040]">File from this chat{s.needs_file ? '' : ' (if any)'}</span>
              {files.map(f => (
                <label key={f.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-[10px] text-[13px] cursor-pointer ${line.file === f.id ? 'bg-[#F0F0F0]' : 'bg-[#F7F7F7]'}`}>
                  <input type="checkbox" checked={line.file === f.id} onChange={e => set({ file: e.target.checked ? f.id : null })}
                    className="w-[18px] h-[18px] accent-[#080808] shrink-0" />
                  <span className="flex-1 min-w-0 font-semibold truncate">{f.name}</span>
                  {f.pages ? <span className="text-[11.5px] text-[#616161] shrink-0">{f.pages} page{f.pages === 1 ? '' : 's'}</span> : null}
                </label>
              ))}
            </div>
          )}
          {s.needs_file && !line.file && (
            <p className="m-0 text-[12px] text-[#8A4B08]">This is printed from the customer’s file. Tick it above, or ask them to send it.</p>
          )}
        </>
      )}
    </div>
  )
}

function Price({ result, loading, ready }) {
  if (!ready) return null
  if (result?.error) {
    return <div className="rounded-[12px] bg-[#FFF4E5] px-3.5 py-3 text-[13px] text-[#8A4B08]">{result.error}</div>
  }
  if (!result) {
    return <div className="rounded-[12px] bg-[#F7F7F7] px-3.5 py-3 text-[13px] text-[#616161]">Working out the price…</div>
  }
  return (
    <div className={`rounded-[12px] bg-[#F7F7F7] px-3.5 py-3 flex flex-col gap-1.5 text-[13px] ${loading ? 'opacity-60' : ''}`} aria-live="polite">
      {result.lines.map((l, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-3">
            <span className="text-[#404040] min-w-0">{l.what}{Number(l.pages) > 1 ? `, ${l.pages} pages` : ''} × {l.quantity}</span>
            <span className="font-semibold tabular-nums shrink-0">GHS {l.price}</span>
          </div>
          {l.addons.map((a, j) => (
            <div key={j} className="flex justify-between gap-3">
              <span className="text-[#404040] min-w-0">{a.what}{a.detail ? ` (${a.detail})` : ''} × {a.quantity}</span>
              <span className="font-semibold tabular-nums shrink-0">GHS {a.price}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="flex justify-between items-baseline pt-1.5 border-t border-[#E0E0E0]">
        <span className="font-extrabold">Total</span>
        <span className="text-[22px] font-extrabold tabular-nums">GHS {result.total}</span>
      </div>
      <span className="text-[12px] text-[#616161]">
        {result.ready ? `Ready ${result.ready}${result.branch ? ` at ${result.branch}` : ''}` : 'The team confirms the ready time.'}
      </span>
    </div>
  )
}

function CustomerDetails({ value, onChange }) {
  const business = value.kind === 'business'
  const set = patch => onChange({ ...value, ...patch })
  return (
    <div className="rounded-[12px] border border-[#E6E6E6] p-3 flex flex-col gap-2.5">
      <p className="m-0 text-[13px] text-[#404040]">A proforma goes to a registered customer. Who is it for?</p>
      <div role="radiogroup" className="inline-flex self-start p-[3px] rounded-lg bg-black/[0.05] gap-0.5">
        {[['person', 'A person'], ['business', 'A business']].map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={value.kind === k} onClick={() => set({ kind: k })}
            className={`h-7 px-3 rounded-md text-xs ${value.kind === k ? 'bg-white shadow-sm font-bold' : 'font-semibold text-[#616161]'}`}>{label}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {business ? (
          <>
            <label className={LABEL}>Business name<input value={value.company_name || ''} onChange={e => set({ company_name: e.target.value })} className={FIELD} /></label>
            <label className={LABEL}>Contact person<input value={value.contact_person || ''} onChange={e => set({ contact_person: e.target.value })} className={FIELD} /></label>
          </>
        ) : (
          <>
            <label className={LABEL}>First name<input value={value.first_name || ''} onChange={e => set({ first_name: e.target.value })} className={FIELD} /></label>
            <label className={LABEL}>Last name<input value={value.last_name || ''} onChange={e => set({ last_name: e.target.value })} className={FIELD} /></label>
          </>
        )}
      </div>
    </div>
  )
}

export default function QuotePanel({ conv, name: whole = '', messages, onClose, onSent, phone = false }) {
  const { user } = useAuth()
  const [lines, setLines] = useState(() => [newLine()])
  const [pdf, setPdf] = useState(true)
  const [error, setError] = useState('')
  const [customer, setCustomer] = useState(null)        // asked for when a proforma needs it
  const { data: services } = useQuery({ queryKey: ['quote-services'], queryFn: getServices, staleTime: 5 * 60_000 })

  // This chat's files from the customer, newest first, never a deleted one.
  const files = useMemo(() => (messages || [])
    .filter(m => m.direction === 'INBOUND' && m.media_file && !m.file_keep?.deleted)
    .slice(-12).reverse()
    .map(m => ({ id: m.id, name: m.media_name || 'Photo', pages: m.media_pages })), [messages])

  // The price, a moment after typing stops.
  const ready = lines.length > 0 && lines.every(l => l.service)
  const body = ready ? lines.map(payload) : null
  const [asked, setAsked] = useState(null)
  const timer = useRef(null)
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAsked(body ? JSON.stringify(body) : null), 350)
    return () => clearTimeout(timer.current)
  }, [JSON.stringify(body)]) // eslint-disable-line react-hooks/exhaustive-deps
  const price = useQuery({
    queryKey: ['quote-price', conv.id, asked],
    queryFn: () => priceQuote(conv.id, JSON.parse(asked)),
    enabled: !!asked,
    placeholderData: keepPreviousData,
  })

  const send = useMutation({
    mutationFn: how => sendQuote(conv.id, {
      lines: lines.map(payload), how, pdf,
      ...(how === 'proforma' && customer ? { customer: customerBody(customer) } : {}),
    }),
    onSuccess: () => { setError(''); onSent?.() },
    onError: (err, how) => {
      const data = err?.response?.data || {}
      if (how === 'proforma' && data.needs_customer) {
        setCustomer(c => c || { kind: 'person', first_name: '', last_name: '' })
        setError('')
        return
      }
      setError(data.detail || 'Could not send. Try again.')
    },
  })

  const canSend = ready && !price.data?.error && !!price.data && !send.isPending
  const name = (whole || conv.contact_name || 'the customer').split(' ')[0]
  const proformaRole = PROFORMA_ROLES.includes(user?.role_name)

  return (
    <aside aria-label="Quote" className={`${phone ? 'w-full' : 'w-[440px] max-w-full'} h-full flex flex-col bg-white border-l border-[#E6E6E6]`}>
      <div className="h-[60px] shrink-0 px-4 sm:px-5 border-b border-[#E6E6E6] flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <h3 className="m-0 text-[16px] font-extrabold truncate">Quote for {name}</h3>
          <span className="text-[12px] text-[#616161]">Same prices as the catalogue and Octos</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close the quote"
          className="w-[34px] h-[34px] shrink-0 rounded-lg border border-[#E6E6E6] grid place-items-center text-[#404040] hover:bg-[#F7F7F7]"><CloseIcon size={16} /></button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 flex flex-col gap-3.5">
        {lines.map((line, i) => (
          <LineEditor key={line.key} line={line} n={i + 1} services={services} files={files} only={lines.length === 1}
            onChange={next => setLines(ls => ls.map(l => (l.key === line.key ? next : l)))}
            onRemove={() => setLines(ls => ls.filter(l => l.key !== line.key))} />
        ))}
        <button type="button" onClick={() => setLines(ls => [...ls, newLine()])} disabled={!ready}
          className="self-start h-[34px] px-3 rounded-lg border border-dashed border-[#BDBDBD] bg-white text-[12.5px] font-semibold text-[#404040] disabled:opacity-40">
          + Add another line
        </button>
        <Price result={price.data} loading={price.isFetching} ready={ready} />
        {customer && <CustomerDetails value={customer} onChange={setCustomer} />}
      </div>

      <div className="shrink-0 px-4 sm:px-5 pt-3.5 border-t border-[#E6E6E6] flex flex-col gap-2"
        style={{ paddingBottom: phone ? 'calc(env(safe-area-inset-bottom) + 14px)' : 18 }}>
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <span className="text-[12px] font-bold text-[#404040]">Send it to {name}</span>
          <label className="inline-flex items-center gap-[7px] text-[12.5px] font-semibold text-[#080808] cursor-pointer">
            <input type="checkbox" checked={pdf} onChange={e => setPdf(e.target.checked)} className="w-[18px] h-[18px] accent-[#080808]" />
            Attach the quote as a PDF
          </label>
        </div>
        {error && <p role="alert" className="m-0 text-[12.5px] text-[#B30000]">{error}</p>}
        {customer ? (
          <button type="button" onClick={() => send.mutate('proforma')} disabled={!canSend || !customerReady(customer)}
            className="h-[46px] rounded-[10px] bg-[#080808] text-white text-[14px] font-bold disabled:opacity-40">
            {send.isPending ? 'Sending…' : 'Register and send the proforma'}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => send.mutate('link')} disabled={!canSend}
              className="h-[46px] rounded-[10px] bg-[#080808] text-white text-[14px] font-bold disabled:opacity-40">
              {send.isPending && send.variables === 'link' ? 'Sending…' : 'Send with a payment link'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => send.mutate('counter')} disabled={!canSend}
                className="h-[44px] rounded-[10px] border border-[#D4D4D4] bg-white text-[13px] font-bold disabled:opacity-40">
                {send.isPending && send.variables === 'counter' ? 'Sending…' : 'Pay at the counter'}
              </button>
              <button type="button" onClick={() => send.mutate('proforma')} disabled={!canSend}
                className="h-[44px] rounded-[10px] border border-[#D4D4D4] bg-white text-[13px] font-bold disabled:opacity-40">
                {send.isPending && send.variables === 'proforma' ? 'Sending…' : 'Send as a proforma'}
              </button>
            </div>
          </>
        )}
        {customer && (
          <button type="button" onClick={() => setCustomer(null)} className="self-center text-[12px] font-semibold text-[#616161] underline">Back</button>
        )}
        {proformaRole && !customer && (
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('octos:open', { detail: { section: 'proformas' } }))}
            className="self-center text-[12px] font-semibold text-[#0B57D0] hover:underline">Big or credit job? Open in Proformas</button>
        )}
      </div>
    </aside>
  )
}

const customerReady = c => (c.kind === 'business' ? c.company_name?.trim() && c.contact_person?.trim()
  : c.first_name?.trim() && c.last_name?.trim())
const customerBody = c => (c.kind === 'business'
  ? { company_name: c.company_name.trim(), contact_person: c.contact_person.trim() }
  : { first_name: c.first_name.trim(), last_name: c.last_name.trim() })

// ── A sent quote in the chat ────────────────────────────────────────────
const STATE = {
  waiting: { bg: '#FFF4DB', fg: '#8A5A00' },
  counter: { bg: '#EEF3FF', fg: '#1D4ED8' },
  paid: { bg: '#E7FCEB', fg: '#0B5F2A' },
  closed: { bg: '#F0F0F0', fg: '#616161' },
}
export function QuoteCard({ q, body }) {
  const [open, setOpen] = useState(false)
  const look = STATE[q.state] || STATE.closed
  return (
    <div className="w-[320px] max-w-full rounded-[10px] bg-white/85 border border-black/[0.08] overflow-hidden text-[#080808]">
      <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-black/[0.06]">
        <span className="text-[10.5px] font-extrabold tracking-[0.06em] text-[#616161] inline-flex items-center gap-1.5 whitespace-nowrap"><QuoteIcon size={13} className="shrink-0" />QUOTE · {q.order}</span>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1" style={{ background: look.bg, color: look.fg }}>
          {q.state === 'paid' && <CheckIcon size={11} />}{q.label}
        </span>
      </div>
      <div className="px-3 py-2 flex flex-col gap-1 text-[12.5px]">
        {q.lines.map((l, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex justify-between gap-3"><span className="text-[#404040] min-w-0">{l.what}{Number(l.pages) > 1 ? `, ${l.pages} pages` : ''} × {l.quantity}</span><span className="tabular-nums shrink-0">{l.price}</span></div>
            {l.addons.map((a, j) => (
              <div key={j} className="flex justify-between gap-3"><span className="text-[#404040] min-w-0">{a.what} × {a.quantity}</span><span className="tabular-nums shrink-0">{a.price}</span></div>
            ))}
          </div>
        ))}
        <div className="flex justify-between pt-1.5 mt-0.5 border-t border-black/[0.06] font-extrabold text-[14px]"><span>Total</span><span className="tabular-nums">GHS {q.total}</span></div>
      </div>
      <div className="px-3 pb-2 flex items-center justify-between gap-2 text-[11.5px] text-[#616161]">
        <span>{q.how === 'counter' ? 'Pays at the counter' : 'Payment link'}{q.job ? ` · ${q.job}` : ''}</span>
        {body && <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="shrink-0 whitespace-nowrap font-semibold text-[#0B57D0] hover:underline">{open ? 'Hide the message' : 'See the message'}</button>}
      </div>
      {open && body && <p className="m-0 px-3 pb-2.5 text-[12.5px] whitespace-pre-line break-words text-[#404040]">{body}</p>}
    </div>
  )
}
