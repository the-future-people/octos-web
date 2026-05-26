// src/components/cashier/ReceiptModal.jsx
// Shown after a successful payment confirmation.

function fmt(amount) {
  return `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

const METHOD_LABELS = {
  CASH : 'Cash',
  MOMO : 'MoMo',
  POS  : 'POS',
  SPLIT: 'Split',
}

export default function ReceiptModal({ result, onClose }) {
  if (!result) return null

  const showCash = result.payment_method === 'CASH' && result.cash_tendered

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

        {/* Success banner */}
        <div className="bg-[var(--text)] px-6 py-5 text-center">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="text-white font-bold text-base">Payment Confirmed</div>
          <div className="text-white/60 text-xs font-mono mt-1">{result.job_number}</div>
        </div>

        {/* Details */}
        <div className="px-6 py-4 space-y-3">
          <Row label="Amount Paid"     value={fmt(result.amount_paid)} bold />
          <Row label="Balance Due"     value={fmt(result.balance_due)} />
          <Row label="Payment Method"  value={METHOD_LABELS[result.payment_method] || result.payment_method} />
          {showCash && (
            <>
              <Row label="Cash Tendered" value={fmt(result.cash_tendered)} />
              <Row label="Change Given"  value={fmt(result.change_given)} />
            </>
          )}
          <div className="border-t border-[var(--border)] pt-3">
            <Row label="Receipt No." value={result.receipt_number} mono />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[var(--text)] text-white text-sm font-bold
              rounded-xl transition-opacity hover:opacity-90"
          >
            Done
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[var(--bg)] text-[var(--text-2)] text-sm font-medium
              rounded-xl border border-[var(--border)] hover:border-[var(--border-dark)] transition-colors"
          >
            Skip for now
          </button>
        </div>

      </div>
    </div>
  )
}

function Row({ label, value, bold, mono }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">
        {label}
      </span>
      <span className={`text-sm ${bold ? 'font-bold text-[var(--text)]' : 'text-[var(--text-2)]'}
        ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  )
}