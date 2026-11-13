// src/components/bm/Jobs.jsx
import JobFile from './JobFile'
import { usePrefetchJobFile } from './jobFileQuery'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getJobs, getJobStats, getJobReceipt, sendReceiptWhatsApp } from '../../api/bm'
import client from '../../api/client'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function timeAgo(iso) {
  if (!iso) return 'â€”'
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (diff < 1)  return 'Just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return `${Math.floor(diff / 1440)}d ago`
}

function toTitleCase(str) {
  if (!str) return str
  return (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Job titles are joined and truncated at creation, so a long job can
 * lose services twice over — once to the "+N more" baked into the
 * title, again to CSS truncation. Line items are the real record, so
 * read those and collapse repeats: two of the same service is "×2",
 * not the same words printed twice.
 */
function serviceSummary(job) {
  const items = job.line_items || []
  if (!items.length) return job.title || '—'

  const counts = new Map()
  for (const it of items) {
    const name = it.service_name || it.label || 'Service'
    counts.set(name, (counts.get(name) || 0) + 1)
  }

  return [...counts.entries()]
    .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
    .join(', ')
}

const STATUS_CONFIG = {
  DRAFT:               { label: 'Draft',             bg: 'bg-zinc-100',    text: 'text-zinc-600'    },
  PENDING_PAYMENT:     { label: 'Pending Payment',   bg: 'bg-amber-100',   text: 'text-amber-700'   },
  PAID:                { label: 'Paid',               bg: 'bg-blue-100',    text: 'text-blue-700'    },
  CONFIRMED:           { label: 'Confirmed',          bg: 'bg-blue-100',    text: 'text-blue-700'    },
  IN_PROGRESS:         { label: 'In Progress',        bg: 'bg-violet-100',  text: 'text-violet-700'  },
  READY:               { label: 'Ready',              bg: 'bg-emerald-100', text: 'text-emerald-700' },
  COMPLETE:            { label: 'Complete',           bg: 'bg-emerald-100', text: 'text-emerald-700' },
  CANCELLED:           { label: 'Cancelled',          bg: 'bg-red-100',     text: 'text-red-600'     },
  VOIDED:              { label: 'Voided',             bg: 'bg-red-100',     text: 'text-red-600'     },
  HALTED:              { label: 'Halted',             bg: 'bg-red-100',     text: 'text-red-600'     },
  QUEUED:              { label: 'Queued',             bg: 'bg-zinc-100',    text: 'text-zinc-600'    },
  READY_FOR_PAYMENT:   { label: 'Ready for Payment', bg: 'bg-amber-100',   text: 'text-amber-700'   },
  DESIGN_IN_PROGRESS:  { label: 'Design in Progress',bg: 'bg-violet-100',  text: 'text-violet-700'  },
  DESIGN_APPROVED:     { label: 'Design Approved',   bg: 'bg-blue-100',    text: 'text-blue-700'    },
  BRIEFED:             { label: 'Briefed',            bg: 'bg-blue-100',    text: 'text-blue-700'    },
  SAMPLE_SENT:         { label: 'Sample Sent',        bg: 'bg-blue-100',    text: 'text-blue-700'    },
  REVISION_REQUESTED:  { label: 'Revision Requested',bg: 'bg-amber-100',   text: 'text-amber-700'   },
  OUT_FOR_DELIVERY:    { label: 'Out for Delivery',  bg: 'bg-blue-100',    text: 'text-blue-700'    },
  INTAKE_HELD:         { label: 'Intake Held',        bg: 'bg-amber-100',   text: 'text-amber-700'   },
}

const TYPE_CONFIG = {
  INSTANT:    { label: 'Instant',    color: 'text-zinc-700',   bg: 'bg-zinc-100'   },
  PRODUCTION: { label: 'Production', color: 'text-blue-700',   bg: 'bg-blue-100'   },
  DESIGN:     { label: 'Design',     color: 'text-violet-700', bg: 'bg-violet-100' },
}

const WORK_LABELS = {
  RECEIVED:      'Received',
  IN_PRODUCTION: 'In production',
  FINISHING:     'Finishing',
  QUALITY_CHECK: 'Quality check',
  DONE:          'Done',
}

/**
 * A job now holds three states at once. Rather than show three columns,
 * the badge answers one question — what is this job waiting on — by
 * precedence: halted beats unpaid beats unfinished beats uncollected.
 * The full picture lives in the detail view.
 */
function lifecycleState(job) {
  if (job.status === 'CANCELLED') return { label: 'Cancelled', bg: 'bg-red-100',  text: 'text-red-600'  }
  if (job.status === 'DRAFT')     return { label: 'Draft',     bg: 'bg-zinc-100', text: 'text-zinc-600' }
  if (job.status === 'INTAKE_HELD')
    return { label: 'Intake held', bg: 'bg-amber-100', text: 'text-amber-700' }

  const settled = job.payment_state === 'SETTLED'

  if (job.is_halted) {
    return { label: 'Halted', bg: 'bg-red-100', text: 'text-red-600', sub: 'Work stopped' }
  }
  if (job.work_state === 'DONE' && job.handover_state === 'AWAITING_COLLECTION') {
    return {
      label: 'Ready for pickup',
      bg: 'bg-emerald-100', text: 'text-emerald-700',
      sub: settled ? null : 'Balance outstanding',
      subTone: settled ? null : 'text-red-600',
    }
  }
  if (job.handover_state === 'OUT_FOR_DELIVERY') {
    return { label: 'Out for delivery', bg: 'bg-blue-100', text: 'text-blue-700' }
  }
  if (job.handover_state === 'HANDED_OVER') {
    return {
      label: 'Handed over',
      bg: 'bg-zinc-100', text: 'text-zinc-600',
      sub: settled ? null : 'Balance outstanding',
      subTone: settled ? null : 'text-red-600',
    }
  }
  if (!settled) {
    return {
      label: 'Awaiting payment',
      bg: 'bg-amber-100', text: 'text-amber-700',
      sub: job.payment_state === 'DEPOSIT_PAID' ? 'Deposit paid' : null,
    }
  }
  return {
    label: 'In production',
    bg: 'bg-violet-100', text: 'text-violet-700',
    sub: WORK_LABELS[job.work_state] || null,
  }
}

/**
 * One horizontal track per axis. The axes are independent — a job can be
 * part-paid, in finishing and awaiting collection at once — so a single
 * combined track would misrepresent them.
 *
 * Empty circles matter as much as filled ones: the old flat history only
 * listed what had happened, so there was no way to see how far a job still
 * had to go.
 */

function StatusBadge({ job, status }) {
  // Falls back to the legacy status map for callers that still pass a
  // bare status string — receipts and invoices tabs have not migrated.
  if (!job) {
    const c = STATUS_CONFIG[status] || { label: status, bg: 'bg-zinc-100', text: 'text-zinc-600' }
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    )
  }

  const s = lifecycleState(job)
  return (
    <div className="min-w-0">
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
        {s.label}
      </span>
      {s.sub && (
        <div className={`text-[10px] mt-0.5 truncate ${s.subTone || 'text-[var(--text-3)]'}`}>
          {s.sub}
        </div>
      )}
    </div>
  )
}

function ReceiptsTab() {
  const [period, setPeriod] = useState('day')
  const [page, setPage] = useState(1)
  const [activeReceiptId, setActiveReceiptId] = useState(null)
  const [sendingWa, setSendingWa] = useState(false)
  const [waMsg, setWaMsg] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['receipts', period, page],
    queryFn:  () => getJobReceipt(null, { period, page, page_size: 10 }).then(r => r.data),
    staleTime: 15000,
    placeholderData: prev => prev,
  })

  const { data: activeReceipt, isLoading: loadingDetail } = useQuery({
    queryKey: ['receipt-detail', activeReceiptId],
    queryFn:  () => client.get(`/api/v1/finance/receipts/${activeReceiptId}/`).then(r => r.data),
    enabled:  !!activeReceiptId,
    staleTime: 30000,
  })

  const receipts   = Array.isArray(data) ? data : (data?.results || [])
  const count      = data?.count || 0
  const totalPages = Math.ceil(count / 10)

  const handlePrint = async () => {
    if (!activeReceiptId) return
    try {
      const res  = await client.get(`/api/v1/finance/receipts/${activeReceiptId}/thermal/`)
      const text = res.data?.text || ''
      const win  = window.open('', '_blank', 'width=300,height=600')
      if (win) {
        win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt</title>
          <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Courier New',monospace;
          font-size:12px;display:flex;justify-content:center;padding:16px;}pre{white-space:pre-wrap;
          word-break:break-word;width:80mm;font-size:11px;}@media print{@page{margin:8mm;}body{padding:0;}}</style>
          </head><body><pre>${text}</pre></body></html>`)
        win.document.close()
        setTimeout(() => { win.print(); win.close() }, 300)
      }
    } catch { /* silent */ }
  }

  const handleSendWa = async () => {
    if (!activeReceiptId) return
    setSendingWa(true); setWaMsg('')
    try {
      await sendReceiptWhatsApp(activeReceiptId)
      setWaMsg('Sent!')
    } catch { setWaMsg('Failed') }
    finally { setSendingWa(false) }
  }

  const METHOD_COLOR = {
    CASH:   'bg-emerald-100 text-emerald-700 border-emerald-200',
    MOMO:   'bg-amber-100 text-amber-700 border-amber-200',
    POS:    'bg-blue-100 text-blue-700 border-blue-200',
    CREDIT: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  }

  const r = activeReceipt

  return (
    <div className="p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Receipts</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">Branch payment receipts</p>
        </div>
        <div className="flex gap-1 bg-[var(--bg)] p-1 rounded-xl">
          {[
            { value: 'day',   label: 'Today'     },
            { value: 'week',  label: 'This Week'  },
            { value: 'month', label: 'This Month' },
          ].map(f => (
            <button key={f.value} onClick={() => { setPeriod(f.value); setPage(1); setActiveReceiptId(null) }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors
                ${period === f.value
                  ? 'bg-[var(--text)] text-white'
                  : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex border border-[var(--border)] rounded-2xl overflow-hidden min-h-[520px]">
        <div className="w-72 shrink-0 border-r border-[var(--border)] flex flex-col bg-[var(--panel)]">
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-[var(--text-3)]">Loading…</div>
            ) : receipts.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--text-3)]">No receipts for this period</div>
            ) : receipts.map(r => (
              <div key={r.id} onClick={() => { setActiveReceiptId(r.id); setWaMsg('') }}
                className={`px-4 py-3 border-b border-[var(--border)] cursor-pointer transition-colors
                  ${activeReceiptId === r.id
                    ? 'bg-[var(--bg)] border-l-2 border-l-[var(--text)]'
                    : 'hover:bg-[var(--bg)]'
                  }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-[var(--text)] truncate">
                    {r.receipt_number}
                  </span>
                  <span className="font-mono text-sm font-bold text-[var(--text)] ml-2 shrink-0">
                    {fmt(r.amount_paid)}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-2)] font-medium truncate mb-1">
                  {r.customer_name || 'Walk-in'}
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border
                    ${METHOD_COLOR[r.payment_method] || METHOD_COLOR.CREDIT}`}>
                    {r.payment_method}
                  </span>
                  <span className="text-[10px] text-[var(--text-3)] font-mono">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
                      : 'â€”'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="shrink-0 px-3 py-2.5 border-t border-[var(--border)] bg-[var(--bg)]
              flex items-center justify-between">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-2.5 py-1 text-xs font-bold border border-[var(--border)]
                  rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">
                ← Prev
              </button>
              <span className="text-[10px] font-mono text-[var(--text-3)]">
                {(page-1)*10+1}—{Math.min(page*10, count)} of {count}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-2.5 py-1 text-xs font-bold border border-[var(--border)]
                  rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">
                Next →
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col bg-[var(--bg)] overflow-hidden">
          {!activeReceiptId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-3)] p-10">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span className="text-sm">Select a receipt to view details</span>
            </div>
          ) : loadingDetail ? (
            <div className="flex-1 flex items-center justify-center text-[var(--text-3)]">Loading…</div>
          ) : r ? (
            <>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <div className="flex items-start justify-between pb-4 border-b border-[var(--border)]">
                  <div>
                    <div className="font-black text-lg text-[var(--text)]">{r.receipt_number}</div>
                    <div className="text-xs text-[var(--text-3)] mt-0.5">
                      {r.created_at ? new Date(r.created_at).toLocaleString('en-GH', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      }) : 'â€”'}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                    PAID
                  </span>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">Job</div>
                  <div className="text-sm font-bold text-[var(--text)]">{r.job_title || 'â€”'}</div>
                  <div className="font-mono text-xs text-[var(--text-3)] mt-0.5">{r.job_number}</div>
                </div>
                {r.line_items?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">Services</div>
                    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
                      {r.line_items.map((li, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5
                          border-b border-[var(--border)] last:border-0">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-[var(--text)]">{li.service_name}</div>
                            <div className="text-[10px] text-[var(--text-3)]">
                              {li.pages}pp × {li.sets} sets · {li.is_color ? 'Colour' : 'B&W'}
                            </div>
                          </div>
                          <span className="font-mono text-xs font-bold text-[var(--text)] ml-3">
                            {fmt(li.line_total)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg)]">
                        <span className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">Subtotal</span>
                        <span className="font-mono text-sm font-black text-[var(--text)]">{fmt(r.subtotal || r.amount_paid)}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className={`px-4 py-3 rounded-xl border space-y-2
                  ${METHOD_COLOR[r.payment_method] || 'bg-zinc-50 border-zinc-200'}`}>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1">Payment Settlement</div>
                  {[
                    ['Amount Paid',   fmt(r.amount_paid),   true ],
                    r.cash_tendered && parseFloat(r.cash_tendered) > 0 ? ['Cash Tendered', fmt(r.cash_tendered), false] : null,
                    r.change_given  && parseFloat(r.change_given)  > 0 ? ['Change Given',  fmt(r.change_given),  false] : null,
                    r.balance_due   && parseFloat(r.balance_due)   > 0 ? ['Balance Due',   fmt(r.balance_due),   false] : null,
                  ].filter(Boolean).map(([label, val, strong]) => (
                    <div key={label} className={`flex items-center justify-between
                      ${strong ? 'pt-2 border-t border-current/20' : ''}`}>
                      <span className={`text-xs ${strong ? 'font-bold' : 'font-medium'}`}>{label}</span>
                      <span className={`font-mono ${strong ? 'text-base font-black' : 'text-sm font-semibold'}`}>{val}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border
                    ${METHOD_COLOR[r.payment_method] || METHOD_COLOR.CREDIT}`}>
                    {r.payment_method}
                  </span>
                  {r.momo_reference && (
                    <span className="text-xs text-[var(--text-3)]">Ref: <span className="font-mono font-semibold text-[var(--text)]">{r.momo_reference}</span></span>
                  )}
                  {r.pos_approval_code && (
                    <span className="text-xs text-[var(--text-3)]">Approval: <span className="font-mono font-semibold text-[var(--text)]">{r.pos_approval_code}</span></span>
                  )}
                </div>
                <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-2">
                  <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1">People</div>
                  {[
                    ['Customer',  r.customer_name || 'Walk-in'],
                    r.customer_phone ? ['Phone', r.customer_phone] : null,
                    ['Cashier',   r.cashier_name  || 'â€”'],
                    ['Attendant', r.intake_by_name || 'â€”'],
                  ].filter(Boolean).map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between border-b border-[var(--border)] pb-1.5 last:border-0 last:pb-0">
                      <span className="text-xs text-[var(--text-3)]">{label}</span>
                      <span className="text-xs font-semibold text-[var(--text)]">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="shrink-0 px-6 py-4 border-t border-[var(--border)] bg-[var(--panel)] flex gap-3">
                <button onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5
                    bg-[var(--text)] text-white text-sm font-bold rounded-xl
                    hover:opacity-90 transition-opacity">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                  Print
                </button>
                {r.customer_phone && (
                  <button onClick={handleSendWa} disabled={sendingWa}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5
                      bg-[#25D366] text-white text-sm font-bold rounded-xl
                      hover:opacity-90 disabled:opacity-40 transition-opacity">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    {sendingWa ? 'Sending…' : 'WhatsApp'}
                  </button>
                )}
                {waMsg && (
                  <span className={`text-xs font-bold self-center
                    ${waMsg === 'Sent!' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {waMsg}
                  </span>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const QUEUE_FILTERS = [
  { value: 'ALL',              label: 'All'              },
  { value: 'awaiting_payment', label: 'Awaiting Payment' },
  { value: 'in_production',    label: 'In Production'    },
  { value: 'ready_for_pickup', label: 'Ready for Pickup' },
  { value: 'halted',           label: 'Halted'           },
  { value: 'handed_over',      label: 'Handed Over'      },
]

const TYPE_FILTERS = [
  { value: 'ALL',        label: 'All Types'  },
  { value: 'INSTANT',    label: 'Instant'    },
  { value: 'PRODUCTION', label: 'Production' },
  { value: 'DESIGN',     label: 'Design'     },
]

export default function Jobs({ focus = null, onOpenChat } = {}) {
  const [tab, setTab] = useState('jobs')
  const [queue, setQueue] = useState('ALL')
  const [jobType, setJobType] = useState('ALL')
  const [period, setPeriod] = useState('day')
  const [page, setPage] = useState(1)
  // Opened from a workload page: start with that job's panel open (13 Nov 2026).
  const [selectedId, setSelectedId] = useState(focus?.id ?? null)
  const prefetchJob = usePrefetchJobFile()

  const { data: statsData } = useQuery({
    queryKey: ['jobStats', period, jobType],
    queryFn:  () => getJobStats({
      period:   period  || undefined,
      job_type: jobType !== 'ALL' ? jobType : undefined,
    }).then(r => r.data),
    refetchInterval: 30000,
    staleTime: 30000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', queue, jobType, period, page],
    queryFn:  () => getJobs({
      queue:    queue    !== 'ALL' ? queue    : undefined,
      job_type: jobType  !== 'ALL' ? jobType  : undefined,
      period:   period   || undefined,
      page,
      page_size: 20,
    }).then(r => r.data),
    staleTime: 15000,
    placeholderData: prev => prev,
  })

  const jobs       = Array.isArray(data) ? data : (data?.results || [])
  const count      = data?.count || 0
  const totalPages = Math.ceil(count / 20)
  const stats = statsData || {}

  const handleQueue = (v) => { setQueue(v); setPage(1) }
  const handleType   = (v) => { setJobType(v); setPage(1) }
  const handlePeriod = (v) => { setPeriod(v); setPage(1) }

  return (
    <div className="flex flex-col">
      <div className="flex gap-1 bg-[var(--panel)] border border-[var(--border)] p-1 rounded-2xl mx-5 sm:mx-6 mt-5 sm:mt-6">
        {[
          { value: 'jobs',     label: 'Jobs'     },
          { value: 'receipts', label: 'Receipts' },
        ].map(t => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-colors
              ${tab === t.value
                ? 'bg-[var(--text)] text-white shadow-sm'
                : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
              }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'receipts' && <ReceiptsTab />}
      {tab === 'jobs' && (
        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--text)]">Jobs</h2>
              <p className="text-xs text-[var(--text-3)] mt-0.5">
                {count > 0 ? `${count.toLocaleString()} jobs` : 'All branch jobs'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: 'Total',            value: stats.total,            color: 'text-[var(--text)]', border: 'border-t-zinc-400',    q: 'ALL'              },
              { label: 'Awaiting Payment', value: stats.awaiting_payment, color: 'text-amber-600',     border: 'border-t-amber-400',   q: 'awaiting_payment' },
              { label: 'In Production',    value: stats.in_production,    color: 'text-violet-600',    border: 'border-t-violet-500',  q: 'in_production'    },
              { label: 'Ready for Pickup', value: stats.ready_for_pickup, color: 'text-emerald-600',   border: 'border-t-emerald-500', q: 'ready_for_pickup' },
              { label: 'Halted',           value: stats.halted,           color: 'text-red-500',       border: 'border-t-red-400',     q: 'halted'           },
              { label: 'Handed Over',      value: stats.handed_over,      color: 'text-[var(--text-2)]', border: 'border-t-zinc-300',  q: 'handed_over'      },
            ].map(c => (
              <button key={c.label} onClick={() => handleQueue(c.q)}
                className={`bg-[var(--panel)] border border-t-2 ${c.border} rounded-xl px-3 py-3 text-center
                  transition-colors cursor-pointer
                  ${queue === c.q ? 'border-[var(--border-dark)]' : 'border-[var(--border)] hover:border-[var(--border-dark)]'}`}>
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">{c.label}</div>
                <div className={`font-mono font-black text-xl ${c.color}`}>{c.value ?? '—'}</div>
              </button>
            ))}
          </div>

          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-3 space-y-3">
            <div className="flex gap-1 bg-[var(--bg)] p-1 rounded-xl">
              {[
                { value: 'day',   label: 'Today'     },
                { value: 'week',  label: 'This Week'  },
                { value: 'month', label: 'This Month' },
                { value: '',      label: 'All Time'   },
              ].map(f => (
                <button key={f.value} onClick={() => handlePeriod(f.value)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors
                    ${period === f.value
                      ? 'bg-[var(--text)] text-white shadow-sm'
                      : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                    }`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1 flex-wrap">
                {QUEUE_FILTERS.map(f => (
                  <button key={f.value} onClick={() => handleQueue(f.value)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors whitespace-nowrap
                      ${queue === f.value
                        ? 'bg-zinc-800 text-white border-transparent'
                        : 'border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)] hover:border-[var(--border-dark)]'
                      }`}>
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="w-px h-4 bg-[var(--border)] shrink-0" />
              <div className="flex gap-1 justify-center">
                {TYPE_FILTERS.map(f => (
                  <button key={f.value} onClick={() => handleType(f.value)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors
                      ${jobType === f.value
                        ? 'bg-blue-600 text-white border-transparent'
                        : 'border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)] hover:border-[var(--border-dark)]'
                      }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoading && !data ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse" />)}
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
              flex flex-col items-center justify-center py-16">
              <p className="text-sm font-semibold text-[var(--text-2)]">No jobs found</p>
              <p className="text-xs text-[var(--text-3)] mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-12 px-4 py-2
                text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
                <span className="col-span-5">Job</span>
                <span className="col-span-2">Customer</span>
                <span className="col-span-2">Status</span>
                <span className="col-span-1">Type</span>
                <span className="col-span-1 text-right">Amount</span>
                <span className="col-span-1 text-right">When</span>
              </div>
              <div className="space-y-1.5">
                {jobs.map(job => (
                  <div key={job.id}
                    onMouseEnter={() => prefetchJob(job.id)} onClick={() => setSelectedId(job.id)}
                    className="bg-[var(--panel)] border border-[var(--border)] rounded-xl
                      px-4 py-3 cursor-pointer hover:border-[var(--border-dark)] transition-colors">
                    <div className="flex items-center justify-between sm:hidden">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[var(--text)]">{job.job_number}</span>
                          <StatusBadge job={job} />
                        </div>
                        <div className="text-xs text-[var(--text-3)] mt-0.5 truncate">
                          {job.title} · {toTitleCase(job.customer_name) || 'Walk-in'}
                        </div>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <div className="font-mono text-sm font-bold text-[var(--text)]">{fmt(job.estimated_cost)}</div>
                        <div className="text-[10px] text-[var(--text-3)]">{timeAgo(job.created_at)}</div>
                      </div>
                    </div>
                    <div className="hidden sm:grid grid-cols-12 items-center gap-1">
                      <div className="col-span-5 min-w-0">
                        <div className="font-mono text-[10px] font-bold text-[var(--text-3)]">{job.job_number}</div>
                        <div className="text-xs font-semibold text-[var(--text)] mt-0.5 line-clamp-2 leading-snug">
                          {serviceSummary(job)}
                        </div>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <div className="text-xs text-[var(--text-2)] truncate">
                          {toTitleCase(job.customer_name) || 'Walk-in'}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <StatusBadge job={job} />
                      </div>
                      <div className="col-span-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded
                          ${TYPE_CONFIG[job.job_type]?.bg} ${TYPE_CONFIG[job.job_type]?.color}`}>
                          {TYPE_CONFIG[job.job_type]?.label || job.job_type}
                        </span>
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="font-mono text-xs font-bold text-[var(--text)]">{fmt(job.estimated_cost)}</span>
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="text-[10px] text-[var(--text-3)]">{timeAgo(job.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-[var(--text-3)]">
                    Page {page} of {totalPages} · {count.toLocaleString()} jobs
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)] border border-[var(--border)]
                        rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">← Prev</button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)] border border-[var(--border)]
                        rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
          {selectedId && (
            <JobFile jobId={selectedId} onClose={() => setSelectedId(null)} onOpenChat={onOpenChat} />
          )}
        </div>
      )}
    </div>
  )
}