// src/components/bm/InvoicesTab.jsx
import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sendInvoice, createInvoice, getServices, calculatePrice, getCustomers } from '../../api/bm'
import { useAuth } from '../../context/AuthContext'
import client from '../../api/client'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

/**
 * A tax invoice bills for work already done. Quotes issued before the work
 * are proformas and live in their own tab — the PROFORMA type is gone from
 * here, because two ways to raise the same document is how a branch ends up
 * with one of each.
 */
export default function InvoicesTab() {
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

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse" />)}
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-semibold text-[var(--text-2)]">No invoices yet</p>
          <p className="text-xs text-[var(--text-3)] mt-1">Bill a customer for work already done</p>
        </div>
      ) : (
        <>
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="hidden sm:grid grid-cols-12 px-5 py-2.5 border-b border-[var(--border)]
              text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
              <span className="col-span-3">Invoice No</span>
              <span className="col-span-4">Bill To</span>
              <span className="col-span-2 text-right pr-3">Amount</span>
              <span className="col-span-1">Status</span>
              <span className="col-span-2 text-right">Actions</span>
            </div>
            {invoices.map(inv => (
              <div key={inv.id} className="grid grid-cols-12 px-5 py-3 border-b border-[var(--border)]
                last:border-0 items-center hover:bg-[var(--bg)] transition-colors">
                <div className="col-span-6 sm:col-span-3">
                  <span className="font-mono text-xs font-bold text-[var(--text)]">{inv.invoice_number}</span>
                  <div className="text-[10px] text-[var(--text-3)] mt-0.5">{inv.issue_date}</div>
                </div>
                <div className="hidden sm:block col-span-4 min-w-0">
                  <div className="text-xs font-semibold text-[var(--text)] truncate">{inv.bill_to_name || '—'}</div>
                  {inv.bill_to_company && (
                    <div className="text-[10px] text-[var(--text-3)] truncate">{inv.bill_to_company}</div>
                  )}
                </div>
                <div className="col-span-3 sm:col-span-2 text-right pr-3">
                  <span className="font-mono text-xs font-bold text-[var(--text)]">{fmt(inv.total)}</span>
                </div>
                <div className="hidden sm:block col-span-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                    ${STATUS_COLOR[inv.status] || 'bg-zinc-100 text-zinc-600'}`}>
                    {inv.status}
                  </span>
                </div>
                <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1.5">
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
                    rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">← Prev</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)] border border-[var(--border)]
                    rounded-lg disabled:opacity-40 hover:border-[var(--border-dark)] transition-colors">Next →</button>
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

// ── Invoice Create Modal — 4-step wizard ─────────────────────────────────────

function InvoiceCreateModal({ onClose, onSuccess }) {
  const { user } = useAuth()
  const [step, setStep] = useState(1)

  const [mode, setMode] = useState('job')

  const [jobRef,     setJobRef]     = useState('')
  const [jobData,    setJobData]    = useState(null)
  const [jobLoading, setJobLoading] = useState(false)
  const [jobError,   setJobError]   = useState('')

  const [search,    setSearch]    = useState('')
  const [selected,  setSelected]  = useState(null)
  const [selPages,  setSelPages]  = useState(1)
  const [selSets,   setSelSets]   = useState(1)
  const [selColor,  setSelColor]  = useState(false)
  const [selPaper]                = useState('A4')
  const [selSides]                = useState('SINGLE')
  const [cart,      setCart]      = useState([])

  const [custSearch,   setCustSearch]   = useState('')
  const [custSelected, setCustSelected] = useState(null)
  const [billName,     setBillName]     = useState('')
  const [billCompany,  setBillCompany]  = useState('')
  const [billPhone,    setBillPhone]    = useState('')
  const [billEmail,    setBillEmail]    = useState('')

  const [dueDate,  setDueDate]  = useState('')
  const [vatRate,  setVatRate]  = useState('0')
  const [channel,  setChannel]  = useState('WHATSAPP')
  const [bmNote,   setBmNote]   = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

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
      if (detail.data.customer_name  && !billName)  setBillName(detail.data.customer_name)
      if (detail.data.customer_phone && !billPhone) setBillPhone(detail.data.customer_phone)
    } catch { setJobError('Could not fetch job. Try again.') }
    finally   { setJobLoading(false) }
  }

  const step1Valid = mode === 'job' ? !!jobData : cart.length > 0
  const step2Valid = billName.trim().length > 0
  const step3Valid = step2Valid
  const step4Valid = step3Valid

  const handleSubmit = async () => {
    setCreateError(''); setCreating(true)
    try {
      const payload = {
        invoice_type: 'TAX', bill_to_name: billName,
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

  const STEPS = ['Source', 'Bill To', 'Delivery', 'Preview']

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-[var(--panel)] w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl
        shadow-2xl flex flex-col overflow-hidden animate-slideUp h-[92vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <div className="font-black text-base text-[var(--text)]">New Invoice</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">Step {step} of 4 — {STEPS[step-1]}</div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg)] text-[var(--text-3)] transition-colors">✕</button>
        </div>

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

        {step === 1 && (
          <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 space-y-4 min-h-0">
            <div>
              <label className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block mb-1.5">Source</label>
              <div className="relative flex bg-[var(--bg)] p-1 rounded-2xl overflow-hidden">
                <div className="absolute top-1 bottom-1 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                  style={{
                    width: 'calc(50% - 2px)',
                    left: mode === 'job' ? '4px' : 'calc(50% - 2px)',
                    background: mode === 'job'
                      ? 'linear-gradient(135deg,#059669,#047857)'
                      : 'linear-gradient(135deg,#d97706,#b45309)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2)',
                  }} />
                {[
                  { value: 'job',        label: 'From a Job' },
                  { value: 'standalone', label: 'Standalone' },
                ].map(m => (
                  <button key={m.value}
                    onClick={() => { setMode(m.value); setJobData(null); setJobError(''); setCart([]) }}
                    className="relative flex-1 py-2 text-xs font-bold rounded-xl transition-colors duration-200 z-10"
                    style={{color: mode === m.value ? '#fff' : 'var(--text-3)'}}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

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

            {mode === 'standalone' && (
              <div className="space-y-3">
                <input type="text" value={search} onChange={e => { setSearch(e.target.value); setSelected(null) }}
                  placeholder="Search services…"
                  className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--border-dark)]"
                />

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
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="h-px bg-[var(--border)]" />

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

        {step === 3 && (
          <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 space-y-4 min-h-0">
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-2">Summary</div>
                <div className="flex items-center justify-between">
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
              <div className="flex gap-2">
                {['WHATSAPP', 'EMAIL', 'BOTH'].map(c => (
                  <button key={c} onClick={() => setChannel(c)}
                    className={`flex-1 py-2.5 rounded-xl border-2 transition-colors font-bold text-[10px] uppercase tracking-wider
                      ${channel === c
                        ? 'bg-[var(--text)] border-[var(--text)] text-white'
                        : 'border-[var(--border)] text-[var(--text-3)]'}`}>
                    {c === 'BOTH' ? 'Both' : c.charAt(0) + c.slice(1).toLowerCase()}
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
                <div className="px-6 pt-6 pb-4 border-b border-zinc-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-black text-xl text-zinc-900 tracking-tight">Farhat Printing Press</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {user?.branch_detail?.name || user?.branch_name || 'Branch'}
                      </div>
                    </div>
                    <div className="text-xs font-black px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                      TAX INVOICE
                    </div>
                  </div>
                </div>

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

                {bmNote && (
                  <div className="px-6 py-4 border-t border-zinc-100">
                    <div className="px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                      <div className="text-[9px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">Note</div>
                      <div className="text-xs text-amber-800">{bmNote}</div>
                    </div>
                  </div>
                )}

                <div className="px-6 py-3 border-t border-zinc-100 text-center">
                  <div className="text-[10px] text-zinc-400">Thank you for your business — Farhat Printing Press</div>
                </div>
              </div>
            </div>
          )
        })()}

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
              disabled={step === 1 ? !step1Valid : step === 2 ? !step2Valid : !step3Valid}
              className="flex-1 py-2.5 bg-[var(--text)] text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
              {step === 3 ? 'Preview →' : 'Next →'}
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={creating || !step4Valid}
              className="flex-1 py-2.5 bg-[var(--text)] text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
              {creating ? 'Creating…' : 'Create Tax Invoice'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}