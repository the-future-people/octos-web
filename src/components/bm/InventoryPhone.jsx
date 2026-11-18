// src/components/bm/InventoryPhone.jsx
//
// Inventory on a phone (18 Nov 2026), in the Overview's look.
//   Inventory, how many items, and how many are low or out
//   Stock | Movements | Waste
//   Stock: each item in its group, with what is left, a quiet bar against
//   the reorder point, amber when low and red when out. A tap opens Receive.
//   Movements: everything in and out, newest first, filtered by kind.
//   Waste: what was spoiled, why and by whom; "Report waste" records more.
// The same calls as Inventory.jsx.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { getStock, getStockMovements, receiveStock } from '../../api/bm'
import PhoneHeader from './PhoneHeader'

const RED = '#D70015'
const AMBER = '#B45309'
const card = 'mx-4 rounded-[16px] bg-white border border-black/[0.04] shadow-[0_3px_12px_rgba(17,24,39,0.05)]'
const RED_FILL = { background: 'linear-gradient(135deg,#EF1C2C 0%,#C8000F 100%)' }
const qty = n => parseFloat(n || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })
function ago(iso) {
  if (!iso) return ''
  const d = new Date(iso), days = Math.round((new Date(new Date().toDateString()) - new Date(d.toDateString())) / 86_400_000)
  if (days === 0) return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
// Each kind of movement: its words, its colour and its sign.
const KIND = {
  IN: ['Received', '#15803D', '+'], OUT: ['Used', '#3A3A3C', '−'], WASTE: ['Waste', RED, '−'],
  CORRECTION: ['Correction', '#6D28D9', '±'], OPENING: ['Opening', '#8A8A8E', '+'],
}
const REASONS = [['JAM', 'Paper jam'], ['MISPRINT', 'Misprint'], ['DAMAGE', 'Damaged'], ['OTHER', 'Other']]
const REASON = Object.fromEntries(REASONS)

const Svg = ({ d, size = 18, width = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
const out = s => parseFloat(s.quantity || 0) <= 0
const toneOf = s => (out(s) || s.is_critical ? RED : s.is_low ? AMBER : null)

// A sheet from the bottom, with a title and a red button at its foot.
function Sheet({ title, sub, onClose, children, action, busy, error }) {
  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-label={title}>
      <div className="absolute inset-0 bg-black/30 animate-fadeIn" onClick={onClose} />
      <div className="ios absolute inset-x-0 bottom-0 rounded-t-[24px] animate-slideUp px-4 max-h-[90dvh] overflow-y-auto"
        style={{ background: '#F6F6F8', paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}>
        <div className="flex justify-center pt-2"><span className="w-9 h-[5px] rounded-full bg-black/15" aria-hidden="true" /></div>
        <div className="flex items-center justify-between pt-2.5">
          <button type="button" onClick={onClose} className="text-[16px] text-[#D70015] w-16 text-left">Cancel</button>
          <span className="text-center"><span className="block text-[17px] font-bold">{title}</span>{sub && <span className="block text-[13px] text-[#8A8A8E]">{sub}</span>}</span>
          <span className="w-16" />
        </div>
        <div className="mt-4 space-y-3">{children}</div>
        {error && <p className="m-0 mt-3 text-[14px] text-[#B91C1C]">{error}</p>}
        <button type="button" onClick={action.onClick} disabled={busy}
          className="mt-5 w-full h-[50px] rounded-[16px] text-white text-[16.5px] font-semibold disabled:opacity-50" style={RED_FILL}>
          {busy ? 'Saving…' : action.label}
        </button>
      </div>
    </div>,
    document.body,
  )
}

function Receive({ item, onClose }) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const save = useMutation({
    mutationFn: () => receiveStock({ consumable_id: item.consumable, quantity: parseFloat(amount), notes }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['stock'] }); queryClient.invalidateQueries({ queryKey: ['movements'] }); onClose() },
    onError: err => setError(err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'That did not save. Try again.'),
  })
  const go = () => { const v = parseFloat(amount); if (!v || v <= 0) return setError('Enter how many came in.'); setError(''); save.mutate() }
  return (
    <Sheet title="Receive stock" sub={item.name} onClose={onClose} busy={save.isPending} error={error}
      action={{ label: amount ? `Add ${qty(amount)} ${item.unit_label}` : 'Add to stock', onClick: go }}>
      <div className="rounded-[16px] bg-white px-4 py-3 flex justify-between text-[15px]">
        <span className="text-[#6E6E73]">In stock now</span><b className="tabular-nums">{qty(item.quantity)} {item.unit_label}</b>
      </div>
      <label className="block rounded-[16px] bg-white px-4 py-3">
        <span className="block text-[13px] text-[#6E6E73]">How many came in ({item.unit_label})</span>
        <input autoFocus type="number" inputMode="decimal" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 500"
          className="w-full mt-1 text-[28px] font-bold tabular-nums bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      </label>
      <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Supplier or delivery note (optional)"
        className="w-full px-4 py-3 text-[16px] rounded-[16px] bg-white outline-none resize-none" />
    </Sheet>
  )
}

