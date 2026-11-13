// src/components/cashier/Balances.jsx
// Balances (13 Nov 2026): money still to settle. Due at pickup: production
// and design jobs with a deposit paid and a balance owing, finished ones
// first, so the balance is taken before the attendant hands over. Below it,
// credit accounts and wallets, as before (CreditAccounts).

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import CreditAccounts from './CreditAccounts'
import PaymentModal from './PaymentModal'

const fmt = v => `GHS ${parseFloat(v || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
const STATE = { DONE: 'Ready for pickup', IN_PRODUCTION: 'Being made', RECEIVED: 'Not started', FINISHING: 'Finishing' }

const Icon = ({ d, size = 17 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">{d}</svg>
)
const HOURGLASS = <><path d="M5 22h14M5 2h14" /><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22" /><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" /></>
const COINS = <><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /></>
const CHAT = <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />

export default function Balances() {
  const [taking, setTaking] = useState(null)
  const { data, isLoading } = useQuery({
    queryKey: ['cashierBalances'],
    queryFn: () => client.get('/api/v1/jobs/cashier/balances/').then(r => r.data),
    refetchInterval: 30_000,
  })
  const rows = data?.results || []

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[22px] font-extrabold text-[var(--text)]">Balances</h2>
        <p className="text-sm text-[var(--text-3)] mt-0.5">Money still to settle: balances on production work, what customers owe, and what is held for them.</p>
      </div>

      <section className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className="flex items-center gap-2 text-[12.5px] font-extrabold tracking-wider text-amber-800"><Icon d={HOURGLASS} />DUE AT PICKUP</h3>
          <span className="ml-auto font-mono text-[15px] font-bold text-amber-700">{fmt(data?.total)}</span>
        </div>
        <p className="text-[13px] text-[var(--text-3)] mb-2">A deposit was paid; take the balance before the attendant hands it over.</p>
        {isLoading && <div className="h-16 rounded-xl bg-[var(--bg)] animate-pulse" />}
        {!isLoading && rows.length === 0 && <p className="text-sm text-[var(--text-3)] py-4">No balances owing right now.</p>}
        {rows.map(job => (
          <div key={job.id} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_120px_auto] gap-3 items-center py-3 border-t border-[var(--border)]">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-bold">{job.for_whom || job.customer_name || 'Walk-in'}</span>
                {job.from_chat && (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800"><Icon d={CHAT} size={11} />WhatsApp</span>
                )}
              </div>
              <div className="text-[12.5px] text-[var(--text-3)] truncate">
                {job.job_number}{job.items_display?.length ? ` · ${job.items_display.filter(i => !i.is_addon).map(i => i.name).join(', ')}` : ''}
              </div>
            </div>
            <div className={`text-[13px] ${job.work_state === 'DONE' ? 'font-bold text-emerald-700' : 'text-[var(--text-2)]'}`}>
              {STATE[job.work_state] || job.work_state}
            </div>
            <div className="text-right">
              <div className="font-mono text-[16px] font-bold text-amber-700">{fmt(job.balance_due)}</div>
              <div className="text-[11.5px] text-[var(--text-3)]">of {fmt(job.estimated_cost)}</div>
            </div>
            <button type="button" onClick={() => setTaking(job)}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--text)] text-white text-sm font-bold justify-self-end">
              <Icon d={COINS} size={16} />Take balance
            </button>
          </div>
        ))}
      </section>

      <CreditAccounts />

      {taking && <PaymentModal job={taking} mode="balance" onClose={() => setTaking(null)} />}
    </div>
  )
}
