// src/components/cashier/CreditAccounts.jsx
// Lists all active credit accounts. Cashier can settle outstanding balances.

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCreditAccounts, settleCreditAccount, getWalletBalances } from '../../api/cashier'
import { invalidateAfterCreditSettled } from '../../api/invalidations'
import JobSuccessOverlay from '../shared/JobSuccessOverlay'

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

  const [settled, setSettled] = useState(false)

  const { mutate, isPending } = useMutation({
    mutationFn: (payload) => settleCreditAccount(account.id, payload),
    onSuccess: () => {
      invalidateAfterCreditSettled(queryClient)
      setSettled(true)
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
      {settled && (
        <JobSuccessOverlay
          jobNumber={`GHS ${parseFloat(amount).toFixed(2)}`}
          message="Settlement confirmed"
          onDone={() => { setSettled(false); onClose() }}
        />
      )}
    </div>
  )
}

function AccountRow({ account, onSettle, suspended = false }) {
  return (
    <div className={`border rounded-xl px-4 py-3 flex items-center gap-4
      ${suspended
        ? 'bg-[var(--red-bg)] border-[var(--red-border)]'
        : 'bg-[var(--panel)] border-[var(--border)]'}`}>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-[var(--text)] truncate">
          {account.customer_name}
        </div>
        <div className="text-xs text-[var(--text-3)] mt-0.5 truncate">
          {account.organisation_name || account.account_type}
          {account.contact_phone ? ` · ${account.contact_phone}` : ''}
        </div>
      </div>

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

      {parseFloat(account.current_balance) > 0 && (
        <button
          onClick={() => onSettle(account)}
          className="shrink-0 px-3 py-1.5 bg-[var(--text)] text-white text-xs
            font-bold rounded-lg hover:opacity-90 transition-opacity">
          Settle
        </button>
      )}
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

  const { data: walletData } = useQuery({
    queryKey: ['walletBalances'],
    queryFn: () => getWalletBalances().then(r => r.data),
    refetchInterval: 60_000,
  })

  const accounts = Array.isArray(data) ? data : (data?.results || [])
  const wallets  = Array.isArray(walletData) ? walletData : []

  const matches = (text) =>
    !search || text?.toLowerCase().includes(search.toLowerCase())

  const matchesAccount = (a) =>
    matches(a.customer_name) || matches(a.organisation_name)

  // Suspended accounts still owe money. Suspension stops further credit
  // being extended; it does not stop someone repaying, and hiding the debt
  // from the person who takes payment would mean a customer who walks in to
  // settle cannot be served.
  const activeAccounts    = accounts.filter(a => a.status === 'ACTIVE'    && matchesAccount(a))
  const suspendedAccounts = accounts.filter(a => a.status === 'SUSPENDED' && matchesAccount(a))

  const filteredWallets = wallets.filter(w => matches(w.name) || matches(w.company_name))

  const totalOwed = accounts
    .filter(a => a.status === 'ACTIVE' || a.status === 'SUSPENDED')
    .reduce((sum, a) => sum + parseFloat(a.current_balance || 0), 0)

  const totalHeld = wallets
    .reduce((sum, w) => sum + parseFloat(w.balance || 0), 0)

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[var(--text)]">Collections</h2>
        <p className="text-xs text-[var(--text-3)] mt-0.5">
          What customers owe, and what is being held for them
        </p>
      </div>

      {/* Two exposures, never netted against each other: credit is money
          owed to the branch, wallet credit is money the branch holds for a
          customer. The same person can appear in both. */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">
            Owed to us
          </div>
          <div className="font-mono font-black text-lg text-[var(--amber-text)]">
            {fmt(totalOwed)}
          </div>
          <div className="text-[10px] text-[var(--text-3)] mt-0.5">
            {activeAccounts.length + suspendedAccounts.length} account{activeAccounts.length + suspendedAccounts.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">
            Held for customers
          </div>
          <div className="font-mono font-black text-lg text-[var(--text)]">
            {fmt(totalHeld)}
          </div>
          <div className="text-[10px] text-[var(--text-3)] mt-0.5">
            {filteredWallets.length} customer{filteredWallets.length !== 1 ? 's' : ''}
          </div>
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

 {isLoading && !data ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-[var(--panel)] border border-[var(--border)]
              rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── Owed to us ── */}
          <section className="rounded-2xl border border-[var(--amber-border)]
            bg-[var(--amber-bg)] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--amber-border)]">
              <h3 className="text-sm font-bold text-[var(--amber-text)]">Owed to us</h3>
              <p className="text-[11px] text-[var(--amber-text)] opacity-70 mt-0.5">
                Outstanding customer balances
              </p>
            </div>

            <div className="p-3 space-y-2 overflow-y-auto max-h-[420px]">
              {activeAccounts.length === 0 && suspendedAccounts.length === 0 ? (
                <p className="text-xs text-[var(--text-3)] py-6 text-center">
                  {search ? 'No accounts match your search' : 'Nothing outstanding'}
                </p>
              ) : (
                <>
                  {activeAccounts.map(account => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      onSettle={setSettlingAccount}
                    />
                  ))}

                  {/* Suspended last — these are closed to further credit and
                      should not be mistaken for accounts in good standing. */}
                  {suspendedAccounts.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 pt-3 pb-1">
                        <span className="text-[10px] font-bold text-[var(--red-text)]
                          uppercase tracking-wider">
                          Suspended — no further credit
                        </span>
                        <div className="flex-1 h-px bg-[var(--red-border)]" />
                      </div>
                      {suspendedAccounts.map(account => (
                        <AccountRow
                          key={account.id}
                          account={account}
                          onSettle={setSettlingAccount}
                          suspended
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </section>

          {/* ── Held for customers ── */}
          <section className="rounded-2xl border border-[var(--border)]
            bg-[var(--panel)] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-bold text-[var(--text)]">Held for customers</h3>
              <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                Redeemed against a job — never paid out as cash
              </p>
            </div>

            <div className="p-3 space-y-2 overflow-y-auto max-h-[420px]">
              {filteredWallets.length === 0 ? (
                <p className="text-xs text-[var(--text-3)] py-6 text-center">
                  {search ? 'No customers match your search' : 'No balances held'}
                </p>
              ) : (
                filteredWallets.map(w => (
                  <div key={w.customer_id}
                    className="bg-[var(--bg)] border border-[var(--border)] rounded-xl
                      px-4 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-[var(--text)] truncate">
                        {w.name}
                      </div>
                      <div className="text-xs text-[var(--text-3)] mt-0.5 truncate">
                        {w.company_name || w.phone}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-sm text-[var(--text)] shrink-0">
                      {fmt(w.balance)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

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