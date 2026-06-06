// src/components/bm/Jobs.jsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { getJobs, getJobStats, getJobDetail, transitionJob, getJobReceipt, sendReceiptWhatsApp, getJobInvoices, createInvoice, sendInvoice, getInvoicePdfUrl } from '../../api/bm'
import { invalidateAfterJobTransitioned } from '../../api/invalidations'
import { useAuth } from '../../context/AuthContext'
import client from '../../api/client'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function timeAgo(iso) {
  if (!iso) return '—'
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

// ── Status config ─────────────────────────────────────────────────────────────
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



// ── Receipt & Invoice Section ─────────────────────────────────────────────────
function ReceiptInvoiceSection({ job }) {
  const [tab,             setTab]             = useState('receipt')
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [invoiceForm,     setInvoiceForm]     = useState({
    invoice_type:     'PROFORMA',
    bill_to_name:     job.customer_name || '',
    bill_to_phone:    job.customer_phone || '',
    bill_to_email:    '',
    bill_to_company:  '',
    delivery_channel: 'DOWNLOAD',
    bm_note:          '',
  })
  const [invoiceError,   setInvoiceError]   = useState('')
  const [sendingWa,      setSendingWa]      = useState(false)
  const [waMsg,          setWaMsg]          = useState('')
  const queryClient = useQueryClient()

  const { data: receiptData } = useQuery({
    queryKey: ['job-receipt', job.id],
    queryFn:  () => getJobReceipt(job.id).then(r => r.data),
    staleTime: 30_000,
  })

  const { data: invoiceData } = useQuery({
    queryKey: ['job-invoices', job.id],
    queryFn:  () => getJobInvoices(job.id).then(r => r.data),
    staleTime: 30_000,
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

      {/* Tabs */}
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

      {/* Receipt tab */}
      {tab === 'receipt' && (
        <div>
          {!receipt ? (
            <div className="px-3 py-4 bg-[var(--bg)] border border-[var(--border)]
              rounded-xl text-xs text-[var(--text-3)] text-center">
              No receipt yet — payment not confirmed
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
                  {sendingWa ? 'Sending…' : '📲 Send WhatsApp'}
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

      {/* Invoice tab */}
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
                  ⬇ Download PDF
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
              {/* Invoice type */}
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
              {/* Bill to */}
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
              {/* Delivery */}
              <select value={invoiceForm.delivery_channel}
                onChange={e => setInvoiceForm(f => ({ ...f, delivery_channel: e.target.value }))}
                className="w-full px-2.5 py-2 text-xs bg-[var(--panel)] border border-[var(--border)]
                  rounded-lg outline-none">
                <option value="DOWNLOAD">Download only</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="BOTH">WhatsApp + Email</option>
              </select>
              {/* Note */}
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

// ── Job Detail Panel ──────────────────────────────────────────────────────────
function JobDetailPanel({ jobId, onClose }) {
  const queryClient = useQueryClient()
  const [transitioning, setTransitioning] = useState(null)
  const [error, setError] = useState('')

  const { data: job, isLoading } = useQuery({
    queryKey: ['job-detail', jobId],
    queryFn:  () => getJobDetail(jobId).then(r => r.data),
    staleTime: 10_000,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: ({ to_status, notes }) => transitionJob(jobId, { to_status, notes }),
    onSuccess: () => {
      invalidateAfterJobTransitioned(queryClient, jobId)
      setTransitioning(null)
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

        {/* Header */}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {isLoading && !job ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-[var(--bg)] rounded-xl animate-pulse" />)}
            </div>
          ) : job ? (<>

            {/* Status + meta */}
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

            {/* Key info grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Customer',    value: toTitleCase(job.customer_name) || 'Walk-in' },
                { label: 'Intake By',   value: toTitleCase(job.intake_by_name) || '—'      },
                { label: 'Channel',     value: job.intake_channel || '—'                   },
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

            {/* Line items */}
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

            {/* Allowed transitions */}
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

            {/* Status log */}
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
                          {' → '}
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

            {/* Notes */}
            {job.notes && (
              <div className="px-3 py-3 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Notes</div>
                <div className="text-xs text-amber-800">{job.notes}</div>
              </div>
            )}

            {/* Receipt & Invoice */}
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

// ── Receipts Tab ──────────────────────────────────────────────────────────────
function ReceiptsTab() {
  const [period,          setPeriod]          = useState('day')
  const [page,            setPage]            = useState(1)
  const [activeReceiptId, setActiveReceiptId] = useState(null)
  const [sendingWa,       setSendingWa]       = useState(false)
  const [waMsg,           setWaMsg]           = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['receipts', period, page],
    queryFn:  () => getJobReceipt(null, { period, page, page_size: 10 }).then(r => r.data),
    staleTime: 15_000,
    placeholderData: prev => prev,
  })

  const { data: activeReceipt, isLoading: loadingDetail } = useQuery({
    queryKey: ['receipt-detail', activeReceiptId],
    queryFn:  () => client.get(`/api/v1/finance/receipts/${activeReceiptId}/`).then(r => r.data),
    enabled:  !!activeReceiptId,
    staleTime: 30_000,
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
      {/* Header + period */}
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

      {/* Two-panel layout */}
      <div className="flex border border-[var(--border)] rounded-2xl overflow-hidden min-h-[520px]">

        {/* Left — list */}
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
                      : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="shrink-0 px-3 py-2.5 border-t border-[var(--border)] bg-[var(--bg)]
              flex items-center justify-between">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-2.5 py-1 text-xs font-bold border border-[var(--border)]
                  rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">
                ← Prev
              </button>
              <span className="text-[10px] font-mono text-[var(--text-3)]">
                {(page-1)*10+1}–{Math.min(page*10, count)} of {count}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-2.5 py-1 text-xs font-bold border border-[var(--border)]
                  rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Right — detail */}
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

                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-[var(--border)]">
                  <div>
                    <div className="font-black text-lg text-[var(--text)]">{r.receipt_number}</div>
                    <div className="text-xs text-[var(--text-3)] mt-0.5">
                      {r.created_at ? new Date(r.created_at).toLocaleString('en-GH', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      }) : '—'}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                    PAID
                  </span>
                </div>

                {/* Job */}
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">Job</div>
                  <div className="text-sm font-bold text-[var(--text)]">{r.job_title || '—'}</div>
                  <div className="font-mono text-xs text-[var(--text-3)] mt-0.5">{r.job_number}</div>
                </div>

                {/* Line items */}
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

                {/* Payment settlement */}
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

                {/* Payment method */}
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

                {/* People */}
                <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-2">
                  <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1">People</div>
                  {[
                    ['Customer',  r.customer_name || 'Walk-in'],
                    r.customer_phone ? ['Phone', r.customer_phone] : null,
                    ['Cashier',   r.cashier_name  || '—'],
                    ['Attendant', r.intake_by_name || '—'],
                  ].filter(Boolean).map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between border-b border-[var(--border)] pb-1.5 last:border-0 last:pb-0">
                      <span className="text-xs text-[var(--text-3)]">{label}</span>
                      <span className="text-xs font-semibold text-[var(--text)]">{val}</span>
                    </div>
                  ))}
                </div>

              </div>

              {/* Actions */}
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

// ── Invoices Tab ──────────────────────────────────────────────────────────────
function InvoicesTab() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [period,      setPeriod]      = useState('')
  const [page,        setPage]        = useState(1)
  const [showCreate,  setShowCreate]  = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({
    invoice_type:     'PROFORMA',
    bill_to_name:     '',
    bill_to_phone:    '',
    bill_to_email:    '',
    bill_to_company:  '',
    delivery_channel: 'DOWNLOAD',
    bm_note:          '',
    job_id:           '',
  })

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

  const { mutate: createInv, isPending: creating } = useMutation({
    mutationFn: (payload) => createInvoice(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setShowCreate(false)
      setCreateError('')
      setForm({
        invoice_type: 'PROFORMA', bill_to_name: '', bill_to_phone: '',
        bill_to_email: '', bill_to_company: '', delivery_channel: 'DOWNLOAD',
        bm_note: '', job_id: '',
      })
    },
    onError: (err) => {
      const d = err.response?.data
      setCreateError(d?.detail || 'Failed to create invoice.')
    },
  })

  const { mutate: resend, isPending: resending } = useMutation({
    mutationFn: (id) => sendInvoice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
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
          {/* Period tabs */}
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

      {/* Invoice list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse" />)}
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-semibold text-[var(--text-2)]">No invoices yet</p>
          <p className="text-xs text-[var(--text-3)] mt-1">Create your first invoice</p>
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
                  <div className="text-xs font-semibold text-[var(--text)] truncate">{inv.bill_to_name || '—'}</div>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-[var(--text-3)]">
                Page {page} of {totalPages} · {count} invoices
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)] border border-[var(--border)]
                    rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">← Prev</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)] border border-[var(--border)]
                    rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">Next →</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create invoice modal */}
      {showCreate && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="bg-[var(--panel)] w-full max-w-md rounded-2xl shadow-2xl
            flex flex-col overflow-hidden animate-slideUp max-h-[90vh]">

            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
              <div>
                <div className="font-bold text-base text-[var(--text)]">New Invoice</div>
                <div className="text-xs text-[var(--text-3)] mt-0.5">Create a proforma or tax invoice</div>
              </div>
              <button onClick={() => setShowCreate(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full
                  hover:bg-[var(--bg)] text-[var(--text-3)] transition-colors">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* Invoice type */}
              <div>
                <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
                  Invoice Type
                </label>
                <div className="flex gap-1.5">
                  {['PROFORMA', 'TAX'].map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, invoice_type: t }))}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors
                        ${form.invoice_type === t
                          ? 'bg-[var(--text)] text-white border-transparent'
                          : 'border-[var(--border)] text-[var(--text-3)] hover:border-[var(--border-dark)]'
                        }`}>
                      {t === 'PROFORMA' ? 'Proforma' : 'Tax Invoice'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Job ID (optional) */}
              <div>
                <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
                  Job Reference <span className="normal-case font-normal">(optional)</span>
                </label>
                <input type="text" placeholder="e.g. FP-WLB-2026-02247"
                  value={form.job_id}
                  onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)]
                    rounded-xl outline-none focus:border-[var(--border-dark)]"
                />
              </div>

              {/* Bill to */}
              <div>
                <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
                  Bill To <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {[
                    { key: 'bill_to_name',    placeholder: 'Full name *',          type: 'text'  },
                    { key: 'bill_to_phone',   placeholder: 'Phone number',          type: 'tel'   },
                    { key: 'bill_to_email',   placeholder: 'Email address',         type: 'email' },
                    { key: 'bill_to_company', placeholder: 'Company (optional)',    type: 'text'  },
                  ].map(f => (
                    <input key={f.key} type={f.type} placeholder={f.placeholder}
                      value={form[f.key]}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)]
                        rounded-xl outline-none focus:border-[var(--border-dark)]"
                    />
                  ))}
                </div>
              </div>

              {/* Delivery channel */}
              <div>
                <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
                  Delivery Channel
                </label>
                <select value={form.delivery_channel}
                  onChange={e => setForm(f => ({ ...f, delivery_channel: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)]
                    rounded-xl outline-none">
                  <option value="DOWNLOAD">Download only</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                  <option value="BOTH">WhatsApp + Email</option>
                </select>
              </div>

              {/* BM note */}
              <div>
                <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">
                  Note <span className="normal-case font-normal">(optional)</span>
                </label>
                <textarea placeholder="Add a note to this invoice…" rows={3}
                  value={form.bm_note}
                  onChange={e => setForm(f => ({ ...f, bm_note: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)]
                    rounded-xl outline-none resize-none focus:border-[var(--border-dark)]"
                />
              </div>

              {createError && (
                <div className="px-3 py-2 bg-[var(--red-bg)] border border-[var(--red-border)]
                  rounded-xl text-xs text-[var(--red-text)]">{createError}</div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[var(--border)] flex gap-3 shrink-0">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)]
                  hover:text-[var(--text)] transition-colors">
                Cancel
              </button>
              <button
                onClick={() => {
                  setCreateError('')
                  createInv({
                    job_id:           form.job_id ? parseInt(form.job_id) : undefined,
                    invoice_type:     form.invoice_type,
                    bill_to_name:     form.bill_to_name,
                    bill_to_phone:    form.bill_to_phone,
                    bill_to_email:    form.bill_to_email,
                    bill_to_company:  form.bill_to_company,
                    delivery_channel: form.delivery_channel,
                    bm_note:          form.bm_note,
                  })
                }}
                disabled={creating || !form.bill_to_name.trim()}
                className="flex-1 py-2.5 bg-[var(--text)] text-white text-sm font-bold
                  rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
                {creating ? 'Creating…' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Main Jobs Component ───────────────────────────────────────────────────────
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
  const [tab,        setTab]        = useState('jobs')
  const [status,     setStatus]     = useState('ALL')
  const [jobType,    setJobType]    = useState('ALL')
  const [period,     setPeriod]     = useState('day')
  const [page,       setPage]       = useState(1)
  const [selectedId, setSelectedId] = useState(null)

  const { data: statsData } = useQuery({
    queryKey: ['jobStats', period, jobType],
    queryFn:  () => getJobStats({
      period:   period  || undefined,
      job_type: jobType !== 'ALL' ? jobType : undefined,
    }).then(r => r.data),
    refetchInterval: 30_000,
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
    staleTime: 15_000,
    placeholderData: prev => prev,
  })

  const jobs       = Array.isArray(data) ? data : (data?.results || [])
  const count      = data?.count || 0
  const totalPages = Math.ceil(count / 20)

  const stats = statsData || {}

  const handleStatus = (v) => { setStatus(v); setPage(1) }
  const handleType   = (v) => { setJobType(v); setPage(1) }
  const handlePeriod = (v) => { setPeriod(v); setPage(1) }

  if (tab === 'receipts') return <ReceiptsTab />
  if (tab === 'invoices') return <InvoicesTab />

  return (
    <div className="p-5 sm:p-6 space-y-5">

      {/* Tab bar */}
      <div className="flex gap-1 bg-[var(--panel)] border border-[var(--border)] p-1 rounded-2xl">
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Jobs</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {count > 0 ? `${count.toLocaleString()} jobs` : 'All branch jobs'}
          </p>
        </div>
      </div>

      {/* Stats strip */}
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
            <div className={`font-mono font-black text-xl ${c.color}`}>{c.value ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Filters — period tabs + status + type in one clean bar */}
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-3 space-y-3">

        {/* Period — tab style */}
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

        {/* Status + Type — centered, two distinct groups */}
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

          {/* Type — blue accent */}
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

      {/* Job list */}
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
          {/* Table header — desktop */}
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

                {/* Mobile */}
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

                {/* Desktop */}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-[var(--text-3)]">
                Page {page} of {totalPages} · {count.toLocaleString()} jobs
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)] border border-[var(--border)]
                    rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">← Prev</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)] border border-[var(--border)]
                    rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">Next →</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Job detail panel */}
      {selectedId && (
        <JobDetailPanel jobId={selectedId} onClose={() => setSelectedId(null)} />
      )}

    </div>
  )
}