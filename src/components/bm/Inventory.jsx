// src/components/bm/Inventory.jsx
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getStock, getStockMovements, receiveStock } from '../../api/bm'
import client from '../../api/client'
import JobSuccessOverlay from '../shared/JobSuccessOverlay'

function fmt(n) {
  return parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 30)  return `${diff}d ago`
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`
  return `${Math.floor(diff / 365)}y ago`
}

const MOVEMENT_COLORS = {
  IN:         { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Received',   sign: '+' },
  OUT:        { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    label: 'Used',       sign: '−' },
  WASTE:      { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-600',     label: 'Waste',      sign: '−' },
  CORRECTION: { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  label: 'Correction', sign: '±' },
  OPENING:    { bg: 'bg-zinc-50',    border: 'border-zinc-200',    text: 'text-zinc-600',    label: 'Opening',    sign: '+' },
}

const WASTE_REASONS = [
  { value: 'JAM',      label: 'Paper Jam'      },
  { value: 'MISPRINT', label: 'Misprint'        },
  { value: 'DAMAGE',   label: 'Physical Damage' },
  { value: 'OTHER',    label: 'Other'           },
]

// ── Receive Stock Modal ───────────────────────────────────────────────────────
function ReceiveStockModal({ item, onClose }) {
  const queryClient = useQueryClient()
  const [qty,     setQty]     = useState('')
  const [notes,   setNotes]   = useState('')
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState(false)

  const { mutate, isPending } = useMutation({
    mutationFn: () => receiveStock({
      consumable_id: item.consumable,
      quantity:      parseFloat(qty),
      notes,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['movements'] })
      setSuccess(true)
    },
    onError: (err) => {
      const d = err.response?.data
      setError(d?.detail || d?.non_field_errors?.[0] || 'Failed to receive stock.')
    },
  })

  const handleSubmit = () => {
    const v = parseFloat(qty)
    if (!qty || isNaN(v) || v <= 0) { setError('Enter a valid quantity.'); return }
    setError('')
    mutate()
  }

  if (success) return <JobSuccessOverlay
    message="Stock received"
    jobNumber={`+${qty} ${item.unit_label} · ${item.name}`}
    onDone={onClose}
  />

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] bg-emerald-50">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-base">📦</span>
            <div>
              <div className="font-black text-base text-[var(--text)]">Receive Stock</div>
              <div className="text-xs text-emerald-700 font-semibold">{item.name}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between px-3 py-2
            bg-white border border-emerald-200 rounded-xl">
            <span className="text-xs text-[var(--text-3)]">Current stock</span>
            <span className="font-mono font-black text-sm text-[var(--text)]">
              {fmt(item.quantity)} {item.unit_label}
            </span>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
              Quantity Received ({item.unit_label})
            </label>
            <input type="number" min="1" value={qty}
              onChange={e => setQty(e.target.value)}
              placeholder="e.g. 500"
              className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)]
                rounded-xl outline-none focus:border-[var(--border-dark)] font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
              Notes (optional)
            </label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Supplier, delivery reference, etc."
              className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)]
                rounded-xl outline-none focus:border-[var(--border-dark)] resize-none" />
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
            className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold
              rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
            {isPending ? 'Recording…' : '+ Receive Stock'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Report Waste Modal ────────────────────────────────────────────────────────
function ReportWasteModal({ items, onClose }) {
  const queryClient = useQueryClient()
  const [consumableId, setConsumableId] = useState('')
  const [qty,          setQty]          = useState('')
  const [reason,       setReason]       = useState('JAM')
  const [notes,        setNotes]        = useState('')
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState(false)

  const { mutate, isPending } = useMutation({
    mutationFn: () => client.post('/api/v1/inventory/waste/report/', {
      consumable_id: parseInt(consumableId),
      quantity:      parseFloat(qty),
      reason,
      notes,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['movements'] })
      queryClient.invalidateQueries({ queryKey: ['waste'] })
      setSuccess(true)
    },
    onError: (err) => {
      const d = err.response?.data
      setError(d?.detail || d?.non_field_errors?.[0] || 'Failed to record waste.')
    },
  })

  const handleSubmit = () => {
    if (!consumableId) { setError('Select a consumable.'); return }
    const v = parseFloat(qty)
    if (!qty || isNaN(v) || v <= 0) { setError('Enter a valid quantity.'); return }
    setError('')
    mutate()
  }

  const wasteItem = items.find(i => String(i.consumable) === String(consumableId))

  if (success) return <JobSuccessOverlay
    message="Waste recorded"
    jobNumber={`−${qty} ${wasteItem?.unit_label || ''} · ${wasteItem?.name || ''}`}
    onDone={onClose}
  />

  if (success) return <JobSuccessOverlay
    message="Stock received"
    jobNumber={`+${qty} ${item.unit_label} · ${item.name}`}
    onDone={onClose}
  />

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] bg-red-50">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-base">🗑</span>
            <div>
              <div className="font-black text-base text-[var(--text)]">Report Waste</div>
              <div className="text-xs text-red-600 font-semibold">Record spoilage or damage</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
              Consumable
            </label>
            <select value={consumableId} onChange={e => setConsumableId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)]
                rounded-xl outline-none focus:border-[var(--border-dark)]">
              <option value="">Select consumable…</option>
              {items.map(i => (
                <option key={i.consumable} value={i.consumable}>
                  {i.name} ({fmt(i.quantity)} {i.unit_label})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
              Reason
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {WASTE_REASONS.map(r => (
                <button key={r.value} onClick={() => setReason(r.value)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-colors
                    ${reason === r.value
                      ? 'bg-red-600 text-white border-transparent'
                      : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-dark)]'
                    }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
              Quantity
            </label>
            <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
              placeholder="How many units wasted?"
              className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)]
                rounded-xl outline-none focus:border-[var(--border-dark)] font-mono" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
              Notes (optional)
            </label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any additional details…"
              className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)]
                rounded-xl outline-none focus:border-[var(--border-dark)] resize-none" />
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
            className="px-5 py-2.5 bg-red-600 text-white text-sm font-bold
              rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
            {isPending ? 'Recording…' : 'Record Waste'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main Inventory Component ──────────────────────────────────────────────────
export default function Inventory() {
  const [tab,         setTab]         = useState('stock')
  const [receiveItem, setReceiveItem] = useState(null)
  const [showWaste,   setShowWaste]   = useState(false)
  const [movFilter,   setMovFilter]   = useState('')

  const { data: stock = [], isLoading: stockLoading } = useQuery({
    queryKey: ['stock'],
    queryFn:  () => getStock().then(r => r.data),
    staleTime: 30_000,
  })

  const { data: movData, isLoading: movLoading } = useQuery({
    queryKey: ['movements', movFilter],
    queryFn:  () => getStockMovements(movFilter ? { type: movFilter } : {}).then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d?.results || [])
    }),
    staleTime: 30_000,
    placeholderData: prev => prev,
  })

  const { data: wasteData = [], isLoading: wasteLoading } = useQuery({
    queryKey: ['waste'],
    queryFn:  () => client.get('/api/v1/inventory/waste/').then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d?.results || [])
    }),
    staleTime: 30_000,
    enabled: tab === 'waste',
  })

  const grouped = stock.reduce((acc, item) => {
    const cat = item.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const lowCount      = stock.filter(s => s.is_low).length
  const criticalCount = stock.filter(s => s.is_critical).length

  return (
    <div className="p-5 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Inventory</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {stock.length} consumables tracked
            {criticalCount > 0 && <span className="text-red-500 font-bold ml-2">· {criticalCount} critical</span>}
            {lowCount > 0 && criticalCount === 0 && <span className="text-amber-600 font-bold ml-2">· {lowCount} low</span>}
          </p>
        </div>
        <button onClick={() => setShowWaste(true)}
          className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50
            border border-red-200 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-1.5">
          🗑 Report Waste
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-black/5 p-1 rounded-xl">
        {[
          { key: 'stock',     label: 'Stock Levels'    },
          { key: 'movements', label: 'Movement Ledger' },
          { key: 'waste',     label: 'Waste Incidents' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors
              ${tab === t.key
                ? 'bg-[var(--panel)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
              }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Stock Levels ── */}
      {tab === 'stock' && (
        stockLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-[var(--panel)] border border-[var(--border)] rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest">{category}</span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-[10px] text-[var(--text-3)]">{items.length} items</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {items.map(item => {
                    const pct = item.reorder_point > 0
                      ? Math.min(100, (parseFloat(item.quantity) / (item.reorder_point * 3)) * 100)
                      : 100
                    const barColor = item.is_critical ? 'bg-red-500' : item.is_low ? 'bg-amber-400' : 'bg-emerald-500'
                    return (
                      <div key={item.id}
                        className={`bg-[var(--panel)] border rounded-xl p-4
                          ${item.is_critical ? 'border-red-200' : item.is_low ? 'border-amber-200' : 'border-[var(--border)]'}`}>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-[var(--text)] leading-tight">{item.name}</div>
                            <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                              {item.paper_size !== 'N/A' ? `${item.paper_size} · ` : ''}{item.unit_label}
                            </div>
                          </div>
                          {item.is_critical
                            ? <span className="text-[10px] font-black px-2 py-0.5 bg-red-100 text-red-600 border border-red-200 rounded-full shrink-0">CRITICAL</span>
                            : item.is_low
                              ? <span className="text-[10px] font-black px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full shrink-0">LOW</span>
                              : null}
                        </div>
                        <div className="flex items-end justify-between mb-2">
                          <div>
                            <span className="font-mono font-black text-xl text-[var(--text)]">{fmt(item.quantity)}</span>
                            <span className="text-xs text-[var(--text-3)] ml-1">{item.unit_label}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-[var(--text-3)]">Reorder at</div>
                            <div className="text-xs font-mono font-bold text-[var(--text-2)]">{item.reorder_point} {item.unit_label}</div>
                          </div>
                        </div>
                        <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden mb-3">
                          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.max(2, pct)}%` }} />
                        </div>
                        <button onClick={() => setReceiveItem(item)}
                          className="w-full py-1.5 text-xs font-bold text-emerald-700
                            bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                          + Receive Stock
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Movement Ledger ── */}
      {tab === 'movements' && (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap">
            {[
              { value: '',           label: 'All'        },
              { value: 'IN',         label: 'Received'   },
              { value: 'OUT',        label: 'Used'       },
              { value: 'WASTE',      label: 'Waste'      },
              { value: 'CORRECTION', label: 'Correction' },
            ].map(f => (
              <button key={f.value} onClick={() => setMovFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors
                  ${movFilter === f.value
                    ? 'bg-[var(--text)] text-white border-transparent'
                    : 'bg-[var(--panel)] border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-dark)]'
                  }`}>
                {f.label}
              </button>
            ))}
          </div>
          {movLoading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse" />)}</div>
          ) : !movData?.length ? (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl flex flex-col items-center justify-center py-16">
              <p className="text-sm font-semibold text-[var(--text-2)]">No movements found</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="hidden sm:grid grid-cols-12 px-4 py-2 text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
                <span className="col-span-3">Consumable</span>
                <span className="col-span-2">Type</span>
                <span className="col-span-1 text-right">Qty</span>
                <span className="col-span-2 text-right">Balance</span>
                <span className="col-span-3 pl-4">Recorded By</span>
                <span className="col-span-1 text-right">When</span>
              </div>
              {movData.map(m => {
                const c = MOVEMENT_COLORS[m.movement_type] || MOVEMENT_COLORS.OPENING
                return (
                  <>
                    <div key={m.id} className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3 hidden sm:grid grid-cols-12 items-center">
                      <div className="col-span-3 min-w-0">
                        <div className="text-xs font-semibold text-[var(--text)] truncate">{m.consumable_name}</div>
                        {m.job_number && <div className="text-[10px] text-[var(--text-3)]">Job: {m.job_number}</div>}
                      </div>
                      <div className="col-span-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.bg} ${c.border} ${c.text}`}>{c.label}</span>
                      </div>
                      <div className="col-span-1 text-right">
                        <span className={`font-mono text-sm font-bold ${c.text}`}>{c.sign}{fmt(m.quantity)}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="font-mono text-xs text-[var(--text-2)]">{fmt(m.balance_after)}</span>
                      </div>
                      <div className="col-span-3 text-xs text-[var(--text-3)] truncate pl-4">{m.recorded_by_name}</div>
                      <div className="col-span-1 text-right text-xs text-[var(--text-3)]">{timeAgo(m.created_at)}</div>
                    </div>
                    <div key={`mob-${m.id}`} className="sm:hidden bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[var(--text)] truncate">{m.consumable_name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${c.bg} ${c.border} ${c.text}`}>{c.label}</span>
                          <span className="text-[10px] text-[var(--text-3)]">{timeAgo(m.created_at)}</span>
                        </div>
                      </div>
                      <span className={`font-mono text-sm font-black ml-3 ${c.text}`}>{c.sign}{fmt(m.quantity)}</span>
                    </div>
                  </>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Waste Incidents ── */}
      {tab === 'waste' && (
        wasteLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse" />)}</div>
        ) : !wasteData.length ? (
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl flex flex-col items-center justify-center py-16">
            <p className="text-sm font-semibold text-[var(--text-2)]">No waste incidents recorded</p>
            <p className="text-xs text-[var(--text-3)] mt-1">Use "Report Waste" to log spoilage or damage</p>
          </div>
        ) : (
          <div className="space-y-2">
            {wasteData.map(w => (
              <div key={w.id} className="bg-[var(--panel)] border border-red-100 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--text)]">{w.consumable_name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 border border-red-200 text-red-600 rounded-full">{w.reason}</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-3)] mt-0.5 flex items-center gap-2">
                    <span>{w.reported_by_name}</span>
                    {w.job_number && <><span>·</span><span>Job {w.job_number}</span></>}
                    {w.notes && <><span>·</span><span className="truncate max-w-32">{w.notes}</span></>}
                  </div>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <div className="font-mono font-black text-sm text-red-500">−{fmt(w.quantity)}</div>
                  <div className="text-[10px] text-[var(--text-3)]">{timeAgo(w.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modals */}
      {receiveItem && <ReceiveStockModal item={receiveItem} onClose={() => setReceiveItem(null)} />}
      {showWaste   && <ReportWasteModal  items={stock}      onClose={() => setShowWaste(false)} />}

    </div>
  )
}