// src/components/bm/ReportsPhoneHistory.jsx
//
// Looking back on a phone (18 Nov 2026): the year by month, the job ledger
// from years down to weeks, and the business owner's statement. The same
// calls as the Yearly, Job Ledger and Investor Statement tabs of Reports.jsx.
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { downloadBranchStatement } from '../../api/bm'
import { saveFile } from '../../api/saveFile'
import { GREEN, AMBER, MON, MONTHS, RED, api, card, dayMonth, errorOf, isoOf, list, money, num, short } from './reportsKit'
import { Bars, Chevron, Empty, Field, Figures, Pushed, RedButton, Skeleton, Stepper, Title } from './ReportsPhoneUI'

const rateTone = r => (r >= 95 ? GREEN : r >= 80 ? AMBER : RED)
const initial = l => String(l).slice(0, 1)

// ── Year ─────────────────────────────────────────────────────────────────────
export function YearTab({ onOpenMonth }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const { data: byMonth = {}, isLoading } = useQuery({
    queryKey: ['sheets-year-phone', year],
    queryFn: () => api.sheets({ year, page_size: 400 }).then(r => {
      const out = {}
      for (const s of list(r.data)) {
        if (s.status === 'OPEN') continue
        const m = parseInt(s.date.slice(5, 7), 10)
        out[m] = out[m] || { total: 0, jobs: 0, days: 0 }
        out[m].total += num(s.total_collected); out[m].jobs += s.total_jobs_created || 0; out[m].days += 1
      }
      return out
    }),
    staleTime: 60_000,
  })
  const isThisYear = year === now.getFullYear()
  const last = isThisYear ? now.getMonth() + 1 : 12
  const rows = Array.from({ length: last }, (_, i) => last - i)
  const values = Array.from({ length: 12 }, (_, i) => byMonth[i + 1]?.total || 0)
  const taken = values.reduce((a, b) => a + b, 0)
  const jobs = Object.values(byMonth).reduce((a, m) => a + m.jobs, 0)
  const best = values.indexOf(Math.max(...values))

  return (
    <>
      <Stepper label={String(year)} onPrev={() => setYear(y => y - 1)} onNext={() => setYear(y => y + 1)} canNext={!isThisYear} />
      {isLoading ? <Skeleton rows={[160, 300]} /> : (
        <>
          <div className={`${card} mt-3`}>
            <div className="px-4 pt-3.5 pb-3">
              <div className="text-[13px] font-medium text-[#6E6E73]">Taken in {year}</div>
              <div className="text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] tabular-nums text-[#111]">{money(taken)}</div>
            </div>
            <div className="px-4 pb-3.5">
              <Bars values={values} labels={MON.slice(1).map(initial)} mark={isThisYear ? now.getMonth() : best} height={88} show={(v, i) => `${MONTHS[i + 1]}: ${money(v)}`} />
            </div>
            <Figures items={[['Jobs', jobs.toLocaleString()], ['Months open', Object.keys(byMonth).length], ['Best month', taken > 0 ? MON[best + 1] : '—']]} />
          </div>

          <Title extra={<span className="text-[12.5px] text-[#8A8A8E]">Closed days only</span>}>By month</Title>
          <div className={`${card} overflow-hidden`}>
            {rows.map((m, i) => {
              const d = byMonth[m]
              const now_ = isThisYear && m === now.getMonth() + 1
              return (
                <button key={m} type="button" onClick={() => onOpenMonth(m, year)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-black/[0.03] ${i ? 'border-t border-black/[0.06]' : ''}`}>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 text-[16px] font-semibold">{MONTHS[m]}
                      {now_ && <span className="h-[19px] px-1.5 rounded-full text-[11px] font-bold bg-[#FFEDB8] text-[#B45309] inline-flex items-center">Now</span>}</span>
                    <span className="block text-[13px] text-[#8A8A8E] tabular-nums">{d ? `${d.jobs} jobs · ${d.days} days` : 'Nothing recorded'}</span>
                  </span>
                  <span className={`text-[15px] font-semibold tabular-nums ${d ? '' : 'text-[#C4C4C7]'}`}>{d ? short(d.total) : '—'}</span>
                  <Chevron />
                </button>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

// ── Ledger ───────────────────────────────────────────────────────────────────
// The headline of a ledger level: what it made, then jobs, pending, finished.
function LedgerCard({ kpis, label }) {
  const k = kpis || {}
  const rate = k.rate?.value
  const change = k.revenue?.change
  return (
    <div className={`${card} mt-3`}>
      <div className="px-4 pt-3.5 pb-3">
        <div className="text-[13px] font-medium text-[#6E6E73]">{label}</div>
        <div className="text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] tabular-nums text-[#111]">{money(k.revenue?.value)}</div>
        {change && <div className="text-[13px] font-semibold" style={{ color: change.startsWith('+') ? GREEN : RED }}>{change} on the one before</div>}
      </div>
      <Figures items={[['Jobs', (k.total?.value ?? 0).toLocaleString()], ['Unpaid', k.pending?.value ?? 0, k.pending?.value > 0 ? RED : null],
        ['Finished', rate != null ? `${rate}%` : '—', rate != null ? rateTone(rate) : null]]} />
    </div>
  )
}

function Heatmap({ weeks }) {
  const top = Math.max(...weeks.flat().map(d => d.count), 1)
  return (
    <div>
      <div className="grid grid-cols-[28px_1fr] gap-2">
        <span />
        <div className="grid grid-cols-6 gap-1 text-center text-[10.5px] text-[#8A8A8E]">{['M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
      </div>
      {weeks.map((w, wi) => (
        <div key={wi} className="grid grid-cols-[28px_1fr] gap-2 mt-1 items-center">
          <span className="text-[11px] text-[#8A8A8E]">W{wi + 1}</span>
          <div className="grid grid-cols-6 gap-1">
            {w.map(d => (
              <span key={d.date} title={`${d.date}: ${d.count} jobs`} className="h-[30px] rounded-[7px] grid place-items-center text-[11px] font-semibold tabular-nums"
                style={{ background: d.count ? `rgba(29,78,216,${0.12 + (d.count / top) * 0.7})` : '#F2F2F5', color: d.count / top > 0.55 ? '#fff' : '#3A3A3C' }}>
                {d.count || ''}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function LedgerPage({ year, onClose }) {
  const [month, setMonth] = useState(null)
  const months = useQuery({
    queryKey: ['ledger-months', year],
    queryFn: () => api.history({ level: 'month', year }).then(r => r.data),
    staleTime: 60_000,
  })
  const weeks = useQuery({
    queryKey: ['ledger-weeks', year, month],
    queryFn: () => api.history({ level: 'week', year, month }).then(r => r.data),
    enabled: !!month,
    staleTime: 60_000,
  })
  const now = new Date()
  const m = months.data, w = weeks.data

  return (
    <Pushed back={month ? String(year) : 'Ledger'} title={month ? `${MONTHS[month]} ${year}` : String(year)}
      onBack={() => (month ? setMonth(null) : onClose())} label="Ledger">
      {!month ? (
        months.isLoading ? <Skeleton rows={[160, 260]} /> : (
          <>
            <LedgerCard kpis={m?.kpis} label={`Made in ${year}`} />
            {m?.trend && (
              <div className={`${card} mt-3 px-4 py-3.5`}>
                <div className="text-[13px] font-medium text-[#6E6E73] mb-2">By month</div>
                <Bars values={m.trend.revenue} labels={m.trend.labels.map(initial)} mark={year === now.getFullYear() ? now.getMonth() : -1} height={88} />
              </div>
            )}
            <Title>Months</Title>
            <div className={`${card} overflow-hidden`}>
              {(m?.items || []).filter(x => x.total > 0).length === 0 ? <Empty>No jobs this year.</Empty>
                : (m?.items || []).filter(x => x.total > 0).map((x, i) => (
                  <button key={x.label} type="button" onClick={() => setMonth(x.month)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-black/[0.03] ${i ? 'border-t border-black/[0.06]' : ''}`}>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[16px] font-semibold">{x.label}</span>
                      <span className="block text-[13px] text-[#8A8A8E] tabular-nums">{x.total.toLocaleString()} jobs{x.total > 0 && <> · <span style={{ color: rateTone(x.rate) }}>{x.rate}% finished</span></>}</span>
                    </span>
                    <span className="text-[15px] font-semibold tabular-nums">{short(x.revenue)}</span>
                    <Chevron />
                  </button>
                ))}
            </div>
          </>
        )
      ) : weeks.isLoading ? <Skeleton rows={[160, 260]} /> : (
        <>
          <LedgerCard kpis={w?.kpis} label={`Made in ${MONTHS[month]}`} />
          {w?.trend && (
            <div className={`${card} mt-3 px-4 py-3.5`}>
              <div className="text-[13px] font-medium text-[#6E6E73] mb-2">Day by day</div>
              <Bars values={w.trend.revenue} height={80} show={(v, i) => `${w.trend.labels[i]} ${MON[month]}: ${money(v)}`}
                labels={w.trend.labels.map((l, i) => (i === 0 || (i + 1) % 5 === 0 ? l : ''))}
                mark={year === now.getFullYear() && month === now.getMonth() + 1 ? now.getDate() - 1 : -1} />
            </div>
          )}
          <Title>Weeks</Title>
          <div className={`${card} overflow-hidden`}>
            {(w?.items || []).length === 0 ? <Empty>No weeks to show.</Empty> : w.items.map((x, i) => (
              <div key={x.week} className={`px-4 py-3 flex items-center gap-3 ${i ? 'border-t border-black/[0.06]' : ''}`}>
                <span className="flex-1 min-w-0">
                  <span className="block text-[16px] font-semibold">{x.label}</span>
                  <span className="block text-[13px] text-[#8A8A8E]">{x.start && x.end ? `${dayMonth(x.start)} – ${dayMonth(x.end)}` : ''}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[15px] font-semibold tabular-nums">{short(x.revenue)}</span>
                  <span className="block text-[12.5px] tabular-nums text-[#8A8A8E]">{x.total.toLocaleString()} jobs{x.total > 0 && <> · <span style={{ color: rateTone(x.rate) }}>{x.rate}%</span></>}</span>
                </span>
              </div>
            ))}
          </div>
          {Array.isArray(w?.heatmap?.[0]) && (
            <>
              <Title extra={<span className="text-[12.5px] text-[#8A8A8E]">Jobs a day</span>}>Busy days</Title>
              <div className={`${card} px-4 py-3.5`}><Heatmap weeks={w.heatmap} /></div>
            </>
          )}
        </>
      )}
    </Pushed>
  )
}

