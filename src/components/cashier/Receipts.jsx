// src/components/cashier/Receipts.jsx
// Today's receipts issued by the logged-in cashier.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCashierReceipts } from '../../api/cashier'

function fmt(amount) {
  return `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function timeStr(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('en-GH', { day: '2-digit', month: 'short' })
  const time = d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

const METHOD_COLORS = {
  CASH:  'bg-[var(--green-bg)] text-[var(--green-text)] border-[var(--green-border)]',
  MOMO:  'bg-[var(--amber-bg)] text-[var(--amber-text)] border-[var(--amber-border)]',
  POS:   'bg-[var(--blue-bg)] text-[var(--blue-text)] border-[var(--blue-border)]',
  SPLIT: 'bg-[var(--bg)] text-[var(--text-2)] border-[var(--border)]',
}

export default function Receipts() {
  const today = new Date().toISOString().split('T')[0]
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['cashierReceipts', today],
    queryFn: () => getCashierReceipts({ date: today }).then(r => r.data),
    refetchInterval: 30_000,
  })

  const receipts = Array.isArray(data)
    ? data
    : (data?.results || [])

  const filtered = receipts.filter(r =>
    !search ||
    r.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.job_number?.toLowerCase().includes(search.toLowerCase())
  )

  const handlePrint = async (receiptId) => {
    try {
      const res = await fetch(
        `http://localhost:8000/api/v1/finance/receipts/${receiptId}/thermal/`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      )
      const data = await res.json()
      const text = data.text || ''

      const win = window.open('', '_blank', 'width=400,height=600')
      win.document.write(`
        <html><head><title>Receipt</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px;
            white-space: pre; margin: 10px; }
        </style></head>
        <body>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
        </html>`)
      win.document.close()
      win.focus()
      win.print()
      win.close()
    } catch (err) {
      console.error('Print failed:', err)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Receipts</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            Your receipts for today — {today}
          </p>
        </div>
        <div className="px-3 py-1 bg-[var(--panel)] border border-[var(--border)]
          rounded-full text-sm font-semibold text-[var(--text-2)]">
          {receipts.length} issued
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by receipt or job number…"
          className="w-full px-3 py-2.5 bg-[var(--panel)] border border-[var(--border)]
            rounded-lg text-sm text-[var(--text)] outline-none
            focus:border-[var(--border-dark)] transition-colors"
        />
      </div>

      {/* List */}
      {isLoading && !data ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-[var(--panel)] border border-[var(--border)]
              rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-[var(--bg)] flex items-center
            justify-center mb-3">
            <svg className="w-5 h-5 text-[var(--text-3)]" fill="none"
              stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--text-2)]">
            {search ? 'No matching receipts' : 'No receipts yet today'}
          </p>
          <p className="text-xs text-[var(--text-3)] mt-1">
            {search ? 'Try a different search term' : 'Receipts will appear here after payments are confirmed'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((receipt, idx) => (
            <div key={receipt.id}
              className="bg-[var(--panel)] border border-[var(--border)] rounded-xl
                px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">

              {/* Index */}
              <div className="hidden sm:block w-6 text-xs font-bold text-[var(--text-3)] shrink-0 text-right">
                {filtered.length - idx}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {/* Line 1 — receipt + job number */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--text)]">
                    {receipt.receipt_number}
                  </span>
                  <span className="text-[10px] text-[var(--text-3)]">·</span>
                  <span className="font-mono text-xs text-[var(--text-3)]">
                    {receipt.job_number}
                  </span>
                </div>
                {/* Line 2 — services */}
                <div className="text-xs text-[var(--text-3)] mt-0.5 truncate">
                  {receipt.job_title || '—'}
                </div>
                {/* Line 3 — attendant + customer */}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[11px] font-medium
                    ${receipt.customer_name
                      ? 'text-[var(--text)] font-semibold'
                      : 'text-[var(--text-3)]'}`}>
                    {receipt.customer_name || 'Walk-in Customer'}
                  </span>
                  <span className="text-[10px] text-[var(--text-3)]">·</span>
                  <span className="text-[11px] text-[var(--text-3)]">
                    by {receipt.intake_by_name || '—'}
                  </span>
                </div>
              </div>

              {/* Badges + amount + print — row on all screens */}
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="px-2 py-0.5 rounded border text-[10px] font-bold
                  uppercase tracking-wider bg-[var(--bg)] text-[var(--text-3)]
                  border-[var(--border)]">
                  {receipt.job_type || 'INSTANT'}
                </div>
                <div className={`px-2 py-0.5 rounded border text-[10px] font-bold
                  uppercase tracking-wider
                  ${METHOD_COLORS[receipt.payment_method] || METHOD_COLORS.SPLIT}`}>
                  {receipt.payment_method}
                </div>
              </div>

              {/* Amount */}
              <div className="text-right shrink-0">
                <div className="font-mono font-bold text-sm text-[var(--text)]">
                  {fmt(receipt.amount_paid)}
                </div>
                <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                  {timeStr(receipt.created_at)}
                </div>
              </div>

              {/* Print */}
              <button
                onClick={() => handlePrint(receipt.id)}
                title="Print receipt"
                className="shrink-0 w-7 h-7 flex items-center justify-center
                  rounded-lg hover:bg-[var(--bg)] text-[var(--text-3)]
                  hover:text-[var(--text)] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
              </button>
              </div>{/* /badges row */}

            </div>
          ))}
        </div>
      )}
    </div>
  )
}