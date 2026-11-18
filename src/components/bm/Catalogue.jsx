// src/components/bm/Catalogue.jsx
//
// The catalogue (redesigned 17 Nov 2026). Services as a grid of cards, three
// across on a wide screen, with the photo on top so the catalogue can be
// scanned by picture; a list view for changing many prices at once; search
// and the type tabs on one row. Clicking a service opens a pane beside it
// with the full details, its price, and its photo, which can be changed or
// taken off there (PUT/DELETE /api/v1/jobs/services/<id>/photo/).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { getServices } from '../../api/bm'
import client from '../../api/client'
import JobSuccessOverlay from '../shared/JobSuccessOverlay'
import CostsPanel from './CostsPanel'
import { saveServiceCost, saveBulkPrices } from '../../api/discounts'
import usePhone from '../../hooks/usePhone'
import CataloguePhone from './CataloguePhone'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

const CATEGORY_CONFIG = {
  INSTANT:    { label: 'Instant',    color: 'bg-zinc-800',   text: 'text-white'        },
  PRODUCTION: { label: 'Production', color: 'bg-blue-600',   text: 'text-white'        },
  DESIGN:     { label: 'Design',     color: 'bg-violet-600', text: 'text-white'        },
}

// What a price is for: "per copy", "per sq ft".
const UNIT_LABEL = { PER_COPY: 'copy', PER_PIECE: 'piece', PER_SQFT: 'sq ft', PER_SQCM: 'sq cm', PER_JOB: 'job' }
const perUnit = unit => `per ${UNIT_LABEL[unit] || (unit || 'piece').replace(/^PER_/, '').toLowerCase()}`

const VIEW_KEY = 'octos.catalogue.view'

// ── Edit Pricing Modal ────────────────────────────────────────────────────────
function EditPricingModal({ service, pricing, onClose }) {
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
          // No branch: a company price, the same at every branch.
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
          <div className="text-[10px] text-amber-700 mt-1">Applies at every branch, on the website and in the app.</div>
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
export function CreateServiceModal({ onClose }) {
  const queryClient = useQueryClient()
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

// ── Photos ────────────────────────────────────────────────────────────────────

function NoPhoto({ big }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[var(--bg)] text-[var(--border-dark)]">
      <div className="flex flex-col items-center gap-1.5">
        <svg width={big ? 34 : 24} height={big ? 34 : 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
        </svg>
        {big && <span className="text-xs text-[var(--text-3)]">No photo yet</span>}
      </div>
    </div>
  )
}

// A photo that fills its box; a plain placeholder when there is none or it fails.
function Photo({ src, name, big }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return <NoPhoto big={big} />
  return <img src={src} alt={name} loading="lazy" onError={() => setBroken(true)}
    className="absolute inset-0 w-full h-full object-cover" />
}

function CategoryTag({ category, className = '' }) {
  const cat = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.INSTANT
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${cat.color} ${cat.text} ${className}`}>{cat.label}</span>
  )
}

function Price({ pricing, unit, size = 'md' }) {
  if (!pricing) return <span className="text-xs font-semibold text-amber-600">No price yet</span>
  const colour = parseFloat(pricing.color_multiplier) > 1
    ? parseFloat(pricing.base_price) * parseFloat(pricing.color_multiplier) : null
  return (
    <div className="min-w-0">
      <div className={`font-black text-emerald-600 tabular-nums ${size === 'lg' ? 'text-2xl' : 'text-[15px]'}`}>
        {fmt(pricing.base_price)} <span className="text-[11px] font-medium text-[var(--text-3)]">{perUnit(unit)}</span>
      </div>
      {colour != null && (
        <div className="text-[11px] text-[var(--text-3)]">
          Colour <b className="font-bold text-amber-600 tabular-nums">{fmt(colour)}</b>
        </div>
      )}
    </div>
  )
}

function EditPriceButton({ pricing, onClick, wide }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }}
      className={`shrink-0 px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-colors
        ${wide ? 'w-full py-2.5 text-sm' : ''}
        ${pricing
          ? 'border-[var(--border)] text-[var(--text-2)] bg-[var(--panel)] hover:border-[var(--border-dark)] hover:text-[var(--text)]'
          : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>
      {pricing ? 'Edit price' : 'Set price'}
    </button>
  )
}

// ── Grid card ─────────────────────────────────────────────────────────────────

function ServiceTile({ service, pricing, onOpen, onEditPricing }) {
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter') onOpen() }}
      className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden cursor-pointer
        transition-all hover:border-[var(--border-dark)] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-dark)]">
      <div className="relative aspect-[16/10] overflow-hidden">
        <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.03]">
          <Photo key={service.image || 'none'} src={service.image} name={service.name} />
        </div>
        <CategoryTag category={service.category} className="absolute top-2.5 left-2.5 shadow-sm" />
        <span className="absolute top-2.5 right-2.5 max-w-[55%] truncate rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
          {service.code}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <div className="text-[14px] font-bold leading-snug text-[var(--text)] line-clamp-2">{service.name}</div>
        {service.description && (
          <div className="text-[12px] leading-relaxed text-[var(--text-3)] line-clamp-2">{service.description}</div>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <Price pricing={pricing} unit={service.unit} />
          <EditPriceButton pricing={pricing} onClick={onEditPricing} />
        </div>
      </div>
    </div>
  )
}

