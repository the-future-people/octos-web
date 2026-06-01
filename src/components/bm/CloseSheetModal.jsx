// src/components/bm/CloseSheetModal.jsx
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { closeSheet } from '../../api/bm'
import client from '../../api/client'

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

export default function CloseSheetModal({ sheetId, onClose, onSuccess }) {
  const queryClient = useQueryClient()
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
  const getFloat = (id) => floats[id] !== undefined ? floats[id] : '100'
  const setFloat = (id, v) => setFloats(f => ({ ...f, [id]: v }))

  const floatsValid = branchCashiers.length === 0 || branchCashiers.every(c => {
    const v = parseFloat(getFloat(c.cashier_id))
    return !isNaN(v) && v >= 20 && v <= 100 && v % 5 === 0
  })

  const allMet  = allSignedOff && floatsValid && ack
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
          {isLoading && !data ? (
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