function ReportWaste({ items, onClose }) {
  const queryClient = useQueryClient()
  const [id, setId] = useState('')
  const [reason, setReason] = useState('JAM')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const item = items.find(i => String(i.consumable) === String(id))
  const save = useMutation({
    mutationFn: () => client.post('/api/v1/inventory/waste/report/', { consumable_id: parseInt(id), quantity: parseFloat(amount), reason, notes }),
    onSuccess: () => { ['stock', 'movements', 'waste'].forEach(k => queryClient.invalidateQueries({ queryKey: [k] })); onClose() },
    onError: err => setError(err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'That did not save. Try again.'),
  })
  const go = () => {
    if (!id) return setError('Choose what was wasted.')
    const v = parseFloat(amount); if (!v || v <= 0) return setError('Enter how much was wasted.')
    setError(''); save.mutate()
  }
  return (
    <Sheet title="Report waste" onClose={onClose} busy={save.isPending} error={error}
      action={{ label: item && amount ? `Record ${qty(amount)} ${item.unit_label} wasted` : 'Record waste', onClick: go }}>
      <select value={id} onChange={e => setId(e.target.value)} aria-label="What was wasted"
        className={`w-full h-[50px] px-4 rounded-[16px] bg-white text-[16px] outline-none ${id ? 'text-[#111]' : 'text-[#8A8A8E]'}`}>
        <option value="">What was wasted?</option>
        {items.map(i => <option key={i.consumable} value={i.consumable}>{i.name} ({qty(i.quantity)} {i.unit_label})</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Why">
        {REASONS.map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={reason === v} onClick={() => setReason(v)}
            className="h-[46px] rounded-[14px] bg-white text-[15px] font-semibold transition-shadow"
            style={{ boxShadow: reason === v ? `0 0 0 2px ${RED}` : '0 0 0 1px rgba(0,0,0,0.06)', color: reason === v ? RED : '#1C1C1E' }}>
            {label}
          </button>
        ))}
      </div>
      <label className="block rounded-[16px] bg-white px-4 py-3">
        <span className="block text-[13px] text-[#6E6E73]">How much{item ? ` (${item.unit_label})` : ''}</span>
        <input type="number" inputMode="decimal" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
          className="w-full mt-1 text-[28px] font-bold tabular-nums bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      </label>
      <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What happened (optional)"
        className="w-full px-4 py-3 text-[16px] rounded-[16px] bg-white outline-none resize-none" />
    </Sheet>
  )
}

