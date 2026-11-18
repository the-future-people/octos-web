// src/components/bm/PerformancePhone.jsx
//
// Performance on a phone (18 Nov 2026), in the Overview's look: what came
// in and what it made for today, the week or the month; the services that
// earned most; and each person's jobs, takings and how many they finished.
// The same data as Performance.jsx (GET /jobs/performance/).
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import PhoneHeader from './PhoneHeader'

const RED = '#D70015'
const card = 'mx-4 rounded-[16px] bg-white border border-black/[0.04] shadow-[0_3px_12px_rgba(17,24,39,0.05)]'
const SOFT = [['#DCE9FF', '#1D4ED8'], ['#D3F2DE', '#15803D'], ['#FFEDB8', '#B45309'], ['#E7DCFF', '#6D28D9'], ['#FCE7F3', '#BE185D']]
const money = v => `GHS ${parseFloat(v || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const short = v => {
  const n = parseFloat(v || 0)
  return n >= 10000 ? `GHS ${(n / 1000).toFixed(1)}k` : `GHS ${n.toLocaleString('en-GH', { maximumFractionDigits: n % 1 ? 2 : 0 })}`
}
const rateTone = r => (r >= 95 ? '#15803D' : r >= 80 ? '#B45309' : RED)
const WORDS = { day: 'today', week: 'this week', month: 'this month' }

function Title({ children, extra }) {
  return (
    <div className="px-5 pt-6 pb-2 flex items-end justify-between gap-3">
      <h2 className="m-0 text-[20px] leading-[25px] font-bold text-[#111]">{children}</h2>{extra}
    </div>
  )
}

export default function PerformancePhone() {
  const [period, setPeriod] = useState('day')
  const { data, isLoading } = useQuery({
    queryKey: ['performance', period],
    queryFn: () => client.get(`/api/v1/jobs/performance/?period=${period}`).then(r => r.data),
    refetchInterval: 60_000, staleTime: 30_000, placeholderData: prev => prev,
  })
  const s = data?.summary || {}
  const services = data?.services || []
  const staff = data?.staff || []
  const top = Math.max(...services.map(x => parseFloat(x.revenue || 0)), 1)

  return (
    <div className="ios min-h-full pb-6" style={{ background: '#F6F6F8' }}>
      <PhoneHeader />
      <div className="px-4 pt-1">
        <h1 className="m-0 text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] text-[#111]">Performance</h1>
      </div>
      <div className="mx-4 mt-3 p-[3px] rounded-[10px] bg-black/[0.06] flex" role="radiogroup" aria-label="Period">
        {[['day', 'Today'], ['week', 'Week'], ['month', 'Month']].map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={period === v} onClick={() => setPeriod(v)}
            className={`flex-1 h-[30px] rounded-[8px] text-[13.5px] font-semibold ${period === v ? 'bg-white text-[#111] shadow-[0_2px_6px_rgba(0,0,0,0.10)]' : 'text-[#3A3A3C]'}`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading && !data ? (
        <div className="px-4 pt-4 space-y-3 animate-pulse" aria-hidden="true"><div className="h-[150px] rounded-[16px] bg-black/[0.05]" /><div className="h-[200px] rounded-[16px] bg-black/[0.05]" /></div>
      ) : (
        <>
          {/* The period at a glance */}
          <div className={`${card} mt-3`}>
            <div className="px-4 pt-3.5 pb-3">
              <div className="text-[13px] font-medium text-[#6E6E73]">Taken {WORDS[period]}</div>
              <div className="text-[32px] leading-[38px] font-extrabold tracking-[-0.02em] tabular-nums text-[#111]">{money(s.revenue)}</div>
            </div>
            <div className="grid grid-cols-4 border-t border-black/[0.06]">
              {[['Jobs', s.total, '#111'], ['Done', s.complete, '#111'], ['Pending', s.pending, s.pending > 0 ? RED : '#111'],
                ['Finished', s.rate != null ? `${s.rate}%` : '—', s.rate != null ? rateTone(s.rate) : '#111']].map(([label, v, tone], i) => (
                <div key={label} className={`px-3 py-2.5 ${i ? 'border-l border-black/[0.06]' : ''}`}>
                  <div className="text-[12px] text-[#6E6E73]">{label}</div>
                  <div className="text-[19px] font-bold tabular-nums" style={{ color: tone }}>{v ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* What earned most */}
          <Title extra={<span className="text-[12.5px] text-[#8A8A8E]">Finished jobs</span>}>Top services</Title>
          <div className={card}>
            {services.length === 0 ? <p className="m-0 px-4 py-6 text-center text-[14.5px] text-[#8A8A8E]">No finished jobs {WORDS[period]}.</p>
              : services.map((x, i) => (
                <div key={x.name} className={`px-4 py-3 ${i ? 'border-t border-black/[0.06]' : ''}`}>
                  <div className="flex items-baseline gap-2">
                    <span className="w-5 text-[13px] font-semibold text-[#A1A1AA] tabular-nums">{i + 1}</span>
                    <span className="flex-1 min-w-0 text-[15.5px] font-semibold truncate">{x.name}</span>
                    <span className="text-[15px] font-semibold tabular-nums">{short(x.revenue)}</span>
                  </div>
                  <div className="mt-1.5 pl-7 flex items-center gap-2.5">
                    <span className="flex-1 h-[6px] rounded-full bg-[#EDEDF0] overflow-hidden">
                      <span className="block h-full rounded-full" style={{ width: `${(parseFloat(x.revenue || 0) / top) * 100}%`, background: i === 0 ? RED : '#9DBDF7' }} />
                    </span>
                    <span className="text-[12.5px] text-[#8A8A8E] tabular-nums whitespace-nowrap">{x.count} job{x.count === 1 ? '' : 's'}</span>
                  </div>
                </div>
              ))}
          </div>

          {/* Each person */}
          <Title extra={<span className="text-[12.5px] text-[#8A8A8E]">Jobs they took in</span>}>Staff</Title>
          <div className={card}>
            {staff.length === 0 ? <p className="m-0 px-4 py-6 text-center text-[14.5px] text-[#8A8A8E]">No staff activity {WORDS[period]}.</p>
              : staff.map((m, i) => {
                const [bg, ink] = SOFT[i % SOFT.length]
                const initials = m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${i ? 'border-t border-black/[0.06]' : ''}`}>
                    <span className="w-10 h-10 rounded-full grid place-items-center text-[14px] font-semibold shrink-0" style={{ background: bg, color: ink }}>{initials}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15.5px] font-semibold truncate">{m.name}</span>
                      <span className="block text-[12.5px] text-[#8A8A8E] tabular-nums">{m.total} jobs · {m.complete} done · {short(m.revenue)}</span>
                      <span className="mt-1.5 block h-[5px] rounded-full bg-[#EDEDF0] overflow-hidden">
                        <span className="block h-full rounded-full" style={{ width: `${Math.min(m.rate || 0, 100)}%`, background: rateTone(m.rate || 0) }} />
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-[18px] font-bold tabular-nums" style={{ color: rateTone(m.rate || 0) }}>{m.rate ?? 0}%</span>
                      <span className="block text-[11.5px] text-[#8A8A8E]">finished</span>
                    </span>
                  </div>
                )
              })}
          </div>
        </>
      )}
    </div>
  )
}
