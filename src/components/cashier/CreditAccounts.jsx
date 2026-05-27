// src/components/cashier/CreditAccounts.jsx
// Lists all active credit accounts. Cashier can settle outstanding balances.

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCreditAccounts, settleCreditAccount } from '../../api/cashier'

function fmt(amount) {
  return `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

const STATUS_STYLES = {
  ACTIVE:    'bg-[var(--green-bg)] text-[var(--green-text)] border-[var(--green-border)]',
  SUSPENDED: 'bg-[var(--amber-bg)] text-[var(--amber-text)] border-[var(--amber-border)]',
  CLOSED:    'bg-[var(--red-bg)] text-[var(--red-text)] border-[var(--red-border)]',
}

function SettleModal({ account, onClose }) {
  const queryClient = useQueryClient()
  const [amount,  setAmount]  = useState('')
  const [method,  setMethod]  = useState('CASH')
  const [ref,     setRef]     = useState('')
  const [error,   setError]   = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: (payload) => settleCreditAccount(account.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditAccounts'] })
      onClose()
    },
    onError: (err) => setError(err.response?.data?.detail || 'Settlement failed.'),
  })

  const isReady = () => {
    const a = parseFloat(amount || 0)
    if (a <= 0 || a > parseFloat(account.current_balance)) return false
    if (method === 'MOMO' && !/^\d{11}$/.test(ref)) return false
    return true
  }

  const handleSubmit = () => {
    setError('')
    const payload = { amount, payment_method: method }
    if (method === 'MOMO') payload.momo_reference = ref
    if (method === 'POS')  payload.pos_approval_code = ref
    mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-sm mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <div className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">
              Settle Credit
            </div>
            <div className="font-bold text-[var(--text)] mt-0.5">
              {account.customer_name}
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
              hover:bg-[var(--bg)] text-[var(--text-3)]">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Balance info */}
          <div className="p-3 bg-[var(--amber-bg)] border border-[var(--amber-border)]
            rounded-lg text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--amber-text)] font-medium">Outstanding</span>
              <span className="font-mono font-bold text-[var(--amber-text)]">
                {fmt(account.current_balance)}
              </span>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
              Amount to Settle <span className="text-[var(--red-text)]">*</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              max={account.current_balance}
              placeholder="0.00"
              className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                rounded-lg text-sm font-mono outline-none focus:border-[var(--border-dark)]"
            />
          </div>

          {/* Method */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['CASH', 'MOMO', 'POS'].map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`py-2 rounded-lg text-sm font-bold border transition-colors
                    ${method === m
                      ? 'bg-[var(--text)] text-white border-[var(--text)]'
                      : 'bg-[var(--bg)] text-[var(--text-2)] border-[var(--border)]'
                    }`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Reference */}
          {(method === 'MOMO' || method === 'POS') && (
            <div>
              <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
                {method === 'MOMO' ? 'MoMo Reference' : 'POS Approval Code'}
                <span className="text-[var(--red-text)]"> *</span>
              </label>
              <input
                type="text"
                value={ref}
                onChange={e => setRef(e.target.value)}
                maxLength={method === 'MOMO' ? 11 : undefined}
                placeholder={method === 'MOMO' ? '11-digit reference' : 'Approval code'}
                className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                  rounded-lg text-sm font-mono outline-none focus:border-[var(--border-dark)]"
              />
            </div>
          )}

          {error && (
            <div className="px-3 py-2.5 bg-[var(--red-bg)] border border-[var(--red-border)]
              rounded-lg text-sm text-[var(--red-text)]">{error}</div>
          )}
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={handleSubmit}
            disabled={!isReady() || isPending}
            className="w-full py-3 bg-[var(--text)] text-white text-sm font-bold
              rounded-xl disabled:opacity-40">
            {isPending ? 'Processing…' : 'Confirm Settlement'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CreditAccounts() {
  const [search,         setSearch]         = useState('')
  const [settlingAccount, setSettlingAccount] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['creditAccounts'],
    queryFn: () => getCreditAccounts().then(r => r.data),
    refetchInterval: 60_000,
  })

  const accounts = Array.isArray(data) ? data : (data?.results || [])
  const active   = accounts.filter(a => a.status === 'ACTIVE')

  const filtered = active.filter(a =>
    !search ||
    a.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.organisation_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Credit Accounts</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            Active accounts — settle outstanding balances
          </p>
        </div>
        <div className="px-3 py-1 bg-[var(--panel)] border border-[var(--border)]
          rounded-full text-sm font-semibold text-[var(--text-2)]">
          {active.length} active
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by customer or organisation…"
          className="w-full px-3 py-2.5 bg-[var(--panel)] border border-[var(--border)]
            rounded-lg text-sm text-[var(--text)] outline-none
            focus:border-[var(--border-dark)] transition-colors"
        />
      </div>

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
          <p className="text-sm font-semibold text-[var(--text-2)]">No active accounts</p>
          <p className="text-xs text-[var(--text-3)] mt-1">
            {search ? 'No accounts match your search' : 'No active credit accounts found'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(account => (
            <div key={account.id}
              className="bg-[var(--panel)] border border-[var(--border)] rounded-xl
                px-4 py-3 flex items-center gap-4">

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-[var(--text)] truncate">
                  {account.customer_name}
                </div>
                <div className="text-xs text-[var(--text-3)] mt-0.5 truncate">
                  {account.organisation_name || account.account_type}
                  {account.contact_phone ? ` · ${account.contact_phone}` : ''}
                </div>
              </div>

              {/* Balance */}
              <div className="text-right shrink-0">
                <div className={`font-mono font-bold text-sm
                  ${parseFloat(account.current_balance) > 0
                    ? 'text-[var(--amber-text)]'
                    : 'text-[var(--green-text)]'}`}>
                  {fmt(account.current_balance)}
                </div>
                <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                  of {fmt(account.credit_limit)} limit
                </div>
              </div>

              {/* Settle button — only if balance > 0 */}
              {parseFloat(account.current_balance) > 0 && (
                <button
                  onClick={() => setSettlingAccount(account)}
                  className="shrink-0 px-3 py-1.5 bg-[var(--amber-bg)] border
                    border-[var(--amber-border)] text-[var(--amber-text)] text-xs
                    font-bold rounded-lg hover:opacity-80 transition-opacity">
                  Settle
                </button>
              )}

            </div>
          ))}
        </div>
      )}

      {settlingAccount && (
        <SettleModal
          account={settlingAccount}
          onClose={() => setSettlingAccount(null)}
        />
      )}
    </div>
  )
}