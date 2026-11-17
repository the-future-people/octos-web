// src/components/bm/DiscountPanel.jsx
//
// Lowering a price on a proforma or a job (17 Nov 2026). The Branch Manager
// types a new total, a percent off, or a price a page, and sees as he types
// what the work costs to make, what it still earns, and whether he is
// within his limit (the floor: 2.5 times cost). Below it, the button asks the
// owner instead; the price changes once the owner approves. The owner has no
// limit and approves or declines what is waiting, here or in the Eye.
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { getDiscount, lowerPrice, approveCut, declineCut, isOwner } from '../../api/discounts'

const money = n => `GHS ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const num = v => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v))

function Tile({ label, value, tone }) {
  return (
    <div className="rounded-xl bg-[var(--bg)] px-3 py-2 min-w-0">
      <div className="text-[10.5px] text-[var(--text-3)]">{label}</div>
      <div className={`text-[13.5px] font-bold tabular-nums whitespace-nowrap ${tone || 'text-[var(--text)]'}`}>{value}</div>
    </div>
  )
}

export default function DiscountPanel({ kind, id, title, onClose }) {
  const { user } = useAuth()
  const owner = isOwner(user)
  const queryClient = useQueryClient()
  const [mode, setMode] = useState('page')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [said, setSaid] = useState({ text: '', bad: false })

  const { data: s, isLoading, error } = useQuery({
    queryKey: ['discount', kind, id],
    queryFn: () => getDiscount(kind, id),
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['discount', kind, id] })
    queryClient.invalidateQueries({ queryKey: kind === 'job' ? ['job-file', id] : ['proformas'] })
    queryClient.invalidateQueries({ queryKey: ['jobs'] })
    queryClient.invalidateQueries({ queryKey: ['waiting-cuts'] })
  }
  const failed = err => setSaid({ text: err?.response?.data?.detail || 'That did not work. Try again.', bad: true })

  const lower = useMutation({
    mutationFn: ({ total, why }) => lowerPrice(kind, id, total, why),
    onSuccess: r => {
      setSaid({ text: r.status === 'PENDING' ? 'Sent to the owner. The price changes once he approves.' : 'Price updated.', bad: false })
      setValue('')
      refresh()
    },
    onError: failed,
  })
  const decide = useMutation({
    mutationFn: ({ cut, yes }) => (yes ? approveCut(cut) : declineCut(cut, '')),
    onSuccess: (_, v) => { setSaid({ text: v.yes ? 'Approved. The price is updated.' : 'Declined.', bad: false }); refresh() },
    onError: failed,
  })

  const pages = s?.page_units || 0
  const modes = [
    ...(pages > 0 ? [{ key: 'page', label: 'A page' }] : []),
    { key: 'total', label: 'New total' },
    { key: 'percent', label: 'Percent off' },
  ]
  const activeMode = modes.some(m => m.key === mode) ? mode : modes[0]?.key

  // The new total, however it was asked for.
  const next = useMemo(() => {
    if (!s) return null
    const v = num(value)
    const before = Number(s.before_total)
    if (v == null) return null
    if (activeMode === 'total') return v
    if (activeMode === 'percent') return before * (1 - v / 100)
    return before - Number(s.page_total) + v * pages
  }, [s, value, activeMode, pages])

  if (!s) {
    return createPortal(
      <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/40 p-4" onClick={onClose}>
        <div className="bg-[var(--panel)] rounded-2xl p-6 text-sm text-[var(--text-3)]">
          {isLoading ? 'Loading the price…' : error?.response?.data?.detail || 'This could not be loaded.'}
        </div>
      </div>, document.body)
  }

  const list = Number(s.list_total)
  const before = Number(s.before_total)
  const cost = Number(s.cost)
  const floor = s.floor_total != null ? Number(s.floor_total) : null
  const total = next != null ? Math.round(next * 100) / 100 : Number(s.total)
  const offPct = list ? ((list - total) / list) * 100 : 0
  const cutPct = before ? ((before - total) / before) * 100 : 0
  const valid = next != null && total > 0 && total <= before
  const within = owner || (floor != null ? total >= floor - 0.004 : cutPct <= Number(s.unknown_cost_limit) + 0.004)
  const perPageFloor = floor != null && pages > 0 ? (floor - (before - Number(s.page_total))) / pages : null

  const guard = owner
    ? { ok: true, text: 'You are the owner: no limit.' }
    : floor != null
      ? within
        ? { ok: true, text: `Within your limit: down to ${money(floor)}${perPageFloor > 0 ? ` (${money(perPageFloor)} a page)` : ''}, ${s.floor_multiple}× cost.` }
        : { ok: false, text: `Below the floor of ${money(floor)}: the owner must approve this one.` }
      : within
        ? { ok: true, text: `Some of this has no cost set, so you can take up to ${s.unknown_cost_limit}% off.` }
        : { ok: false, text: `More than ${s.unknown_cost_limit}% off with costs unknown: the owner must approve.` }

  const go = () => {
    if (!reason.trim()) { setSaid({ text: 'Say why the price is lower: it goes on the record.', bad: true }); return }
    if (!valid) { setSaid({ text: `Give a new price above zero and up to ${money(before)}.`, bad: true }); return }
    lower.mutate({ total: total.toFixed(2), why: reason.trim() })
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label="Lower the price" onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-[var(--panel)] rounded-2xl shadow-2xl overflow-hidden animate-slideUp">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
          <div className="min-w-0">
            <div className="text-[15px] font-black text-[var(--text)]">Lower the price</div>
            <div className="text-[12px] text-[var(--text-3)] truncate">{title}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-auto w-8 h-8 rounded-full grid place-items-center text-[var(--text-3)] hover:bg-[var(--bg)]">✕</button>
        </div>

        <div className="px-5 py-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
          <div className="text-[13px] space-y-1">
            <div className="flex justify-between"><span className="text-[var(--text-2)]">List price</span><span className="tabular-nums">{money(list)}</span></div>
            {Number(s.bulk_saving) > 0 && (
              <div className="flex justify-between text-emerald-700"><span>Bulk price (automatic)</span><span className="tabular-nums">−{money(s.bulk_saving)}</span></div>
            )}
            {Number(s.discount_amount) > 0 && (
              <div className="flex justify-between text-amber-700">
                <span className="truncate pr-3">Discount now · {s.discount_by}: {s.discount_reason}</span>
                <span className="tabular-nums">−{money(s.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-[var(--border)] pt-1.5"><span>Price now</span><span className="tabular-nums">{money(s.total)}</span></div>
          </div>

          {s.pending && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-900">
              <b>Waiting for the owner:</b> {s.pending.asked_by} asked for {money(s.pending.new_total)} ({s.pending.percent}% off). {s.pending.reason}
              {owner && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => decide.mutate({ cut: s.pending.id, yes: true })} disabled={decide.isPending}
                    className="h-8 px-3 rounded-lg bg-[var(--text)] text-white text-[12px] font-bold disabled:opacity-50">Approve</button>
                  <button onClick={() => decide.mutate({ cut: s.pending.id, yes: false })} disabled={decide.isPending}
                    className="h-8 px-3 rounded-lg border border-amber-300 text-[12px] font-bold disabled:opacity-50">Decline</button>
                </div>
              )}
            </div>
          )}

          {!s.changeable ? (
            <p className="rounded-xl bg-[var(--bg)] px-3 py-2.5 text-[12.5px] text-[var(--text-2)]">{s.why_not}</p>
          ) : (
            <>
              <div>
                <div className="flex gap-1 bg-black/5 p-1 rounded-xl mb-2 w-fit">
                  {modes.map(m => (
                    <button key={m.key} onClick={() => { setMode(m.key); setValue('') }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg ${activeMode === m.key ? 'bg-[var(--panel)] shadow-sm text-[var(--text)]' : 'text-[var(--text-3)]'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[var(--text-3)] w-20 shrink-0">
                    {activeMode === 'page' ? `GHS a page` : activeMode === 'percent' ? 'Percent off' : 'New total GHS'}
                  </span>
                  <input value={value} onChange={e => setValue(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" autoFocus
                    placeholder={activeMode === 'page' ? (Number(s.page_total) / pages).toFixed(2) : activeMode === 'percent' ? '10' : before.toFixed(2)}
                    className="flex-1 h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[15px] font-bold tabular-nums outline-none focus:border-[var(--border-dark)]" />
                </div>
                {activeMode === 'page' && <p className="mt-1 text-[11px] text-[var(--text-3)]">{pages.toLocaleString()} pages in this {kind}; finishing and other items keep their price.</p>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-[1.2fr_0.9fr_1fr_1fr] gap-2">
                <Tile label="New total" value={money(total)} />
                <Tile label="Off list price" value={`${offPct.toFixed(1)}%`} />
                <Tile label="Cost to make" value={s.cost_known ? money(cost) : 'Not all costed'} />
                <Tile label="Earns over cost" value={s.cost_known ? money(total - cost) : '—'}
                  tone={s.cost_known && total - cost < 0 ? 'text-red-600' : undefined} />
              </div>

              {next != null && (
                <div className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[12.5px] ${guard.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
                  <span aria-hidden>{guard.ok ? '✓' : '!'}</span><span>{guard.text}</span>
                </div>
              )}

              <input value={reason} onChange={e => setReason(e.target.value)} maxLength={300}
                placeholder="Why it's lower: large order, regular customer…"
                className="w-full h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[13px] outline-none focus:border-[var(--border-dark)]" />

              <div className="flex gap-2">
                <button onClick={go} disabled={lower.isPending}
                  className={`flex-1 h-11 rounded-xl text-white text-sm font-bold disabled:opacity-50 ${within ? 'bg-[var(--text)]' : 'bg-amber-600'}`}>
                  {lower.isPending ? 'Saving…' : within ? 'Apply discount' : 'Ask the owner to approve'}
                </button>
                {Number(s.discount_amount) > 0 && (
                  <button onClick={() => lower.mutate({ total: before.toFixed(2), why: reason.trim() || 'Discount removed' })}
                    disabled={lower.isPending}
                    className="h-11 px-4 rounded-xl border border-[var(--border)] text-[13px] font-semibold text-[var(--text-2)] disabled:opacity-50">
                    Remove discount
                  </button>
                )}
              </div>
            </>
          )}

          {said.text && <p className={`text-[12.5px] ${said.bad ? 'text-red-600' : 'text-emerald-700'}`}>{said.text}</p>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
