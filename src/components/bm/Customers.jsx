// src/components/bm/Customers.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCustomers } from '../../api/bm'
import NewCustomerModal from './NewCustomerModal'

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 30)  return `${diff}d ago`
  if (diff < 365) return `${Math.floor(diff/30)}mo ago`
  return `${Math.floor(diff/365)}y ago`
}

const TIER_COLORS = {
  VIP:     'bg-amber-50 text-amber-700 border-amber-200',
  PREMIUM: 'bg-blue-50 text-blue-700 border-blue-200',
  REGULAR: 'bg-zinc-50 text-zinc-600 border-zinc-200',
}

const TYPE_COLORS = {
  INDIVIDUAL:  'bg-[var(--bg)] text-[var(--text-3)] border-[var(--border)]',
  CORPORATE:   'bg-blue-50 text-blue-700 border-blue-200',
  INSTITUTION: 'bg-violet-50 text-violet-700 border-violet-200',
}

export default function Customers() {
  const [tab,             setTab]             = useState('all')
  const [search,          setSearch]          = useState('')
  const [page,            setPage]            = useState(1)
  const [selected,        setSelected]        = useState(null)
  const [showNewCustomer, setShowNewCustomer] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', tab, search, page],
    queryFn:  () => getCustomers({
      search,
      page,
      page_size: 15,
      ...(tab === 'individuals'  ? { customer_type: 'INDIVIDUAL'  } : {}),
      ...(tab === 'businesses'   ? { customer_type: 'BUSINESS'    } : {}),
      ...(tab === 'institutions' ? { customer_type: 'INSTITUTION' } : {}),
    }).then(r => r.data),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })

  const customers = Array.isArray(data) ? data : (data?.results || [])
  const count     = data?.count || 0
  const totalPages = Math.ceil(count / 15)

  return (
    <div className="p-5 sm:p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Customers</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {count} registered customers
          </p>
        </div>
        <button
          onClick={() => setShowNewCustomer(true)}
          className="px-4 py-2 bg-[var(--text)] text-white text-sm font-bold
            rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Customer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-black/5 p-1 rounded-xl">
        {[
          { key: 'all',          label: 'All'          },
          { key: 'individuals',  label: 'Individuals'  },
          { key: 'businesses',   label: 'Businesses'   },
          { key: 'institutions', label: 'Institutions' },
        ].map(t => (
          <button key={t.key}
            onClick={() => { setTab(t.key); setPage(1); setSelected(null) }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors
              ${tab === t.key
                ? 'bg-[var(--panel)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
              }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search by name, phone or company..."
          className="w-full px-3 py-2.5 bg-[var(--panel)] border border-[var(--border)]
            rounded-lg text-sm text-[var(--text)] outline-none
            focus:border-[var(--border-dark)] transition-colors"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-16 bg-[var(--panel)] border border-[var(--border)]
              rounded-xl animate-pulse" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          flex flex-col items-center justify-center py-16">
          <p className="text-sm font-semibold text-[var(--text-2)]">No customers found</p>
          <p className="text-xs text-[var(--text-3)] mt-1">Try a different search term</p>
        </div>
      ) : (
        <>
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-12 px-4 py-2 mb-1
            text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
            <span className="col-span-4">Customer</span>
            <span className="col-span-2">Phone</span>
            <span className="col-span-2">Type</span>
            <span className="col-span-1 text-center">Visits</span>
            <span className="col-span-1 text-center">Tier</span>
            <span className="col-span-2 text-right">Since</span>
          </div>

          <div className="space-y-1.5">
            {customers.map(c => (
              <div key={c.id}
                onClick={() => setSelected(selected?.id === c.id ? null : c)}
                className="bg-[var(--panel)] border border-[var(--border)] rounded-xl
                  px-4 py-3 cursor-pointer hover:border-[var(--border-dark)]
                  transition-colors">

                {/* Mobile */}
                <div className="flex items-center justify-between sm:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[var(--text)] truncate">
                      {c.customer_type === 'INDIVIDUAL' ? c.full_name : (c.company_name || c.full_name)}
                    </div>
                    <div className="text-xs text-[var(--text-3)] mt-0.5">
                      {c.customer_type !== 'INDIVIDUAL' && c.full_name ? `Rep: ${c.full_name} · ` : ''}{c.phone}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border
                      ${TIER_COLORS[c.tier] || TIER_COLORS.REGULAR}`}>
                      {c.tier}
                    </span>
                    <div className="text-[10px] text-[var(--text-3)] mt-1">
                      {c.visit_count} visits
                    </div>
                  </div>
                </div>

                {/* Desktop */}
                <div className="hidden sm:grid grid-cols-12 items-center">
                  <div className="col-span-4 min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)] truncate">
                      {c.customer_type === 'INDIVIDUAL' ? c.full_name : (c.company_name || c.full_name)}
                    </div>
                    {c.customer_type !== 'INDIVIDUAL' && c.full_name && (
                      <div className="text-[10px] text-[var(--text-3)] truncate mt-0.5">
                        Rep: {c.full_name}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 text-xs text-[var(--text-2)] font-mono">
                    {c.phone}
                  </div>
                  <div className="col-span-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border
                      ${TYPE_COLORS[c.customer_type] || TYPE_COLORS.INDIVIDUAL}`}>
                      {c.customer_type}
                    </span>
                  </div>
                  <div className="col-span-1 text-center">
                    <span className="font-mono text-sm font-bold text-[var(--text)]">
                      {c.visit_count}
                    </span>
                  </div>
                  <div className="col-span-1 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border
                      ${TIER_COLORS[c.tier] || TIER_COLORS.REGULAR}`}>
                      {c.tier}
                    </span>
                  </div>
                  <div className="col-span-2 text-right text-xs text-[var(--text-3)]">
                    {timeAgo(c.created_at)}
                  </div>
                </div>

                {/* Expanded detail */}
                {selected?.id === c.id && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)]
                    grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                        tracking-wider mb-1">Gender</div>
                      <div className="text-sm text-[var(--text)]">{c.gender || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                        tracking-wider mb-1">Confidence</div>
                      <div className="text-sm font-mono font-bold text-[var(--text)]">
                        {c.confidence_score}%
                      </div>
                    </div>
                    {c.secondary_phone && (
                      <div>
                        <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                          tracking-wider mb-1">Alt Phone</div>
                        <div className="text-sm font-mono text-[var(--text)]">
                          {c.secondary_phone}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                        tracking-wider mb-1">Priority</div>
                      <div className={`text-sm font-bold
                        ${c.is_priority ? 'text-amber-600' : 'text-[var(--text-3)]'}`}>
                        {c.is_priority ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-[var(--text-3)]">
                Page {page} of {totalPages} · {count} customers
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)]
                    border border-[var(--border)] rounded-lg disabled:opacity-40
                    hover:border-[var(--border-dark)] transition-colors">
                  ← Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)]
                    border border-[var(--border)] rounded-lg disabled:opacity-40
                    hover:border-[var(--border-dark)] transition-colors">
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {showNewCustomer && (
        <NewCustomerModal
          onClose={() => setShowNewCustomer(false)}
          onSuccess={() => setShowNewCustomer(false)}
        />
      )}
    </div>
  )
}