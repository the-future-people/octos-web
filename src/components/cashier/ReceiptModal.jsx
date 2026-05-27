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

  const handlePrint = async (receiptId) => {
    if (!receiptId) return
    try {
      const res  = await fetch(
        `http://localhost:8000/api/v1/finance/receipts/${receiptId}/thermal/`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      )
      const data = await res.json()
      const text = data.text || ''
      const win  = window.open('', '_blank', 'width=400,height=600')
      win.document.write(`<html><head><title>Receipt</title>
        <style>body{font-family:'Courier New',monospace;font-size:12px;white-space:pre;margin:10px;}</style>
        </head><body>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body></html>`)
      win.document.close()
      win.focus()
      win.print()
      win.close()
    } catch (err) {
      console.error('Print failed:', err)
    }
  }
  
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
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handlePrint(result.receipt_id)}
              className="py-2.5 bg-[var(--bg)] text-[var(--text-2)] text-sm font-semibold
                rounded-xl border border-[var(--border)] hover:border-[var(--border-dark)]
                transition-colors flex items-center justify-center gap-2"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print
            </button>
            <button
              disabled
              title="Coming soon"
              className="py-2.5 bg-[var(--bg)] text-[var(--text-3)] text-sm font-semibold
                rounded-xl border border-[var(--border)] opacity-50 cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 text-[var(--text-3)] text-sm
              hover:text-[var(--text)] transition-colors">
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