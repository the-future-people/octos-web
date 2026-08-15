// src/components/bm/ReviseProformaModal.jsx
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getProformaDetail, getServices, getBulkPricing, calculatePrice, reviseProforma,
} from '../../api/bm'
import { useAuth } from '../../context/AuthContext'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function today() {
  return new Date().toLocaleDateString('en-GH', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function plusDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Revising happens against a document the customer is holding, so this is
 * the document rather than a form. Quantities are editable and lines can be
 * dropped; prices are not typeable — they come from PricingEngine, and a
 * typeable price on a commitment is a route around the pricing rules.
 */
export default function ReviseProformaModal({ proformaId, onClose, onSuccess }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const branchId = user?.branch || 2

  const [lines, setLines] = useState(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const { data: proforma, isLoading } = useQuery({
    queryKey: ['proforma', proformaId],
    queryFn:  () => getProformaDetail(proformaId).then(r => r.data),
  })

  const { data: servicesRaw = [] } = useQuery({
    queryKey: ['services'],
    queryFn:  () => getServices().then(r => r.data),
    staleTime: 60_000,
  })

  const { data: bulkPricing = {} } = useQuery({
    queryKey: ['bulkPricing', branchId],
    queryFn:  () => getBulkPricing(branchId).then(r => r.data),
    staleTime: 300_000,
  })

  // Seed the editable lines once the document arrives.
  useEffect(() => {
    if (proforma && lines === null) {
      setLines(proforma.line_items.map((li, i) => ({
        _id: i,
        service_id:   li.service_id,
        service_name: li.service_name,
        quantity:     li.quantity,
        pages:        li.pages,
        is_color:     li.is_color,
        ring_size:    li.ring_size,
        output_mode:  li.output_mode,
        unit_price:   parseFloat(li.unit_price),
        total:        parseFloat(li.total),
        removed:      false,
        repricing:    false,
      })))
      setNotes(proforma.notes || '')
    }
  }, [proforma, lines])

  const priceLine = (line) => {
    const conditional = !!(line.ring_size || line.output_mode)
    if (conditional) {
      return calculatePrice({
        service:  line.service_id,
        branch:   branchId,
        quantity: line.quantity,
        pages:    line.pages,
        ...(line.ring_size   ? { ring_size:   line.ring_size   } : {}),
        ...(line.output_mode ? { output_mode: line.output_mode } : {}),
      }).then(r => r.data)
    }
    // Everything else prices locally from the bulk map, the same split the
    // create modal uses — no request per keystroke.
    const rule = bulkPricing[line.service_id] || bulkPricing[String(line.service_id)]
    if (!rule) return Promise.resolve(null)
    const base = parseFloat(rule.base_price)
    const mult = parseFloat(rule.color_multiplier)
    const unit = (rule.unit || '').toUpperCase().replace('PER_', '')
    let total
    if (['COPY', 'PIECE', 'PAGE', 'SHEET'].includes(unit)) total = base * line.pages * line.quantity
    else if (['SQFT', 'SQCM', 'SQM'].includes(unit))        total = base * mult * line.quantity
    else if (unit === 'JOB')                                total = base * mult
    else                                                    total = base * line.pages * line.quantity
    return Promise.resolve({ total: total.toFixed(2), base_price: rule.base_price })
  }

  const changeQty = (id, delta) => {
    setLines(ls => ls.map(l =>
      l._id === id ? { ...l, quantity: Math.max(1, l.quantity + delta), repricing: true } : l
    ))
  }

  // Reprice whichever lines are flagged, after a pause.
  useEffect(() => {
    if (!lines) return
    const pending = lines.filter(l => l.repricing)
    if (pending.length === 0) return
    const t = setTimeout(async () => {
      for (const line of pending) {
        try {
          const res = await priceLine(line)
          setLines(ls => ls.map(l => l._id === line._id
            ? {
                ...l,
                repricing: false,
                total: res ? parseFloat(res.total) : l.total,
                unit_price: res?.base_price ? parseFloat(res.base_price) : l.unit_price,
              }
            : l))
        } catch {
          setLines(ls => ls.map(l => l._id === line._id ? { ...l, repricing: false } : l))
        }
      }
    }, 450)
    return () => clearTimeout(t)
  }, [lines])

  const toggleRemoved = (id) =>
    setLines(ls => ls.map(l => l._id === id ? { ...l, removed: !l.removed } : l))

  const kept     = (lines || []).filter(l => !l.removed)
  const newTotal = kept.reduce((s, l) => s + (l.total || 0), 0)
  const oldTotal = parseFloat(proforma?.total || 0)

  const { mutate, isPending } = useMutation({
    mutationFn: () => reviseProforma(proformaId, {
      notes,
      line_items: kept.map(l => ({
        service:  l.service_id,
        quantity: l.quantity,
        pages:    l.pages,
        is_color: l.is_color,
        ...(l.ring_size   ? { ring_size:   l.ring_size   } : {}),
        ...(l.output_mode ? { output_mode: l.output_mode } : {}),
      })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proformas'] })
      onSuccess?.()
      onClose()
    },
    onError: (e) => setError(e.response?.data?.detail || 'Could not issue this revision.'),
  })

  const body = () => {
    if (isLoading || !lines) {
      return <div className="p-10 text-center text-sm text-[var(--text-3)]">Loading…</div>
    }
    return (
      <>
        <div className="bg-[#C6202A] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Farhat Printing Press</div>
            <div className="text-[11px] opacity-85">Professional Printing Services</div>
          </div>
          <div className="text-sm tracking-widest">PROFORMA</div>
        </div>

        <div className="bg-[var(--bg)] px-6 py-2 text-[11px] text-[var(--text-3)] text-center">
          Westland Branch | 0556244194 | info@farhatwestland.com
        </div>

        <div className="px-6 py-4 flex justify-between gap-6">
          <div className="border-l-[3px] border-[#C6202A] pl-3">
            <div className="text-[9px] tracking-widest text-[var(--text-3)]">BILL TO</div>
            <div className="text-sm font-semibold text-[var(--text)] mt-0.5">
              {proforma.customer_name}
            </div>
            {proforma.contact_person && (
              <div className="text-xs text-[var(--text-2)]">{proforma.contact_person}</div>
            )}
            {proforma.contact_phone && (
              <div className="text-xs text-[var(--text-2)]">{proforma.contact_phone}</div>
            )}
          </div>
          <div className="text-right text-[11px]">
            <div className="text-[9px] tracking-widest text-[var(--text-3)]">PROFORMA NO</div>
            <div className="text-[#C6202A] font-mono text-sm my-0.5">
              {proforma.proforma_number.split('-v')[0]}-v{proforma.version + 1}
            </div>
            <div className="text-[9px] tracking-widest text-[var(--text-3)] mt-2">REVISED</div>
            <div className="font-semibold">{today()}</div>
            <div className="text-[9px] tracking-widest text-[var(--text-3)] mt-2">VALID UNTIL</div>
            <div className="font-semibold">{plusDays(21)}</div>
          </div>
        </div>

        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#C6202A] text-white text-left">
              <th className="px-6 py-2 font-medium">SERVICE</th>
              <th className="px-2 py-2 font-medium w-24 text-center">QTY</th>
              <th className="px-2 py-2 font-medium w-20 text-right">UNIT</th>
              <th className="px-2 py-2 font-medium w-24 text-right">TOTAL</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <tr key={l._id}
                className={`border-b border-[var(--border)] ${l.removed ? 'opacity-40' : ''}`}>
                <td className="px-6 py-2.5">
                  <div className={`font-semibold text-[var(--text)] ${l.removed ? 'line-through' : ''}`}>
                    {l.service_name}
                  </div>
                  <div className="text-[11px] text-[var(--text-3)]">
                    {l.ring_size ? `${l.ring_size}mm ring` : `${l.pages}pp`}
                    {l.is_color ? ' · Colour' : ''}
                    {l.output_mode ? ` · ${l.output_mode.replace('_', ' + ').toLowerCase()}` : ''}
                  </div>
                </td>
                <td className="px-2 py-2.5 text-center">
                  {l.removed ? (
                    <span className="text-[var(--text-3)]">{l.quantity}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 border border-[var(--border)]
                      rounded-lg px-1 py-0.5">
                      <button onClick={() => changeQty(l._id, -1)}
                        className="w-5 text-[var(--text-3)] hover:text-[var(--text)]">−</button>
                      <input type="number" min="1" value={l.quantity}
                        onChange={e => {
                          const v = Math.max(1, parseInt(e.target.value) || 1)
                          setLines(ls => ls.map(x =>
                            x._id === l._id ? { ...x, quantity: v, repricing: true } : x))
                        }}
                        className="w-14 text-center font-mono bg-transparent outline-none
                          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                          [&::-webkit-inner-spin-button]:appearance-none" />
                      <button onClick={() => changeQty(l._id, 1)}
                        className="w-5 text-[var(--text-3)] hover:text-[var(--text)]">+</button>
                    </span>
                  )}
                </td>
                <td className="px-2 py-2.5 text-right text-[var(--text-2)] font-mono">
                  {l.unit_price?.toFixed(2)}
                </td>
                <td className="px-2 py-2.5 text-right font-mono font-semibold">
                  {l.repricing ? '…' : l.total?.toFixed(2)}
                </td>
                <td className="px-2 py-2.5 text-center">
                  <button onClick={() => toggleRemoved(l._id)}
                    className={`text-[10px] ${l.removed
                      ? 'text-emerald-600 font-semibold'
                      : 'text-[var(--text-3)] hover:text-red-500'}`}>
                    {l.removed ? 'undo' : '✕'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-6 py-2 border-b border-[var(--border)]">
          <select
            value=""
            onChange={e => {
              const svc = servicesRaw.find(s => String(s.id) === e.target.value)
              if (!svc) return
              setLines(ls => [...ls, {
                _id: Math.max(0, ...ls.map(x => x._id)) + 1,
                service_id:   svc.id,
                service_name: svc.name,
                quantity:     1,
                pages:        svc.smart_defaults?.pages || 1,
                is_color:     svc.smart_defaults?.is_color ?? false,
                ring_size:    svc.name.toLowerCase().includes('binding') ? 10 : null,
                output_mode:  svc.name.toLowerCase().includes('passport') ? 'PRINT' : null,
                unit_price:   0,
                total:        0,
                removed:      false,
                repricing:    true,
              }])
            }}
            className="text-xs text-[#C6202A] bg-transparent outline-none cursor-pointer py-1">
            <option value="">+ Add a service</option>
            {servicesRaw.filter(s => s.is_active).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="px-6 py-4 flex justify-end">
          <div className="w-56 text-xs">
            <div className="flex justify-between py-1 text-[var(--text-2)]">
              <span>Subtotal</span>
              <span className="font-mono">{fmt(newTotal)}</span>
            </div>
            <div className="flex justify-between pt-2 mt-1 border-t border-[var(--border-dark)]
              text-sm font-semibold">
              <span>Total</span>
              <span className="font-mono">{fmt(newTotal)}</span>
            </div>
            {Math.round(newTotal * 100) !== Math.round(oldTotal * 100) && (
              <div className="text-[10px] text-[var(--text-3)] mt-1">
                was {fmt(oldTotal)}
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 animate-fadeIn">
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-2xl
        max-h-[92vh] flex flex-col overflow-hidden animate-slideUp">

        <div className="flex-1 overflow-y-auto">{body()}</div>

        {error && (
          <div className="mx-6 mb-2 px-3 py-2 bg-[var(--red-bg)] border border-[var(--red-border)]
            rounded-lg text-xs text-[var(--red-text)] shrink-0">{error}</div>
        )}

        <div className="bg-[var(--bg)] px-6 py-3 flex items-center justify-between gap-3
          shrink-0 border-t border-[var(--border)]">
          <span className="text-[11px] text-[var(--text-3)]">
            v{proforma?.version} is kept — the customer may be holding it
          </span>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-[var(--text-2)]
                hover:text-[var(--text)] transition-colors">Cancel</button>
            <button onClick={() => mutate()}
              disabled={isPending || kept.length === 0}
              className="px-4 py-2 bg-[#C6202A] text-white text-sm font-bold rounded-xl
                disabled:opacity-40 hover:opacity-90 transition-opacity whitespace-nowrap">
              {isPending ? 'Issuing…' : `Issue v${(proforma?.version || 1) + 1}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}