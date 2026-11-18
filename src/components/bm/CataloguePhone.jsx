// src/components/bm/CataloguePhone.jsx
//
// The catalogue on a phone (18 Nov 2026), in the Overview's look.
//   Catalogue, how many services, and how many have no price
//   search, then All | Instant | Production | Design | No price
//   each service as a row with its photo, its unit and its price
// A service opens its page: the photo (change it from the camera or the
// library, or take it off), the price and the colour price, bulk prices,
// what it costs to make, and the finishing it offers. New service and
// "What things cost" open the same forms as on the computer.
// The same calls as Catalogue.jsx.
import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getServices } from '../../api/bm'
import client from '../../api/client'
import { saveBulkPrices, saveServiceCost } from '../../api/discounts'
import CostsPanel from './CostsPanel'
import PhoneHeader from './PhoneHeader'
import { CreateServiceModal } from './Catalogue'
import { Chevron, Empty, Field, Pushed, Sheet, Skeleton, Svg, Title } from './ReportsPhoneUI'

const RED = '#D70015'
const card = 'mx-4 rounded-[16px] bg-white border border-black/[0.04] shadow-[0_3px_12px_rgba(17,24,39,0.05)]'
const money = v => `GHS ${parseFloat(v || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const UNIT = { PER_COPY: 'copy', PER_PIECE: 'piece', PER_SQFT: 'sq ft', PER_SQCM: 'sq cm', PER_JOB: 'job' }
const unitOf = u => UNIT[u] || (u || 'piece').replace(/^PER_/, '').toLowerCase()
const KINDS = [['INSTANT', 'Instant'], ['PRODUCTION', 'Production'], ['DESIGN', 'Design']]
const KIND = Object.fromEntries(KINDS)
const PHOTO_KINDS = ['image/jpeg', 'image/png', 'image/webp']
const colourOf = p => (p && parseFloat(p.color_multiplier) > 1 ? parseFloat(p.base_price) * parseFloat(p.color_multiplier) : null)
const errorOf = (err, fallback) => {
  const d = err?.response?.data
  return d?.detail || (d && Object.values(d).flat().find(v => typeof v === 'string')) || fallback
}

function Thumb({ src, size = 52 }) {
  const [broken, setBroken] = useState(false)
  return (
    <span className="relative rounded-[12px] overflow-hidden shrink-0 bg-[#F1F1F3] grid place-items-center text-[#C4C4C7]" style={{ width: size, height: size }}>
      {src && !broken
        ? <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="absolute inset-0 w-full h-full object-cover" />
        : <Svg size={size > 60 ? 34 : 20} width={1.6} d={<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>} />}
    </span>
  )
}

// ── Editing a price ───────────────────────────────────────────────────────────
function PriceSheet({ service, pricing, onClose }) {
  const queryClient = useQueryClient()
  const [base, setBase] = useState(pricing?.base_price ? String(parseFloat(pricing.base_price)) : '')
  const [mult, setMult] = useState(pricing?.color_multiplier ? String(parseFloat(pricing.color_multiplier)) : '1')
  const [error, setError] = useState('')
  const save = useMutation({
    mutationFn: () => (pricing?.id
      ? client.patch(`/api/v1/jobs/pricing/${pricing.id}/`, { base_price: parseFloat(base), color_multiplier: parseFloat(mult) })
      : client.post('/api/v1/jobs/pricing/create/', { service: service.id, base_price: parseFloat(base), color_multiplier: parseFloat(mult), is_active: true })),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pricing'] }); onClose() },
    onError: err => setError(errorOf(err, 'The price did not save.')),
  })
  const go = () => {
    if (!(parseFloat(base) >= 0)) return setError('Enter the price.')
    if (!(parseFloat(mult) >= 1)) return setError('Colour costs at least the black and white price: 1 or more.')
    setError(''); save.mutate()
  }
  const colour = parseFloat(base) >= 0 && parseFloat(mult) > 1 ? parseFloat(base) * parseFloat(mult) : null
  return (
    <Sheet title={pricing ? 'Change the price' : 'Set a price'} sub={service.name} onClose={onClose} busy={save.isPending} error={error}
      action={{ label: 'Save price', onClick: go }}>
      <Field label={`Price per ${unitOf(service.unit)} (GHS)`}>
        <input autoFocus type="number" inputMode="decimal" min="0" step="0.5" value={base} onChange={e => setBase(e.target.value)} placeholder="e.g. 3.00"
          className="w-full mt-1 text-[28px] font-bold tabular-nums bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      </Field>
      <Field label="Colour costs this many times more">
        <input type="number" inputMode="decimal" min="1" step="0.1" value={mult} onChange={e => setMult(e.target.value)}
          className="w-full mt-1 text-[18px] font-semibold tabular-nums bg-transparent outline-none" />
        <span className="block mt-0.5 text-[13px] text-[#8A8A8E]">{colour != null ? `Colour: ${money(colour)} per ${unitOf(service.unit)}` : 'No colour price: 1 means the same.'}</span>
      </Field>
      <p className="m-0 px-1 text-[13px] text-[#8A8A8E]">The same at every branch, on the website and in the app.</p>
    </Sheet>
  )
}

// ── Bulk prices ───────────────────────────────────────────────────────────────
function BulkPrices({ service, pricing }) {
  const queryClient = useQueryClient()
  const [bands, setBands] = useState(() => (pricing.bulk_prices || []).map(b => ({ from: String(b.from), price: String(b.price) })))
  const [said, setSaid] = useState({ text: '', bad: false })
  const save = useMutation({
    mutationFn: () => saveBulkPrices(pricing.id, bands.filter(b => b.from && b.price).map(b => ({ from: Number(b.from), price: Number(b.price) }))),
    onSuccess: () => { setSaid({ text: 'Bulk prices saved.', bad: false }); queryClient.invalidateQueries({ queryKey: ['pricing', 'company'] }) },
    onError: err => setSaid({ text: errorOf(err, 'Could not save.'), bad: true }),
  })
  const set = (i, key, v) => setBands(bands.map((b, j) => (j === i ? { ...b, [key]: v.replace(/[^\d.]/g, '') } : b)))
  const unit = unitOf(service.unit)
  return (
    <>
      <Title extra={<button type="button" onClick={() => setBands([...bands, { from: '', price: '' }])} className="text-[15px] font-medium" style={{ color: RED }}>Add</button>}>Bulk prices</Title>
      <p className="m-0 px-5 -mt-1 mb-2 text-[13.5px] text-[#8A8A8E]">From so many {unit}s (counted on the whole job, {unit}s × copies), the price per {unit} drops. Octos quotes these by itself.</p>
      <div className={card}>
        {bands.length === 0 ? <Empty>None yet: the list price for any amount.</Empty> : bands.map((b, i) => (
          <div key={i} className={`px-4 py-2.5 flex items-center gap-2 text-[15px] ${i ? 'border-t border-black/[0.06]' : ''}`}>
            <span className="text-[#6E6E73]">From</span>
            <input value={b.from} onChange={e => set(i, 'from', e.target.value)} inputMode="numeric" aria-label="From how many"
              className="w-[68px] h-9 px-2 rounded-[10px] bg-[#F2F2F5] text-[16px] font-semibold tabular-nums outline-none" />
            <span className="text-[#6E6E73]">for GHS</span>
            <input value={b.price} onChange={e => set(i, 'price', e.target.value)} inputMode="decimal" aria-label="Price"
              className="w-[72px] h-9 px-2 rounded-[10px] bg-[#F2F2F5] text-[16px] font-semibold tabular-nums outline-none" />
            <button type="button" onClick={() => setBands(bands.filter((_, j) => j !== i))} aria-label="Remove this bulk price"
              className="ml-auto w-8 h-8 grid place-items-center rounded-full text-[#A1A1AA]"><Svg size={16} width={2.4} d={<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>} /></button>
          </div>
        ))}
        <div className="px-4 py-2.5 border-t border-black/[0.06] flex items-center gap-3">
          <span className={`flex-1 text-[13.5px] ${said.bad ? 'text-[#B91C1C]' : 'text-[#15803D]'}`}>{said.text}</span>
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending}
            className="h-[34px] px-4 rounded-full bg-[#1C1C1E] text-white text-[14px] font-semibold disabled:opacity-40">{save.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </>
  )
}

// ── Cost to make ──────────────────────────────────────────────────────────────
const BASES = [['COLOUR_PAGE', 'Colour page'], ['BW_PAGE', 'B&W page'], ['FIXED', 'Fixed'], ['NONE', 'Not set']]

function CostToMake({ service, pricing }) {
  const queryClient = useQueryClient()
  const [basis, setBasis] = useState(service.cost_basis || 'NONE')
  const [size, setSize] = useState(String(service.cost_size ?? '1'))
  const [amount, setAmount] = useState(String(service.cost_amount ?? '0'))
  const [said, setSaid] = useState({ text: '', bad: false })
  const save = useMutation({
    mutationFn: () => saveServiceCost(service.id, { cost_basis: basis, cost_size: size || '1', cost_amount: amount || '0' }),
    onSuccess: updated => {
      queryClient.setQueryData(['services'], list => (Array.isArray(list) ? list.map(x => (x.id === updated.id ? updated : x)) : list))
      setSaid({ text: 'Cost saved.', bad: false })
    },
    onError: err => setSaid({ text: errorOf(err, 'Could not save.'), bad: true }),
  })
  const cost = service.unit_cost != null ? Number(service.unit_cost) : null
  const price = pricing ? Number(pricing.base_price) : null
  const page = basis === 'COLOUR_PAGE' || basis === 'BW_PAGE'
  return (
    <>
      <Title>Cost to make</Title>
      <div className={card}>
        <div className="px-4 py-3 text-[15px]">
          {cost != null
            ? <>About <b className="tabular-nums">GHS {cost.toFixed(2)}</b> per {unitOf(service.unit)}{price ? <span className="text-[#6E6E73]"> · earns <b className="text-[#111]">{(price / cost).toFixed(1)}×</b> its cost</span> : null}</>
            : <span className="text-[#B45309]">Not set yet, so discounts on it are held small.</span>}
        </div>
        <div className="px-4 pb-3">
          <div className="p-[3px] rounded-[10px] bg-black/[0.06] grid grid-cols-4" role="radiogroup" aria-label="What it costs">
            {BASES.map(([v, label]) => (
              <button key={v} type="button" role="radio" aria-checked={basis === v} onClick={() => setBasis(v)}
                className={`h-[32px] rounded-[8px] text-[13px] font-semibold ${basis === v ? 'bg-white text-[#111] shadow-[0_2px_6px_rgba(0,0,0,0.10)]' : 'text-[#3A3A3C]'}`}>{label}</button>
            ))}
          </div>
        </div>
        {page && (
          <label className="px-4 py-2.5 border-t border-black/[0.06] flex items-center justify-between text-[15px]">
            <span className="text-[#6E6E73]">Size, in A4 pages</span>
            <input value={size} onChange={e => setSize(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal"
              className="w-[80px] h-9 px-2 rounded-[10px] bg-[#F2F2F5] text-[16px] font-semibold text-right tabular-nums outline-none" />
          </label>
        )}
        {basis === 'FIXED' && (
          <label className="px-4 py-2.5 border-t border-black/[0.06] flex items-center justify-between text-[15px]">
            <span className="text-[#6E6E73]">Costs (GHS)</span>
            <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal"
              className="w-[96px] h-9 px-2 rounded-[10px] bg-[#F2F2F5] text-[16px] font-semibold text-right tabular-nums outline-none" />
          </label>
        )}
        <div className="px-4 py-2.5 border-t border-black/[0.06] flex items-center gap-3">
          <span className={`flex-1 text-[13.5px] ${said.bad ? 'text-[#B91C1C]' : 'text-[#15803D]'}`}>{said.text}</span>
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending}
            className="h-[34px] px-4 rounded-full bg-[#1C1C1E] text-white text-[14px] font-semibold disabled:opacity-40">{save.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </>
  )
}

// ── A service's page ──────────────────────────────────────────────────────────
function ServicePage({ service, pricing, onClose }) {
  const queryClient = useQueryClient()
  const input = useRef(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [pricingOpen, setPricingOpen] = useState(false)
  const saved = updated => {
    queryClient.setQueryData(['services'], list => (Array.isArray(list) ? list.map(s => (s.id === updated.id ? updated : s)) : list))
    queryClient.invalidateQueries({ queryKey: ['services'] })
    setPreview(p => { if (p) URL.revokeObjectURL(p); return null })
  }
  const failed = err => { setPreview(p => { if (p) URL.revokeObjectURL(p); return null }); setError(errorOf(err, 'The photo did not save. Try again.')) }
  const upload = useMutation({
    mutationFn: file => { const form = new FormData(); form.append('image', file); return client.put(`/api/v1/jobs/services/${service.id}/photo/`, form).then(r => r.data) },
    onSuccess: saved, onError: failed,
  })
  const remove = useMutation({
    mutationFn: () => client.delete(`/api/v1/jobs/services/${service.id}/photo/`).then(r => r.data),
    onSuccess: saved, onError: failed,
  })
  const busy = upload.isPending || remove.isPending
  const choose = file => {
    if (!file) return
    setError('')
    if (!PHOTO_KINDS.includes(file.type)) return setError('Use a JPG, PNG or WebP photo.')
    if (file.size > 5 * 1024 * 1024) return setError('That photo is over 5 MB. Use a smaller one.')
    setPreview(URL.createObjectURL(file)); upload.mutate(file)
  }
  const colour = colourOf(pricing)
  const addons = service.addons || []

  return (
    <Pushed back="Catalogue" onBack={onClose} label="Service">
      <div className="mx-4 mt-3 relative aspect-[4/3] rounded-[20px] overflow-hidden bg-[#EDEDF0]">
        {preview ? <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
          : service.image ? <img src={service.image} alt={service.name} className="absolute inset-0 w-full h-full object-cover" />
            : <div className="absolute inset-0 grid place-items-center text-[#A1A1AA]"><div className="text-center"><Svg size={40} width={1.4} d={<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>} /><div className="mt-1 text-[14px]">No photo yet</div></div></div>}
        {busy && <div className="absolute inset-0 grid place-items-center bg-black/40 text-white text-[15px] font-semibold">{upload.isPending ? 'Uploading…' : 'Removing…'}</div>}
      </div>
      <input ref={input} type="file" accept={PHOTO_KINDS.join(',')} className="hidden" onChange={e => { choose(e.target.files?.[0]); e.target.value = '' }} />
      <div className="mx-4 mt-2.5 flex gap-2">
        <button type="button" onClick={() => input.current?.click()} disabled={busy}
          className="flex-1 h-[44px] rounded-[14px] bg-white border border-black/[0.08] text-[15.5px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50" style={{ color: RED }}>
          <Svg size={18} d={<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>} />
          {service.image ? 'Change photo' : 'Add a photo'}
        </button>
        {service.image && (
          <button type="button" onClick={() => { setError(''); remove.mutate() }} disabled={busy}
            className="h-[44px] px-4 rounded-[14px] bg-white border border-black/[0.08] text-[15.5px] font-semibold text-[#3A3A3C] disabled:opacity-50">Remove</button>
        )}
      </div>
      <p className="m-0 mx-5 mt-1.5 text-[13px]" style={{ color: error ? '#B91C1C' : '#8A8A8E' }}>{error || 'Take one with the camera or pick one. It shows on the website and the app too.'}</p>

      <div className="px-5 pt-4">
        <div className="text-[13px] text-[#6E6E73]">{KIND[service.category] || service.category} · <span className="font-mono">{service.code}</span></div>
        <h1 className="m-0 text-[24px] leading-[30px] font-extrabold tracking-[-0.02em] text-[#111]">{service.name}</h1>
        {service.variant_label && <div className="text-[14px] text-[#6E6E73]">{service.variant_label}</div>}
        {service.description && <p className="m-0 mt-2 text-[15px] leading-[21px] text-[#3A3A3C]">{service.description}</p>}
      </div>

      <Title>Price</Title>
      <button type="button" onClick={() => setPricingOpen(true)} className={`${card} block w-[calc(100%-32px)] text-left px-4 py-3.5 active:bg-black/[0.02]`}>
        <div className="flex items-center gap-3">
          <span className="flex-1 min-w-0">
            {pricing
              ? <><span className="block text-[26px] leading-[32px] font-extrabold tabular-nums">{money(pricing.base_price)}</span>
                <span className="block text-[13.5px] text-[#8A8A8E]">per {unitOf(service.unit)}{colour != null ? <> · colour <b className="text-[#111] tabular-nums">{money(colour)}</b></> : ''}</span></>
              : <><span className="block text-[18px] font-bold" style={{ color: RED }}>No price yet</span><span className="block text-[13.5px] text-[#8A8A8E]">It can't be quoted until it has one.</span></>}
          </span>
          <span className="text-[15px] font-medium shrink-0" style={{ color: RED }}>{pricing ? 'Change' : 'Set'}</span>
        </div>
      </button>
      <p className="m-0 mx-5 mt-1.5 text-[13px] text-[#8A8A8E]">The same at every branch, on the website and in the app.</p>

      {pricing && <BulkPrices key={pricing.id} service={service} pricing={pricing} />}
      <CostToMake key={service.id} service={service} pricing={pricing} />

      {addons.length > 0 && (
        <>
          <Title>Finishing offered</Title>
          <div className="px-4 flex flex-wrap gap-2">
            {addons.map(a => <span key={a.id} className="h-[32px] px-3 rounded-full bg-white border border-black/[0.06] text-[14px] inline-flex items-center">{a.name}</span>)}
          </div>
        </>
      )}

      {pricingOpen && <PriceSheet service={service} pricing={pricing} onClose={() => setPricingOpen(false)} />}
    </Pushed>
  )
}

// ── The list ──────────────────────────────────────────────────────────────────
function Row({ s, pricing, first, onOpen }) {
  const colour = colourOf(pricing)
  return (
    <button type="button" onClick={onOpen} className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-black/[0.03] ${first ? '' : 'border-t border-black/[0.06]'}`}>
      <Thumb src={s.image} />
      <span className="flex-1 min-w-0">
        <span className="block text-[15.5px] leading-[20px] font-semibold line-clamp-2">{s.name}</span>
        <span className="block text-[12.5px] text-[#8A8A8E] truncate">per {unitOf(s.unit)}{colour != null ? ` · colour ${money(colour)}` : ''}</span>
      </span>
      <span className="text-right shrink-0">
        {pricing ? <span className="block text-[15px] font-semibold tabular-nums">{money(pricing.base_price)}</span>
          : <span className="block text-[13.5px] font-semibold" style={{ color: RED }}>No price</span>}
      </span>
      <Chevron />
    </button>
  )
}

