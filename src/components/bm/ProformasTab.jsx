// src/components/bm/ProformasTab.jsx
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getProformas, issueProforma, convertProforma,
} from '../../api/bm'
import NewProformaModal from './NewProformaModal'

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
            <span className="col-span-3">Customer</span>
            <span className="col-span-2 text-right">Amount</span>
            <span className="col-span-1">Status</span>
            <span className="col-span-2 text-right">Actions</span>
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
                <div className="col-span-3 min-w-0 text-xs text-[var(--text-2)] truncate">
                  {p.customer_name}
                </div>
                <div className="col-span-2 text-right font-mono text-xs font-bold text-[var(--text)]">
                  {fmt(p.total)}
                </div>
                <div className="col-span-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>
                    {s.label}
                  </span>
                </div>
                <div className="col-span-2 flex justify-end gap-1.5">
                  {p.status === 'DRAFT' && (
                    <button onClick={() => issue(p.id)} disabled={issuing}
                      className="px-2.5 py-1 text-[10px] font-bold border border-[var(--border)]
                        rounded-lg hover:border-[var(--border-dark)] disabled:opacity-40
                        transition-colors whitespace-nowrap">
                      Issue
                    </button>
                  )}
                  {p.status === 'ISSUED' && !p.is_expired && (
                    <>
                      <button onClick={() => onOpenDetail?.(p.id, 'revise')}
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