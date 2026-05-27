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
      {isLoading ? (
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
                px-4 py-3 flex items-center gap-4">

              {/* Index */}
              <div className="w-6 text-xs font-bold text-[var(--text-3)] shrink-0 text-right">
                {filtered.length - idx}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-[var(--text)]">
                    {receipt.receipt_number}
                  </span>
                  <span className="text-[10px] text-[var(--text-3)]">·</span>
                  <span className="text-xs text-[var(--text-3)]">
                    {receipt.job_number}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-3)] mt-0.5 truncate">
                  {receipt.job_title || 'Instant job'} · {receipt.intake_by_name || '—'}
                </div>
              </div>

              {/* Method badge */}
              <div className={`px-2 py-0.5 rounded border text-[10px] font-bold
                uppercase tracking-wider shrink-0
                ${METHOD_COLORS[receipt.payment_method] || METHOD_COLORS.SPLIT}`}>
                {receipt.payment_method}
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
                onClick={() => window.open(
                  `http://localhost:8000/api/v1/finance/receipts/${receipt.id}/thermal/`,
                  '_blank'
                )}
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

            </div>
          ))}
        </div>
      )}
    </div>
  )
}