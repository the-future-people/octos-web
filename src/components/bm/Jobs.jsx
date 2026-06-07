// src/components/bm/Jobs.jsx
import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { getJobs, getJobStats, getJobDetail, transitionJob, getJobReceipt, sendReceiptWhatsApp, getJobInvoices, createInvoice, sendInvoice, getInvoicePdfUrl, getServices, calculatePrice, getCustomers } from '../../api/bm'
import { invalidateAfterJobTransitioned } from '../../api/invalidations'
import { useAuth } from '../../context/AuthContext'
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
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
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

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || { label: status, bg: 'bg-zinc-100', text: 'text-zinc-600' }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

function ReceiptInvoiceSection({ job }) {
  const [tab, setTab] = useState('receipt')
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_type:     'PROFORMA',
    bill_to_name:     job.customer_name || '',
    bill_to_phone:    job.customer_phone || '',
    bill_to_email:    '',
    bill_to_company:  '',
    delivery_channel: 'DOWNLOAD',
    bm_note:          '',
  })
  const [invoiceError, setInvoiceError] = useState('')
  const [sendingWa, setSendingWa] = useState(false)
  const [waMsg, setWaMsg] = useState('')
  const queryClient = useQueryClient()

  const { data: receiptData } = useQuery({
    queryKey: ['job-receipt', job.id],
    queryFn:  () => getJobReceipt(job.id).then(r => r.data),
    staleTime: 30000,
  })

  const { data: invoiceData } = useQuery({
    queryKey: ['job-invoices', job.id],
    queryFn:  () => getJobInvoices(job.id).then(r => r.data),
    staleTime: 30000,
  })

  const receipts = Array.isArray(receiptData) ? receiptData : (receiptData?.results || [])
  const invoices = Array.isArray(invoiceData) ? invoiceData : (invoiceData?.results || [])
  const receipt  = receipts[0] || null
  const invoice  = invoices[0] || null

  const { mutate: createInv, isPending: creatingInv } = useMutation({
    mutationFn: (payload) => createInvoice(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-invoices', job.id] })
      setShowInvoiceForm(false)
      setInvoiceError('')
    },
    onError: (err) => {
      const d = err.response?.data
      setInvoiceError(d?.detail || 'Failed to create invoice.')
    },
  })

  const { mutate: resendInv, isPending: resendingInv } = useMutation({
    mutationFn: (id) => sendInvoice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-invoices', job.id] }),
  })

  const handleSendWa = async () => {
    if (!receipt) return
    setSendingWa(true)
    setWaMsg('')
    try {
      await sendReceiptWhatsApp(receipt.id)
      setWaMsg('Sent!')
    } catch {
      setWaMsg('Failed')
    } finally {
      setSendingWa(false)
    }
  }

  const handleCreateInvoice = () => {
    setInvoiceError('')
    createInv({
      job_id:           job.id,
      invoice_type:     invoiceForm.invoice_type,
      bill_to_name:     invoiceForm.bill_to_name,
      bill_to_phone:    invoiceForm.bill_to_phone,
      bill_to_email:    invoiceForm.bill_to_email,
      bill_to_company:  invoiceForm.bill_to_company,
      delivery_channel: invoiceForm.delivery_channel,
      bm_note:          invoiceForm.bm_note,
    })
  }

  return (
    <div>
      <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">
        Receipt & Invoice
      </div>
      <div className="flex gap-1 bg-[var(--bg)] p-1 rounded-xl mb-3">
        {['receipt', 'invoice'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors capitalize
              ${tab === t
                ? 'bg-[var(--text)] text-white'
                : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
              }`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'receipt' && (
        <div>
          {!receipt ? (
            <div className="px-3 py-4 bg-[var(--bg)] border border-[var(--border)]
              rounded-xl text-xs text-[var(--text-3)] text-center">
              No receipt yet â€” payment not confirmed
            </div>
          ) : (
            <div className="px-3 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text)]">{receipt.receipt_number}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  {receipt.payment_method}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-3)]">Amount paid</span>
                <span className="font-mono text-xs font-bold text-[var(--text)]">
                  {fmt(receipt.amount_paid)}
                </span>
              </div>
              {receipt.customer_name && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-3)]">Customer</span>
                  <span className="text-xs text-[var(--text)]">{receipt.customer_name}</span>
                </div>
              )}
              {receipt.customer_phone && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-3)]">Phone</span>
                  <span className="text-xs text-[var(--text)]">{receipt.customer_phone}</span>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={handleSendWa} disabled={sendingWa}
                  className="flex-1 py-2 text-xs font-bold bg-emerald-600 text-white
                    rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity">
                  {sendingWa ? 'Sending…' : 'ðŸ“² Send WhatsApp'}
                </button>
              </div>
              {waMsg && (
                <div className={`text-xs text-center font-semibold
                  ${waMsg === 'Sent!' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {waMsg}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {tab === 'invoice' && (
        <div className="space-y-2">
          {invoice ? (
            <div className="px-3 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text)]">{invoice.invoice_number}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {invoice.invoice_type}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-3)]">Total</span>
                <span className="font-mono text-xs font-bold text-[var(--text)]">
                  {fmt(invoice.total)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-3)]">Status</span>
                <span className="text-xs font-semibold text-[var(--text)]">{invoice.status}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <a href={getInvoicePdfUrl(invoice.id)} target="_blank" rel="noreferrer"
                  className="flex-1 py-2 text-xs font-bold bg-[var(--text)] text-white
                    rounded-lg hover:opacity-90 transition-opacity text-center">
                  â¬‡ Download PDF
                </a>
                <button onClick={() => resendInv(invoice.id)} disabled={resendingInv}
                  className="flex-1 py-2 text-xs font-bold border border-[var(--border)]
                    text-[var(--text)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-40
                    transition-colors">
                  {resendingInv ? 'Sending…' : 'Resend'}
                </button>
              </div>
            </div>
          ) : showInvoiceForm ? (
            <div className="px-3 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-2">
              <div className="flex gap-1">
                {['PROFORMA', 'TAX'].map(t => (
                  <button key={t} onClick={() => setInvoiceForm(f => ({ ...f, invoice_type: t }))}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-colors
                      ${invoiceForm.invoice_type === t
                        ? 'bg-[var(--text)] text-white border-transparent'
                        : 'border-[var(--border)] text-[var(--text-3)]'
                      }`}>
                    {t}
                  </button>
                ))}
              </div>
              {[
                { key: 'bill_to_name',    placeholder: 'Bill to name *'    },
                { key: 'bill_to_phone',   placeholder: 'Phone'             },
                { key: 'bill_to_email',   placeholder: 'Email'             },
                { key: 'bill_to_company', placeholder: 'Company (optional)'},
              ].map(f => (
                <input key={f.key} type="text" placeholder={f.placeholder}
                  value={invoiceForm[f.key]}
                  onChange={e => setInvoiceForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full px-2.5 py-2 text-xs bg-[var(--panel)] border border-[var(--border)]
                    rounded-lg outline-none focus:border-[var(--border-dark)]"
                />
              ))}
              <select value={invoiceForm.delivery_channel}
                onChange={e => setInvoiceForm(f => ({ ...f, delivery_channel: e.target.value }))}
                className="w-full px-2.5 py-2 text-xs bg-[var(--panel)] border border-[var(--border)]
                  rounded-lg outline-none">
                <option value="DOWNLOAD">Download only</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="BOTH">WhatsApp + Email</option>
              </select>
              <textarea placeholder="BM note (optional)" rows={2}
                value={invoiceForm.bm_note}
                onChange={e => setInvoiceForm(f => ({ ...f, bm_note: e.target.value }))}
                className="w-full px-2.5 py-2 text-xs bg-[var(--panel)] border border-[var(--border)]
                  rounded-lg outline-none resize-none"
              />
              {invoiceError && (
                <div className="text-xs text-red-500 font-semibold">{invoiceError}</div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setShowInvoiceForm(false)}
                  className="flex-1 py-2 text-xs font-bold border border-[var(--border)]
                    text-[var(--text-2)] rounded-lg hover:bg-[var(--bg)] transition-colors">
                  Cancel
                </button>
                <button onClick={handleCreateInvoice} disabled={creatingInv || !invoiceForm.bill_to_name}
                  className="flex-1 py-2 text-xs font-bold bg-[var(--text)] text-white
                    rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity">
                  {creatingInv ? 'Creating…' : 'Create Invoice'}
                </button>
              </div>
            </div>
          ) : (
            <div className="px-3 py-4 bg-[var(--bg)] border border-[var(--border)]
              rounded-xl text-center space-y-2">
              <p className="text-xs text-[var(--text-3)]">No invoice for this job</p>
              <button onClick={() => setShowInvoiceForm(true)}
                className="px-4 py-2 text-xs font-bold bg-[var(--text)] text-white
                  rounded-lg hover:opacity-90 transition-opacity">
                + Create Invoice
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function JobDetailPanel({ jobId, onClose }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')

  const { data: job, isLoading } = useQuery({
    queryKey: ['job-detail', jobId],
    queryFn:  () => getJobDetail(jobId).then(r => r.data),
    staleTime: 10000,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: ({ to_status, notes }) => transitionJob(jobId, { to_status, notes }),
    onSuccess: () => {
      invalidateAfterJobTransitioned(queryClient, jobId)
      setError('')
    },
    onError: (err) => {
      const d = err.response?.data
      setError(d?.detail || 'Transition failed.')
    },
  })

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[var(--panel)] w-full max-w-lg max-h-[90vh]
        flex flex-col overflow-hidden shadow-2xl rounded-2xl animate-slideUp">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <div className="font-black text-base text-[var(--text)]">
              {isLoading ? 'Loading…' : job?.job_number}
            </div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">
              {isLoading ? '' : job?.title}
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full
              hover:bg-[var(--bg)] text-[var(--text-3)] transition-colors">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {isLoading && !job ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-[var(--bg)] rounded-xl animate-pulse" />)}
            </div>
          ) : job ? (<>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={job.status} />
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                ${TYPE_CONFIG[job.job_type]?.bg} ${TYPE_CONFIG[job.job_type]?.color}`}>
                {TYPE_CONFIG[job.job_type]?.label || job.job_type}
              </span>
              {job.is_routed && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  Routed Out
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Customer',    value: toTitleCase(job.customer_name) || 'Walk-in' },
                { label: 'Intake By',   value: toTitleCase(job.intake_by_name) || 'â€”'      },
                { label: 'Channel',     value: job.intake_channel || 'â€”'                   },
                { label: 'Created',     value: timeAgo(job.created_at)                     },
                { label: 'Est. Cost',   value: fmt(job.estimated_cost),  highlight: true   },
                { label: 'Amount Paid', value: fmt(job.amount_paid),     highlight: true   },
              ].map(item => (
                <div key={item.label}
                  className={`px-3 py-2.5 rounded-xl border ${item.highlight ? 'bg-emerald-50 border-emerald-100' : 'bg-[var(--bg)] border-[var(--border)]'}`}>
                  <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-0.5">{item.label}</div>
                  <div className={`text-sm font-bold ${item.highlight ? 'text-emerald-700 font-mono' : 'text-[var(--text)]'}`}>{item.value}</div>
                </div>
              ))}
            </div>
            {job.line_items?.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">Services</div>
                <div className="space-y-1.5">
                  {job.line_items.map(li => (
                    <div key={li.id} className="flex items-center justify-between px-3 py-2.5
                      bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[var(--text)]">{li.label || li.service_name}</div>
                        <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                          {li.quantity} × {li.pages}pp · {li.is_color ? 'Colour' : 'B&W'}
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-[var(--text)] ml-3">
                        {fmt(li.line_total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {job.allowed_transitions?.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">Actions</div>
                <div className="flex flex-wrap gap-2">
                  {job.allowed_transitions.map(t => (
                    <button key={t.to_status}
                      onClick={() => {
                        setError('')
                        mutate({ to_status: t.to_status })
                      }}
                      disabled={isPending}
                      className="px-3 py-2 text-xs font-bold bg-[var(--text)] text-white
                        rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                      {t.label || t.to_status.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
                {error && (
                  <div className="mt-2 px-3 py-2 bg-[var(--red-bg)] border border-[var(--red-border)]
                    rounded-lg text-xs text-[var(--red-text)]">{error}</div>
                )}
              </div>
            )}
            {job.status_logs?.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">History</div>
                <div className="space-y-1">
                  {job.status_logs.slice(0, 8).map(log => (
                    <div key={log.id} className="flex items-center gap-3 px-3 py-2
                      bg-[var(--bg)] border border-[var(--border)] rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[var(--text-2)]">
                          <span className="text-[var(--text-3)]">{log.from_status?.replace(/_/g,' ')}</span>
                          {' â†’ '}
                          <span className="font-semibold text-[var(--text)]">{log.to_status?.replace(/_/g,' ')}</span>
                        </div>
                        {log.actor_name && (
                          <div className="text-[10px] text-[var(--text-3)] mt-0.5">{toTitleCase(log.actor_name)}</div>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--text-3)] shrink-0">
                        {timeAgo(log.transitioned_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {job.notes && (
              <div className="px-3 py-3 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Notes</div>
                <div className="text-xs text-amber-800">{job.notes}</div>
              </div>
            )}
            <ReceiptInvoiceSection job={job} />
          </>) : (
            <div className="text-sm text-[var(--text-3)] text-center py-8">Job not found</div>
          )}
        </div>
      </div>
    </div>,
    document.body
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
                â† Prev
              </button>
              <span className="text-[10px] font-mono text-[var(--text-3)]">
                {(page-1)*10+1}â€“{Math.min(page*10, count)} of {count}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-2.5 py-1 text-xs font-bold border border-[var(--border)]
                  rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">
                Next â†’
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

const STATUS_FILTERS = [
  { value: 'ALL',             label: 'All'             },
  { value: 'PENDING_PAYMENT', label: 'Pending Payment' },
  { value: 'IN_PROGRESS',     label: 'In Progress'     },
  { value: 'READY',           label: 'Ready'           },
  { value: 'COMPLETE',        label: 'Complete'        },
  { value: 'CANCELLED',       label: 'Cancelled'       },
]

const TYPE_FILTERS = [
  { value: 'ALL',        label: 'All Types'  },
  { value: 'INSTANT',    label: 'Instant'    },
  { value: 'PRODUCTION', label: 'Production' },
  { value: 'DESIGN',     label: 'Design'     },
]

export default function Jobs() {
  const [tab, setTab] = useState('jobs')
  const [status, setStatus] = useState('ALL')
  const [jobType, setJobType] = useState('ALL')
  const [period, setPeriod] = useState('day')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(null)

  const { data: statsData } = useQuery({
    queryKey: ['jobStats', period, jobType],
    queryFn:  () => getJobStats({
      period:   period  || undefined,
      job_type: jobType !== 'ALL' ? jobType : undefined,
    }).then(r => r.data),
    refetchInterval: 30000,
    staleTime: 0,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', status, jobType, period, page],
    queryFn:  () => getJobs({
      status:   status   !== 'ALL' ? status   : undefined,
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

  const handleStatus = (v) => { setStatus(v); setPage(1) }
  const handleType   = (v) => { setJobType(v); setPage(1) }
  const handlePeriod = (v) => { setPeriod(v); setPage(1) }

  return (
    <div className="flex flex-col">
      <div className="flex gap-1 bg-[var(--panel)] border border-[var(--border)] p-1 rounded-2xl mx-5 sm:mx-6 mt-5 sm:mt-6">
        {[
          { value: 'jobs',     label: 'Jobs'     },
          { value: 'receipts', label: 'Receipts' },
          { value: 'invoices', label: 'Invoices' },
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
      {tab === 'invoices' && <InvoicesTab />}
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
              { label: 'Total',      value: stats.total,      color: 'text-[var(--text)]',    border: 'border-t-zinc-400'    },
              { label: 'Complete',   value: stats.complete,   color: 'text-emerald-600',       border: 'border-t-emerald-500' },
              { label: 'In Progress',value: stats.in_progress,color: 'text-violet-600',        border: 'border-t-violet-500'  },
              { label: 'Pending',    value: stats.pending,    color: 'text-amber-600',         border: 'border-t-amber-400'   },
              { label: 'Cancelled',  value: stats.cancelled,  color: 'text-red-500',           border: 'border-t-red-400'     },
              { label: 'Walk-in',    value: stats.walkin,     color: 'text-blue-600',          border: 'border-t-blue-400'    },
            ].map(c => (
              <div key={c.label}
                className={`bg-[var(--panel)] border border-[var(--border)] border-t-2 ${c.border} rounded-xl px-3 py-3 text-center`}>
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">{c.label}</div>
                <div className={`font-mono font-black text-xl ${c.color}`}>{c.value ?? 'â€”'}</div>
              </div>
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
                {STATUS_FILTERS.map(f => (
                  <button key={f.value} onClick={() => handleStatus(f.value)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors whitespace-nowrap
                      ${status === f.value
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
                <span className="col-span-2">Job No.</span>
                <span className="col-span-3">Title</span>
                <span className="col-span-2">Customer</span>
                <span className="col-span-2">Status</span>
                <span className="col-span-1">Type</span>
                <span className="col-span-1 text-right">Amount</span>
                <span className="col-span-1 text-right">When</span>
              </div>
              <div className="space-y-1.5">
                {jobs.map(job => (
                  <div key={job.id}
                    onClick={() => setSelectedId(job.id)}
                    className="bg-[var(--panel)] border border-[var(--border)] rounded-xl
                      px-4 py-3 cursor-pointer hover:border-[var(--border-dark)] transition-colors">
                    <div className="flex items-center justify-between sm:hidden">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[var(--text)]">{job.job_number}</span>
                          <StatusBadge status={job.status} />
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
                      <div className="col-span-2">
                        <span className="font-mono text-xs font-bold text-[var(--text)]">{job.job_number}</span>
                      </div>
                      <div className="col-span-3 min-w-0">
                        <div className="text-xs font-semibold text-[var(--text)] truncate">{job.title}</div>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <div className="text-xs text-[var(--text-2)] truncate">
                          {toTitleCase(job.customer_name) || 'Walk-in'}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <StatusBadge status={job.status} />
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
                        rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">â† Prev</button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)] border border-[var(--border)]
                        rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">Next â†’</button>
                  </div>
                </div>
              )}
            </>
          )}
          {selectedId && (
            <JobDetailPanel jobId={selectedId} onClose={() => setSelectedId(null)} />
          )}
        </div>
      )}
    </div>
  )
}

// â”€â”€ Invoices Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function InvoicesTab() {
  const queryClient = useQueryClient()
  const [period,      setPeriod]      = useState('')
  const [page,        setPage]        = useState(1)
  const [showCreate,  setShowCreate]  = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', period, page],
    queryFn:  () => client.get('/api/v1/finance/invoices/', {
      params: { period: period || undefined, page, page_size: 10 }
    }).then(r => r.data),
    staleTime: 15_000,
    placeholderData: prev => prev,
  })

  const invoices   = Array.isArray(data) ? data : (data?.results || [])
  const count      = data?.count || 0
  const totalPages = Math.ceil(count / 10)

  const { mutate: resend, isPending: resending } = useMutation({
    mutationFn: (id) => sendInvoice(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  })

  const STATUS_COLOR = {
    DRAFT:  'bg-zinc-100 text-zinc-600',
    SENT:   'bg-blue-100 text-blue-700',
    VIEWED: 'bg-amber-100 text-amber-700',
    PAID:   'bg-emerald-100 text-emerald-700',
  }

  const handleDownload = async (id, invoiceNumber) => {
    try {
      const res  = await client.get(`/api/v1/finance/invoices/${id}/pdf/`, { responseType: 'blob' })
      const url  = URL.createObjectURL(res.data)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${invoiceNumber}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* silent */ }
  }

  return (
    <div className="p-5 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Invoices</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">{count} invoice{count !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-[var(--bg)] p-1 rounded-xl">
            {[
              { value: '',      label: 'All'        },
              { value: 'day',   label: 'Today'      },
              { value: 'week',  label: 'This Week'  },
              { value: 'month', label: 'This Month' },
            ].map(f => (
              <button key={f.value} onClick={() => { setPeriod(f.value); setPage(1) }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors
                  ${period === f.value
                    ? 'bg-[var(--text)] text-white'
                    : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                  }`}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-[var(--text)] text-white text-xs font-bold
              rounded-xl hover:opacity-90 transition-opacity">
            + New Invoice
          </button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse" />)}
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-semibold text-[var(--text-2)]">No invoices yet</p>
          <p className="text-xs text-[var(--text-3)] mt-1">Create your first invoice above</p>
        </div>
      ) : (
        <>
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="hidden sm:grid grid-cols-12 px-5 py-2.5 border-b border-[var(--border)]
              text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
              <span className="col-span-3">Invoice No</span>
              <span className="col-span-2">Type</span>
              <span className="col-span-3">Bill To</span>
              <span className="col-span-2 text-right">Amount</span>
              <span className="col-span-1">Status</span>
              <span className="col-span-1 text-right">Actions</span>
            </div>
            {invoices.map(inv => (
              <div key={inv.id} className="grid grid-cols-12 px-5 py-3 border-b border-[var(--border)]
                last:border-0 items-center hover:bg-[var(--bg)] transition-colors">
                <div className="col-span-6 sm:col-span-3">
                  <span className="font-mono text-xs font-bold text-[var(--text)]">{inv.invoice_number}</span>
                  <div className="text-[10px] text-[var(--text-3)] mt-0.5">{inv.issue_date}</div>
                </div>
                <div className="hidden sm:block col-span-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                    ${inv.invoice_type === 'PROFORMA' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                    {inv.invoice_type}
                  </span>
                </div>
                <div className="hidden sm:block col-span-3 min-w-0">
                  <div className="text-xs font-semibold text-[var(--text)] truncate">{inv.bill_to_name || 'â€”'}</div>
                  {inv.bill_to_company && (
                    <div className="text-[10px] text-[var(--text-3)] truncate">{inv.bill_to_company}</div>
                  )}
                </div>
                <div className="col-span-3 sm:col-span-2 text-right">
                  <span className="font-mono text-xs font-bold text-[var(--text)]">{fmt(inv.total)}</span>
                </div>
                <div className="hidden sm:block col-span-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                    ${STATUS_COLOR[inv.status] || 'bg-zinc-100 text-zinc-600'}`}>
                    {inv.status}
                  </span>
                </div>
                <div className="col-span-3 sm:col-span-1 flex items-center justify-end gap-1.5">
                  <button onClick={() => handleDownload(inv.id, inv.invoice_number)}
                    title="Download PDF"
                    className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg)]
                      text-[var(--text-2)] transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </button>
                  <button onClick={() => resend(inv.id)} disabled={resending}
                    title="Resend"
                    className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg)]
                      text-[var(--text-2)] disabled:opacity-40 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22 2 11 13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-[var(--text-3)]">Page {page} of {totalPages} · {count} invoices</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)] border border-[var(--border)]
                    rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">â† Prev</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)] border border-[var(--border)]
                    rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">Next â†’</button>
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <InvoiceCreateModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false)
            queryClient.invalidateQueries({ queryKey: ['invoices'] })
          }}
        />
      )}
    </div>
  )
}

// â”€â”€ Invoice Create Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ── Invoice Create Modal — 3-step wizard ─────────────────────────────────────
const PAPER_SIZES = ['A4', 'A3', 'A5', 'A6', 'SRA3', 'LEGAL', 'LETTER', 'CUSTOM']
const SIDES_OPTS  = [{ value: 'SINGLE', label: 'Single-sided' }, { value: 'DOUBLE', label: 'Double-sided' }]

function InvoiceCreateModal({ onClose, onSuccess }) {
  const { user } = useAuth()
  const [step, setStep] = useState(1)

  // ── Step 1: Source & Type ───────────────────────────────────────────────
  const [invoiceType, setInvoiceType] = useState('PROFORMA')
  const [mode,        setMode]        = useState('job')

  // Job-linked
  const [jobRef,     setJobRef]     = useState('')
  const [jobData,    setJobData]    = useState(null)
  const [jobLoading, setJobLoading] = useState(false)
  const [jobError,   setJobError]   = useState('')

  // Standalone cart (mirrors NewJobModal)
  const [search,    setSearch]    = useState('')
  const [selected,  setSelected]  = useState(null)
  const [selPages,  setSelPages]  = useState(1)
  const [selSets,   setSelSets]   = useState(1)
  const [selColor,  setSelColor]  = useState(false)
  const [selPaper,  setSelPaper]  = useState('A4')
  const [selSides,  setSelSides]  = useState('SINGLE')
  const [cart,      setCart]      = useState([])

  // ── Step 2: Bill To ─────────────────────────────────────────────────────
  const [custSearch,   setCustSearch]   = useState('')
  const [custSelected, setCustSelected] = useState(null)
  const [billName,     setBillName]     = useState('')
  const [billCompany,  setBillCompany]  = useState('')
  const [billPhone,    setBillPhone]    = useState('')
  const [billEmail,    setBillEmail]    = useState('')

  // ── Step 3: Delivery ────────────────────────────────────────────────────
  const [dueDate,  setDueDate]  = useState('')
  const [vatRate,  setVatRate]  = useState('0')
  const [channel,  setChannel]  = useState('WHATSAPP')
  const [bmNote,   setBmNote]   = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: servicesRaw = [] } = useQuery({
    queryKey: ['services'],
    queryFn:  () => getServices().then(r => r.data),
    staleTime: 300_000,
  })
  const services = Array.isArray(servicesRaw) ? servicesRaw : (servicesRaw?.results || [])

  const { data: custResults = [] } = useQuery({
    queryKey: ['custSearch', custSearch],
    queryFn:  () => getCustomers({ search: custSearch.trim(), page_size: 6 }).then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d?.results || [])
    }),
    enabled:  custSearch.length >= 2 && !custSelected,
    staleTime: 10_000,
  })

  const { data: selPrice } = useQuery({
    queryKey: ['invSelPrice', selected?.id, selPages, selSets, selColor],
    queryFn:  () => calculatePrice({
      service:  selected.id,
      branch:   user?.branch || 2,
      quantity: selSets,
      pages:    selPages,
      is_color: selColor,
    }).then(r => r.data),
    enabled: !!selected,
    staleTime: 3_000,
  })

  // ── Service grouping (same alias logic as NewJobModal) ──────────────────
  const SERVICE_ALIASES = [
    { patterns: ['black','blk','bw','b&w','mono','monochrome'], resolves: 'b&w'      },
    { patterns: ['colour','color','col','clr'],                  resolves: 'colour'   },
    { patterns: ['print'],                                        resolves: 'print'    },
    { patterns: ['copy','cop','copi'],                           resolves: 'cop'      },
    { patterns: ['bind','ring'],                                  resolves: 'bind'     },
    { patterns: ['passport','pass','pas'],                        resolves: 'passport' },
    { patterns: ['laminate','lam'],                               resolves: 'laminat'  },
  ]
  const resolveToken = (tok) => {
    for (const { patterns, resolves } of SERVICE_ALIASES)
      if (patterns.some(p => p.startsWith(tok) || tok.startsWith(p))) return resolves
    return tok
  }
  const matchesSearch = (name, query) => {
    if (!query) return true
    const target = name.toLowerCase()
    return query.toLowerCase().trim().split(/\s+/).filter(Boolean).every(tok => {
      const r = resolveToken(tok); return target.includes(tok) || target.includes(r)
    })
  }
  const grouped = useMemo(() => {
    const groups = {}
    services
      .filter(s => s.is_active && matchesSearch(s.name, search))
      .forEach(s => {
        const key = s.name.match(/^(A3|A4|A5|DL|Zeta)/)?.[0] || 'Other'
        if (!groups[key]) groups[key] = []
        groups[key].push(s)
      })
    return groups
  }, [services, search])

  // ── Cart helpers ────────────────────────────────────────────────────────
  const cartTotal = cart.reduce((s, i) => s + parseFloat(i._price || 0), 0)
  const vatAmount = cartTotal * (parseFloat(vatRate || 0) / 100)

  const addToCart = () => {
    if (!selected || !selPrice) return
    setCart(c => [...c, {
      _id: Date.now(), service: selected,
      pages: selPages, sets: selSets, is_color: selColor,
      paper_size: selPaper, sides: selSides,
      _price: selPrice.total || 0,
    }])
    setSelected(null); setSelPages(1); setSelSets(1); setSelColor(false)
  }
  const removeFromCart = (id) => setCart(c => c.filter(i => i._id !== id))

  // ── Job lookup ──────────────────────────────────────────────────────────
  const lookupJob = async () => {
    const q = jobRef.trim(); if (!q) return
    setJobLoading(true); setJobError(''); setJobData(null)
    try {
      const res   = await client.get('/api/v1/jobs/', { params: { search: q, page_size: 5 } })
      const jobs  = Array.isArray(res.data) ? res.data : (res.data?.results || [])
      const match = jobs.find(j => j.job_number?.toLowerCase() === q.toLowerCase() || String(j.id) === q)
      if (!match) { setJobError('Job not found.'); return }
      const detail = await client.get(`/api/v1/jobs/${match.id}/`)
      setJobData(detail.data)
      // Auto-fill bill-to from job customer
      if (detail.data.customer_name  && !billName)  setBillName(detail.data.customer_name)
      if (detail.data.customer_phone && !billPhone) setBillPhone(detail.data.customer_phone)
    } catch { setJobError('Could not fetch job. Try again.') }
    finally   { setJobLoading(false) }
  }

  // ── Step validation ─────────────────────────────────────────────────────
  const step1Valid = mode === 'job' ? !!jobData : cart.length > 0
  const step2Valid = billName.trim().length > 0
  const step3Valid = step2Valid
  const step4Valid = step3Valid

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setCreateError(''); setCreating(true)
    try {
      const payload = {
        invoice_type: invoiceType, bill_to_name: billName,
        bill_to_phone: billPhone, bill_to_email: billEmail,
        bill_to_company: billCompany, delivery_channel: channel,
        due_date: dueDate || null, vat_rate: parseFloat(vatRate || 0), bm_note: bmNote,
      }
      if (mode === 'job' && jobData) {
        payload.job_id = jobData.id
      } else {
        payload.line_items = cart.map(li => ({
          service: li.service.id, pages: li.pages, sets: li.sets,
          is_color: li.is_color, paper_size: li.paper_size, sides: li.sides,
        }))
      }
      await createInvoice(payload)
      onSuccess()
    } catch (err) {
      const d = err.response?.data
      setCreateError(d?.detail || JSON.stringify(d) || 'Failed to create invoice.')
      setStep(3)
    } finally { setCreating(false) }
  }

  // ── Progress bar ────────────────────────────────────────────────────────
 const STEPS = ['Source & Type', 'Bill To', 'Delivery', 'Preview']

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-[var(--panel)] w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl
        shadow-2xl flex flex-col overflow-hidden animate-slideUp h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <div className="font-black text-base text-[var(--text)]">New Invoice</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">Step {step} of 4 — {STEPS[step-1]}</div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg)] text-[var(--text-3)] transition-colors">✕</button>
        </div>

        {/* Progress */}
        <div className="flex px-6 pt-4 gap-2 shrink-0">
          {STEPS.map((label, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1 rounded-full transition-colors ${i < step ? 'bg-[var(--text)]' : 'bg-[var(--border)]'}`} />
              <div className={`text-[9px] font-bold mt-1 uppercase tracking-wider
                ${i + 1 === step ? 'text-[var(--text)]' : 'text-[var(--text-3)]'}`}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 space-y-4 min-h-0">

            {/* Invoice type */}
            <div>
              <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">Invoice Type</label>
              <div className="flex gap-1.5">
                {[
                  { value: 'PROFORMA', label: 'Proforma',    desc: 'Quote / pre-payment'       },
                  { value: 'TAX',      label: 'Tax Invoice', desc: 'Post-payment / official'   },
                ].map(t => (
                  <button key={t.value} onClick={() => setInvoiceType(t.value)}
                    className={`flex-1 py-2.5 px-3 text-left rounded-xl border transition-colors
                      ${invoiceType === t.value ? 'bg-[var(--text)] text-white border-transparent' : 'border-[var(--border)] hover:border-[var(--border-dark)]'}`}>
                    <div className={`text-xs font-bold ${invoiceType === t.value ? 'text-white' : 'text-[var(--text)]'}`}>{t.label}</div>
                    <div className={`text-[10px] mt-0.5 ${invoiceType === t.value ? 'text-white/70' : 'text-[var(--text-3)]'}`}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mode */}
            <div>
              <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">Source</label>
              <div className="flex gap-1 bg-[var(--bg)] p-1 rounded-xl">
                {[{ value: 'job', label: '🔗 From a Job' }, { value: 'standalone', label: '📋 Standalone' }].map(m => (
                  <button key={m.value}
                    onClick={() => { setMode(m.value); setJobData(null); setJobError(''); setCart([]) }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors
                      ${mode === m.value ? 'bg-[var(--text)] text-white' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Job mode */}
            {mode === 'job' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">Job Number</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="e.g. FP-WLB-2026-02247" value={jobRef}
                      onChange={e => setJobRef(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && lookupJob()}
                      className="flex-1 px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--border-dark)]"
                    />
                    <button onClick={lookupJob} disabled={jobLoading || !jobRef.trim()}
                      className="px-4 py-2 bg-[var(--text)] text-white text-xs font-bold rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0">
                      {jobLoading ? '…' : 'Lookup'}
                    </button>
                  </div>
                  {jobError && <p className="text-xs text-[var(--red-text)] mt-1.5">{jobError}</p>}
                </div>

                {jobData && (
                  <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl overflow-hidden">
                    {/* Paid warning */}
                    {['COMPLETE', 'PAID'].includes(jobData.status) && (
                      <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600 shrink-0">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span className="text-xs text-amber-700 font-medium">This job is already paid — you're creating a formal record invoice only.</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                      <div>
                        <div className="text-xs font-black text-[var(--text)]">{jobData.job_number}</div>
                        <div className="text-[10px] text-[var(--text-3)] mt-0.5">{jobData.title}</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                        {jobData.status?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {jobData.line_items?.length > 0 && (
                      <div className="divide-y divide-[var(--border)]">
                        {jobData.line_items.map((li, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-[var(--text)]">{li.label || li.service_name}</div>
                              <div className="text-[10px] text-[var(--text-3)]">{li.quantity} × {li.pages}pp · {li.is_color ? 'Colour' : 'B&W'}</div>
                            </div>
                            <span className="font-mono text-xs font-bold text-[var(--text)] ml-3 shrink-0">{fmt(li.line_total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50 border-t border-emerald-100">
                      <span className="text-xs font-bold text-emerald-700">Est. Total</span>
                      <span className="font-mono text-sm font-black text-emerald-700">{fmt(jobData.estimated_cost)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Standalone mode — mirrors NewJobModal */}
            {mode === 'standalone' && (
              <div className="space-y-3">
                {/* Service search */}
                <input type="text" value={search} onChange={e => { setSearch(e.target.value); setSelected(null) }}
                  placeholder="Search services…"
                  className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--border-dark)]"
                />

                {/* Grouped chips */}
                <div className="max-h-48 overflow-y-auto space-y-2.5 pr-1">
                  {Object.keys(grouped).length === 0 ? (
                    <div className="text-sm text-[var(--text-3)] text-center py-4">No services found</div>
                  ) : Object.entries(grouped).map(([grp, items]) => (
                    <div key={grp}>
                      <div className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1.5">{grp}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map(s => (
                          <button key={s.id} onClick={() => {
                            setSelected(s); setSelPages(s.smart_defaults?.pages || 1)
                            setSelSets(s.smart_defaults?.quantity || 1)
                            setSelColor(s.smart_defaults?.is_color ?? false)
                          }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
                              ${selected?.id === s.id
                                ? 'bg-[var(--text)] text-white border-transparent'
                                : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-dark)]'
                              }`}>
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Inline editor */}
                {selected && (
                  <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                    <div className="text-xs font-bold text-[var(--text)]">{selected.name}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1">Sheets</label>
                        <input type="number" min="1" value={selPages}
                          onChange={e => setSelPages(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-2.5 py-2 text-sm bg-[var(--panel)] border border-[var(--border)] rounded-lg outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1">Copies</label>
                        <input type="number" min="1" value={selSets}
                          onChange={e => setSelSets(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-2.5 py-2 text-sm bg-[var(--panel)] border border-[var(--border)] rounded-lg outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelColor(c => !c)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-colors
                          ${selColor ? 'bg-violet-100 text-violet-700 border-violet-200' : 'border-[var(--border)] text-[var(--text-3)]'}`}>
                        <span className={`w-3 h-3 rounded-full ${selColor ? 'bg-violet-500' : 'bg-zinc-300'}`} />
                        {selColor ? 'Colour' : 'B&W'}
                      </button>
                      <div className="flex-1 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700">Total</span>
                        <span className="font-mono font-black text-sm text-emerald-700">
                          {selPrice ? fmt(selPrice.total) : '…'}
                        </span>
                      </div>
                      <button onClick={addToCart} disabled={!selPrice}
                        className="px-4 py-2 bg-[var(--text)] text-white text-xs font-bold rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity whitespace-nowrap">
                        + Add
                      </button>
                    </div>
                  </div>
                )}

                {/* Cart */}
                {cart.length > 0 && (
                  <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Items</span>
                      <span className="text-[10px] text-[var(--text-3)]">{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
                    </div>
                    {cart.map(item => (
                      <div key={item._id} className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] last:border-0">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-[var(--text)]">{item.service.name}</div>
                          <div className="text-[10px] text-[var(--text-3)]">{item.sets} × {item.pages}pp · {item.is_color ? 'Colour' : 'B&W'} · {item.paper_size}</div>
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <span className="font-mono text-xs font-bold text-[var(--text)]">{fmt(item._price)}</span>
                          <button onClick={() => removeFromCart(item._id)} className="text-[var(--text-3)] hover:text-[var(--red-text)] transition-colors">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="px-4 py-2.5 bg-[var(--bg)] flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-3)]">Subtotal</span>
                      <span className="font-mono text-sm font-black text-[var(--text)]">{fmt(cartTotal)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 space-y-4 min-h-0">
            <div>
              <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
                Search Customer <span className="normal-case font-normal">(or enter manually below)</span>
              </label>
              <div className="relative">
                <input type="text" value={custSearch}
                  onChange={e => { setCustSearch(e.target.value); setCustSelected(null) }}
                  placeholder="Search by name or phone…"
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl outline-none transition-colors
                    ${custSelected
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                      : 'bg-[var(--bg)] border-[var(--border)] focus:border-[var(--border-dark)]'
                    }`}
                />
                {custSearch && (
                  <button onClick={() => { setCustSearch(''); setCustSelected(null) }}
                    className="absolute right-3 top-2.5 text-[var(--text-3)] hover:text-[var(--text)] text-sm">✕</button>
                )}
                {custResults.length > 0 && !custSelected && (
                  <div className="absolute top-12 left-0 right-0 bg-[var(--panel)] border border-[var(--border)] rounded-xl shadow-lg z-20 overflow-hidden">
                    {custResults.map(c => (
                      <button key={c.id}
                        onClick={() => {
                          setCustSelected(c)
                          const name = c.customer_type !== 'INDIVIDUAL' ? (c.company_name || c.full_name) : c.full_name
                          setCustSearch(name)
                          setBillName(c.full_name || '')
                          setBillCompany(c.company_name || '')
                          setBillPhone(c.phone || '')
                          setBillEmail(c.email || '')
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-[var(--bg)] border-b border-[var(--border)] last:border-0 transition-colors">
                        <div className="text-sm font-semibold text-[var(--text)]">
                          {c.customer_type !== 'INDIVIDUAL' ? (c.company_name || c.full_name) : c.full_name}
                        </div>
                        <div className="text-xs text-[var(--text-3)] mt-0.5">
                          {c.customer_type !== 'INDIVIDUAL' && c.full_name ? `Rep: ${c.full_name} · ` : ''}{c.phone}
                          {c.customer_type && ` · ${c.customer_type}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {custSelected && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Customer auto-populated — edit fields below if needed
                </div>
              )}
            </div>

            <div className="h-px bg-[var(--border)]" />

            {/* Manual / editable fields */}
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1">
                  Full Name <span className="text-[var(--red-text)]">*</span>
                </label>
                <input type="text" placeholder="Full name" value={billName} onChange={e => setBillName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--border-dark)]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1">Company / Organisation</label>
                <input type="text" placeholder="Company name (optional)" value={billCompany} onChange={e => setBillCompany(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--border-dark)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1">Phone</label>
                  <input type="tel" placeholder="Phone number" value={billPhone} onChange={e => setBillPhone(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--border-dark)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1">Email</label>
                  <input type="email" placeholder="Email address" value={billEmail} onChange={e => setBillEmail(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--border-dark)]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 space-y-4 min-h-0">

            {/* Summary card */}
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-2">Summary</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-3)]">Type</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                    ${invoiceType === 'PROFORMA' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                    {invoiceType}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-[var(--text-3)]">Bill To</span>
                  <div className="text-right">
                    <div className="text-xs font-bold text-[var(--text)]">{billCompany || billName}</div>
                    {billCompany && <div className="text-[10px] text-[var(--text-3)]">{billName}</div>}
                  </div>
                </div>
                {mode === 'job' && jobData && (
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-[var(--text-3)]">Job</span>
                    <span className="font-mono text-xs font-bold text-[var(--text)]">{jobData.job_number}</span>
                  </div>
                )}
              </div>
              {/* Line items */}
              {(mode === 'standalone' ? cart : jobData?.line_items || []).map((li, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] last:border-0">
                  <div className="text-xs text-[var(--text-2)]">
                    {mode === 'standalone' ? li.service.name : (li.label || li.service_name)}
                  </div>
                  <span className="font-mono text-xs font-bold text-[var(--text)]">
                    {fmt(mode === 'standalone' ? li._price : li.line_total)}
                  </span>
                </div>
              ))}
              <div className="px-4 py-2.5 bg-[var(--panel)] space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-3)]">Subtotal</span>
                  <span className="font-mono font-bold text-[var(--text)]">
                    {fmt(mode === 'job' && jobData ? jobData.estimated_cost : cartTotal)}
                  </span>
                </div>
                {parseFloat(vatRate) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-3)]">VAT ({vatRate}%)</span>
                    <span className="font-mono font-bold text-[var(--text)]">{fmt(vatAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-[var(--border)]">
                  <span className="text-sm font-bold text-[var(--text)]">Total</span>
                  <span className="font-mono text-base font-black text-[var(--text)]">
                    {fmt((mode === 'job' && jobData ? parseFloat(jobData.estimated_cost) : cartTotal) + vatAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--border-dark)]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">VAT Rate</label>
                <select value={vatRate} onChange={e => setVatRate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none">
                  <option value="0">No VAT (0%)</option>
                  <option value="15">15%</option>
                  <option value="21">21%</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">Delivery Channel</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { value: 'WHATSAPP', label: '📲 WhatsApp'             },
                  { value: 'EMAIL',    label: '✉ Email'                 },
                  { value: 'BOTH',     label: '📲 + ✉ WhatsApp & Email' },
                ].map(c => (
                  <button key={c.value} onClick={() => setChannel(c.value)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-colors text-left
                      ${channel === c.value ? 'bg-[var(--text)] text-white border-transparent' : 'border-[var(--border)] text-[var(--text-3)] hover:border-[var(--border-dark)]'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
                Note <span className="normal-case font-normal text-[var(--text-3)]">(optional)</span>
              </label>
              <textarea placeholder="Add a note to this invoice…" rows={2} value={bmNote} onChange={e => setBmNote(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none resize-none focus:border-[var(--border-dark)]"
              />
            </div>

            {createError && (
              <div className="px-3 py-2.5 bg-[var(--red-bg)] border border-[var(--red-border)] rounded-xl text-xs text-[var(--red-text)]">{createError}</div>
            )}
          </div>
        )}

        {/* ── STEP 4 — Preview ── */}
        {step === 4 && (() => {
          const lineItems = mode === 'standalone' ? cart : (jobData?.line_items || [])
          const subtotal  = mode === 'job' && jobData
            ? parseFloat(jobData.estimated_cost || 0)
            : cartTotal
          const vat   = subtotal * (parseFloat(vatRate || 0) / 100)
          const total = subtotal + vat
          const today = new Date().toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })

          return (
            <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 min-h-0">
              <div className="bg-white border border-[var(--border)] rounded-2xl overflow-hidden text-zinc-800 shadow-sm">

                {/* Invoice header */}
                <div className="px-6 pt-6 pb-4 border-b border-zinc-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-black text-xl text-zinc-900 tracking-tight">Farhat Printing Press</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {user?.branch_detail?.name || user?.branch_name || 'Branch'}
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {[
                          user?.branch_detail?.phone || user?.branch_detail?.whatsapp_number,
                          user?.branch_detail?.email,
                          user?.branch_detail?.address || user?.branch_detail?.location,
                        ].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-black px-2.5 py-1 rounded-full inline-block
                        ${invoiceType === 'PROFORMA' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                        {invoiceType} INVOICE
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bill to + meta */}
                <div className="px-6 py-4 grid grid-cols-2 gap-4 border-b border-zinc-100">
                  <div>
                    <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Bill To</div>
                    <div className="text-sm font-bold text-zinc-900">{billCompany || billName}</div>
                    {billCompany && <div className="text-xs text-zinc-500 mt-0.5">{billName}</div>}
                    {billPhone && <div className="text-xs text-zinc-500 mt-0.5">{billPhone}</div>}
                    {billEmail && <div className="text-xs text-zinc-500 mt-0.5">{billEmail}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Invoice Details</div>
                    <div className="text-xs text-zinc-500">Issued: <span className="font-semibold text-zinc-800">{today}</span></div>
                    {dueDate && (
                      <div className="text-xs text-zinc-500 mt-0.5">Due: <span className="font-semibold text-zinc-800">
                        {new Date(dueDate).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span></div>
                    )}
                    {mode === 'job' && jobData && (
                      <div className="text-xs text-zinc-500 mt-0.5">Job: <span className="font-mono font-bold text-zinc-800">{jobData.job_number}</span></div>
                    )}
                  </div>
                </div>

                {/* Line items */}
                <div className="px-6 py-3">
                  <div className="grid grid-cols-12 text-[9px] font-bold text-zinc-400 uppercase tracking-widest pb-2 border-b border-zinc-200">
                    <span className="col-span-1">#</span>
                    <span className="col-span-5">Description</span>
                    <span className="col-span-2 text-center">Qty</span>
                    <span className="col-span-2 text-right">Unit Price</span>
                    <span className="col-span-2 text-right">Amount</span>
                  </div>
                  {lineItems.map((li, i) => {
                    const qty       = mode === 'standalone' ? (li.sets * li.pages) : (li.quantity * li.pages)
                    const lineTotal = parseFloat(mode === 'standalone' ? li._price : li.line_total) || 0
                    const unitPrice = qty > 0 ? lineTotal / qty : 0
                    const desc      = mode === 'standalone' ? li.service.name : (li.label || li.service_name)
                    const detail    = mode === 'standalone'
                      ? `${li.sets} set${li.sets !== 1 ? 's' : ''} × ${li.pages}pp · ${li.is_color ? 'Colour' : 'B&W'}`
                      : `${li.quantity} set${li.quantity !== 1 ? 's' : ''} × ${li.pages}pp · ${li.is_color ? 'Colour' : 'B&W'}`
                    return (
                      <div key={i} className="grid grid-cols-12 items-start py-3 border-b border-zinc-50 last:border-0">
                        <div className="col-span-1 text-xs text-zinc-400">{i + 1}</div>
                        <div className="col-span-5">
                          <div className="text-xs font-semibold text-zinc-800">{desc}</div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">{detail}</div>
                        </div>
                        <div className="col-span-2 text-center text-xs text-zinc-600">{qty}</div>
                        <div className="col-span-2 text-right font-mono text-xs text-zinc-600">{fmt(unitPrice)}</div>
                        <div className="col-span-2 text-right font-mono text-xs font-bold text-zinc-800">{fmt(lineTotal)}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Totals */}
                <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 space-y-1.5">
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>Subtotal</span>
                    <span className="font-mono font-semibold text-zinc-700">{fmt(subtotal)}</span>
                  </div>
                  {vat > 0 && (
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>VAT ({vatRate}%)</span>
                      <span className="font-mono font-semibold text-zinc-700">{fmt(vat)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-zinc-200">
                    <span className="text-sm font-bold text-zinc-900">Total</span>
                    <span className="font-mono text-base font-black text-zinc-900">{fmt(total)}</span>
                  </div>
                </div>

                {/* Delivery + Note */}
                <div className="px-6 py-4 border-t border-zinc-100 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Delivery</span>
                    <span className="font-semibold text-zinc-700">
                      {channel === 'WHATSAPP' ? '📲 WhatsApp' : channel === 'EMAIL' ? '✉ Email' : '📲 + ✉ WhatsApp & Email'}
                    </span>
                  </div>
                  {bmNote && (
                    <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                      <div className="text-[9px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">Note</div>
                      <div className="text-xs text-amber-800">{bmNote}</div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-zinc-100 text-center">
                  <div className="text-[10px] text-zinc-400">Thank you for your business — Farhat Printing Press</div>
                </div>
              </div>
            </div>
          )
        })()}


        {/* Footer navigation */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex items-center gap-3 shrink-0">
          {step > 1 ? (
            <button onClick={() => setStep(s => s - 1)}
              className="px-4 py-2.5 text-sm font-semibold border border-[var(--border)] rounded-xl hover:border-[var(--border-dark)] transition-colors">
              ← Back
            </button>
          ) : (
            <button onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
              Cancel
            </button>
          )}
          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={
                step === 1 ? !step1Valid :
                step === 2 ? !step2Valid :
                !step3Valid
              }
              className="flex-1 py-2.5 bg-[var(--text)] text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
              {step === 3 ? 'Preview →' : 'Next →'}
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={creating || !step4Valid}
              className="flex-1 py-2.5 bg-[var(--text)] text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
              {creating ? 'Creating…' : `Create ${invoiceType === 'PROFORMA' ? 'Proforma' : 'Tax Invoice'}`}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
