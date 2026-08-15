// src/components/bm/ProformasTab.jsx
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getProformas, issueProforma, convertProforma, getProformaPdf,
} from '../../api/bm'
import NewProformaModal from './NewProformaModal'
import ReviseProformaModal from './ReviseProformaModal'

function fmt(n) {
  return `GHS ${parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function shortDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
}

/**
 * The badge says what to do, not what state a record is in. An issued
 * proforma with three days left is not "issued" in any useful sense — it
 * is a thing that needs chasing before it dies.
 */
function statusOf(p) {
  if (p.status === 'DRAFT')      return { label: 'Draft',     cls: 'bg-zinc-100 text-zinc-600' }
  if (p.status === 'CONVERTED')  return { label: 'Converted', cls: 'bg-emerald-100 text-emerald-700' }
  if (p.status === 'EXPIRED')    return { label: 'Expired',   cls: 'bg-zinc-100 text-zinc-400' }
  if (p.status === 'SUPERSEDED') return { label: 'Revised',   cls: 'bg-zinc-100 text-zinc-500' }
  if (p.days_left !== null && p.days_left <= 3)
    return { label: 'Chase', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'Issued', cls: 'bg-blue-100 text-blue-700' }
}

function subLine(p) {
  if (p.status === 'DRAFT')     return `${shortDate(p.created_at)} · draft`
  if (p.status === 'CONVERTED') return `Accepted ${shortDate(p.converted_at || p.updated_at)}`
  if (p.status === 'EXPIRED')   return `Expired ${shortDate(p.valid_until)}`
  if (p.status === 'SUPERSEDED') return `Replaced by a later version`
  if (p.days_left === null || p.days_left === undefined)
    return `Issued ${shortDate(p.issued_at)}`
  return `Issued ${shortDate(p.issued_at)} · ${p.days_left} day${p.days_left === 1 ? '' : 's'} left`
}

const FILTERS = [
  { value: 'open',       label: 'Open'      },
  { value: 'CONVERTED',  label: 'Converted' },
  { value: 'EXPIRED',    label: 'Expired'   },
  { value: '',           label: 'All'       },
]

export default function ProformasTab({ onOpenDetail }) {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [revising, setRevising]     = useState(null)
  const [sharing, setSharing]       = useState(null)

  const download = async (p) => {
    try {
      const res = await getProformaPdf(p.id)
      const url = URL.createObjectURL(res.data)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `${p.proforma_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setSharing(null)
    } catch {
      setError('Could not build the document.')
      setSharing(null)
    }
  }
  const [filter, setFilter] = useState('open')
  const [page, setPage]     = useState(1)
  const [error, setError]   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['proformas', filter, page],
    queryFn:  () => getProformas({
      status: filter && filter !== 'open' ? filter : undefined,
      page,
      page_size: 10,
    }).then(r => r.data),
    staleTime: 15_000,
    placeholderData: prev => prev,
  })

  const rows  = Array.isArray(data) ? data : (data?.results || [])
  const count = data?.count || rows.length

  // "Open" is not a status the backend knows — it is everything still
  // live, which is DRAFT plus ISSUED.
  const visible = filter === 'open'
    ? rows.filter(p => p.status === 'DRAFT' || p.status === 'ISSUED')
    : rows

  const openValue = visible
    .filter(p => p.status === 'ISSUED')
    .reduce((s, p) => s + parseFloat(p.total || 0), 0)

  const { mutate: issue, isPending: issuing } = useMutation({
    mutationFn: (id) => issueProforma(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['proformas'] }),
    onError:    (e) => setError(e.response?.data?.detail || 'Could not issue this proforma.'),
  })

  // Accepting is a commitment on both sides, so it asks first — and asks
  // what was agreed while it has the manager's attention, rather than
  // recording an empty term and losing the arrangement.
  const [accepting_, setAccepting] = useState(null)
  const [terms, setTerms]          = useState('70')

  const { mutate: accept, isPending: accepting } = useMutation({
    mutationFn: ({ id, agreed_terms }) => convertProforma(id, { agreed_terms }),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['proformas'] })
      queryClient.invalidateQueries({ queryKey: ['paymentQueue'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setAccepting(null)
    },
    onError:    (e) => {
      setError(e.response?.data?.detail || 'Could not accept this proforma.')
      setAccepting(null)
    },
  })

  return (
    <div className="p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Proformas</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {filter === 'open' && openValue > 0
              ? `${visible.length} open · ${fmt(openValue)} outstanding`
              : `${count} proforma${count !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-[var(--bg)] p-1 rounded-xl">
            {FILTERS.map(f => (
              <button key={f.value} onClick={() => { setFilter(f.value); setPage(1) }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors
                  ${filter === f.value
                    ? 'bg-[var(--text)] text-white shadow-sm'
                    : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                  }`}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-xs font-bold bg-[var(--text)] text-white
              rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap">
            + New Proforma
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 bg-[var(--red-bg)] border border-[var(--red-border)]
          rounded-lg text-xs text-[var(--red-text)] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold ml-3">✕</button>
        </div>
      )}

      {isLoading && !data ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-16 bg-[var(--panel)] border border-[var(--border)]
              rounded-xl animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          flex flex-col items-center justify-center py-16">
          <p className="text-sm font-semibold text-[var(--text-2)]">No proformas here</p>
          <p className="text-xs text-[var(--text-3)] mt-1">
            Raise one to quote a customer before the work starts
          </p>
        </div>
      ) : (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 px-4 py-2 border-b border-[var(--border)]
            text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
            <span className="col-span-4">Proforma</span>
            <span className="col-span-2">Customer</span>
            <span className="col-span-2 text-right pr-3">Amount</span>
            <span className="col-span-1">Status</span>
            <span className="col-span-3 text-right">Actions</span>
          </div>

          {visible.map(p => {
            const s       = statusOf(p)
            const urgent  = p.status === 'ISSUED' && p.days_left !== null && p.days_left <= 3
            const faded   = p.status === 'EXPIRED' || p.status === 'SUPERSEDED'
            return (
              <div key={p.id}
                className={`grid grid-cols-1 sm:grid-cols-12 gap-2 items-center px-4 py-3
                  border-b border-[var(--border)] last:border-0 ${faded ? 'opacity-60' : ''}`}>
                <div className="col-span-4 min-w-0 cursor-pointer"
                  onClick={() => onOpenDetail?.(p.id)}>
                  <div className="font-mono text-xs font-bold text-[var(--text)]">
                    {p.proforma_number}
                  </div>
                  <div className={`text-[10px] mt-0.5 ${urgent ? 'text-red-600 font-semibold' : 'text-[var(--text-3)]'}`}>
                    {subLine(p)}
                  </div>
                </div>
                <div className="col-span-2 min-w-0 text-xs text-[var(--text-2)] truncate">
                  {p.customer_name}
                </div>
                <div className="col-span-2 text-right pr-3 font-mono text-xs font-bold text-[var(--text)]">
                  {fmt(p.total)}
                </div>
                <div className="col-span-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>
                    {s.label}
                  </span>
                </div>
                <div className="col-span-3 flex justify-end gap-1.5">
                  {p.status === 'DRAFT' && (
                    <button onClick={() => issue(p.id)} disabled={issuing}
                      className="px-2.5 py-1 text-[10px] font-bold border border-[var(--border)]
                        rounded-lg hover:border-[var(--border-dark)] disabled:opacity-40
                        transition-colors whitespace-nowrap">
                      Issue
                    </button>
                  )}
                  {(p.status === 'ISSUED' || p.status === 'DRAFT') && (
                    <button onClick={() => setSharing(p)}
                      className="px-2.5 py-1 text-[10px] font-bold border border-[var(--border)]
                        rounded-lg hover:border-[var(--border-dark)] transition-colors">
                      Share
                    </button>
                  )}
                  {p.status === 'ISSUED' && !p.is_expired && (
                    <>
                      <button onClick={() => setRevising(p.id)}
                        className="px-2.5 py-1 text-[10px] font-bold border border-[var(--border)]
                          rounded-lg hover:border-[var(--border-dark)] transition-colors">
                        Revise
                      </button>
                      <button onClick={() => { setTerms('70'); setAccepting(p) }} disabled={accepting}
                        className="px-2.5 py-1 text-[10px] font-bold bg-[var(--text)] text-white
                          rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity">
                        Accept
                      </button>
                    </>
                  )}
                  {p.status === 'CONVERTED' && (
                    <button onClick={() => onOpenDetail?.(p.id)}
                      className="px-2.5 py-1 text-[10px] font-bold border border-[var(--border)]
                        rounded-lg hover:border-[var(--border-dark)] transition-colors whitespace-nowrap">
                      View job
                    </button>
                  )}
                  {p.status === 'EXPIRED' && (
                    <button onClick={() => setShowCreate(true)}
                      className="px-2.5 py-1 text-[10px] font-bold border border-[var(--border)]
                        rounded-lg hover:border-[var(--border-dark)] transition-colors whitespace-nowrap">
                      Re-quote
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <NewProformaModal onClose={() => setShowCreate(false)} />
      )}

      {revising && (
        <ReviseProformaModal proformaId={revising} onClose={() => setRevising(null)} />
      )}

      {sharing && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSharing(null)}>
          <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-sm
            overflow-hidden animate-slideUp" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-[var(--border)]">
              <div className="text-sm font-bold text-[var(--text)]">Share proforma</div>
              <div className="text-[11px] text-[var(--text-3)] font-mono mt-0.5">
                {sharing.proforma_number}
              </div>
            </div>
            {/* Only the working channel is coloured, so the eye goes to it
                rather than reading past two dead options. Neither of the
                others is wired: _deliver_invoice only stamps a status, and
                WhatsApp needs the Cloud API and its own SIM. They are shown
                rather than hidden so the shape is known. */}
            <div className="flex gap-2 px-3 pb-3">
              <button onClick={() => download(sharing)}
                className="flex-1 bg-emerald-50 hover:bg-emerald-100 rounded-xl
                  py-3.5 px-2 text-center transition-colors">
                <div className="w-8 h-8 rounded-full bg-emerald-600 mx-auto mb-1.5
                  flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-emerald-900">Download</div>
                <div className="text-[10px] text-emerald-700 mt-0.5">PDF</div>
              </button>

              <button disabled
                className="flex-1 bg-[var(--bg)] rounded-xl py-3.5 px-2 text-center
                  opacity-55 cursor-not-allowed">
                <div className="w-8 h-8 rounded-full bg-[var(--border-dark)] mx-auto mb-1.5
                  flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M17.5 14.4c-.3-.15-1.75-.87-2.02-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.03 1.02-1.03 2.48s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.7.3 1.26.48 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.42.25-.69.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.22-3.74.99 1-3.65-.24-.38a9.86 9.86 0 0 1-1.51-5.26C2.16 6.45 6.6 2.01 12.05 2.01c2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.89-9.88 9.89m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45c6.55 0 11.89-5.34 11.89-11.9a11.82 11.82 0 0 0-3.48-8.41z" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-[var(--text-2)]">WhatsApp</div>
                <div className="text-[10px] text-[var(--text-3)] mt-0.5">Not connected</div>
              </button>

              <button disabled
                className="flex-1 bg-[var(--bg)] rounded-xl py-3.5 px-2 text-center
                  opacity-55 cursor-not-allowed">
                <div className="w-8 h-8 rounded-full bg-[var(--border-dark)] mx-auto mb-1.5
                  flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <polyline points="22 6 12 13 2 6" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-[var(--text-2)]">Email</div>
                <div className="text-[10px] text-[var(--text-3)] mt-0.5">Not connected</div>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {accepting_ && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-md
            overflow-hidden animate-slideUp">
            <div className="px-6 py-4 border-b border-[var(--border)]">
              <div className="font-bold text-[var(--text)]">Accept this proforma</div>
              <div className="text-xs text-[var(--text-3)] mt-0.5">
                {accepting_.proforma_number} · {accepting_.customer_name}
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-[var(--text-2)] leading-relaxed">
                The customer has accepted the pricing and terms on this proforma.
                A job for <span className="font-bold text-[var(--text)]">{fmt(accepting_.total)}</span> will
                be created and sent to the cashier for payment.
              </p>

              <div>
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                  tracking-wider mb-2">What was agreed</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { value: '70',     label: '70% deposit' },
                    { value: '100',    label: 'Paid in full' },
                    { value: 'CREDIT', label: 'On credit'   },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setTerms(opt.value)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-colors
                        ${terms === opt.value
                          ? 'bg-[var(--text)] text-white border-transparent'
                          : 'border-[var(--border)] text-[var(--text-3)] hover:border-[var(--border-dark)]'
                        }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--text-3)] mt-2 leading-relaxed">
                  Recorded on the proforma for reference. The cashier still takes
                  the payment and applies credit, as always.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3">
              <button onClick={() => setAccepting(null)}
                className="px-4 py-2 text-sm font-semibold text-[var(--text-2)]
                  hover:text-[var(--text)] transition-colors">
                Not yet
              </button>
              <button onClick={() => accept({ id: accepting_.id, agreed_terms: terms })}
                disabled={accepting}
                className="px-4 py-2 bg-[var(--text)] text-white text-sm font-bold
                  rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
                {accepting ? 'Sending...' : 'Send to cashier'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}