export default function CataloguePhone() {
  const [kind, setKind] = useState('ALL')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [costs, setCosts] = useState(false)

  const { data: services = [], isLoading } = useQuery({ queryKey: ['services'], queryFn: () => getServices().then(r => r.data), staleTime: 60_000 })
  const { data: prices = [] } = useQuery({
    queryKey: ['pricing', 'company'],
    queryFn: async () => {
      let url = '/api/v1/jobs/pricing/?company=1'
      const all = []
      while (url) {
        const { data } = await client.get(url)
        if (Array.isArray(data)) return data
        all.push(...(data?.results || [])); url = data?.next || null
      }
      return all
    },
    staleTime: 60_000,
  })
  const priceOf = useMemo(() => Object.fromEntries(prices.map(p => [typeof p.service === 'object' ? p.service?.id : p.service, p])), [prices])

  const q = search.trim().toLowerCase()
  const unpriced = services.filter(s => !priceOf[s.id]).length
  const shown = services.filter(s =>
    (kind === 'ALL' || (kind === 'NOPRICE' ? !priceOf[s.id] : s.category === kind)) &&
    (!q || [s.name, s.code, s.description].some(t => (t || '').toLowerCase().includes(q))))
  const groups = KINDS.map(([k, label]) => ({ k, label, items: shown.filter(s => s.category === k) })).filter(g => g.items.length)
  const open = services.find(s => s.id === openId)
  const chips = [['ALL', 'All', services.length], ...KINDS.map(([k, l]) => [k, l, services.filter(s => s.category === k).length]), ['NOPRICE', 'No price', unpriced]]

  return (
    <div className="ios min-h-full pb-6" style={{ background: '#F6F6F8' }}>
      <PhoneHeader />
      <div className="px-4 pt-1 flex items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] text-[#111]">Catalogue</h1>
          <div className="text-[14px] text-[#6E6E73]">{services.length} services{unpriced > 0 && <span style={{ color: RED }}> · {unpriced} without a price</span>}</div>
        </div>
        <button type="button" onClick={() => setCreating(true)} aria-label="New service"
          className="w-[38px] h-[38px] rounded-full grid place-items-center text-white shrink-0 mb-1" style={{ background: RED }}>
          <Svg size={20} width={2.6} d={<path d="M12 5v14 M5 12h14" />} />
        </button>
      </div>

      <label className="mx-4 mt-3 h-[40px] rounded-[12px] bg-black/[0.06] flex items-center gap-2 px-3 text-[#8A8A8E]">
        <Svg size={17} width={2.2} d={<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services" type="search"
          className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-[#111] placeholder:text-[#8A8A8E]" />
      </label>

      <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {chips.map(([k, label, n]) => {
          const on = kind === k
          return (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={`shrink-0 h-[34px] px-3.5 rounded-full flex items-center gap-1.5 text-[14px] font-semibold whitespace-nowrap
                ${on ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E] border border-black/[0.06]'}`}>
              {label}<span className="tabular-nums" style={{ color: on ? 'rgba(255,255,255,0.7)' : k === 'NOPRICE' && n > 0 ? RED : '#8A8A8E' }}>{n}</span>
            </button>
          )
        })}
      </div>

      <button type="button" onClick={() => setCosts(true)} className={`${card} mt-3 w-[calc(100%-32px)] flex items-center gap-3 px-4 py-3 text-left`}>
        <span className="w-9 h-9 rounded-[11px] grid place-items-center shrink-0" style={{ background: '#FFEDB8', color: '#B45309' }}>
          <Svg size={19} d={<path d="M12 9c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3z M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15.5px] font-semibold">What things cost</span>
          <span className="block text-[13px] text-[#8A8A8E]">Paper, toner and the other costs behind each price</span>
        </span>
        <Chevron />
      </button>

      {isLoading ? <Skeleton rows={[300]} /> : groups.length === 0 ? (
        <div className={`${card} mt-4`}><Empty>{q ? `Nothing matches “${search.trim()}”.` : 'Nothing here.'}</Empty></div>
      ) : groups.map(g => (
        <div key={g.k}>
          <Title extra={<span className="text-[12.5px] text-[#8A8A8E]">{g.items.length}</span>}>{g.label}</Title>
          <div className={`${card} overflow-hidden`}>
            {g.items.map((s, i) => <Row key={s.id} s={s} pricing={priceOf[s.id]} first={i === 0} onOpen={() => setOpenId(s.id)} />)}
          </div>
        </div>
      ))}

      {open && <ServicePage service={open} pricing={priceOf[open.id]} onClose={() => setOpenId(null)} />}
      {creating && <CreateServiceModal onClose={() => setCreating(false)} />}
      {costs && <CostsPanel onClose={() => setCosts(false)} />}
    </div>
  )
}