// ── List row: for changing many prices at once ────────────────────────────────

function ServiceRow({ service, pricing, onOpen, onEditPricing }) {
  const colour = pricing && parseFloat(pricing.color_multiplier) > 1
    ? parseFloat(pricing.base_price) * parseFloat(pricing.color_multiplier) : null
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter') onOpen() }}
      className="grid grid-cols-[48px_minmax(0,1fr)_auto] sm:grid-cols-[48px_minmax(0,1fr)_110px_110px_auto] items-center gap-3
        px-3 py-2 cursor-pointer hover:bg-[var(--bg)] transition-colors">
      <div className="relative w-12 h-9 rounded-md overflow-hidden"><Photo key={service.image || 'none'} src={service.image} name={service.name} /></div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-[var(--text)] truncate">{service.name}</div>
        <div className="text-[11px] text-[var(--text-3)] font-mono truncate">{service.code} · {perUnit(service.unit)}</div>
      </div>
      <div className="hidden sm:block text-[13px] font-bold text-emerald-600 tabular-nums">
        {pricing ? fmt(pricing.base_price) : <span className="text-xs font-semibold text-amber-600">No price</span>}
      </div>
      <div className="hidden sm:block text-[13px] font-bold text-amber-600 tabular-nums">{colour != null ? fmt(colour) : <span className="text-[var(--text-3)] font-normal">—</span>}</div>
      <EditPriceButton pricing={pricing} onClick={onEditPricing} />
    </div>
  )
}

function ServiceList({ items, pricingMap, onOpen, onEditPricing }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden divide-y divide-[var(--border)]">
      <div className="hidden sm:grid grid-cols-[48px_minmax(0,1fr)_110px_110px_auto] gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
        <span /><span>Service</span><span>Price</span><span>Colour</span><span className="w-[68px]" />
      </div>
      {items.map(s => (
        <ServiceRow key={s.id} service={s} pricing={pricingMap[s.id]}
          onOpen={() => onOpen(s)} onEditPricing={() => onEditPricing(s, pricingMap[s.id])} />
      ))}
    </div>
  )
}

// ── The pane beside a service ─────────────────────────────────────────────────

const PHOTO_KINDS = ['image/jpeg', 'image/png', 'image/webp']

