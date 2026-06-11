// src/components/bm/Catalogue.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { getServices } from '../../api/bm'
import { useAuth } from '../../context/AuthContext'
import client from '../../api/client'
import JobSuccessOverlay from '../shared/JobSuccessOverlay'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

const CATEGORY_CONFIG = {
  INSTANT:    { label: 'Instant',    color: 'bg-zinc-800',   text: 'text-white'        },
  PRODUCTION: { label: 'Production', color: 'bg-blue-600',   text: 'text-white'        },
  DESIGN:     { label: 'Design',     color: 'bg-violet-600', text: 'text-white'        },
}

// ── Service Image ─────────────────────────────────────────────────────────────
function ServiceImage({ src, name, small }) {
  const size = small ? 'w-20 h-16' : 'w-24 h-20'
  if (src) {
    return (
      <img src={src} alt={name}
        className={`${size} object-cover rounded-lg shrink-0 bg-[var(--bg)]`} />
    )
  }
  return (
    <div className={`${size} rounded-lg shrink-0 bg-[var(--bg)] border border-[var(--border)]
      flex items-center justify-center`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.5" className="text-[var(--border-dark)]">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    </div>
  )
}

// ── Edit Pricing Modal ────────────────────────────────────────────────────────
function EditPricingModal({ service, pricing, branchId, onClose }) {
  const queryClient = useQueryClient()
  const [basePrice,       setBasePrice]       = useState(pricing?.base_price || '')
  const [colorMultiplier, setColorMultiplier] = useState(pricing?.color_multiplier || '1.00')
  const [error,           setError]           = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (pricing?.id) {
        // Update existing
        return client.patch(`/api/v1/jobs/pricing/${pricing.id}/`, {
          base_price:        parseFloat(basePrice),
          color_multiplier:  parseFloat(colorMultiplier),
        })
      } else {
        // Create new
        return client.post('/api/v1/jobs/pricing/create/', {
          service:           service.id,
          branch:            branchId,
          base_price:        parseFloat(basePrice),
          color_multiplier:  parseFloat(colorMultiplier),
          is_active:         true,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
      onClose()
    },
    onError: (err) => {
      const d = err.response?.data
      setError(d?.detail || d?.non_field_errors?.[0] || Object.values(d || {}).flat()[0] || 'Failed to save pricing.')
    },
  })

  const handleSubmit = () => {
    if (!basePrice || isNaN(parseFloat(basePrice)) || parseFloat(basePrice) < 0) {
      setError('Enter a valid base price.'); return
    }
    if (!colorMultiplier || isNaN(parseFloat(colorMultiplier)) || parseFloat(colorMultiplier) < 1) {
      setError('Colour multiplier must be 1.00 or greater.'); return
    }
    setError('')
    mutate()
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <div className="font-black text-base text-[var(--text)]">
            {pricing ? 'Edit Pricing' : 'Set Pricing'}
          </div>
          <div className="text-xs text-[var(--text-3)] mt-0.5">{service.name}</div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
              Base Price (GHS)
            </label>
            <input type="number" min="0" step="0.50" value={basePrice}
              onChange={e => setBasePrice(e.target.value)}
              placeholder="e.g. 3.00"
              className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)]
                rounded-xl outline-none focus:border-[var(--border-dark)] font-mono" />
            <p className="text-[10px] text-[var(--text-3)] mt-1">Price per unit (1 sheet / 1 copy)</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
              Colour Multiplier
            </label>
            <input type="number" min="1" step="0.10" value={colorMultiplier}
              onChange={e => setColorMultiplier(e.target.value)}
              placeholder="e.g. 2.50"
              className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)]
                rounded-xl outline-none focus:border-[var(--border-dark)] font-mono" />
            <p className="text-[10px] text-[var(--text-3)] mt-1">
              Colour price = base × multiplier.
              {basePrice && colorMultiplier
                ? ` Colour = ${fmt(parseFloat(basePrice) * parseFloat(colorMultiplier))}`
                : ''}
            </p>
          </div>
          {error && (
            <div className="px-3 py-2 bg-[var(--red-bg)] border border-[var(--red-border)]
              rounded-xl text-xs text-[var(--red-text)]">{error}</div>
          )}
        </div>

        <div className="px-6 pb-5 flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)]
              hover:text-[var(--text)] transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={isPending}
            className="px-5 py-2.5 bg-[var(--text)] text-white text-sm font-bold
              rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
            {isPending ? 'Saving…' : 'Save Pricing'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Create Service Modal ──────────────────────────────────────────────────────
function CreateServiceModal({ onClose }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [name,        setName]        = useState('')
  const [category,    setCategory]    = useState('INSTANT')
  const [unit,        setUnit]        = useState('PER_PAGE')
  const [paperSize,   setPaperSize]   = useState('A4')
  const [description, setDescription] = useState('')
  const [basePrice,   setBasePrice]   = useState('')
  const [colorMult,   setColorMult]   = useState('1.00')
  const [error,       setError]       = useState('')
  const [image,       setImage]       = useState(null)
  const [success,     setSuccess]     = useState(false)
  const [createdName, setCreatedName] = useState('')

  // Consumable mappings
  const { data: stockItems = [] } = useQuery({
    queryKey: ['stock'],
    queryFn:  () => client.get('/api/v1/inventory/stock/').then(r => r.data),
    staleTime: 60_000,
  })
  const [mappings, setMappings] = useState([])  // [{ consumable_id, quantity_per_unit, applies_to_color, applies_to_bw }]

  const addMapping = () => setMappings(m => [...m, { consumable_id: '', quantity_per_unit: '1', applies_to_color: true, applies_to_bw: true }])
  const removeMapping = (i) => setMappings(m => m.filter((_, idx) => idx !== i))
  const updateMapping = (i, key, val) => setMappings(m => m.map((row, idx) => idx === i ? { ...row, [key]: val } : row))

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const form = new FormData()
      form.append('name',        name.trim())
      form.append('category',    category)
      form.append('description', description)
      form.append('code',        name.trim().toUpperCase().replace(/\s+/g, '-').slice(0, 20))
      form.append('base_price',  parseFloat(basePrice))
      form.append('color_multiplier', parseFloat(colorMult))
      form.append('unit',        unit)
      form.append('paper_size',  paperSize)
      if (image) form.append('image', image)
      const validMappings = mappings
        .filter(m => m.consumable_id && parseFloat(m.quantity_per_unit) > 0)
        .map(m => ({
          consumable_id:      parseInt(m.consumable_id),
          quantity_per_unit:  parseFloat(m.quantity_per_unit),
          applies_to_color:   m.applies_to_color,
          applies_to_bw:      m.applies_to_bw,
        }))
      if (validMappings.length) {
        form.append('consumable_mappings', JSON.stringify(validMappings))
      }
      return client.post('/api/v1/jobs/services/create/', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      setCreatedName(res.data.name || name)
      setSuccess(true)
    },
    onError: (err) => {
      const d = err.response?.data
      setError(d?.detail || d?.name?.[0] || d?.non_field_errors?.[0] || Object.values(d || {}).flat()[0] || 'Failed to create service.')
    },
  })

  const handleSubmit = () => {
    if (!name.trim())  { setError('Service name is required.'); return }
    if (!basePrice || isNaN(parseFloat(basePrice)) || parseFloat(basePrice) < 0) {
      setError('Enter a valid base price.'); return
    }
    setError('')
    mutate()
  }

  if (success) return <JobSuccessOverlay
    message="Service created"
    jobNumber={createdName}
    onDone={onClose}
  />

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="font-black text-base text-[var(--text)]">New Service</div>
          <div className="text-xs text-[var(--text-3)] mt-0.5">Add a service to the catalogue</div>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">

          {/* Name */}
          <div>
            <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
              Service Name <span className="text-red-500">*</span>
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. A4 B&W Photocopy 1-sided"
              className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)]
                rounded-xl outline-none focus:border-[var(--border-dark)]" />
          </div>

          {/* Category */}
          <div>
            <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {['INSTANT', 'PRODUCTION', 'DESIGN'].map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-colors
                    ${category === c
                      ? `${CATEGORY_CONFIG[c].color} ${CATEGORY_CONFIG[c].text} border-transparent`
                      : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-2)]'
                    }`}>
                  {CATEGORY_CONFIG[c].label}
                </button>
              ))}
            </div>
          </div>

          {/* Unit + Paper Size */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
                Pricing Unit
              </label>
              <select value={unit} onChange={e => setUnit(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)]
                  rounded-xl outline-none focus:border-[var(--border-dark)]">
                <option value="PER_PAGE">Per Page</option>
                <option value="PER_PIECE">Per Piece</option>
                <option value="PER_JOB">Per Job</option>
                <option value="PER_SHEET">Per Sheet</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
                Paper Size
              </label>
              <select value={paperSize} onChange={e => setPaperSize(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)]
                  rounded-xl outline-none focus:border-[var(--border-dark)]">
                <option value="A4">A4</option>
                <option value="A3">A3</option>
                <option value="A5">A5</option>
                <option value="A2">A2</option>
                <option value="CUSTOM">Custom</option>
                <option value="N/A">N/A</option>
              </select>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
                Base Price (GHS) <span className="text-red-500">*</span>
              </label>
              <input type="number" min="0" step="0.50" value={basePrice}
                onChange={e => setBasePrice(e.target.value)}
                placeholder="e.g. 3.00"
                className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)]
                  rounded-xl outline-none focus:border-[var(--border-dark)] font-mono" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
                Colour Multiplier
              </label>
              <input type="number" min="1" step="0.10" value={colorMult}
                onChange={e => setColorMult(e.target.value)}
                placeholder="1.00"
                className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)]
                  rounded-xl outline-none focus:border-[var(--border-dark)] font-mono" />
              {basePrice && colorMult && parseFloat(colorMult) > 1 && (
                <p className="text-[10px] text-amber-600 mt-1">
                  Colour = {`GHS ${(parseFloat(basePrice) * parseFloat(colorMult)).toFixed(2)}`}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
              Description (optional)
            </label>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of the service…"
              className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)]
                rounded-xl outline-none focus:border-[var(--border-dark)] resize-none" />
          </div>

          {/* Consumable Mappings */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
                Consumable Mappings
              </label>
              <button onClick={addMapping}
                className="text-[10px] font-bold text-[var(--text-2)] hover:text-[var(--text)]
                  px-2 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--border-dark)] transition-colors">
                + Add
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-3)] mb-2">
              Link consumables that get used when this service is performed.
            </p>
            {mappings.length === 0 ? (
              <div className="text-[10px] text-[var(--text-3)] italic px-3 py-2 bg-[var(--bg)]
                border border-dashed border-[var(--border)] rounded-xl text-center">
                No consumables linked — toner auto-mapped from paper selection
              </div>
            ) : (
              <div className="space-y-2">
                {mappings.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[var(--bg)]
                    border border-[var(--border)] rounded-xl px-3 py-2">
                    <select value={m.consumable_id}
                      onChange={e => updateMapping(i, 'consumable_id', e.target.value)}
                      className="flex-1 text-xs bg-transparent outline-none">
                      <option value="">Select consumable…</option>
                      {stockItems.map(s => (
                        <option key={s.consumable} value={s.consumable}>
                          {s.name} ({s.unit_label})
                        </option>
                      ))}
                    </select>
                    <input type="number" min="0.001" step="0.001"
                      value={m.quantity_per_unit}
                      onChange={e => updateMapping(i, 'quantity_per_unit', e.target.value)}
                      className="w-20 text-xs font-mono px-2 py-1 bg-[var(--panel)]
                        border border-[var(--border)] rounded-lg outline-none"
                      placeholder="qty" />
                    <button onClick={() => removeMapping(i)}
                      className="text-red-400 hover:text-red-600 text-xs font-bold shrink-0">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Image */}
          <div>
            <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
              Service Image (optional)
            </label>
            <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])}
              className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)]
                rounded-xl outline-none file:mr-3 file:py-1 file:px-3 file:rounded-lg
                file:border-0 file:text-xs file:font-bold file:bg-[var(--text)] file:text-white
                file:cursor-pointer cursor-pointer" />
            {image && (
              <div className="mt-2 flex items-center gap-2">
                <img src={URL.createObjectURL(image)} alt="preview"
                  className="w-16 h-12 object-cover rounded-lg border border-[var(--border)]" />
                <button onClick={() => setImage(null)}
                  className="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
            )}
          </div>

          {error && (
            <div className="px-3 py-2 bg-[var(--red-bg)] border border-[var(--red-border)]
              rounded-xl text-xs text-[var(--red-text)]">{error}</div>
          )}
        </div>

        <div className="px-6 pb-5 pt-3 border-t border-[var(--border)] flex justify-end gap-3 shrink-0">
          <button onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)]
              hover:text-[var(--text)] transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={isPending}
            className="px-5 py-2.5 bg-[var(--text)] text-white text-sm font-bold
              rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
            {isPending ? 'Creating…' : 'Create Service'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
// ── Service Card ──────────────────────────────────────────────────────────────
function ServiceCard({ service, pricing, onEditPricing }) {
  const cat = CATEGORY_CONFIG[service.category] || CATEGORY_CONFIG.INSTANT

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl
      flex items-center gap-4 px-4 py-3 hover:border-[var(--border-dark)] transition-colors">

      {/* Image */}
      <ServiceImage src={service.image} name={service.name} small />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-sm font-bold text-[var(--text)] leading-tight">{service.name}</span>
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${cat.color} ${cat.text} shrink-0`}>
            {cat.label}
          </span>
        </div>
        {service.description && (
          <div className="text-[10px] text-[var(--text-3)] mt-0.5 truncate">{service.description}</div>
        )}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {pricing ? (
            <>
              <span className="text-xs font-mono font-bold text-emerald-600">
                {fmt(pricing.base_price)} <span className="text-[10px] font-normal text-[var(--text-3)]">B&W</span>
              </span>
              {parseFloat(pricing.color_multiplier) > 1 && (
                <span className="text-xs font-mono font-bold text-amber-600">
                  {fmt(parseFloat(pricing.base_price) * parseFloat(pricing.color_multiplier))}
                  <span className="text-[10px] font-normal text-[var(--text-3)]"> Colour</span>
                </span>
              )}
            </>
          ) : (
            <span className="text-[10px] text-[var(--text-3)] italic">No pricing set</span>
          )}
          <span className="text-[10px] text-[var(--text-3)]">{service.code}</span>
        </div>
      </div>

      {/* Action */}
      <button
        onClick={() => onEditPricing(service, pricing)}
        className={`shrink-0 px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-colors
          ${pricing
            ? 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-dark)]'
            : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}>
        {pricing ? 'Edit Price' : 'Set Price'}
      </button>
    </div>
  )
}

// ── Main Catalogue ────────────────────────────────────────────────────────────
export default function Catalogue() {
  const { user } = useAuth()
  const branchId = typeof user?.branch === 'object' ? user?.branch?.id : (user?.branch || 2)
  const [category,     setCategory]     = useState('ALL')
  const [editTarget,   setEditTarget]   = useState(null)  // { service, pricing }
  const [showCreate,   setShowCreate]   = useState(false)

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['services'],
    queryFn:  () => getServices().then(r => r.data),
    staleTime: 60_000,
  })

  const { data: pricingRules = [] } = useQuery({
    queryKey: ['pricing', branchId],
    queryFn:  () => client.get(`/api/v1/jobs/pricing/?branch=${branchId}`).then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d?.results || [])
    }),
    staleTime: 60_000,
  })

  // Build pricing map: service_id → pricing rule
  const pricingMap = pricingRules.reduce((acc, p) => {
    const key = typeof p.service === 'object' ? p.service?.id : p.service
    acc[key] = p
    return acc
  }, {})

  const filtered = category === 'ALL'
    ? services
    : services.filter(s => s.category === category)

  // Group by category for ALL view
  const grouped = filtered.reduce((acc, s) => {
    const cat = s.category || 'OTHER'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  const noPricing = services.filter(s => !pricingMap[s.id]).length

  return (
    <div className="p-5 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Catalogue</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {services.length} services
            {noPricing > 0 && (
              <span className="text-amber-600 font-bold ml-2">· {noPricing} need pricing</span>
            )}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-[var(--text)] text-white text-sm font-bold
            rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Service
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 bg-black/5 p-1 rounded-xl">
        {[
          { key: 'ALL',        label: `All (${services.length})`                                        },
          { key: 'INSTANT',    label: `Instant (${services.filter(s=>s.category==='INSTANT').length})`    },
          { key: 'PRODUCTION', label: `Production (${services.filter(s=>s.category==='PRODUCTION').length})` },
          { key: 'DESIGN',     label: `Design (${services.filter(s=>s.category==='DESIGN').length})`     },
        ].map(t => (
          <button key={t.key} onClick={() => setCategory(t.key)}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors
              ${category === t.key
                ? 'bg-[var(--panel)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
              }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Service list */}
      {servicesLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse" />)}
        </div>
      ) : category === 'ALL' ? (
        // Grouped view
        <div className="space-y-6">
          {['INSTANT', 'PRODUCTION', 'DESIGN'].map(cat => {
            const items = grouped[cat] || []
            if (!items.length) return null
            const cfg = CATEGORY_CONFIG[cat]
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${cfg.color} ${cfg.text}`}>
                    {cfg.label}
                  </span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-[10px] text-[var(--text-3)]">{items.length} services</span>
                </div>
                <div className="space-y-2">
                  {items.map(s => (
                    <ServiceCard key={s.id} service={s} pricing={pricingMap[s.id]}
                      onEditPricing={(svc, p) => setEditTarget({ service: svc, pricing: p })} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // Single category view
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
              flex flex-col items-center justify-center py-16">
              <p className="text-sm font-semibold text-[var(--text-2)]">No services in this category</p>
            </div>
          ) : filtered.map(s => (
            <ServiceCard key={s.id} service={s} pricing={pricingMap[s.id]}
              onEditPricing={(svc, p) => setEditTarget({ service: svc, pricing: p })} />
          ))}
        </div>
      )}

      {/* Modals */}
      {editTarget && (
        <EditPricingModal
          service={editTarget.service}
          pricing={editTarget.pricing}
          branchId={branchId}
          onClose={() => setEditTarget(null)}
        />
      )}
      {showCreate && (
        <CreateServiceModal onClose={() => setShowCreate(false)} />
      )}

    </div>
  )
}