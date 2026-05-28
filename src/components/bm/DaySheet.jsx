// src/components/bm/DaySheet.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTodaySummary, getLockStatus } from '../../api/bm'
import CloseSheetModal from './CloseSheetModal'

function fmt(amount) {
  return `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function pct(val) {
  return `${parseFloat(val || 0).toFixed(1)}%`
}

export default function DaySheet() {
  const [showCloseModal, setShowCloseModal] = useState(false)

  const { data: summary, isLoading } = useQuery({
    queryKey: ['todaySummary'],
    queryFn:  () => getTodaySummary().then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: lockData } = useQuery({
    queryKey: ['lockStatus'],
    queryFn:  () => getLockStatus().then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 0,
  })

  if (isLoading) return (
    <div className="p-6 space-y-4">
      {[1,2,3].map(i => (
        <div key={i} className="h-24 bg-[var(--panel)] border border-[var(--border)]
          rounded-xl animate-pulse" />
      ))}
    </div>
  )

  const meta      = summary?.meta      || {}
  const revenue   = summary?.revenue   || {}
  const jobs      = summary?.jobs      || {}
  const pace      = summary?.pace      || {}
  const inventory = summary?.inventory || []
  const alerts    = summary?.alerts    || []

  const minsToClose   = lockData?.mins_to_close ?? 999
  const canClose      = lockData?.can_close_sheet
  const showCloseBtn  = minsToClose <= 30
  const lowStockItems = inventory.filter(i => i.is_low)

  return (
    <div className="p-5 sm:p-6 space-y-5">

      {/* Sheet header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Day Sheet</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {meta.sheet_number} · {meta.date} · {meta.status}
          </p>
        </div>
        {showCloseBtn && (
          <button
            disabled={!canClose}
            onClick={() => canClose && setShowCloseModal(true)}
            className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-colors
              flex items-center gap-2
              ${canClose
                ? 'bg-[var(--text)] text-white hover:opacity-90'
                : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text-3)] cursor-not-allowed'
              }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
              <line x1="6" y1="1" x2="6" y2="4"/>
              <line x1="10" y1="1" x2="10" y2="4"/>
              <line x1="14" y1="1" x2="14" y2="4"/>
            </svg>
            {canClose ? 'Close Day Sheet' : 'Waiting for cashier sign-off'}
          </button>
        )}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="p-3 bg-[var(--amber-bg)] border border-[var(--amber-border)]
          rounded-xl flex items-start gap-2">
          <span className="text-[var(--amber-text)] shrink-0 mt-0.5">⚠</span>
          <div className="text-xs text-[var(--amber-text)]">
            {alerts.map((a, i) => <div key={i}>{a.message}</div>)}
          </div>
        </div>
      )}

      {/* Revenue cards */}
      <div>
        <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
          tracking-widest mb-2">Revenue</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Cash',           value: revenue.cash,            color: 'border-t-emerald-500', textColor: 'text-emerald-600' },
            { label: 'MoMo',           value: revenue.momo,            color: 'border-t-amber-400',   textColor: 'text-amber-600'  },
            { label: 'POS',            value: revenue.pos,             color: 'border-t-blue-500',    textColor: 'text-blue-600'   },
            { label: 'Net Cash in Till', value: revenue.net_cash_in_till, color: 'border-t-zinc-400',  textColor: 'text-[var(--text)]' },
          ].map(card => (
            <div key={card.label}
              className={`bg-[var(--panel)] border border-[var(--border)] border-t-4
                ${card.color} rounded-xl p-4`}>
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                tracking-wider mb-2">{card.label}</div>
              <div className={`font-mono font-black text-xl ${card.textColor}`}>
                {fmt(card.value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total revenue */}
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4
        flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">
            Total Collected
          </div>
          <div className="font-mono font-black text-2xl text-[var(--text)]">
            {fmt(revenue.total)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">
            Credit Issued
          </div>
          <div className="font-mono font-bold text-lg text-[var(--amber-text)]">
            {fmt(revenue.credit_issued)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">
            Petty Cash Out
          </div>
          <div className="font-mono font-bold text-lg text-[var(--red-text)]">
            {fmt(revenue.petty_cash_out)}
          </div>
        </div>
      </div>

      {/* Job stats */}
      <div>
        <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
          tracking-widest mb-2">Jobs</div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: 'Total',    value: jobs.total,       color: 'text-[var(--text)]'    },
            { label: 'Complete', value: jobs.complete,    color: 'text-emerald-600'       },
            { label: 'In Progress', value: jobs.in_progress, color: 'text-amber-600'    },
            { label: 'Pending',  value: jobs.pending,     color: 'text-red-500'          },
            { label: 'Registered', value: jobs.registered, color: 'text-blue-600'       },
            { label: 'Walk-in',  value: jobs.walkin,      color: 'text-[var(--text-2)]' },
          ].map(card => (
            <div key={card.label}
              className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-3 text-center">
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                tracking-wider mb-1">{card.label}</div>
              <div className={`font-mono font-black text-xl ${card.color}`}>
                {card.value ?? '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analytics strip */}
      <div>
        <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
          tracking-widest mb-2">Pace & Predictions</div>
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                tracking-wider mb-1">Jobs / Hour</div>
              <div className="font-mono font-black text-xl text-[var(--text)]">
                {pace.jobs_per_hour?.toFixed(1) ?? '—'}
              </div>
              {pace.pace_change_pct != null && (
                <div className={`text-[10px] mt-0.5 font-semibold
                  ${pace.pace_change_pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {pace.pace_change_pct >= 0 ? '↑' : '↓'} {Math.abs(pace.pace_change_pct).toFixed(1)}% vs yesterday
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                tracking-wider mb-1">Predicted EOD Jobs</div>
              <div className="font-mono font-black text-xl text-[var(--text)]">
                {pace.predicted_jobs_eod ?? '—'}
              </div>
              <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                {pace.confidence_pct}% confidence
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                tracking-wider mb-1">Predicted Revenue</div>
              <div className="font-mono font-black text-xl text-[var(--text)]">
                {fmt(pace.predicted_revenue_eod)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                tracking-wider mb-1">Avg Job Value</div>
              <div className="font-mono font-black text-xl text-[var(--text)]">
                {fmt(pace.avg_job_value_today)}
              </div>
              <div className="text-[10px] text-[var(--text-3)] mt-0.5">
                7d avg: {fmt(pace.avg_job_value_7d)}
              </div>
            </div>
          </div>

          {/* Confidence bar */}
          {pace.confidence_pct != null && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[var(--text-3)]">Prediction confidence</span>
                <span className="text-[10px] font-bold text-[var(--text)]">{pace.confidence_pct}%</span>
              </div>
              <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${pace.confidence_pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inventory */}
      {lowStockItems.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
            tracking-widest mb-2">Low Stock ({lowStockItems.length} items)</div>
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="hidden sm:grid grid-cols-12 px-4 py-2 border-b border-[var(--border)]
              text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
              <span className="col-span-5">Item</span>
              <span className="col-span-2 text-right">Opening</span>
              <span className="col-span-2 text-right">Consumed</span>
              <span className="col-span-2 text-right">Closing</span>
              <span className="col-span-1 text-right">Reorder</span>
            </div>
            {lowStockItems.map((item, i) => (
              <div key={i}
                className="grid grid-cols-12 px-4 py-2.5 border-b border-[var(--border)]
                  last:border-0 items-center">
                <div className="col-span-5">
                  <div className="text-xs font-semibold text-[var(--text)]">{item.consumable}</div>
                  <div className="text-[10px] text-[var(--text-3)]">{item.category} · {item.unit}</div>
                </div>
                <div className="col-span-2 text-right text-xs text-[var(--text-2)]">{item.opening}</div>
                <div className="col-span-2 text-right text-xs text-[var(--text-2)]">{item.consumed}</div>
                <div className="col-span-2 text-right">
                  <span className="font-mono font-bold text-xs text-[var(--red-text)]">
                    {item.closing}
                  </span>
                </div>
                <div className="col-span-1 text-right text-[10px] text-[var(--text-3)]">
                  {item.reorder_point}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    {showCloseModal && (
        <CloseSheetModal
          sheetId={meta.sheet_id}
          summary={summary}
          onClose={() => setShowCloseModal(false)}
          onSuccess={() => setShowCloseModal(false)}
        />
      )}
    </div>
  )
}