function ServicePane({ service, pricing, onClose, onEditPricing }) {
  const queryClient = useQueryClient()
  const input = useRef(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  // The local preview's address is let go when it's replaced or the pane closes.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const saved = updated => {
    queryClient.setQueryData(['services'], list =>
      Array.isArray(list) ? list.map(s => (s.id === updated.id ? updated : s)) : list)
    queryClient.invalidateQueries({ queryKey: ['services'] })
    setPreview(null)
  }
  const failed = err => {
    setPreview(null)
    setError(err.response?.data?.detail || 'The photo could not be saved. Try again.')
  }

  const upload = useMutation({
    mutationFn: file => {
      const form = new FormData()
      form.append('image', file)
      return client.put(`/api/v1/jobs/services/${service.id}/photo/`, form).then(r => r.data)
    },
    onSuccess: saved,
    onError: failed,
  })
  const remove = useMutation({
    mutationFn: () => client.delete(`/api/v1/jobs/services/${service.id}/photo/`).then(r => r.data),
    onSuccess: saved,
    onError: failed,
  })
  const busy = upload.isPending || remove.isPending

  const choose = file => {
    if (!file) return
    setError('')
    if (!PHOTO_KINDS.includes(file.type)) { setError('Use a JPG, PNG or WebP photo.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('That photo is over 5 MB. Use a smaller one.'); return }
    setPreview(URL.createObjectURL(file))
    upload.mutate(file)
  }

  const addons = service.addons || []

  return createPortal(
    <div className="fixed inset-0 z-[9998]" role="dialog" aria-modal="true" aria-label={service.name}>
      <div className="absolute inset-0 bg-black/30 animate-fadeIn" onClick={onClose} />
      <aside className="catalogue-pane absolute right-0 top-0 h-full w-full max-w-[440px] bg-[var(--panel)] shadow-2xl flex flex-col">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--border)]">
          <CategoryTag category={service.category} />
          <span className="font-mono text-[11px] text-[var(--text-3)] truncate">{service.code}</span>
          <button onClick={onClose} aria-label="Close"
            className="ml-auto w-8 h-8 rounded-full grid place-items-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg)]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* The photo: change it, drop one on it, or take it off */}
          <div>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files?.[0]) }}
              className={`relative aspect-[4/3] rounded-2xl overflow-hidden border transition-colors
                ${dragging ? 'border-2 border-dashed border-emerald-500' : 'border-[var(--border)]'}`}>
              {preview
                ? <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                : <Photo key={service.image || 'none'} src={service.image} name={service.name} big />}
              {busy && (
                <div className="absolute inset-0 grid place-items-center bg-black/40 text-white text-sm font-semibold">
                  {upload.isPending ? 'Uploading…' : 'Removing…'}
                </div>
              )}
              {dragging && !busy && (
                <div className="absolute inset-0 grid place-items-center bg-emerald-500/15 text-emerald-700 text-sm font-bold">Drop to use this photo</div>
              )}
            </div>
            <input ref={input} type="file" accept={PHOTO_KINDS.join(',')} className="hidden"
              onChange={e => { choose(e.target.files?.[0]); e.target.value = '' }} />
            <div className="flex gap-2 mt-2.5">
              <button onClick={() => input.current?.click()} disabled={busy}
                className="flex-1 h-10 rounded-xl bg-[var(--text)] text-[var(--panel)] text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                </svg>
                {service.image ? 'Change photo' : 'Add a photo'}
              </button>
              {service.image && (
                <button onClick={() => { setError(''); remove.mutate() }} disabled={busy}
                  className="h-10 px-4 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-2)] hover:text-[var(--red-text)] hover:border-[var(--red-border)] disabled:opacity-50">
                  Remove
                </button>
              )}
            </div>
            {error
              ? <p className="mt-2 text-xs text-[var(--red-text)]">{error}</p>
              : <p className="mt-2 text-[11px] text-[var(--text-3)]">JPG, PNG or WebP, up to 5 MB. Or drop a photo on it. It shows on the website and the app too.</p>}
          </div>

          <div>
            <h2 className="text-xl font-black leading-tight text-[var(--text)]">{service.name}</h2>
            {service.variant_label && <p className="text-xs text-[var(--text-3)] mt-1">{service.variant_label}</p>}
            {service.description && <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--text-2)]">{service.description}</p>}
          </div>

          <div className="rounded-2xl border border-[var(--border)] p-4 space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">Price</div>
            <Price pricing={pricing} unit={service.unit} size="lg" />
            <p className="text-[11px] text-[var(--text-3)]">The same at every branch, on the website and in the app.</p>
            <EditPriceButton pricing={pricing} onClick={onEditPricing} wide />
          </div>

          {pricing && <BulkPrices service={service} pricing={pricing} />}
          <CostToMake service={service} pricing={pricing} />

          {addons.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)] mb-2">Finishing offered</div>
              <div className="flex flex-wrap gap-1.5">
                {addons.map(a => (
                  <span key={a.id} className="rounded-lg border border-[var(--border)] px-2 py-1 text-[11.5px] text-[var(--text-2)]">{a.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  )
}

// ── Bulk prices and cost to make (17 Nov 2026) ────────────────────────────────

// Bulk prices, counted on the whole line (pages × copies): from so many on,
// the price drops. Octos quotes them by itself.
function BulkPrices({ service, pricing }) {
  const queryClient = useQueryClient()
  const [bands, setBands] = useState(() => (pricing.bulk_prices || []).map(b => ({ from: String(b.from), price: String(b.price) })))
  const [said, setSaid] = useState({ text: '', bad: false })
  const save = useMutation({
    mutationFn: () => saveBulkPrices(pricing.id, bands.filter(b => b.from && b.price).map(b => ({ from: Number(b.from), price: Number(b.price) }))),
    onSuccess: () => { setSaid({ text: 'Bulk prices saved.', bad: false }); queryClient.invalidateQueries({ queryKey: ['pricing', 'company'] }) },
    onError: err => {
      const d = err?.response?.data
      setSaid({ text: d?.detail || (d && Object.values(d).flat().find(v => typeof v === 'string')) || 'Could not save.', bad: true })
    },
  })
  const set = (i, key, v) => setBands(bands.map((b, j) => (j === i ? { ...b, [key]: v.replace(/[^\d.]/g, '') } : b)))
  const unit = perUnit(service.unit).replace('per ', '')
  return (
    <div className="rounded-2xl border border-[var(--border)] p-4 space-y-2.5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">Bulk prices</div>
      <p className="text-[11.5px] text-[var(--text-3)]">Counted on the whole job: {unit}s × copies. Octos quotes these by itself.</p>
      {bands.length === 0 && <p className="text-[12px] text-[var(--text-2)]">None yet: the list price for any amount.</p>}
      {bands.map((b, i) => (
        <div key={i} className="flex items-center gap-2 text-[12.5px]">
          <span className="text-[var(--text-3)]">From</span>
          <input value={b.from} onChange={e => set(i, 'from', e.target.value)} inputMode="numeric" aria-label="From how many"
            className="w-20 h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] font-bold tabular-nums" />
          <span className="text-[var(--text-3)]">{unit}s, GHS</span>
          <input value={b.price} onChange={e => set(i, 'price', e.target.value)} inputMode="decimal" aria-label="Price"
            className="w-20 h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] font-bold tabular-nums" />
          <button onClick={() => setBands(bands.filter((_, j) => j !== i))} aria-label="Remove"
            className="ml-auto w-7 h-7 rounded-full text-[var(--text-3)] hover:text-[var(--red-text)]">✕</button>
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={() => setBands([...bands, { from: '', price: '' }])}
          className="h-9 px-3 rounded-xl border border-[var(--border)] text-[12px] font-semibold text-[var(--text-2)]">Add a bulk price</button>
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="h-9 px-4 rounded-xl bg-[var(--text)] text-[var(--panel)] text-[12px] font-bold disabled:opacity-50">Save</button>
      </div>
      {said.text && <p className={`text-[11.5px] ${said.bad ? 'text-[var(--red-text)]' : 'text-emerald-700'}`}>{said.text}</p>}
    </div>
  )
}

const BASES = [
  { key: 'COLOUR_PAGE', label: 'A colour page' },
  { key: 'BW_PAGE', label: 'A black and white page' },
  { key: 'FIXED', label: 'A fixed amount' },
  { key: 'NONE', label: 'Not set' },
]

// What one unit costs to make, from "What things cost". The discount floor
// comes from it.
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
    onError: err => setSaid({ text: err?.response?.data?.detail || 'Could not save.', bad: true }),
  })
  const cost = service.unit_cost != null ? Number(service.unit_cost) : null
  const price = pricing ? Number(pricing.base_price) : null
  const page = basis === 'COLOUR_PAGE' || basis === 'BW_PAGE'
  return (
    <div className="rounded-2xl border border-[var(--border)] p-4 space-y-2.5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">Cost to make</div>
      {cost != null ? (
        <p className="text-[12.5px] text-[var(--text-2)]">
          About <b className="text-[var(--text)]">GHS {cost.toFixed(2)}</b> {perUnit(service.unit)}
          {price ? <> · at {fmt(price)} it earns <b className="text-[var(--text)]">{(price / cost).toFixed(1)}×</b> its cost</> : null}
        </p>
      ) : (
        <p className="text-[12px] text-amber-700">Not set yet: discounts on it are held to a small percentage.</p>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={basis} onChange={e => setBasis(e.target.value)} aria-label="What it costs"
          className="h-9 px-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[12.5px]">
          {BASES.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
        </select>
        {page && (
          <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-3)]">
            Size ×A4
            <input value={size} onChange={e => setSize(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal"
              className="w-14 h-9 px-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] font-bold tabular-nums" />
          </label>
        )}
        {basis === 'FIXED' && (
          <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-3)]">
            GHS
            <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal"
              className="w-20 h-9 px-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] font-bold tabular-nums" />
          </label>
        )}
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="h-9 px-4 rounded-xl bg-[var(--text)] text-[var(--panel)] text-[12px] font-bold disabled:opacity-50">Save</button>
      </div>
      {said.text && <p className={`text-[11.5px] ${said.bad ? 'text-[var(--red-text)]' : 'text-emerald-700'}`}>{said.text}</p>}
    </div>
  )
}

// ── Main Catalogue ────────────────────────────────────────────────────────────

function useView() {
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid' } catch { return 'grid' }
  })
  const choose = v => { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* private window */ } }
  return [view, choose]
}