export function LedgerTab() {
  const [year, setYear] = useState(null)
  const { data, isLoading } = useQuery({
    queryKey: ['ledger-years'],
    queryFn: () => api.history({ level: 'year' }).then(r => r.data),
    staleTime: 120_000,
  })
  if (isLoading) return <Skeleton rows={[160, 120]} />
  const years = data?.items || []
  const top = Math.max(...years.map(y => y.total), 1)
  const now = new Date()
  return (
    <>
      <LedgerCard kpis={data?.kpis} label="Made, all years" />
      <Title>Years</Title>
      <div className={`${card} overflow-hidden`}>
        {years.length === 0 ? <Empty>No jobs recorded yet.</Empty> : years.map((y, i) => (
          <button key={y.year} type="button" onClick={() => setYear(y.year)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-black/[0.03] ${i ? 'border-t border-black/[0.06]' : ''}`}>
            <span className="flex-1 min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[20px] font-bold tabular-nums">{y.year}</span>
                <span className="text-[15px] font-semibold tabular-nums">{short(y.revenue)}</span>
              </span>
              <span className="block text-[13px] text-[#8A8A8E] tabular-nums">{y.total.toLocaleString()} jobs</span>
              <span className="mt-1.5 block h-[5px] rounded-full bg-[#EDEDF0] overflow-hidden">
                <span className="block h-full rounded-full bg-[#9DBDF7]" style={{ width: `${(y.total / top) * 100}%` }} />
              </span>
            </span>
            <Chevron />
          </button>
        ))}
      </div>
      {data?.trend && (
        <>
          <Title extra={<span className="text-[12.5px] text-[#8A8A8E]">{now.getFullYear()}</span>}>This year by month</Title>
          <div className={`${card} px-4 py-3.5`}>
            <Bars values={data.trend.revenue} labels={data.trend.labels.map(initial)} mark={now.getMonth()} height={88} show={(v, i) => `${data.trend.labels[i]}: ${money(v)}`} />
          </div>
        </>
      )}
      {year && <LedgerPage year={year} onClose={() => setYear(null)} />}
    </>
  )
}

// ── Statement ────────────────────────────────────────────────────────────────
export function StatementTab() {
  const now = new Date()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState('')
  const RANGES = [
    ['This month', new Date(now.getFullYear(), now.getMonth(), 1), now],
    ['Last month', new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)],
    ['This year', new Date(now.getFullYear(), 0, 1), now],
    ['Last year', new Date(now.getFullYear() - 1, 0, 1), new Date(now.getFullYear() - 1, 11, 31)],
  ].map(([l, a, b]) => [l, isoOf(a), isoOf(b)])
  const make = useMutation({
    mutationFn: () => downloadBranchStatement(from, to),
    onSuccess: res => saveFile(`branch-statement-${from}-to-${to}.pdf`, new Blob([res.data], { type: 'application/pdf' })),
    onError: err => setError(errorOf(err, 'Could not make the statement.')),
  })
  const go = () => {
    if (!from || !to) return setError('Pick a start and an end.')
    if (from > to) return setError('The start comes after the end.')
    setError(''); make.mutate()
  }
  return (
    <>
      <Title>Branch statement</Title>
      <p className="m-0 px-5 -mt-1 text-[14px] text-[#6E6E73]">A statement for a bank, an investor or a partner: takings, jobs, customers and how people paid.</p>
      <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {RANGES.map(([label, a, b]) => {
          const on = from === a && to === b
          return (
            <button key={label} type="button" onClick={() => { setFrom(a); setTo(b) }}
              className={`shrink-0 h-[34px] px-3.5 rounded-full text-[14px] font-semibold whitespace-nowrap ${on ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E] border border-black/[0.06]'}`}>{label}</button>
          )
        })}
      </div>
      <div className="mx-4 mt-3 space-y-3">
        <Field label="From"><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full mt-1 text-[16px] bg-transparent outline-none" /></Field>
        <Field label="To"><input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full mt-1 text-[16px] bg-transparent outline-none" /></Field>
        {error && <p className="m-0 text-[14px] text-[#B91C1C]">{error}</p>}
        <RedButton onClick={go} busy={make.isPending ? 'Making the statement…' : null}>Download statement</RedButton>
        <p className="m-0 px-1 text-[13px] text-[#8A8A8E]">Only the business owner can make this. Keep it as you would any private business paper.</p>
      </div>
    </>
  )
}
