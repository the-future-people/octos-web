// src/components/bm/CloseSheetModal.jsx
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { closeSheet } from '../../api/bm'
import { resolveSignOffItem } from '../../api/attendant'
import client from '../../api/client'
import usePhone from '../../hooks/usePhone'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ icon, title, badge, badgeGreen, color = 'blue', children }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-100',   icon: 'bg-blue-100',   title: 'text-blue-800'   },
    green:  { bg: 'bg-emerald-50',border: 'border-emerald-100',icon: 'bg-emerald-100',title: 'text-emerald-800' },
    amber:  { bg: 'bg-amber-50',  border: 'border-amber-100',  icon: 'bg-amber-100',  title: 'text-amber-800'  },
    red:    { bg: 'bg-red-50',    border: 'border-red-100',    icon: 'bg-red-100',    title: 'text-red-800'    },
    violet: { bg: 'bg-violet-50', border: 'border-violet-100', icon: 'bg-violet-100', title: 'text-violet-800' },
    slate:  { bg: 'bg-slate-50',  border: 'border-slate-100',  icon: 'bg-slate-100',  title: 'text-slate-700'  },
  }
  const c = colors[color] || colors.blue

  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} overflow-hidden`}>
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-inherit">
        <div className="flex items-center gap-2.5">
          <span className={`w-7 h-7 ${c.icon} rounded-lg flex items-center justify-center text-sm`}>{icon}</span>
          <span className={`text-[11px] font-bold uppercase tracking-widest ${c.title}`}>{title}</span>
        </div>
        {badge && (
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${badgeGreen ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  )
}

// ── Empty state inside a section ──────────────────────────────────────────────
function SectionEmpty({ text }) {
  return (
    <p className="text-sm text-[var(--text-3)] flex items-center gap-1.5">
      <span className="text-emerald-500">✓</span> {text}
    </p>
  )
}

// ── An attendant's flagged answer, resolved by the BM ─────────────────────────
// Left unpaid: the job is written off (cancelled with the reason on its log),
// unless it has been paid since. Missing from the shelf: the BM records what
// was found. Nothing is voided.
function AttendantItem({ item, sheetId }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const { mutate, isPending } = useMutation({
    mutationFn: () => resolveSignOffItem(item.id, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['eod-summary', sheetId] }),
    onError: (err) => setError(err.response?.data?.detail || "Couldn't resolve this. Try again."),
  })
  const leftUnpaid = item.answer === 'LEFT_UNPAID'
  return (
    <div className="px-3 py-2.5 bg-white border border-red-200 rounded-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold text-[var(--text)] truncate">{item.job_number} · {item.title}</div>
          <div className="text-[10px] text-red-600 font-bold">{item.answer_label}</div>
        </div>
        <div className="font-mono text-xs font-black text-[var(--text)] shrink-0">{fmt(item.amount)}</div>
      </div>
      <div className="mt-2 flex gap-2">
        <input value={note} onChange={e => { setNote(e.target.value); setError('') }}
          placeholder={leftUnpaid ? 'What happened' : 'Where it was found, or what was done'}
          aria-label={`Note for ${item.job_number}`}
          className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-white border border-[var(--border)] rounded-lg outline-none
            focus:border-[var(--border-dark)]" />
        <button onClick={() => { if (!note.trim()) { setError('Add a short note first.'); return } mutate() }}
          disabled={isPending}
          className="px-3 py-1.5 text-xs font-bold bg-[var(--text)] text-white rounded-lg disabled:opacity-40">
          {isPending ? 'Saving…' : leftUnpaid ? 'Write off' : 'Resolve'}
        </button>
      </div>
      {error && <p className="mt-1 text-[10px] font-semibold text-red-600">{error}</p>}
    </div>
  )
}

// The phone's section title and its round tick (18 Nov 2026).
function PhoneTitle({ children, extra }) {
  return (
    <div className="px-5 pt-6 pb-2 flex items-end justify-between gap-3">
      <h2 className="m-0 text-[20px] leading-[25px] font-bold text-[#111]">{children}</h2>{extra}
    </div>
  )
}
function PhoneTick({ on }) {
  return (
    <span className="w-[22px] h-[22px] rounded-full grid place-items-center shrink-0"
      style={on ? { background: '#22C55E', color: '#FFFFFF' } : { border: '2px solid #D1D1D6' }}>
      {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
    </span>
  )
}

export default function CloseSheetModal({ sheetId, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const phone = usePhone()
  const [floats, setFloats] = useState({})
  const [notes,  setNotes]  = useState('')
  const [ack,    setAck]    = useState(false)
  const [error,  setError]  = useState('')

  const { data: eod, isLoading } = useQuery({
    queryKey: ['eod-summary', sheetId],
    queryFn:  () => client.get(`/api/v1/finance/sheets/${sheetId}/eod-summary/`).then(r => r.data),
    staleTime: 30_000,
  })

  const revenue        = eod?.revenue            || {}
  const jobs           = eod?.jobs               || {}
  const cashierActivity= eod?.cashier_activity   || []
  const pettyList      = eod?.petty_cash         || []
  const creditList     = eod?.credit_sales       || []
  const inventory      = eod?.inventory_consumption || []
  const branchCashiers = eod?.branch_cashiers    || []
  const meta           = eod?.meta               || {}

  const allSignedOff = cashierActivity.length === 0 || cashierActivity.every(c => c.is_signed_off)
  const attendantSignoffs  = eod?.attendant_signoffs?.attendants || []
  const attendantsSignedOff = eod?.attendant_signoffs ? eod.attendant_signoffs.all_signed_off : true
  const getFloat = (id) => floats[id] !== undefined ? floats[id] : '100'
  const setFloat = (id, v) => setFloats(f => ({ ...f, [id]: v }))

  const floatsValid = branchCashiers.length === 0 || branchCashiers.every(c => {
    const v = parseFloat(getFloat(c.cashier_id))
    return !isNaN(v) && v >= 20 && v <= 100 && v % 5 === 0
  })

  const allMet  = allSignedOff && attendantsSignedOff && floatsValid && ack
  const canClose = allMet && !isLoading

  const { mutate, isPending } = useMutation({
    mutationFn: (payload) => closeSheet(sheetId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todaySummary'] })
      queryClient.invalidateQueries({ queryKey: ['lockStatus'] })
      queryClient.invalidateQueries({ queryKey: ['shiftStatus'] })
      onSuccess?.()
      onClose()
    },
    onError: (err) => {
      const d = err.response?.data
      const msg = Array.isArray(d?.errors) ? d.errors.join(' · ') : (d?.detail || 'Failed to close sheet.')
      // If sheet is already closed treat it as success
      if (msg.toLowerCase().includes('already') && msg.toLowerCase().includes('closed')) {
        queryClient.invalidateQueries({ queryKey: ['todaySummary'] })
        queryClient.invalidateQueries({ queryKey: ['lockStatus'] })
        onSuccess?.()
        onClose()
        return
      }
      setError(msg)
    },
  })

  const handleClose = () => {
    if (!allSignedOff) { setError('Cashier must sign off before closing.'); return }
    if (!attendantsSignedOff) { setError('Attendants must sign off before closing.'); return }
    if (!floatsValid)  { setError('Opening floats must be GHS 20–100 in multiples of GHS 5.'); return }
    if (!ack)          { setError('Please check the acknowledgement box.'); return }
    setError('')
    mutate({
      floats: branchCashiers.map(c => ({
        cashier_id:    c.cashier_id,
        opening_float: parseFloat(getFloat(c.cashier_id)) || 100,
      })),
      bm_notes: notes,
    })
  }

  // ── The phone (18 Nov 2026), in the Overview's look ─────────────
  // One page: what must be true to close, the day's money and jobs, each
  // cashier and attendant, anything to note, tomorrow's floats with − and +,
  // and a switch for the Branch Manager's word. Close sits at the foot.
  if (phone) {
    const RED = '#D70015'
    const card = 'mx-4 rounded-[16px] bg-white border border-black/[0.04] shadow-[0_3px_12px_rgba(17,24,39,0.05)]'
    const conditions = [
      ['Cashier signed off', allSignedOff], ['Attendants signed off', attendantsSignedOff],
      ['Tomorrow’s floats set', floatsValid], ['You have checked the report', ack],
    ]
    const notable = [
      ...(jobs.pending_list || []).map(j => ({ key: `p${j.id}`, kind: 'Waiting for payment', title: `${j.job_number} · ${j.title}`, sub: j.intake_by_name, amount: j.estimated_cost, tone: '#B45309' })),
      ...pettyList.map(p => ({ key: `c${p.id}`, kind: 'Petty cash', title: p.reason, sub: `${p.recorded_by_name} · ${fmtTime(p.created_at)}`, amount: p.amount, tone: RED })),
      ...creditList.map((c, i) => ({ key: `k${i}`, kind: 'On credit', title: `${c.job_number} · ${c.customer_name}`, sub: c.title, amount: c.estimated_cost, tone: '#7C3AED' })),
    ]
    const stepFloat = (id, d) => {
      const v = Math.min(100, Math.max(20, (parseFloat(getFloat(id)) || 100) + d))
      setFloat(id, String(v))
    }
    const dateWords = meta.date ? new Date(`${meta.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : ''

    return createPortal(
      <div className="ios fixed inset-0 z-[9999] flex flex-col animate-slideUp" style={{ background: '#F6F6F8' }}>
        <div className="ios-bar shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="h-[50px] px-2 grid grid-cols-[1fr_auto_1fr] items-center">
            <button type="button" onClick={onClose} className="justify-self-start text-[17px] text-[#D70015] px-2">Cancel</button>
            <span className="text-[16px] font-semibold text-[#111]">End of day</span><span />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="px-4 pt-3">
            <h1 className="m-0 text-[26px] leading-[32px] font-extrabold tracking-[-0.02em] text-[#111]">{dateWords}</h1>
            <div className="text-[14px] text-[#6E6E73] tabular-nums">{meta.sheet_number} · {meta.branch}</div>
          </div>

          {isLoading && !eod ? (
            <div className="px-4 pt-4 space-y-3 animate-pulse" aria-hidden="true">
              {[0, 1, 2].map(i => <div key={i} className="h-[120px] rounded-[16px] bg-black/[0.05]" />)}
            </div>
          ) : (<>
            {/* What must be true to close */}
            <div className={`${card} mt-4 divide-y divide-black/[0.06]`}>
              {conditions.map(([label, on]) => (
                <div key={label} className="flex items-center gap-3 px-4 py-2.5">
                  <PhoneTick on={on} /><span className={`text-[15px] ${on ? 'text-[#1C1C1E]' : 'text-[#B91C1C] font-medium'}`}>{label}</span>
                </div>
              ))}
            </div>

            {/* The money */}
            <PhoneTitle>Money</PhoneTitle>
            <div className={card}>
              <div className="px-4 pt-3.5 pb-3">
                <div className="text-[13px] font-medium text-[#6E6E73]">Collected</div>
                <div className="text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] tabular-nums text-[#111]">{fmt(revenue.total)}</div>
              </div>
              <div className="grid grid-cols-3 border-t border-black/[0.06]">
                {[['Cash', revenue.cash, '#15803D'], ['MoMo', revenue.momo, '#B45309'], ['Card', revenue.pos, '#2563EB']].map(([label, v, dot], i) => (
                  <div key={label} className={`px-3.5 py-2.5 min-w-0 ${i ? 'border-l border-black/[0.06]' : ''}`}>
                    <span className="flex items-center gap-1.5 text-[12.5px] text-[#6E6E73]"><span className="w-2 h-2 rounded-full" style={{ background: dot }} />{label}</span>
                    <span className="block mt-0.5 text-[14.5px] font-semibold tabular-nums truncate">{fmt(v)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-black/[0.06] divide-y divide-black/[0.06]">
                {[['Credit given', revenue.credit_issued], ['Credit paid back', revenue.credit_settled], ['Petty cash out', revenue.petty_cash_out], ['Cash in the till', revenue.net_cash_in_till, true]].map(([label, v, strong]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2.5">
                    <span className={`text-[15px] ${strong ? 'font-semibold' : ''}`}>{label}</span>
                    <span className={`tabular-nums ${strong ? 'text-[16px] font-bold' : 'text-[15px] font-semibold'}`}>{fmt(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* The jobs */}
            <PhoneTitle>Jobs</PhoneTitle>
            <div className={`${card} grid grid-cols-4`}>
              {[['Total', jobs.total, '#111'], ['Done', jobs.completed, '#111'],
                ['Pending', jobs.pending_payment, jobs.pending_payment > 0 ? RED : '#111'], ['Cancelled', jobs.cancelled, '#111']].map(([label, v, tone], i) => (
                <div key={label} className={`px-3 py-3 ${i ? 'border-l border-black/[0.06]' : ''}`}>
                  <div className="text-[12px] text-[#6E6E73]">{label}</div>
                  <div className="text-[22px] leading-[28px] font-bold tabular-nums" style={{ color: tone }}>{v ?? '—'}</div>
                </div>
              ))}
            </div>

            {/* The cashiers */}
            <PhoneTitle>Cashiers</PhoneTitle>
            {cashierActivity.length === 0 ? <p className="m-0 mx-5 text-[14.5px] text-[#8A8A8E]">No cashier activity today.</p> : (
              <div className="space-y-3">
                {cashierActivity.map(c => {
                  const off = parseFloat(c.variance || 0) !== 0
                  return (
                    <div key={c.cashier_id} className={card}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <PhoneTick on={c.is_signed_off} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15.5px] font-semibold truncate">{c.cashier_name}</span>
                          <span className="block text-[12.5px]" style={{ color: c.is_signed_off ? '#8A8A8E' : '#B91C1C' }}>
                            {c.is_signed_off ? `Signed off · ${c.transaction_count} payments` : 'Not signed off yet'}
                          </span>
                        </span>
                        <span className="text-[15.5px] font-bold tabular-nums">{fmt(c.total_collected)}</span>
                      </div>
                      <div className="border-t border-black/[0.06] divide-y divide-black/[0.06]">
                        {[['Opening float', c.opening_float], ['Cash expected', c.expected_cash], ['Cash counted', c.closing_cash]].map(([label, v]) => (
                          <div key={label} className="flex justify-between px-4 py-2 text-[14.5px]"><span className="text-[#3A3A3C]">{label}</span><span className="font-semibold tabular-nums">{fmt(v)}</span></div>
                        ))}
                        <div className="flex justify-between px-4 py-2 text-[14.5px]">
                          <span className="font-semibold">{off ? 'Difference' : 'Balanced'}</span>
                          <span className="font-bold tabular-nums" style={{ color: off ? RED : '#15803D' }}>{fmt(c.variance)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* The attendants */}
            <PhoneTitle>Attendants</PhoneTitle>
            {attendantSignoffs.length === 0 ? <p className="m-0 mx-5 text-[14.5px] text-[#8A8A8E]">No attendant recorded jobs today.</p> : (
              <div className={`${card} divide-y divide-black/[0.06]`}>
                {attendantSignoffs.map(a => {
                  const b = a.buckets || {}
                  return (
                    <div key={a.attendant_id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <PhoneTick on={a.is_signed_off} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15.5px] font-semibold truncate">{a.attendant_name}</span>
                          <span className="block text-[12.5px]" style={{ color: !a.is_signed_off ? '#B91C1C' : a.is_auto ? '#B45309' : '#8A8A8E' }}>
                            {!a.is_signed_off ? 'Not signed off yet' : a.is_auto ? `Signed off by Octos at ${fmtTime(a.signed_off_at)}` : `Signed off at ${fmtTime(a.signed_off_at)}`}
                          </span>
                        </span>
                      </div>
                      {a.is_signed_off && (
                        <div className="mt-1.5 pl-[34px] text-[12.5px] text-[#8A8A8E]">
                          {b.recorded_total ?? 0} recorded · {b.paid ?? 0} paid · {b.handed_to_production ?? 0} to production · {b.unpaid_instant ?? 0} unpaid
                        </div>
                      )}
                      {a.handover_note && <div className="mt-1.5 pl-[34px] text-[13px] text-[#3A3A3C]">“{a.handover_note}”</div>}
                      {a.open_items?.length > 0 && (
                        <div className="mt-2.5 space-y-2">{a.open_items.map(item => <AttendantItem key={item.id} item={item} sheetId={sheetId} />)}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Anything to note */}
            <PhoneTitle>To note</PhoneTitle>
            {notable.length === 0 ? (
              <p className="m-0 mx-5 text-[14.5px] text-[#8A8A8E]">Nothing waiting for payment, no petty cash and no credit sales.</p>
            ) : (
              <div className={`${card} divide-y divide-black/[0.06]`}>
                {notable.map(n => (
                  <div key={n.key} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12px] font-semibold" style={{ color: n.tone }}>{n.kind}</span>
                      <span className="block text-[15px] truncate">{n.title}</span>
                      {n.sub && <span className="block text-[12.5px] text-[#8A8A8E] truncate">{n.sub}</span>}
                    </span>
                    <span className="text-[15px] font-semibold tabular-nums">{fmt(n.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {inventory.length > 0 && (<>
              <PhoneTitle>Stock used</PhoneTitle>
              <div className={`${card} divide-y divide-black/[0.06]`}>
                {inventory.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0"><span className="block text-[15px] truncate">{item.consumable}</span>
                      <span className="block text-[12.5px] text-[#8A8A8E]">Used {item.consumed} {item.unit}</span></span>
                    <span className="text-[15px] font-bold tabular-nums" style={{ color: item.closing <= 0 ? RED : item.is_low ? '#B45309' : '#111' }}>{item.closing} left</span>
                  </div>
                ))}
              </div>
            </>)}

            {/* Notes */}
            <PhoneTitle>Your notes</PhoneTitle>
            <div className="mx-4">
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything worth remembering about today"
                className="w-full px-3.5 py-3 text-[16px] rounded-[16px] bg-white border border-black/[0.06] outline-none resize-none" />
            </div>

            {/* Tomorrow's floats */}
            <PhoneTitle extra={<span className="text-[12.5px] text-[#8A8A8E]">GHS 20–100, in fives</span>}>Tomorrow’s float</PhoneTitle>
            {branchCashiers.length === 0 ? <p className="m-0 mx-5 text-[14.5px] text-[#8A8A8E]">No active cashiers.</p> : (
              <div className={`${card} divide-y divide-black/[0.06]`}>
                {branchCashiers.map(c => {
                  const v = parseFloat(getFloat(c.cashier_id))
                  const valid = !isNaN(v) && v >= 20 && v <= 100 && v % 5 === 0
                  return (
                    <div key={c.cashier_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="text-[15.5px] truncate">{c.cashier_name}</span>
                      <div className={`flex items-center h-[40px] rounded-[12px] overflow-hidden shrink-0 ${valid ? 'bg-[#F2F2F4]' : 'bg-[#FFF2F2]'}`}>
                        <button type="button" onClick={() => stepFloat(c.cashier_id, -5)} aria-label="Five less" className="w-10 h-full text-[20px] text-[#1C1C1E]">−</button>
                        <input type="number" inputMode="numeric" value={getFloat(c.cashier_id)} onChange={e => setFloat(c.cashier_id, e.target.value)}
                          aria-label={`Opening float for ${c.cashier_name}`}
                          className="w-[64px] h-full text-center text-[16px] font-semibold tabular-nums bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          style={{ color: valid ? '#111' : '#B91C1C' }} />
                        <button type="button" onClick={() => stepFloat(c.cashier_id, 5)} aria-label="Five more" className="w-10 h-full text-[20px] text-[#1C1C1E]">+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* The Branch Manager's word, as an iOS switch */}
            <div className={`${card} mt-6 px-4 py-3.5 flex items-start gap-3`}>
              <p className="m-0 flex-1 text-[14px] leading-[20px] text-[#3A3A3C]">
                I, <b className="text-[#111]">{meta.opened_by || 'the Branch Manager'}</b>, have checked this report and it is a true account of today at <b className="text-[#111]">{meta.branch}</b>.
              </p>
              <button type="button" role="switch" aria-checked={ack} onClick={() => setAck(a => !a)} aria-label="I have checked the report"
                className="relative w-[51px] h-[31px] rounded-full shrink-0 transition-colors" style={{ background: ack ? '#34C759' : '#E5E5EA' }}>
                <span className="absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-[left]"
                  style={{ left: ack ? 22 : 2 }} />
              </button>
            </div>
          </>)}
        </div>

        <div className="shrink-0 bg-white border-t border-black/[0.08] px-4 pt-2.5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
          {error && <p className="m-0 mb-2 text-[14px] text-[#B91C1C]">{error}</p>}
          <button type="button" onClick={handleClose} disabled={!canClose || isPending}
            className="w-full h-[50px] rounded-[16px] text-[16px] font-semibold disabled:text-[#8A8A8E]"
            style={canClose ? { background: 'linear-gradient(135deg,#EF1C2C 0%,#C8000F 100%)', color: '#FFFFFF' } : { background: '#E5E5EA' }}>
            {isPending ? 'Closing…' : canClose ? 'Close the day sheet' : `${conditions.filter(([, on]) => !on).length} thing${conditions.filter(([, on]) => !on).length === 1 ? '' : 's'} left before closing`}
          </button>
        </div>
      </div>,
      document.body,
    )
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 animate-fadeIn"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh]
        flex flex-col overflow-hidden animate-slideUp">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <div className="font-black text-xl text-[var(--text)]">End of Day Report</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">
              {meta.sheet_number} · {meta.date && new Date(meta.date).toLocaleDateString('en-GH', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })} · {meta.branch}
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full
              hover:bg-[var(--bg)] text-[var(--text-3)] transition-colors text-lg">✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {isLoading && !eod ? (
            <div className="space-y-4">
              {[1,2,3,4].map(i => <div key={i} className="h-24 bg-[var(--bg)] rounded-2xl animate-pulse"/>)}
            </div>
          ) : (<>

            {/* ── Revenue Summary ── */}
            <Section icon="💰" title="Revenue Summary" color="green">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                {[
                  { label: 'Cash',            value: fmt(revenue.cash),           color: 'text-emerald-700' },
                  { label: 'MoMo',            value: fmt(revenue.momo),           color: 'text-amber-600'   },
                  { label: 'POS',             value: fmt(revenue.pos),            color: 'text-blue-600'    },
                  { label: 'Total Collected', value: fmt(revenue.total),          color: 'text-emerald-700', highlight: true },
                ].map(c => (
                  <div key={c.label} className={`rounded-xl p-3 ${c.highlight ? 'bg-emerald-100' : 'bg-white/70'}`}>
                    <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">{c.label}</div>
                    <div className={`font-mono font-black text-sm ${c.color}`}>{c.value}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Credit Issued',    value: fmt(revenue.credit_issued),    color: 'text-red-500'    },
                  { label: 'Credit Settled',   value: fmt(revenue.credit_settled),   color: 'text-emerald-700'},
                  { label: 'Petty Cash Out',   value: fmt(revenue.petty_cash_out),   color: 'text-amber-600'  },
                  { label: 'Net Cash in Till', value: fmt(revenue.net_cash_in_till), color: 'text-emerald-700', highlight: true },
                ].map(c => (
                  <div key={c.label} className={`rounded-xl p-3 ${c.highlight ? 'bg-emerald-100' : 'bg-white/70'}`}>
                    <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">{c.label}</div>
                    <div className={`font-mono font-black text-sm ${c.color}`}>{c.value}</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* ── Jobs Overview ── */}
            <Section icon="🗂" title="Jobs Overview" color="blue">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Total Jobs', value: jobs.total           ?? '—', color: 'text-blue-700',    bg: 'bg-blue-100'    },
                  { label: 'Completed',  value: jobs.completed        ?? '—', color: 'text-emerald-700', bg: 'bg-emerald-100' },
                  { label: 'Pending',    value: jobs.pending_payment  ?? '—', color: 'text-amber-700',   bg: 'bg-amber-100'   },
                  { label: 'Cancelled',  value: jobs.cancelled        ?? '—', color: 'text-red-600',     bg: 'bg-red-100'     },
                ].map(c => (
                  <div key={c.label} className={`${c.bg} rounded-xl p-3`}>
                    <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">{c.label}</div>
                    <div className={`font-mono font-black text-2xl ${c.color}`}>{c.value}</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* ── Cashier Sign-off ── */}
            <Section icon="✍️" title="Cashier Sign-off" color={allSignedOff ? 'green' : 'red'}
              badge={allSignedOff ? '✓ All Signed Off' : 'SIGN-OFF PENDING'}
              badgeGreen={allSignedOff}>
              {cashierActivity.length === 0 ? (
                <SectionEmpty text="No cashier activity recorded today." />
              ) : (
                <div className="space-y-3">
                  {cashierActivity.map(c => (
                    <div key={c.cashier_id}
                      className={`rounded-xl border overflow-hidden ${c.is_signed_off ? 'border-emerald-200 bg-white' : 'border-red-200 bg-red-50'}`}>
                      <div className="flex items-center justify-between px-4 py-3">
                        <div>
                          <div className="text-sm font-bold text-[var(--text)]">{c.cashier_name}</div>
                          <div className="text-[10px] text-[var(--text-3)]">{c.transaction_count} transactions</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full
                            ${c.is_signed_off ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                            {c.is_signed_off ? '✓ Signed off' : '⚠ Not signed off'}
                          </span>
                          <span className="font-mono font-black text-sm text-[var(--text)]">{fmt(c.total_collected)}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 divide-x divide-[var(--border)] border-t border-[var(--border)] bg-white/60">
                        {[
                          { label: 'Opening Float', value: fmt(c.opening_float) },
                          { label: 'Expected Cash', value: fmt(c.expected_cash) },
                          { label: 'Closing Count', value: fmt(c.closing_cash)  },
                          { label: 'Variance',      value: fmt(c.variance),
                            color: parseFloat(c.variance) === 0 ? 'text-emerald-600' : 'text-red-500' },
                        ].map(f => (
                          <div key={f.label} className="px-3 py-2">
                            <div className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-0.5">{f.label}</div>
                            <div className={`font-mono text-xs font-bold ${f.color || 'text-[var(--text)]'}`}>{f.value}</div>
                          </div>
                        ))}
                      </div>
                      {Object.keys(c.method_breakdown || {}).length > 0 && (
                        <div className="px-4 py-2.5 border-t border-[var(--border)] flex gap-2 flex-wrap bg-white/40">
                          {Object.entries(c.method_breakdown).map(([method, data]) => (
                            <div key={method} className="flex items-center gap-1.5 px-3 py-1.5
                              bg-white border border-[var(--border)] rounded-lg">
                              <span className="text-[10px] font-bold text-[var(--text-3)] uppercase">{method}</span>
                              <span className="font-mono text-xs font-bold text-[var(--text)]">{fmt(data.total)}</span>
                              <span className="text-[10px] text-[var(--text-3)]">· {data.count} txn</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Attendant Sign-off ── */}
            <Section icon="🧾" title="Attendant Sign-off" color={attendantsSignedOff ? 'green' : 'red'}
              badge={attendantsSignedOff ? '✓ All Signed Off' : 'SIGN-OFF PENDING'}
              badgeGreen={attendantsSignedOff}>
              {attendantSignoffs.length === 0 ? (
                <SectionEmpty text="No attendant recorded jobs today." />
              ) : (
                <div className="space-y-3">
                  {attendantSignoffs.map(a => {
                    const b = a.buckets || {}
                    return (
                      <div key={a.attendant_id}
                        className={`rounded-xl border overflow-hidden ${a.is_signed_off ? 'border-emerald-200 bg-white' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center justify-between px-4 py-3">
                          <div>
                            <div className="text-sm font-bold text-[var(--text)]">{a.attendant_name}</div>
                            {a.is_signed_off && (
                              <div className="text-[10px] text-[var(--text-3)]">
                                {b.recorded_total ?? 0} recorded · {b.paid ?? 0} paid · {b.handed_to_production ?? 0} to production · {b.unpaid_instant ?? 0} unpaid
                              </div>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full
                            ${!a.is_signed_off ? 'bg-red-100 text-red-600'
                              : a.is_auto ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'}`}>
                            {!a.is_signed_off ? '⚠ Not signed off'
                              : a.is_auto ? `Signed off by Octos at ${fmtTime(a.signed_off_at)}`
                              : `✓ Signed off at ${fmtTime(a.signed_off_at)}`}
                          </span>
                        </div>
                        {a.handover_note && (
                          <div className="px-4 py-2 border-t border-[var(--border)] text-xs text-[var(--text-2)] bg-white/60">
                            Handover: {a.handover_note}
                          </div>
                        )}
                        {a.open_items?.length > 0 && (
                          <div className="px-4 py-3 border-t border-[var(--border)] space-y-2 bg-white/40">
                            {a.open_items.map(item => (
                              <AttendantItem key={item.id} item={item} sheetId={sheetId} />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Section>

            {/* ── Pending Payments ── */}
            <Section icon="⏳" title="Pending Payments" color={jobs.pending_list?.length ? 'amber' : 'slate'}>
              {!(jobs.pending_list?.length) ? (
                <SectionEmpty text="No pending payments." />
              ) : (
                <div className="space-y-2">
                  {jobs.pending_list.map(j => (
                    <div key={j.id} className="flex items-center justify-between px-4 py-3
                      bg-white border border-amber-200 rounded-xl">
                      <div>
                        <div className="text-xs font-bold text-[var(--text)]">{j.job_number}</div>
                        <div className="text-[10px] text-[var(--text-3)] mt-0.5">{j.title} · {j.intake_by_name}</div>
                      </div>
                      <div className="font-mono text-sm font-black text-amber-700">{fmt(j.estimated_cost)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Petty Cash ── */}
            <Section icon="💵" title="Petty Cash Disbursements" color={pettyList.length ? 'amber' : 'slate'}>
              {pettyList.length === 0 ? (
                <SectionEmpty text="No petty cash disbursements today." />
              ) : (
                <div className="space-y-2">
                  {pettyList.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3
                      bg-white border border-[var(--border)] rounded-xl">
                      <div>
                        <div className="text-xs font-bold text-[var(--text)]">{p.reason}</div>
                        <div className="text-[10px] text-[var(--text-3)] mt-0.5">{p.recorded_by_name} · {fmtTime(p.created_at)}</div>
                      </div>
                      <div className="font-mono text-sm font-black text-red-500">{fmt(p.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Credit Sales ── */}
            <Section icon="💳" title="Credit Sales" color={creditList.length ? 'violet' : 'slate'}>
              {creditList.length === 0 ? (
                <SectionEmpty text="No credit sales today." />
              ) : (
                <div className="space-y-2">
                  {creditList.map((c, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3
                      bg-white border border-violet-200 rounded-xl">
                      <div>
                        <div className="text-xs font-bold text-[var(--text)]">{c.job_number}</div>
                        <div className="text-[10px] text-[var(--text-3)] mt-0.5">{c.customer_name} · {c.title}</div>
                      </div>
                      <div className="font-mono text-sm font-black text-violet-700">{fmt(c.estimated_cost)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Inventory ── */}
            {inventory.length > 0 && (
              <Section icon="📦" title="Inventory Consumed Today" color="slate">
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <div className="grid grid-cols-12 px-4 py-2 bg-slate-100 border-b border-[var(--border)]
                    text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
                    <span className="col-span-5">Consumable</span>
                    <span className="col-span-2 text-right">Consumed</span>
                    <span className="col-span-2 text-right">Closing</span>
                    <span className="col-span-1 text-right">Reorder</span>
                    <span className="col-span-2 text-right">Status</span>
                  </div>
                  {inventory.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 px-4 py-3 border-b border-[var(--border)]
                      last:border-0 items-center hover:bg-slate-50 transition-colors bg-white">
                      <div className="col-span-5">
                        <div className="text-xs font-semibold text-[var(--text)]">{item.consumable}</div>
                        <div className="text-[10px] text-[var(--text-3)]">{item.category}</div>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-xs font-mono font-semibold text-[var(--text-2)]">
                          {item.consumed} {item.unit}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className={`text-xs font-mono font-bold ${item.closing <= 0 ? 'text-red-500' : 'text-[var(--text)]'}`}>
                          {item.closing} {item.unit}
                        </span>
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="text-[10px] text-[var(--text-3)]">{item.reorder_point}</span>
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                          ${item.is_low ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                          {item.is_low ? 'LOW' : 'OK'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── BM Notes ── */}
            <Section icon="📝" title="Branch Manager Notes" color="slate">
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-2">
                Remarks / Observations for Today
              </div>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add any remarks, incidents, observations or notes about today's operations…"
                className="w-full px-3 py-2.5 text-sm bg-white border border-[var(--border)]
                  rounded-xl outline-none focus:border-[var(--border-dark)] transition-colors resize-none"
              />
            </Section>

            {/* ── Tomorrow's Float ── */}
            <Section icon="💰" title="Tomorrow's Opening Float" color="amber"
              badge="REQUIRED" badgeGreen={floatsValid}>
              <div className="px-3 py-2.5 bg-amber-100 border border-amber-200 rounded-xl mb-3">
                <p className="text-xs text-amber-800">
                  Set the opening float for each cashier for tomorrow. Must be GHS 20–100 in multiples of GHS 5.
                </p>
              </div>
              {branchCashiers.length === 0 ? (
                <SectionEmpty text="No active cashiers found." />
              ) : (
                <div className="space-y-2">
                  {branchCashiers.map(c => {
                    const v = parseFloat(getFloat(c.cashier_id))
                    const valid = !isNaN(v) && v >= 20 && v <= 100 && v % 5 === 0
                    return (
                      <div key={c.cashier_id}
                        className="flex items-center justify-between gap-3
                          bg-white border border-[var(--border)] rounded-xl px-4 py-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text)]">{c.cashier_name}</div>
                          <div className="text-xs text-[var(--text-3)]">Opening float for tomorrow</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--text-3)]">GHS</span>
                          <input
                            type="number" min="20" max="100" step="5"
                            value={getFloat(c.cashier_id)}
                            onChange={e => setFloat(c.cashier_id, e.target.value)}
                            className={`w-20 px-2 py-1.5 text-sm font-mono rounded-lg outline-none text-right border
                              ${valid ? 'border-[var(--border)] bg-white focus:border-[var(--border-dark)]' : 'border-red-300 bg-red-50'}`}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Section>

            {/* ── Acknowledgement ── */}
            <label className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all
              ${ack ? 'bg-blue-50 border-blue-300' : 'bg-[var(--bg)] border-[var(--border)] hover:border-[var(--border-dark)]'}`}>
              <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)}
                className="mt-0.5 shrink-0 w-4 h-4 accent-blue-600" />
              <p className="text-xs text-[var(--text-2)] leading-relaxed">
                I, <strong className="text-[var(--text)]">{meta.opened_by || 'Branch Manager'}</strong>, have reviewed this end-of-day report and confirm that all information accurately reflects today's operations at <strong className="text-[var(--text)]">{meta.branch}</strong>. I take full responsibility for this filing.
              </p>
            </label>

          </>)}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-[var(--border)] shrink-0">
          {/* Conditions checklist */}
          {!isLoading && (
            <div className="mb-3 flex flex-wrap gap-2">
              {[
                { label: 'Cashier signed off', met: allSignedOff },
                { label: 'Attendants signed off', met: attendantsSignedOff },
                { label: 'Float set',          met: floatsValid  },
                { label: 'BM acknowledged',    met: ack          },
              ].map(cond => (
                <span key={cond.label}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1
                    ${cond.met ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                  {cond.met ? '✓' : '✕'} {cond.label}
                </span>
              ))}
              {allMet && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 ml-auto">
                  ✓ All conditions met — ready to close
                </span>
              )}
            </div>
          )}

          {error && (
            <div className="mb-3 px-3 py-2 bg-[var(--red-bg)] border border-[var(--red-border)]
              rounded-lg text-xs text-[var(--red-text)]">{error}</div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)]
                hover:text-[var(--text)] transition-colors">
              Cancel
            </button>
            <button onClick={handleClose} disabled={!canClose || isPending}
              className="px-5 py-2.5 bg-[var(--text)] text-white text-sm font-bold
                rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-2">
              {isPending ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Closing…
                </>
              ) : '✓ Confirm & Close Sheet'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )

  return createPortal(modal, document.body)
}