export default function Catalogue() {
  if (usePhone()) return <CataloguePhone />
  return <CatalogueComputer />
}

function CatalogueComputer() {
  const [category,   setCategory]   = useState('ALL')
  const [search,     setSearch]     = useState('')
  const [view,       setView]       = useView()
  const [openId,     setOpenId]     = useState(null)
  const [editTarget, setEditTarget] = useState(null)  // { service, pricing }
  const [showCreate, setShowCreate] = useState(false)
  const [showCosts,  setShowCosts]  = useState(false)

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['services'],
    queryFn:  () => getServices().then(r => r.data),
    staleTime: 60_000,
  })

  const { data: pricingRules = [] } = useQuery({
    // Prices are company-wide: the catalogue shows (and sets) the company's.
    queryKey: ['pricing', 'company'],
    // Every price, however the server sends them: a plain list, or pages
    // to follow. Reading only the first page made everything past the
    // twentieth service look unpriced.
    queryFn:  async () => {
      let url = '/api/v1/jobs/pricing/?company=1'
      const all = []
      while (url) {
        const { data } = await client.get(url)
        if (Array.isArray(data)) return data
        all.push(...(data?.results || []))
        url = data?.next || null
      }
      return all
    },
    staleTime: 60_000,
  })

  // service id → its price
  const pricingMap = useMemo(() => pricingRules.reduce((acc, p) => {
    const key = typeof p.service === 'object' ? p.service?.id : p.service
    acc[key] = p
    return acc
  }, {}), [pricingRules])

  const q = search.trim().toLowerCase()
  const matches = useMemo(() => services.filter(s =>
    (category === 'ALL' || s.category === category) &&
    (!q || [s.name, s.code, s.description].some(t => (t || '').toLowerCase().includes(q)))
  ), [services, category, q])

  const groups = category === 'ALL'
    ? ['INSTANT', 'PRODUCTION', 'DESIGN'].map(cat => ({ cat, items: matches.filter(s => s.category === cat) })).filter(g => g.items.length)
    : [{ cat: category, items: matches }]

  const noPricing = services.filter(s => !pricingMap[s.id]).length
  const open = services.find(s => s.id === openId)
  const editPrice = (svc, p) => setEditTarget({ service: svc, pricing: p })
  const count = cat => services.filter(s => s.category === cat).length

  return (
    <div className="p-5 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Catalogue</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {services.length} services
            {noPricing > 0 && <span className="text-amber-600 font-bold ml-2">· {noPricing} need pricing</span>}
          </p>
        </div>
        <div className="flex gap-2">
        <button onClick={() => setShowCosts(true)}
          className="px-3.5 py-2 border border-[var(--border)] bg-[var(--panel)] text-[var(--text-2)] text-sm font-semibold rounded-xl hover:border-[var(--border-dark)]">
          What things cost
        </button>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-[var(--text)] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New service
        </button>
        </div>
      </div>

      {/* Search, type tabs, grid or list */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services"
            className="w-full h-10 pl-9 pr-9 rounded-xl border border-[var(--border)] bg-[var(--panel)] text-sm text-[var(--text)] outline-none focus:border-[var(--border-dark)]" />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-full text-[var(--text-3)] hover:text-[var(--text)]">✕</button>
          )}
        </div>
        <div className="flex gap-1 bg-black/5 p-1 rounded-xl overflow-x-auto">
          {[
            { key: 'ALL',        label: 'All',        n: services.length },
            { key: 'INSTANT',    label: 'Instant',    n: count('INSTANT') },
            { key: 'PRODUCTION', label: 'Production', n: count('PRODUCTION') },
            { key: 'DESIGN',     label: 'Design',     n: count('DESIGN') },
          ].map(t => (
            <button key={t.key} onClick={() => setCategory(t.key)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors
                ${category === t.key ? 'bg-[var(--panel)] text-[var(--text)] shadow-sm' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
              {t.label} <span className="font-semibold opacity-60">{t.n}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-black/5 p-1 rounded-xl">
          {[
            { key: 'grid', label: 'Grid', icon: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></> },
            { key: 'list', label: 'List', icon: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></> },
          ].map(v => (
            <button key={v.key} onClick={() => setView(v.key)} aria-label={`${v.label} view`} aria-pressed={view === v.key} title={`${v.label} view`}
              className={`w-8 h-7 grid place-items-center rounded-lg transition-colors
                ${view === v.key ? 'bg-[var(--panel)] text-[var(--text)] shadow-sm' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">{v.icon}</svg>
            </button>
          ))}
        </div>
      </div>

      {/* Services */}
      {servicesLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-64 bg-[var(--panel)] border border-[var(--border)] rounded-2xl animate-pulse" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl flex flex-col items-center justify-center py-16 gap-1">
          <p className="text-sm font-semibold text-[var(--text-2)]">{q ? `No services match “${search.trim()}”` : 'No services in this category'}</p>
          {q && <button onClick={() => setSearch('')} className="text-xs font-semibold text-[var(--text-3)] hover:text-[var(--text)]">Clear the search</button>}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ cat, items }) => (
            <section key={cat}>
              {category === 'ALL' && (
                <div className="flex items-center gap-2 mb-3">
                  <CategoryTag category={cat} className="px-2.5 py-1 rounded-lg" />
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-[10px] text-[var(--text-3)]">{items.length} service{items.length === 1 ? '' : 's'}</span>
                </div>
              )}
              {view === 'list' ? (
                <ServiceList items={items} pricingMap={pricingMap} onOpen={s => setOpenId(s.id)} onEditPricing={editPrice} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map(s => (
                    <ServiceTile key={s.id} service={s} pricing={pricingMap[s.id]}
                      onOpen={() => setOpenId(s.id)} onEditPricing={() => editPrice(s, pricingMap[s.id])} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* The pane, and the modals over it */}
      {open && (
        <ServicePane service={open} pricing={pricingMap[open.id]}
          onClose={() => setOpenId(null)} onEditPricing={() => editPrice(open, pricingMap[open.id])} />
      )}
      {editTarget && (
        <EditPricingModal
          service={editTarget.service}
          pricing={editTarget.pricing}
          onClose={() => setEditTarget(null)}
        />
      )}
      {showCreate && (
        <CreateServiceModal onClose={() => setShowCreate(false)} />
      )}
      {showCosts && <CostsPanel onClose={() => setShowCosts(false)} />}

    </div>
  )
}
