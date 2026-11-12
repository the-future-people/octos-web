// src/components/cashier/PaymentQueue.jsx
// The cashier's queue (redesigned 12 Nov 2026): who each job is for (the
// record, else the WhatsApp chat, else walk-in: jobs/services/labels.py), what
// it is, who recorded it and when, how long they have waited, and one action.
// Counter sales are paid in full now; production takes a deposit now and the
// balance at pickup. Polls every 15s.

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getPaymentQueue } from '../../api/cashier'
import PaymentModal from './PaymentModal'

const fmt = amount => `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`

function waited(dateStr) {
  const minutes = dateStr ? Math.max(0, Math.floor((Date.now() - new Date(dateStr)) / 60000)) : 0
  const label = minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`
  // Amber after 5 minutes, red after 15: colour means "look at this".
  const tone = minutes >= 15 ? 'text-red-600' : minutes >= 5 ? 'text-amber-700' : 'text-[var(--text-2)]'
  return { label, tone }
}
const clock = iso => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '')

// Outline icons, in the sidebar's style.
const Icon = ({ d, size = 17 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">{d}</svg>
)
const ICON = {
  counter: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /></>,
  production: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  hourglass: <><path d="M5 22h14M5 2h14" /><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22" /><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" /></>,
  chat: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  coins: <><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /></>,
  clear: <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
}

const KINDS = [
  { id: 'instant',   label: 'Counter sales', icon: 'counter' },
  { id: 'processed', label: 'Production',    icon: 'production' },
]

export default function PaymentQueue() {
  const [activeJob, setActiveJob] = useState(null)
  const [kind, setKind] = useState('instant')
  const { data, isLoading } = useQuery({
    queryKey: ['paymentQueue', kind],
    queryFn: () => getPaymentQueue(kind).then(r => r.data),
    refetchInterval: 15_000,
  })

  const jobs = Array.isArray(data) ? data : (data?.results || [])
  // Counts cover both queues, so the other tab's badge stays true.
  const counts = data?.counts || {}

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <h2 className="text-[22px] font-extrabold text-[var(--text)]">Payment queue</h2>
          <p className="text-sm text-[var(--text-3)] mt-0.5">Oldest first. Tap a customer to take their payment.</p>
        </div>
        <div className="ml-auto flex gap-2">
          {KINDS.map(({ id, label, icon }) => {
            const active = kind === id
            return (
              <button key={id} type="button" onClick={() => setKind(id)} aria-pressed={active}
                      className={`flex items-center gap-2 h-10 px-4 rounded-full text-sm transition-colors
                        ${active ? 'bg-[var(--text)] text-white font-bold' : 'bg-[var(--panel)] border border-[var(--border)] font-semibold text-[var(--text-2)]'}`}>
                <Icon d={ICON[icon]} size={16} />
                {label}
                <span className={`text-xs rounded-full ${active ? 'px-2 py-0.5 bg-white/20' : 'text-[var(--text-3)]'}`}>
                  {counts[id] ?? 0}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-[var(--panel)] border border-[var(--border)] rounded-2xl animate-pulse" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--bg)] grid place-items-center mb-3 text-[var(--text-3)]">
            <Icon d={ICON.clear} size={22} />
          </div>
          <p className="text-sm font-semibold text-[var(--text-2)]">
            {kind === 'processed' ? 'No production deposits waiting' : 'Queue is clear'}
          </p>
          <p className="text-xs text-[var(--text-3)] mt-1">Nobody is waiting to pay right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => {
            const w = waited(job.created_at)
            const production = kind === 'processed'
            return (
              <button key={job.id} type="button" onClick={() => setActiveJob(job)}
                      className="w-full text-left grid grid-cols-[84px_minmax(0,1fr)_auto] gap-4 items-center
                                 bg-[var(--panel)] border border-[var(--border)] rounded-2xl px-5 py-4 hover:border-black/30 transition-colors">
                <div className="text-center">
                  <div className={`flex justify-center ${w.tone}`}><Icon d={ICON.hourglass} size={15} /></div>
                  <div className={`font-mono text-lg font-bold ${w.tone}`}>{w.label}</div>
                  <div className="text-[11px] font-semibold text-[var(--text-3)]">waiting</div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[16.5px] font-extrabold text-[var(--text)]">{job.for_whom || job.customer_name || 'Walk-in'}</span>
                    {job.from_chat && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800">
                        <Icon d={ICON.chat} size={12} />WhatsApp
                      </span>
                    )}
                    <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md
                                      ${production ? 'bg-amber-50 text-amber-800' : 'bg-indigo-50 text-indigo-800'}`}>
                      {production ? `PRODUCTION · ${job.deposit_percentage || 70}% DEPOSIT` : 'COUNTER SALE'}
                    </span>
                  </div>
                  <div className="text-sm text-[var(--text-2)] mt-0.5 truncate">{job.services_summary || job.title || ''}</div>
                  <div className="text-[12.5px] text-[var(--text-3)] mt-0.5">
                    {job.job_number} · recorded by {job.recorded_by || job.intake_by_name || '—'} at {clock(job.created_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xl font-bold text-[var(--text)]">{fmt(job.estimated_cost)}</div>
                  <span className="inline-flex items-center gap-2 mt-2 h-10 px-4 rounded-xl bg-[var(--text)] text-white text-sm font-bold">
                    <Icon d={ICON.coins} size={16} />Take payment
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {activeJob && <PaymentModal job={activeJob} onClose={() => setActiveJob(null)} />}
    </div>
  )
}