export default function InventoryPhone() {
  const [tab, setTab] = useState('stock')
  const [filter, setFilter] = useState('')
  const [receiving, setReceiving] = useState(null)
  const [wasting, setWasting] = useState(false)
  const { data: stock = [], isLoading } = useQuery({ queryKey: ['stock'], queryFn: () => getStock().then(r => r.data), staleTime: 30_000 })
  const { data: moves = [], isLoading: movesLoading } = useQuery({
    queryKey: ['movements', filter], enabled: tab === 'moves', staleTime: 30_000, placeholderData: prev => prev,
    queryFn: () => getStockMovements(filter ? { type: filter } : {}).then(r => (Array.isArray(r.data) ? r.data : r.data?.results || [])),
  })
  const { data: waste = [], isLoading: wasteLoading } = useQuery({
    queryKey: ['waste'], enabled: tab === 'waste', staleTime: 30_000,
    queryFn: () => client.get('/api/v1/inventory/waste/').then(r => (Array.isArray(r.data) ? r.data : r.data?.results || [])),
  })

  // Out and low first in each group, so what needs ordering is seen first.
  const rank = s => (out(s) ? 0 : s.is_critical ? 1 : s.is_low ? 2 : 3)
  const groups = Object.entries(stock.reduce((acc, s) => ((acc[s.category || 'Other'] = acc[s.category || 'Other'] || []).push(s), acc), {}))
    .map(([g, items]) => [g, [...items].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))])
  const outCount = stock.filter(out).length
  const lowCount = stock.filter(s => !out(s) && (s.is_low || s.is_critical)).length

  // One item: what is left, against its reorder point. A tap opens Receive.
  const stockRow = (s, i) => {
    const tone = toneOf(s)
    const fill = s.reorder_point > 0 ? Math.min(100, (parseFloat(s.quantity) / (s.reorder_point * 3)) * 100) : 100
    return (
      <button key={s.id} type="button" onClick={() => setReceiving(s)}
        className={`w-full text-left px-4 py-2.5 active:bg-black/[0.04] ${i ? 'border-t border-black/[0.06]' : ''}`}>
        <span className="flex items-center gap-3">
          <span className="flex-1 min-w-0">
            <span className="block text-[15.5px] font-semibold truncate">{s.name}</span>
            <span className="block text-[12.5px]" style={{ color: tone || '#8A8A8E', fontWeight: tone ? 600 : 400 }}>
              {out(s) ? 'Out of stock' : s.is_critical ? 'Almost out' : s.is_low ? 'Running low' : `Reorder at ${s.reorder_point}`}
              {tone && ` · reorder at ${s.reorder_point}`}
            </span>
          </span>
          <span className="text-right shrink-0">
            <span className="text-[18px] font-bold tabular-nums" style={{ color: tone || '#111' }}>{qty(s.quantity)}</span>
            <span className="ml-1 text-[12.5px] text-[#8A8A8E]">{s.unit_label}</span>
          </span>
        </span>
        <span className="mt-1.5 block h-[5px] rounded-full bg-[#EDEDF0] overflow-hidden">
          <span className="block h-full rounded-full" style={{ width: `${Math.max(2, fill)}%`, background: tone || '#9DBDF7' }} />
        </span>
      </button>
    )
  }
  const needs = stock.filter(s => rank(s) < 3).sort((a, b) => rank(a) - rank(b))

  return (
    <div className="ios min-h-full pb-6" style={{ background: '#F6F6F8' }}>
      <PhoneHeader />
      <div className="px-4 pt-1 flex items-center justify-between">
        <h1 className="m-0 text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] text-[#111]">Inventory</h1>
        <button type="button" onClick={() => setWasting(true)}
          className="h-10 px-3.5 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.08)] text-[14.5px] font-semibold inline-flex items-center gap-1.5" style={{ color: RED }}>
          <Svg d={<path d="M3 6h18 M8 6V4h8v2 M6 6l1 14h10l1-14" />} size={16} />Report waste
        </button>
      </div>
      <div className="px-4 text-[14px] text-[#8A8A8E]">
        {stock.length} items
        {outCount > 0 && <span className="font-semibold" style={{ color: RED }}> · {outCount} out</span>}
        {lowCount > 0 && <span className="font-semibold" style={{ color: AMBER }}> · {lowCount} running low</span>}
      </div>

      <div className="mx-4 mt-3 p-[3px] rounded-[10px] bg-black/[0.06] flex" role="tablist">
        {[['stock', 'Stock'], ['moves', 'Movements'], ['waste', 'Waste']].map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={`flex-1 h-[30px] rounded-[8px] text-[13.5px] font-semibold ${tab === v ? 'bg-white text-[#111] shadow-[0_2px_6px_rgba(0,0,0,0.10)]' : 'text-[#3A3A3C]'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* What needs ordering, first: out, then almost out, then low */}
      {tab === 'stock' && !isLoading && needs.length > 0 && (
        <>
          <div className="px-5 pt-5 pb-1.5 flex justify-between text-[13px]">
            <span className="font-semibold uppercase tracking-[0.04em]" style={{ color: RED }}>Needs ordering</span><span className="text-[#A1A1AA]">{needs.length}</span>
          </div>
          <div className={`${card} overflow-hidden`} style={{ boxShadow: `inset 3px 0 0 ${RED}, 0 3px 12px rgba(17,24,39,0.05)` }}>{needs.map(stockRow)}</div>
        </>
      )}
      {tab === 'stock' && (isLoading ? <div className={`${card} mt-4 h-[300px] animate-pulse`} aria-hidden="true" /> : groups.map(([g, items]) => (
        <div key={g}>
          <div className="px-5 pt-5 pb-1.5 flex justify-between text-[13px]">
            <span className="font-semibold uppercase tracking-[0.04em] text-[#8A8A8E]">{g}</span><span className="text-[#A1A1AA]">{items.length}</span>
          </div>
          <div className={`${card} overflow-hidden`}>
            {items.map((s, i) => stockRow(s, i))}
          </div>
        </div>
      )))}
      {tab === 'stock' && !isLoading && <p className="m-0 mx-5 mt-2 text-[12.5px] text-[#8A8A8E]">Tap an item to add stock that came in.</p>}

      {tab === 'moves' && (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            {[['', 'All'], ['IN', 'Received'], ['OUT', 'Used'], ['WASTE', 'Waste'], ['CORRECTION', 'Corrections']].map(([v, label]) => (
              <button key={label} type="button" onClick={() => setFilter(v)}
                className={`shrink-0 h-[34px] px-3.5 rounded-full text-[14px] font-semibold ${filter === v ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E] border border-black/[0.06]'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3">
            {movesLoading && !moves.length ? <div className={`${card} h-[260px] animate-pulse`} aria-hidden="true" />
              : moves.length === 0 ? <div className={`${card} py-10 text-center text-[15px] text-[#8A8A8E]`}>Nothing here yet.</div>
              : (
                <div className={`${card} overflow-hidden`}>
                  {moves.map((m, i) => {
                    const [word, tone, sign] = KIND[m.movement_type] || KIND.OPENING
                    return (
                      <div key={m.id} className={`flex items-center gap-3 px-4 py-2.5 ${i ? 'border-t border-black/[0.06]' : ''}`}>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-semibold truncate">{m.consumable_name}</span>
                          <span className="block text-[12.5px] text-[#8A8A8E] truncate">
                            <span style={{ color: tone, fontWeight: 600 }}>{word}</span> · {m.recorded_by_name}{m.job_number ? ` · job #${m.job_number.split('-').pop()}` : ''} · {ago(m.created_at)}
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-[16px] font-bold tabular-nums" style={{ color: tone }}>{sign}{qty(m.quantity)}</span>
                          <span className="block text-[11.5px] text-[#8A8A8E] tabular-nums">{qty(m.balance_after)} left</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
          </div>
        </>
      )}

      {tab === 'waste' && (
        <div className="mt-3">
          {wasteLoading ? <div className={`${card} h-[200px] animate-pulse`} aria-hidden="true" />
            : waste.length === 0 ? (
              <div className={`${card} py-10 px-6 text-center`}>
                <div className="text-[16px] font-semibold">No waste recorded</div>
                <div className="text-[13.5px] text-[#8A8A8E] mt-1">Use Report waste for jams, misprints and damage.</div>
              </div>
            ) : (
              <div className={`${card} overflow-hidden`}>
                {waste.map((w, i) => (
                  <div key={w.id} className={`flex items-center gap-3 px-4 py-2.5 ${i ? 'border-t border-black/[0.06]' : ''}`}>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold truncate">{w.consumable_name}</span>
                      <span className="block text-[12.5px] text-[#8A8A8E] truncate">
                        <span style={{ color: RED, fontWeight: 600 }}>{REASON[w.reason] || w.reason}</span> · {w.reported_by_name}{w.notes ? ` · ${w.notes}` : ''}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-[16px] font-bold tabular-nums" style={{ color: RED }}>−{qty(w.quantity)}</span>
                      <span className="block text-[11.5px] text-[#8A8A8E]">{ago(w.created_at)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {receiving && <Receive item={receiving} onClose={() => setReceiving(null)} />}
      {wasting && <ReportWaste items={stock} onClose={() => setWasting(false)} />}
    </div>
  )
}
