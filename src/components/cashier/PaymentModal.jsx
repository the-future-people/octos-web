// src/components/cashier/PaymentModal.jsx
// Payment confirmation modal — Cash, MoMo, Split

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { confirmPayment } from '../../api/cashier'
import ReceiptModal from './ReceiptModal'

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
    const body = {
      deposit_percentage: deposit,
      payment_method: method,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <div className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">
              Collect Payment
            </div>
            <div className="font-mono text-sm font-bold text-[var(--text)] mt-0.5">
              {job.job_number}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
              hover:bg-[var(--bg)] text-[var(--text-3)] transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">

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
                value={cash}
                onChange={e => setCash(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                  rounded-lg text-sm font-mono outline-none focus:border-[var(--border-dark)]"
              />
              {parseFloat(cash || 0) >= amountDue && (
                <div className="mt-2 text-sm font-bold text-[var(--green-text)]">
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
                onChange={e => setMomoRef(e.target.value)}
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
                    onChange={e => setSplitRef1(e.target.value)}
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
                    className="px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                      rounded-lg text-sm font-mono opacity-60"
                  />
                </div>
              </div>
            </div>
          )}

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
              rounded-xl transition-opacity disabled:opacity-40"
          >
            {isPending ? 'Processing…' : 'Confirm Payment'}
          </button>
        </div>

      </div>
    </div>
  )
}