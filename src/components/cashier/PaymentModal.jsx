// src/components/cashier/PaymentModal.jsx
// Payment confirmation modal — Cash, MoMo, Split

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { confirmPayment } from '../../api/cashier'
import ReceiptModal from './ReceiptModal'
import { createPortal } from 'react-dom'

function fmt(amount) {
  return `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

const METHODS = [
  { id: 'CASH', label: 'Cash' },
  { id: 'MOMO', label: 'MoMo' },
  { id: 'SPLIT', label: 'Split' },
]

export default function PaymentModal({ job, onClose }) {
  const queryClient = useQueryClient()

  const [deposit,    setDeposit]    = useState(100)
  const [method,     setMethod]     = useState(null)
  const [momoRef,    setMomoRef]    = useState('')
  const [cash,       setCash]       = useState('')
  const [splitMethod1, setSplitMethod1] = useState('MOMO')
  const [splitAmount1, setSplitAmount1] = useState('')
  const [splitRef1,    setSplitRef1]    = useState('')
  const [splitMethod2, setSplitMethod2] = useState('CASH')
  const [error,      setError]      = useState('')
  const [company,    setCompany]    = useState('')
  const [phone,      setPhone]      = useState('')
  const [notes,      setNotes]      = useState('')

  const amountDue = job ? (parseFloat(job.estimated_cost || 0) * deposit / 100) : 0
  const change    = method === 'CASH' ? Math.max(0, parseFloat(cash || 0) - amountDue) : 0
  const split2Amount = method === 'SPLIT'
    ? Math.max(0, amountDue - parseFloat(splitAmount1 || 0)).toFixed(2)
    : '0.00'

  // Reset state when job changes
  useEffect(() => {
    setDeposit(100)
    setMethod(null)
    setMomoRef('')
    setCash('')
    setSplitAmount1('')
    setSplitRef1('')
    setError('')
    setCompany('')
    setPhone('')
    setNotes('')
  }, [job?.id])

  const [receipt, setReceipt] = useState(null)

  const { mutate, isPending } = useMutation({
    mutationFn: (payload) => confirmPayment(job.id, payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['paymentQueue'] })
      queryClient.invalidateQueries({ queryKey: ['cashierSummary'] })
      setReceipt(res.data)
    },
    onError: (err) => {
      setError(err.response?.data?.detail || 'Payment failed. Please try again.')
    },
  })

  const isReady = () => {
    if (!method) return false
    if (method === 'CASH') return parseFloat(cash || 0) >= amountDue
    if (method === 'MOMO') return /^\d{11}$/.test(momoRef)
    if (method === 'SPLIT') {
      const a1 = parseFloat(splitAmount1 || 0)
      if (a1 <= 0 || a1 >= amountDue) return false
      if (splitMethod1 === 'MOMO' && !/^\d{11}$/.test(splitRef1)) return false
      return true
    }
    return false
  }

  const handleSubmit = () => {
    setError('')
    
    // Add notes and customer info to the body
    const body = {
      deposit_percentage: deposit,
      payment_method: method,
      company_name: company || undefined,
      customer_phone: phone || undefined,
      notes: notes || undefined,
    }

    if (method === 'CASH') {
      body.cash_tendered = parseFloat(cash).toFixed(2)
      body.change_given  = change.toFixed(2)
    }
    if (method === 'MOMO') {
      body.momo_reference = momoRef
    }
    if (method === 'SPLIT') {
      body.split_legs = [
        {
          method: splitMethod1,
          amount: parseFloat(splitAmount1).toFixed(2),
          reference: splitRef1 || undefined,
        },
        {
          method: splitMethod2,
          amount: split2Amount,
        },
      ]
    }

    mutate(body)
  }

  if (!job) return null

  if (receipt) {
    return <ReceiptModal result={receipt} onClose={onClose} />
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-md mx-auto
        max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="relative px-6 pt-5 pb-3 border-b border-[var(--border)] text-center">
          <button onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center
              rounded-full hover:bg-[var(--bg)] text-[var(--text-3)] transition-colors">
            ✕
          </button>
          <div className="font-black text-base text-[var(--text)]">Farhat Printing Press</div>
          <div className="text-xs text-[var(--text-3)] mt-0.5">
            {job.branch_name}{job.branch_phone ? ` · ${job.branch_phone}` : ''}
          </div>
          {job.branch_address && (
            <div className="text-xs text-[var(--text-3)]">{job.branch_address}</div>
          )}
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap text-[10px] text-[var(--text-3)]">
            <span>ATTENDANT <strong className="text-[var(--text-2)]">{job.intake_by_name}</strong></span>
            <span>·</span>
            <span>TYPE <strong className="text-[var(--text-2)]">{job.job_type}</strong></span>
            <span>·</span>
            <span>CUSTOMER <strong className="text-[var(--text-2)]">{job.customer_name || 'Walk-in'}</strong></span>
            <span>·</span>
            <span>REF <strong className="font-mono text-[var(--text-2)]">{job.job_number}</strong></span>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5 overflow-y-auto flex-1">

          {/* Line items */}
          {job.line_items?.length > 0 && (
            <div className="border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 px-3 py-2 bg-[var(--bg)]
                text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
                <span className="col-span-7">Item</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-3 text-right">Amount</span>
              </div>
              {job.line_items.map((li, i) => (
                <div key={i} className="grid grid-cols-12 px-3 py-2.5 border-t border-[var(--border)] items-center">
                  <div className="col-span-7 min-w-0">
                    <div className="text-xs font-semibold text-[var(--text)] truncate">
                      {li.label || li.service_name}
                    </div>
                    <div className="text-[10px] text-[var(--text-3)]">
                      {li.pages}pp · {li.is_color ? 'Colour' : 'B&W'}
                    </div>
                  </div>
                  <div className="col-span-2 text-center text-xs font-mono text-[var(--text-2)]">
                    {li.quantity}
                  </div>
                  <div className="col-span-3 text-right text-xs font-mono font-bold text-[var(--text)]">
                    {fmt(li.line_total)}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-12 px-3 py-2.5 border-t border-[var(--border)] bg-[var(--bg)]">
                <span className="col-span-9 text-xs font-bold text-[var(--text)]">TOTAL</span>
                <span className="col-span-3 text-right text-sm font-mono font-black text-[var(--text)]">
                  {fmt(job.estimated_cost)}
                </span>
              </div>
            </div>
          )}

          {/* Amount due */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">
                Collect from customer
              </div>
              <div className="font-mono font-black text-2xl text-[var(--text)]">
                {fmt(amountDue)}
              </div>
            </div>
            <div className="flex gap-2">
              {[100, 70].map(pct => (
                <button
                  key={pct}
                  onClick={() => setDeposit(pct)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors
                    ${deposit === pct
                      ? 'bg-[var(--text)] text-white border-[var(--text)]'
                      : 'bg-[var(--bg)] text-[var(--text-2)] border-[var(--border)]'
                    }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Payment method */}
          <div>
            <div className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-2">
              Payment Method
            </div>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`py-2.5 rounded-lg text-sm font-bold border transition-colors
                    ${method === m.id
                      ? 'bg-[var(--text)] text-white border-[var(--text)]'
                      : 'bg-[var(--bg)] text-[var(--text-2)] border-[var(--border)] hover:border-[var(--border-dark)]'
                    }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cash fields */}
          {method === 'CASH' && (
            <div>
              <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
                Cash Tendered <span className="text-[var(--red-text)]">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cash}
                onChange={e => setCash(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                  rounded-lg text-sm font-mono outline-none focus:border-[var(--border-dark)]"
              />
              {parseFloat(cash || 0) >= amountDue && (
                <div className="mt-2 text-sm font-bold text-emerald-600">
                  Change: {fmt(change)}
                </div>
              )}
            </div>
          )}

          {/* MoMo fields */}
          {method === 'MOMO' && (
            <div>
              <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
                MoMo Reference <span className="text-[var(--red-text)]">*</span>
              </label>
              <input
                type="text"
                value={momoRef}
                onChange={e => setMomoRef(e.target.value.replace(/\D/g, ''))}
                placeholder="11-digit reference"
                maxLength={11}
                className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                  rounded-lg text-sm font-mono outline-none focus:border-[var(--border-dark)]"
              />
              <div className="mt-1 text-xs text-[var(--text-3)]">
                {momoRef.length}/11 digits
              </div>
            </div>
          )}

          {/* Split fields */}
          {method === 'SPLIT' && (
            <div className="space-y-3">
              <div>
                <div className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-2">
                  First Payment
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select
                    value={splitMethod1}
                    onChange={e => setSplitMethod1(e.target.value)}
                    className="px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                      rounded-lg text-sm outline-none"
                  >
                    <option value="MOMO">MoMo</option>
                    <option value="CASH">Cash</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={splitAmount1}
                    onChange={e => setSplitAmount1(e.target.value)}
                    placeholder="Amount"
                    className="px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                      rounded-lg text-sm font-mono outline-none"
                  />
                </div>
                {splitMethod1 === 'MOMO' && (
                  <input
                    type="text"
                    value={splitRef1}
                    onChange={e => setSplitRef1(e.target.value.replace(/\D/g, ''))}
                    placeholder="MoMo reference (11 digits)"
                    maxLength={11}
                    className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                      rounded-lg text-sm font-mono outline-none"
                  />
                )}
              </div>

              <div>
                <div className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-2">
                  Second Payment
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={splitMethod2}
                    onChange={e => setSplitMethod2(e.target.value)}
                    className="px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                      rounded-lg text-sm outline-none"
                  >
                    <option value="CASH">Cash</option>
                    <option value="MOMO">MoMo</option>
                  </select>
                  <input
                    type="number"
                    value={split2Amount}
                    readOnly
                    disabled
                    className="px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                      rounded-lg text-sm font-mono opacity-60 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Receipt extras - moved before error */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
                Company / Sender <span className="text-[var(--text-3)] font-normal normal-case">(optional — shown on receipt)</span>
              </label>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="e.g. ABC Ltd, University of Ghana…"
                className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                  rounded-lg text-sm outline-none focus:border-[var(--border-dark)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
                  Phone <span className="text-[var(--text-3)] font-normal normal-case">(for receipt)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="0244123456"
                  maxLength={10}
                  className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                    rounded-lg text-sm outline-none focus:border-[var(--border-dark)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
                  Notes <span className="text-[var(--text-3)] font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional context…"
                  className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                    rounded-lg text-sm outline-none focus:border-[var(--border-dark)]"
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2.5 bg-[var(--red-bg)] border border-[var(--red-border)]
              rounded-lg text-sm text-[var(--red-text)]">
              {error}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={handleSubmit}
            disabled={!isReady() || isPending}
            className="w-full py-3 bg-[var(--text)] text-white text-sm font-bold
              rounded-xl transition-opacity disabled:opacity-40 hover:opacity-90"
          >
            {isPending ? 'Processing…' : 'Confirm Payment'}
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}