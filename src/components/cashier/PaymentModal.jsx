// src/components/cashier/PaymentModal.jsx
// Taking payment (redesigned 12 Nov 2026): one customer, one amount, one
// confirmed action. Same rules as before, which the server also enforces:
// wallet redeem only when the balance covers it; change into the wallet only
// with the customer's consent (capped server-side at GHS 200); split is exactly
// two legs; a MoMo reference is 11 digits; deposit 70% or 100%.
// New: who it is for (record, chat or walk-in), Card (POS) with its approval
// code, quick cash amounts and live change, the receipt phone pre-filled, and
// the WhatsApp receipt sent on confirm for those who want it.

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import client from '../../api/client'
import { confirmPayment } from '../../api/cashier'
import { invalidateAfterPaymentConfirmed } from '../../api/invalidations'
import ReceiptModal from './ReceiptModal'

const fmt = amount => `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
const clock = iso => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '')
// The receipt phone as the old field took it: 10 local digits (0XXXXXXXXX).
const localPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 9 ? '0' + d.slice(-9) : d }

const Icon = ({ d, size = 20, width = 1.75 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">{d}</svg>
)
const ICON = {
  CASH: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></>,
  MOMO: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></>,
  POS: <><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>,
  WALLET: <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>,
  SPLIT: <><path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.17-2.87L3 3" /><path d="M15 9l6-6" /></>,
  chat: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  check: <path d="M20 6 9 17l-5-5" />,
  x: <><path d="M18 6 6 18" /><path d="M6 6l12 12" /></>,
}
// Exact, then the next three cedi notes a customer is likely to hand over.
const NOTES = [5, 10, 20, 50, 100, 200]
const quickCash = due => [due, ...NOTES.filter(n => n > due).slice(0, 3)]

const MAIN = [{ id: 'CASH', label: 'Cash' }, { id: 'MOMO', label: 'MoMo' }, { id: 'POS', label: 'Card (POS)' }]
const WORD = { CASH: 'cash', MOMO: 'MoMo', POS: 'by card', WALLET: 'from their wallet', SPLIT: 'split' }

const label = 'block text-[11.5px] font-extrabold tracking-wider text-[var(--text-2)] mb-2'
const field = 'w-full h-12 px-3.5 bg-white border border-black/20 rounded-xl text-[15px] outline-none focus:border-black'

export default function PaymentModal({ job, onClose }) {
  const queryClient = useQueryClient()
  const production = job?.job_type === 'PRODUCTION' || job?.job_type === 'DESIGN'

  // Fresh state for every job: the queue mounts one modal per job opened.
  const [deposit, setDeposit] = useState(production ? (job?.deposit_percentage || 70) : 100)
  const [method, setMethod] = useState('CASH')
  const [cash, setCash] = useState('')
  const [momoRef, setMomoRef] = useState('')
  const [posCode, setPosCode] = useState('')
  const [splitMethod1, setSplitMethod1] = useState('MOMO')
  const [splitAmount1, setSplitAmount1] = useState('')
  const [splitRef1, setSplitRef1] = useState('')
  const [splitMethod2, setSplitMethod2] = useState('CASH')
  const [changeAction, setChangeAction] = useState('CASH')        // CASH | WALLET
  const [walletConsented, setWalletConsented] = useState(false)
  const [phone, setPhone] = useState(localPhone(job?.contact_phone))
  const [sendWa, setSendWa] = useState(!!job?.from_chat)
  const [extras, setExtras] = useState(false)
  const [company, setCompany] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [waStatus, setWaStatus] = useState(null)

  const total = parseFloat(job?.estimated_cost || 0)
  const amountDue = total * deposit / 100
  const given = parseFloat(cash || 0)
  const change = method === 'CASH' ? Math.max(0, given - amountDue) : 0
  const short = method === 'CASH' && cash !== '' && given < amountDue

  // JobListSerializer exposes the FK as `customer`, not `customer_id`.
  const walletBalance = parseFloat(job?.customer_wallet_balance || 0)
  const canRedeemWallet = !!job?.customer && walletBalance >= amountDue && amountDue > 0
  const canAddToWallet = !!job?.customer
  const walletWhy = !job?.customer ? 'no customer record' : walletBalance <= 0 ? 'nothing held' : `only ${fmt(walletBalance)} held`
  const split2Amount = Math.max(0, amountDue - parseFloat(splitAmount1 || 0)).toFixed(2)

  const { mutate, isPending } = useMutation({
    mutationFn: payload => confirmPayment(job.id, payload),
    onSuccess: res => {
      invalidateAfterPaymentConfirmed(queryClient)
      setReceipt(res.data)
      // The WhatsApp receipt, for those who want it: sent now, shown on the receipt.
      if (sendWa && res.data?.receipt_id) {
        setWaStatus({ state: 'sending', note: '' })
        client.post(`/api/v1/finance/receipts/${res.data.receipt_id}/send-whatsapp/`)
          .then(r => setWaStatus({ state: 'sent', note: r.data?.detail || 'Sent on WhatsApp.' }))
          .catch(err => setWaStatus({ state: 'failed', note: err?.response?.data?.detail || 'Could not send. Try again.' }))
      }
    },
    onError: err => {
      const d = err.response?.data
      setError(d?.detail || (d && Object.values(d).flat().find(v => typeof v === 'string')) || 'Payment failed. Please try again.')
    },
  })

  const ready = (() => {
    if (method === 'CASH') return cash !== '' && !short && !(change > 0 && changeAction === 'WALLET' && !walletConsented)
    if (method === 'MOMO') return /^\d{11}$/.test(momoRef)
    if (method === 'POS') return posCode.trim().length > 0
    if (method === 'WALLET') return canRedeemWallet
    if (method === 'SPLIT') {
      const a1 = parseFloat(splitAmount1 || 0)
      if (a1 <= 0 || a1 >= amountDue) return false
      return !(splitMethod1 === 'MOMO' && !/^\d{11}$/.test(splitRef1))
    }
    return false
  })()

  const submit = () => {
    setError('')
    const body = {
      deposit_percentage: deposit,
      payment_method: method,
      company_name: company || undefined,
      customer_phone: phone || undefined,
      notes: notes || undefined,
    }
    if (method === 'CASH') {
      body.cash_tendered = given.toFixed(2)
      if (change > 0 && changeAction === 'WALLET') {
        body.wallet_credit_amount = change.toFixed(2)
        body.wallet_consent = true      // change_given omitted: the server applies the GHS 200 cap
      } else {
        body.change_given = change.toFixed(2)
      }
    }
    if (method === 'MOMO') body.momo_reference = momoRef
    if (method === 'POS') body.pos_approval_code = posCode.trim()
    if (method === 'SPLIT') {
      body.split_legs = [
        { method: splitMethod1, amount: parseFloat(splitAmount1).toFixed(2), reference: splitRef1 || undefined },
        { method: splitMethod2, amount: split2Amount },
      ]
    }
    mutate(body)
  }

  if (!job) return null
  if (receipt) return <ReceiptModal result={receipt} onClose={onClose} waStatus={waStatus} />

  const confirmText = (() => {
    if (method === 'CASH' && cash === '') return 'Enter the cash received'
    if (method === 'CASH' && short) return `${fmt(amountDue - given)} short of the amount`
    let t = `Confirm ${fmt(amountDue)} ${WORD[method]}`
    if (method === 'CASH' && change > 0) t += changeAction === 'WALLET' ? ` · ${fmt(change)} to their wallet` : ` · give ${fmt(change)} change`
    if (sendWa) t += ' · WhatsApp receipt'
    return t
  })()

  const on = active => (active ? 'bg-[var(--text)] text-white border-[var(--text)]' : 'bg-white text-[var(--text)] border-black/15 hover:border-black/40')

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <section aria-label="Take payment" className="bg-[var(--panel)] rounded-[22px] shadow-2xl w-full max-w-[580px] max-h-[94vh] flex flex-col overflow-hidden">

        <div className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex gap-3 items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[21px] font-extrabold text-[var(--text)]">{job.for_whom || job.customer_name || 'Walk-in'}</h2>
              {job.from_chat && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800">
                  <Icon d={ICON.chat} size={12} width={2} />WhatsApp
                </span>
              )}
              <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${production ? 'bg-amber-50 text-amber-800' : 'bg-indigo-50 text-indigo-800'}`}>
                {production ? 'PRODUCTION' : 'COUNTER SALE'}
              </span>
            </div>
            <div className="text-[13px] text-[var(--text-3)] mt-1">
              {job.job_number} · recorded by {job.recorded_by || job.intake_by_name || '—'} at {clock(job.created_at)}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
                  className="w-11 h-11 rounded-xl border border-[var(--border)] grid place-items-center text-[var(--text-2)] hover:bg-[var(--bg)]">
            <Icon d={ICON.x} size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          <div className="border border-[var(--border)] rounded-2xl overflow-hidden">
            {(job.line_items || []).map((li, i) => (
              <div key={i} className="flex justify-between gap-3 px-4 py-2.5 border-b border-[var(--border)] text-sm">
                <span className="min-w-0 truncate">
                  {li.quantity} × {li.label || li.service_name}
                  {/* The label already carries pages and colour; add them only when there is none. */}
                  {!li.label && li.pages ? <span className="text-[var(--text-3)]"> · {li.pages}pp, {li.is_color ? 'colour' : 'B&W'}</span> : null}
                </span>
                <span className="font-mono font-bold">{fmt(li.line_total)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-[var(--bg)]">
              <div>
                <div className="text-[11.5px] font-extrabold tracking-wider text-[var(--text-2)]">TO COLLECT</div>
                {production && <div className="text-xs text-[var(--text-3)]">{deposit}% of {fmt(total)} · balance {fmt(total - amountDue)} at pickup</div>}
              </div>
              <div className="flex items-center gap-3">
                {production && (
                  <div className="flex gap-1.5">
                    {[70, 100].map(pct => (
                      <button key={pct} type="button" onClick={() => setDeposit(pct)} aria-pressed={deposit === pct}
                              className={`h-9 px-3 rounded-lg text-sm font-bold border ${on(deposit === pct)}`}>{pct}%</button>
                    ))}
                  </div>
                )}
                <span className="font-mono text-[26px] font-bold text-[var(--text)]">{fmt(amountDue)}</span>
              </div>
            </div>
          </div>

          <div>
            <div className={label}>PAID BY</div>
            <div className="grid grid-cols-3 gap-2">
              {MAIN.map(m => (
                <button key={m.id} type="button" onClick={() => setMethod(m.id)} aria-pressed={method === m.id}
                        className={`h-16 rounded-2xl border font-bold text-[14.5px] flex flex-col items-center justify-center gap-1 transition-colors ${on(method === m.id)}`}>
                  <Icon d={ICON[m.id]} size={22} />{m.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <button type="button" onClick={() => canRedeemWallet && setMethod('WALLET')} disabled={!canRedeemWallet} aria-pressed={method === 'WALLET'}
                      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-semibold border
                        ${method === 'WALLET' ? 'bg-[var(--text)] text-white border-[var(--text)]'
                          : canRedeemWallet ? 'bg-white border-black/15' : 'bg-white border-dashed border-black/20 text-[var(--text-3)]'}`}>
                <Icon d={ICON.WALLET} size={15} />Wallet{canRedeemWallet ? ` · ${fmt(walletBalance)}` : ` · ${walletWhy}`}
              </button>
              <button type="button" onClick={() => setMethod('SPLIT')} aria-pressed={method === 'SPLIT'}
                      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-semibold border ${on(method === 'SPLIT')}`}>
                <Icon d={ICON.SPLIT} size={15} />Split
              </button>
            </div>
          </div>

          {method === 'CASH' && (
            <div className="grid grid-cols-2 gap-3 items-start">
              <div>
                <label htmlFor="cash-in" className={label}>CASH RECEIVED</label>
                <input id="cash-in" type="number" min="0" step="0.01" inputMode="decimal" value={cash}
                       onChange={e => setCash(e.target.value)} placeholder="0.00"
                       className="w-full h-[52px] px-3.5 border-2 border-[var(--text)] rounded-xl font-mono text-[22px] font-bold outline-none" />
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {quickCash(amountDue).map(v => (
                    <button key={v} type="button" onClick={() => setCash(Number(v).toFixed(2))}
                            className="h-8 px-3 rounded-full border border-black/15 bg-white font-mono text-[13px] font-bold">
                      {v === amountDue ? 'Exact' : `GHS ${v}`}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`rounded-2xl px-4 py-3.5 ${short ? 'bg-red-50' : 'bg-emerald-50'}`}>
                <div className={`text-[11.5px] font-extrabold tracking-wider ${short ? 'text-red-800' : 'text-emerald-800'}`}>
                  {short ? 'STILL TO PAY' : 'CHANGE TO GIVE'}
                </div>
                <div className={`font-mono text-[28px] font-bold mt-1 ${short ? 'text-red-800' : 'text-emerald-800'}`}>
                  {fmt(short ? amountDue - given : change)}
                </div>
              </div>
              {change > 0 && canAddToWallet && (
                <div className="col-span-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => { setChangeAction('CASH'); setWalletConsented(false) }}
                            className={`h-10 rounded-xl text-sm font-bold border ${on(changeAction === 'CASH')}`}>Give as cash</button>
                    <button type="button" onClick={() => setChangeAction('WALLET')}
                            className={`h-10 rounded-xl text-sm font-bold border ${on(changeAction === 'WALLET')}`}>Add to their wallet</button>
                  </div>
                  {changeAction === 'WALLET' && (
                    <label className="flex items-start gap-2 px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-2)] cursor-pointer">
                      <input type="checkbox" checked={walletConsented} onChange={e => setWalletConsented(e.target.checked)} className="mt-0.5" />
                      <span>I confirmed with {job.for_whom || job.customer_name} that they want {fmt(change)} saved to their wallet instead of cash change.</span>
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          {method === 'MOMO' && (
            <div>
              <label htmlFor="momo-ref" className={label}>MOMO TRANSACTION ID</label>
              <input id="momo-ref" value={momoRef} maxLength={11} inputMode="numeric"
                     onChange={e => setMomoRef(e.target.value.replace(/\D/g, ''))}
                     placeholder="11 digits, from the customer's confirmation message" className={`${field} font-mono`} />
              <div className="mt-1 text-xs text-[var(--text-3)]">{momoRef.length} of 11 digits</div>
            </div>
          )}

          {method === 'POS' && (
            <div>
              <label htmlFor="pos-code" className={label}>APPROVAL CODE FROM THE POS SLIP</label>
              <input id="pos-code" value={posCode} onChange={e => setPosCode(e.target.value)}
                     placeholder="Printed on the card machine's slip" className={`${field} font-mono`} />
            </div>
          )}

          {method === 'WALLET' && (
            <div className="px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-2xl">
              <div className="text-[11.5px] font-extrabold tracking-wider text-[var(--text-2)]">{job.for_whom || job.customer_name}'S WALLET</div>
              <div className="font-mono text-lg font-bold">{fmt(walletBalance)}</div>
              <div className="text-xs text-[var(--text-3)] mt-0.5">{fmt(amountDue)} will be taken from it. It is never paid out as cash.</div>
            </div>
          )}

          {method === 'SPLIT' && (
            <div className="space-y-3">
              <div>
                <div className={label}>FIRST PAYMENT</div>
                <div className="grid grid-cols-2 gap-2">
                  <select aria-label="First payment method" value={splitMethod1} onChange={e => setSplitMethod1(e.target.value)} className={field}>
                    <option value="MOMO">MoMo</option><option value="CASH">Cash</option>
                  </select>
                  <input aria-label="First payment amount" type="number" min="0" step="0.01" value={splitAmount1}
                         onChange={e => setSplitAmount1(e.target.value)} placeholder="Amount" className={`${field} font-mono`} />
                </div>
                {splitMethod1 === 'MOMO' && (
                  <input aria-label="MoMo transaction ID" value={splitRef1} maxLength={11} inputMode="numeric"
                         onChange={e => setSplitRef1(e.target.value.replace(/\D/g, ''))}
                         placeholder="MoMo transaction ID (11 digits)" className={`${field} font-mono mt-2`} />
                )}
              </div>
              <div>
                <div className={label}>SECOND PAYMENT · THE REST</div>
                <div className="grid grid-cols-2 gap-2">
                  <select aria-label="Second payment method" value={splitMethod2} onChange={e => setSplitMethod2(e.target.value)} className={field}>
                    <option value="CASH">Cash</option><option value="MOMO">MoMo</option>
                  </select>
                  <div className="h-12 px-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center font-mono font-bold">{fmt(split2Amount)}</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <div className={label}>RECEIPT</div>
            <div className="flex gap-2 flex-wrap items-center">
              <button type="button" onClick={() => setSendWa(v => !v)} aria-pressed={sendWa}
                      className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-bold border ${on(sendWa)}`}>
                <Icon d={ICON.chat} size={17} />Send on WhatsApp
              </button>
              <div className="flex-1 min-w-[180px]">
                <label htmlFor="rcpt-phone" className="sr-only">Receipt phone</label>
                <input id="rcpt-phone" type="tel" value={phone} maxLength={10} inputMode="numeric"
                       onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="0244123456"
                       className="w-full h-11 px-3 bg-white border border-black/20 rounded-xl font-mono text-sm outline-none focus:border-black" />
              </div>
            </div>
            <div className="text-xs text-[var(--text-3)] mt-1.5">
              {job.contact_phone ? (job.from_chat ? 'Number from their WhatsApp chat. ' : 'Number from their customer record. ') : ''}
              Print it on the next screen.{' '}
              {!extras && <button type="button" onClick={() => setExtras(true)} className="font-semibold text-[var(--text-2)] underline">Add a company name or note</button>}
            </div>
            {extras && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input aria-label="Company or sender, shown on the receipt" value={company} onChange={e => setCompany(e.target.value)}
                       placeholder="Company / sender (on receipt)" className={field} />
                <input aria-label="Note" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note" className={field} />
              </div>
            )}
          </div>

          {error && <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
        </div>

        <div className="px-6 pt-3 pb-5 border-t border-[var(--border)] space-y-1.5">
          <button type="button" onClick={submit} disabled={!ready || isPending}
                  className={`w-full min-h-14 px-4 py-2 rounded-2xl text-white text-[15.5px] font-extrabold flex items-center justify-center gap-2
                              ${ready ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-zinc-400'} disabled:cursor-not-allowed`}>
            <Icon d={ICON.check} size={19} width={2.5} />
            {isPending ? 'Confirming…' : confirmText}
          </button>
          <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-[var(--text-3)] hover:text-[var(--text)]">Cancel</button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
