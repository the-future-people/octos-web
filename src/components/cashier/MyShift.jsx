// src/components/cashier/MyShift.jsx
// My shift (12 Nov 2026): the drawer, my numbers, and every receipt, in one
// place (Receipts and Today's Log were two views of the same thing).
// "Should be in the drawer" is the same calculation sign-off uses
// (CashierFloat.expected_now), so what she watches all day is what she counts.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import Receipts from './Receipts'

const fmt = v => `GHS ${parseFloat(v || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
const hourLabel = h => (h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`)

const Icon = ({ d, size = 17, color = 'currentColor', width = 1.75 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">{d}</svg>
)
const ICON = {
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></>,
  momo: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>,
  coins: <><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /></>,
  chart: <><path d="M3 3v18h18" /><path d="M7 16v-4" /><path d="M12 16V8" /><path d="M17 16v-7" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  hourglass: <><path d="M5 22h14M5 2h14" /><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22" /><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" /></>,
  chat: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  check: <path d="M20 6 9 17l-5-5" />,
}
const WAIT_AIM = 5   // minutes; the shop's aim for recorded -> paid

function Card({ children, className = '' }) {
  return <section className={`bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-5 ${className}`}>{children}</section>
}
function Heading({ icon, children, right }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <h3 className="flex items-center gap-2 text-[12.5px] font-extrabold tracking-wider text-[var(--text-2)]"><Icon d={ICON[icon]} />{children}</h3>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  )
}

export default function MyShift({ onSignOff }) {
  const [period, setPeriod] = useState('today')
  const { data: today } = useQuery({
    queryKey: ['my-numbers', 'today'],
    queryFn: () => client.get('/api/v1/finance/cashier/my-numbers/', { params: { period: 'today' } }).then(r => r.data),
    refetchInterval: 30_000,
  })
  const { data: chosen } = useQuery({
    queryKey: ['my-numbers', period],
    queryFn: () => client.get('/api/v1/finance/cashier/my-numbers/', { params: { period } }).then(r => r.data),
    enabled: period !== 'today',
  })
  const numbers = period === 'today' ? today : chosen
  const drawer = today?.drawer
  const m = today?.by_method?.methods || {}
  const peakMax = Math.max(1, ...(numbers?.busiest?.by_hour || []).map(h => h.count))
  const wait = numbers?.wait_to_pay_minutes
  const wa = numbers?.whatsapp
  const acc = numbers?.accuracy

  const pill = active => `h-9 px-3.5 rounded-full text-[13px] font-semibold border ${active ? 'bg-[var(--text)] text-white border-transparent' : 'bg-white border-black/15'}`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-[22px] font-extrabold text-[var(--text)]">My shift</h2>
          <p className="text-sm text-[var(--text-3)] mt-0.5">The drawer, your numbers, and every receipt.</p>
        </div>
        {onSignOff && (
          <button type="button" onClick={onSignOff}
                  className="ml-auto inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-[var(--text)] text-white text-[15px] font-extrabold">
            <Icon d={ICON.check} size={18} width={2.25} />Count the drawer and sign off
          </button>
        )}
      </div>

      <Card>
        <Heading icon="cash">THE DRAWER</Heading>
        {drawer ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-[var(--bg)] px-4 py-3"><div className="text-[12.5px] text-[var(--text-2)]">Opening float</div><div className="font-mono text-xl font-bold mt-1">{fmt(drawer.opening_float)}</div></div>
            <div className="rounded-xl bg-[var(--bg)] px-4 py-3">
              <div className="text-[12.5px] text-[var(--text-2)]">Cash taken</div>
              <div className="font-mono text-xl font-bold mt-1">{fmt(drawer.cash_collected)}</div>
              {parseFloat(drawer.petty_cash_out) > 0 && <div className="text-xs text-[var(--text-3)]">less {fmt(drawer.petty_cash_out)} petty cash</div>}
            </div>
            <div className="rounded-xl bg-emerald-50 px-4 py-3"><div className="text-[12.5px] font-bold text-emerald-800">Should be in the drawer</div><div className="font-mono text-xl font-bold mt-1 text-emerald-800">{fmt(drawer.expected)}</div><div className="text-xs text-emerald-800">what you will count at sign-off</div></div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-3)]">No open float right now. The drawer appears once your float is acknowledged.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          {[['momo', 'MoMo', 'MOMO', 'text-amber-700'], ['card', 'Card (POS)', 'POS', 'text-blue-700'], ['coins', 'All methods', null, 'text-[var(--text)]']].map(([ic, name, key, tone]) => {
            const v = key ? m[key] : { amount: today?.by_method?.total, count: today?.by_method?.count }
            return (
              <div key={name} className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3">
                <span className={tone}><Icon d={ICON[ic]} size={20} /></span>
                <div><div className="text-[12.5px] text-[var(--text-2)]">{name} · {v?.count || 0}</div><div className={`font-mono text-[17px] font-bold ${tone}`}>{fmt(v?.amount)}</div></div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <Heading icon="chart" right={
          <div className="flex gap-1.5">
            <button type="button" className={pill(period === 'today')} onClick={() => setPeriod('today')} aria-pressed={period === 'today'}>Today</button>
            <button type="button" className={pill(period === '30d')} onClick={() => setPeriod('30d')} aria-pressed={period === '30d'}>Last 30 days</button>
          </div>
        }>MY NUMBERS</Heading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--text-2)]"><span className="text-emerald-700"><Icon d={ICON.target} /></span>Drawer accuracy</div>
            <div className="text-[22px] font-extrabold mt-2">{acc?.of ? `${acc.exact} of ${acc.of} sign-offs exact` : 'No sign-offs yet'}</div>
            <div className="text-[12.5px] text-[var(--text-3)] mb-3">Your last sign-offs. Amber shows over or short, in cedis.</div>
            <div className="flex gap-1.5 flex-wrap">
              {(acc?.shifts || []).map((s, i) => (
                <span key={i} title={s.date || ''}
                      className={`h-8 min-w-8 px-1.5 rounded-full grid place-items-center text-[10.5px] font-extrabold font-mono
                                  ${s.exact ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                  {s.exact ? <Icon d={ICON.check} size={14} width={2.5} /> : (parseFloat(s.variance) > 0 ? '+' : '') + parseFloat(s.variance).toFixed(2)}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--text-2)]"><span className="text-amber-700"><Icon d={ICON.hourglass} /></span>How long customers wait to pay</div>
            <div className="flex items-baseline gap-2 mt-2"><span className="text-[22px] font-extrabold">{wait == null ? '—' : `${wait} min`}</span><span className="text-[13px] font-bold text-amber-800">aim: under {WAIT_AIM}</span></div>
            <div className="text-[12.5px] text-[var(--text-3)] mb-3">From the job being recorded to it being paid, on average.</div>
            <div className="h-2.5 rounded-full bg-[var(--bg)] overflow-hidden">
              <div className={`h-full ${wait != null && wait <= WAIT_AIM ? 'bg-emerald-600' : 'bg-amber-600'}`} style={{ width: `${Math.min(100, ((wait || 0) / (WAIT_AIM * 2)) * 100)}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--text-2)]"><Icon d={ICON.chart} />Busiest hours</div>
            <div className="text-[22px] font-extrabold mt-2">{numbers?.busiest?.peak_hour != null ? `${hourLabel(numbers.busiest.peak_hour)} to ${hourLabel((numbers.busiest.peak_hour + 1) % 24)}` : '—'}</div>
            <div className="text-[12.5px] text-[var(--text-3)] mb-3">{numbers?.busiest?.peak_count ? `${numbers.busiest.peak_count} payments in that hour. Plan breaks and float top-ups around it.` : 'No payments yet.'}</div>
            <div className="flex items-end gap-1 h-20">
              {(numbers?.busiest?.by_hour || []).map(h => (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full rounded-t ${h.hour === numbers.busiest.peak_hour ? 'bg-[var(--text)]' : 'bg-black/20'}`} style={{ height: `${(h.count / peakMax) * 60}px` }} />
                  <span className="text-[10px] text-[var(--text-3)]">{hourLabel(h.hour).replace('am', '').replace('pm', '')}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--text-2)]"><span className="text-emerald-700"><Icon d={ICON.chat} /></span>Receipts sent on WhatsApp</div>
            <div className="text-[22px] font-extrabold mt-2">{wa?.of ? `${wa.sent} of ${wa.of} · ${Math.round((wa.sent / wa.of) * 100)}%` : '—'}</div>
            <div className="text-[12.5px] text-[var(--text-3)] mb-3">{wa?.chat_customers ? `${wa.chat_sent} of ${wa.chat_customers} WhatsApp customers got one.` : 'Every WhatsApp customer should get one.'}</div>
            <div className="h-2.5 rounded-full bg-[var(--bg)] overflow-hidden"><div className="h-full bg-emerald-600" style={{ width: `${wa?.of ? (wa.sent / wa.of) * 100 : 0}%` }} /></div>
          </div>
        </div>
      </Card>

      <Receipts />
    </div>
  )
}
