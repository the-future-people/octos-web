// src/components/bm/CustomersPhone.jsx
//
// Customers on a phone (18 Nov 2026), in the Overview's look.
//   Customers, a red + New, and how many are registered
//   Search, then All · People · Businesses · Institutions · Balances
//   Each customer a row: soft initials, the name, the number, visits; a star
//   only for VIP and Premium. Balances: what is owed to the branch and what it
//   holds for customers, account by account.
// A tap slides the customer in: the numbers that matter, Call, then Profile
// (contact, who they work with, credit, notes) or Jobs (each opens its page).
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { getCustomers, getCustomerDetail, getJobs, getCreditAccountsBM, getWalletBalancesBM } from '../../api/bm'
import PhoneHeader from './PhoneHeader'
import NewCustomerModal from './NewCustomerModal'
import LinksPanel from './LinksPanel'
import JobFilePhone from './JobFilePhone'
import { EditForm } from './CustomerProfileModal'
import { lifecycleState, toneOf } from './jobLifecycle'

const RED = '#D70015'
const PAGE = 20
const card = 'mx-4 rounded-[16px] bg-white border border-black/[0.04] shadow-[0_3px_12px_rgba(17,24,39,0.05)]'
const RED_FILL = { background: 'linear-gradient(135deg,#EF1C2C 0%,#C8000F 100%)' }
const SOFT = [['#DCE9FF', '#1D4ED8'], ['#D3F2DE', '#15803D'], ['#FFEDB8', '#B45309'], ['#E7DCFF', '#6D28D9'], ['#FCE7F3', '#BE185D'], ['#F1F1F3', '#3A3A3C']]
const DOT = { amber: '#F59E0B', violet: '#8B5CF6', green: '#22C55E', blue: '#3B82F6', red: RED, grey: '#A1A1AA' }
const money = v => `GHS ${parseFloat(v || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const titleCase = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
const nameOf = c => titleCase(c?.customer_type === 'INDIVIDUAL' ? c?.full_name : (c?.company_name || c?.full_name))
const initials = c => (nameOf(c) || '?').replace(/^(Mr|Mrs|Ms|Miss|Dr|Prof|Rev)\.?\s+/i, '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
const KIND = { INDIVIDUAL: 'Person', BUSINESS: 'Business', INSTITUTION: 'Institution' }
const since = iso => (iso ? `${new Date(iso).toLocaleDateString('en-GB', { month: 'short' })} ’${String(new Date(iso).getFullYear()).slice(2)}` : '—')
// Short for the stats row: GHS 1,250 rather than GHS 1,250.00.
const short = v => `GHS ${Math.round(parseFloat(v || 0)).toLocaleString('en-GH')}`
const day = iso => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')

const Svg = ({ d, size = 18, width = 2, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{d}</svg>
)
const STAR = <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
const PHONE = <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />

function Avatar({ c, size = 44 }) {
  const [bg, ink] = SOFT[(c?.id || 0) % SOFT.length]
  return <span className="rounded-full grid place-items-center font-semibold shrink-0" style={{ width: size, height: size, fontSize: size / 2.7, background: bg, color: ink }}>{initials(c)}</span>
}
function Tier({ tier }) {
  if (tier !== 'VIP' && tier !== 'PREMIUM') return null
  const vip = tier === 'VIP'
  return (
    <span className="inline-flex items-center gap-1 h-[20px] px-1.5 rounded-full text-[11px] font-bold"
      style={{ background: vip ? '#FFEDB8' : '#DCE9FF', color: vip ? '#B45309' : '#1D4ED8' }}>
      <Svg d={STAR} size={11} width={2.4} />{vip ? 'VIP' : 'Premium'}
    </span>
  )
}

function Chips({ value, onPick }) {
  const options = [['all', 'All'], ['individuals', 'People'], ['businesses', 'Businesses'], ['institutions', 'Institutions'], ['balances', 'Balances']]
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onPick(v)}
          className={`shrink-0 h-[34px] px-3.5 rounded-full text-[14px] font-semibold whitespace-nowrap
            ${value === v ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E] border border-black/[0.06]'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

// Owed to the branch and held for customers: two exposures, never netted.
function Balances() {
  const { data: creditData, isLoading: l1 } = useQuery({ queryKey: ['bmCreditAccounts'], queryFn: () => getCreditAccountsBM().then(r => r.data), staleTime: 30_000 })
  const { data: walletData, isLoading: l2 } = useQuery({ queryKey: ['bmWalletBalances'], queryFn: () => getWalletBalancesBM().then(r => r.data), staleTime: 30_000 })
  if (l1 || l2) return <div className={`${card} mt-3 h-[200px] animate-pulse`} aria-hidden="true" />
  const accounts = Array.isArray(creditData) ? creditData : (creditData?.results || [])
  const wallets = Array.isArray(walletData) ? walletData : []
  const owing = accounts.filter(a => parseFloat(a.current_balance || 0) > 0)
    .sort((a, b) => (a.status === 'SUSPENDED') - (b.status === 'SUSPENDED') || parseFloat(b.current_balance) - parseFloat(a.current_balance))
  const owed = owing.reduce((s, a) => s + parseFloat(a.current_balance || 0), 0)
  const held = wallets.reduce((s, w) => s + parseFloat(w.balance || 0), 0)
  const suspended = owing.filter(a => a.status === 'SUSPENDED').length
  return (
    <>
      <div className="mx-4 mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-[16px] bg-white border border-black/[0.04] px-3.5 py-3 shadow-[0_3px_12px_rgba(17,24,39,0.05)]">
          <div className="text-[12.5px] text-[#6E6E73]">Owed to the branch</div>
          <div className="text-[20px] font-bold tabular-nums" style={{ color: owed > 0 ? '#B45309' : '#111' }}>{money(owed)}</div>
          <div className="text-[12px] text-[#8A8A8E]">{owing.length} account{owing.length === 1 ? '' : 's'}{suspended ? <span style={{ color: RED }}> · {suspended} suspended</span> : ''}</div>
        </div>
        <div className="rounded-[16px] bg-white border border-black/[0.04] px-3.5 py-3 shadow-[0_3px_12px_rgba(17,24,39,0.05)]">
          <div className="text-[12.5px] text-[#6E6E73]">Held for customers</div>
          <div className="text-[20px] font-bold tabular-nums">{money(held)}</div>
          <div className="text-[12px] text-[#8A8A8E]">{wallets.length} wallet{wallets.length === 1 ? '' : 's'}</div>
        </div>
      </div>
      <div className="px-5 pt-5 pb-1.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#8A8A8E]">Credit owed</div>
      <div className={`${card} overflow-hidden`}>
        {owing.length === 0 ? <p className="m-0 px-4 py-5 text-center text-[14.5px] text-[#8A8A8E]">Nothing outstanding.</p>
          : owing.map((a, i) => (
            <div key={a.id} className={`flex items-center gap-3 px-4 py-2.5 ${i ? 'border-t border-black/[0.06]' : ''}`}>
              <span className="flex-1 min-w-0">
                <span className="block text-[15.5px] font-semibold truncate">{a.customer_name}</span>
                <span className="block text-[12.5px] truncate" style={{ color: a.status === 'SUSPENDED' ? RED : '#8A8A8E' }}>
                  {a.status === 'SUSPENDED' ? 'Suspended · past terms' : (a.organisation_name || titleCase(a.account_type))}{a.payment_terms ? ` · ${a.payment_terms}-day terms` : ''}
                </span>
              </span>
              <span className="text-right shrink-0">
                <span className="block text-[15px] font-bold tabular-nums" style={{ color: '#B45309' }}>{money(a.current_balance)}</span>
                <span className="block text-[11.5px] text-[#8A8A8E]">of {money(a.credit_limit)}</span>
              </span>
            </div>
          ))}
      </div>
      <p className="m-0 mx-5 mt-1.5 text-[12.5px] text-[#8A8A8E]">Paid at the counter. An account lifts its own suspension once cleared.</p>
      <div className="px-5 pt-5 pb-1.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#8A8A8E]">Wallets</div>
      <div className={`${card} overflow-hidden`}>
        {wallets.length === 0 ? <p className="m-0 px-4 py-5 text-center text-[14.5px] text-[#8A8A8E]">No money held.</p>
          : wallets.map((w, i) => (
            <div key={w.customer_id} className={`flex items-center gap-3 px-4 py-2.5 ${i ? 'border-t border-black/[0.06]' : ''}`}>
              <span className="flex-1 min-w-0"><span className="block text-[15.5px] font-semibold truncate">{w.name}</span>
                <span className="block text-[12.5px] text-[#8A8A8E] truncate">{w.company_name || w.phone}</span></span>
              <span className="text-[15px] font-bold tabular-nums">{money(w.balance)}</span>
            </div>
          ))}
      </div>
      <p className="m-0 mx-5 mt-1.5 text-[12.5px] text-[#8A8A8E]">A wallet expires after six months without use.</p>
    </>
  )
}

// Notes that save themselves, a moment after typing stops.
function Notes({ customerId, initial }) {
  const [text, setText] = useState(initial ?? '')
  const [state, setState] = useState('')
  const timer = useRef(null)
  const save = async value => {
    setState('Saving…')
    try { await client.patch(`/api/v1/customers/${customerId}/edit/`, { notes: value }); setState('Saved') } catch { setState('Not saved. Try again.') }
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <>
      <div className="px-5 pt-5 pb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[#8A8A8E]">Your notes</span>
        <span className="text-[12.5px] text-[#8A8A8E]">{state}</span>
      </div>
      <div className="mx-4">
        <textarea rows={3} value={text} placeholder="Anything worth remembering about them"
          onChange={e => { const v = e.target.value; setText(v); setState(''); clearTimeout(timer.current); timer.current = setTimeout(() => save(v), 900) }}
          className="w-full px-3.5 py-3 text-[16px] rounded-[16px] bg-white border border-black/[0.06] outline-none resize-none" />
      </div>
    </>
  )
}

function CustomerPage({ id, onClose }) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('profile')
  const [editing, setEditing] = useState(false)
  const [openJob, setOpenJob] = useState(null)
  const { data: c, isLoading } = useQuery({ queryKey: ['customer', id], queryFn: () => getCustomerDetail(id).then(r => r.data) })
  const { data: credit } = useQuery({
    queryKey: ['credit', id], queryFn: () => client.get(`/api/v1/customers/credit/?customer=${id}`).then(r => r.data),
    select: d => d.results?.[0] ?? d?.[0] ?? null,
  })
  const { data: jobsData, isLoading: loadingJobs } = useQuery({ queryKey: ['customer-jobs', id], queryFn: () => getJobs({ customer: id, page_size: 100 }).then(r => r.data) })
  const jobs = jobsData?.results ?? (Array.isArray(jobsData) ? jobsData : [])
  useEffect(() => {
    document.body.dataset.fullscreen = '1'
    return () => { delete document.body.dataset.fullscreen }
  }, [])

  const stats = c ? [
    ['Visits', c.visit_count ?? '—'], ['Jobs', jobsData?.count ?? jobs.length ?? '—'],
    ['Spent', c.lifetime_spend != null ? short(c.lifetime_spend) : '—'], ['Since', since(c.created_at)],
  ] : []

  return createPortal(
    <section aria-label="Customer" className="ios ios-push fixed inset-0 z-[65] flex flex-col" style={{ background: '#F6F6F8' }}>
      <div className="ios-bar shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-[50px] px-2 grid grid-cols-[1fr_auto_1fr] items-center">
          <button type="button" onClick={() => (editing ? setEditing(false) : onClose())} className="justify-self-start flex items-center text-[17px] text-[#D70015] pr-2">
            <Svg d={<path d="M15 18l-6-6 6-6" />} size={26} width={2.4} />{editing ? 'Back' : 'Customers'}
          </button>
          <span className="text-[16px] font-semibold text-[#111]">{editing ? 'Edit' : ''}</span>
          {!editing && c ? <button type="button" onClick={() => setEditing(true)} className="justify-self-end text-[17px] text-[#D70015] px-2">Edit</button> : <span />}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {isLoading || !c ? (
          <div className="px-4 pt-6 space-y-3 animate-pulse" aria-hidden="true"><div className="h-20 rounded-[16px] bg-black/[0.05]" /><div className="h-40 rounded-[16px] bg-black/[0.05]" /></div>
        ) : editing ? (
          <div className="mx-4 mt-4 rounded-[16px] bg-white overflow-hidden">
            <EditForm customer={c} onCancel={() => setEditing(false)}
              onSaved={updated => { queryClient.setQueryData(['customer', id], updated); queryClient.invalidateQueries({ queryKey: ['customers-phone'] }); setEditing(false) }} />
          </div>
        ) : (
          <>
            <div className="pt-5 px-4 flex flex-col items-center text-center">
              <Avatar c={c} size={76} />
              <h1 className="m-0 mt-3 text-[24px] leading-[30px] font-extrabold tracking-[-0.02em] text-[#111]">{nameOf(c)}</h1>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap justify-center text-[14px] text-[#6E6E73]">
                <span>{KIND[c.customer_type]}</span>
                {c.customer_type !== 'INDIVIDUAL' && c.full_name && <span>· {titleCase(c.titled_name || c.full_name)}</span>}
                <Tier tier={c.tier} />
                {credit && <span className="h-[20px] px-1.5 rounded-full text-[11px] font-bold bg-[#D3F2DE] text-[#15803D] inline-flex items-center">Credit account</span>}
                {c.is_priority && <span className="h-[20px] px-1.5 rounded-full text-[11px] font-bold bg-[#FFE1E1] inline-flex items-center" style={{ color: RED }}>Priority</span>}
              </div>
              {c.phone && (
                <a href={`tel:${c.phone}`} className="mt-3.5 h-[40px] px-4 rounded-full inline-flex items-center gap-2 text-[15px] font-semibold"
                  style={{ background: '#D3F2DE', color: '#15803D' }}>
                  <Svg d={PHONE} size={16} />Call {c.phone}
                </a>
              )}
            </div>

            <div className={`${card} mt-5 grid grid-cols-4`}>
              {stats.map(([label, v], i) => (
                <div key={label} className={`px-2.5 py-3 text-center ${i ? 'border-l border-black/[0.06]' : ''}`}>
                  <div className="text-[12px] text-[#6E6E73]">{label}</div>
                  <div className="mt-0.5 text-[14.5px] font-bold tabular-nums whitespace-nowrap">{v}</div>
                </div>
              ))}
            </div>

            <div className="mx-4 mt-5 p-[3px] rounded-[10px] bg-black/[0.06] flex" role="tablist">
              {[['profile', 'Profile'], ['jobs', `Jobs${jobsData?.count != null ? ` ${jobsData.count}` : ''}`]].map(([v, label]) => (
                <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
                  className={`flex-1 h-[30px] rounded-[8px] text-[13.5px] font-semibold ${tab === v ? 'bg-white text-[#111] shadow-[0_2px_6px_rgba(0,0,0,0.10)]' : 'text-[#3A3A3C]'}`}>
                  {label}
                </button>
              ))}
            </div>

            {tab === 'profile' ? (
              <>
                <div className={`${card} mt-3 divide-y divide-black/[0.06]`}>
                  {[['Phone', c.phone], c.secondary_phone && ['Second number', c.secondary_phone], ['Email', c.email], ['Address', c.address]].filter(Boolean).map(([label, v]) => (
                    <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="text-[15px] text-[#6E6E73]">{label}</span>
                      <span className="text-[15px] font-medium text-right truncate tabular-nums">{v || '—'}</span>
                    </div>
                  ))}
                </div>
                {credit && (
                  <>
                    <div className="px-5 pt-5 pb-1.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#8A8A8E]">Credit account</div>
                    <div className={`${card} px-4 py-3`}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[15px]">Owes</span>
                        <span className="text-[18px] font-bold tabular-nums" style={{ color: parseFloat(credit.current_balance) > 0 ? '#B45309' : '#111' }}>{money(credit.current_balance)}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-[#EDEDF0] overflow-hidden">
                        <span className="block h-full rounded-full" style={{ width: `${Math.min(credit.utilisation_pct ?? 0, 100)}%`, background: (credit.utilisation_pct ?? 0) > 80 ? RED : '#F59E0B' }} />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[12.5px] text-[#8A8A8E]">
                        <span>{money(credit.available_credit)} left of {money(credit.credit_limit)}</span>
                        <span>{credit.payment_terms}-day terms · {titleCase(credit.status)}</span>
                      </div>
                    </div>
                  </>
                )}
                <div className="mx-4 mt-5 rounded-[16px] bg-white overflow-hidden [&>div]:border-0"><LinksPanel customer={c} /></div>
                <Notes customerId={c.id} initial={c.notes} />
              </>
            ) : (
              <div className="mt-3">
                {loadingJobs ? <div className={`${card} h-[200px] animate-pulse`} aria-hidden="true" />
                  : jobs.length === 0 ? <div className={`${card} py-10 text-center text-[15px] text-[#8A8A8E]`}>No jobs on record.</div>
                  : (
                    <div className={`${card} overflow-hidden`}>
                      {jobs.map((j, i) => {
                        const s = lifecycleState(j)
                        return (
                          <button key={j.id} type="button" onClick={() => setOpenJob(j.id)}
                            className={`w-full text-left px-4 py-2.5 active:bg-black/[0.04] ${i ? 'border-t border-black/[0.07]' : ''}`}>
                            <span className="flex items-baseline gap-2">
                              <span className="flex-1 min-w-0 text-[15.5px] font-semibold truncate">{j.title || 'Job'}</span>
                              <span className="text-[15px] font-semibold tabular-nums">{money(j.estimated_cost)}</span>
                            </span>
                            <span className="flex items-center gap-1.5 mt-0.5 text-[12.5px]">
                              <span className="w-[7px] h-[7px] rounded-full" style={{ background: DOT[toneOf(s)] }} />
                              <span className="flex-1 min-w-0 text-[#3A3A3C] truncate">{s.label}</span>
                              <span className="text-[#A1A1AA] tabular-nums">#{(j.job_number || '').split('-').pop()} · {day(j.created_at)}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
              </div>
            )}
          </>
        )}
      </div>
      {openJob && <JobFilePhone jobId={openJob} onClose={() => setOpenJob(null)} />}
    </section>,
    document.body,
  )
}

export default function CustomersPhone() {
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const [adding, setAdding] = useState(false)
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t) }, [search])
  const type = { individuals: 'INDIVIDUAL', businesses: 'BUSINESS', institutions: 'INSTITUTION' }[tab]
  const list = useInfiniteQuery({
    queryKey: ['customers-phone', tab, q],
    queryFn: ({ pageParam }) => getCustomers({ search: q, page: pageParam, page_size: PAGE, ...(type ? { customer_type: type } : {}) }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last?.next ? pages.length + 1 : undefined),
    enabled: tab !== 'balances',
    staleTime: 30_000,
  })
  const rows = (list.data?.pages || []).flatMap(p => (Array.isArray(p) ? p : p?.results || []))
  const count = list.data?.pages?.[0]?.count ?? rows.length

  return (
    <div className="ios min-h-full pb-6" style={{ background: '#F6F6F8' }}>
      <PhoneHeader />
      <div className="px-4 pt-1 flex items-center justify-between">
        <h1 className="m-0 text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] text-[#111]">Customers</h1>
        <button type="button" onClick={() => setAdding(true)} aria-label="New customer"
          className="h-10 pl-3 pr-3.5 rounded-full text-white text-[14.5px] font-semibold inline-flex items-center gap-1.5" style={RED_FILL}>
          <Svg d={<path d="M12 5v14 M5 12h14" />} size={17} width={2.6} />New
        </button>
      </div>
      {tab !== 'balances' && <div className="px-4 text-[14px] text-[#8A8A8E]">{list.isLoading ? '' : `${count.toLocaleString()} ${q ? 'found' : 'registered'}`}</div>}

      <label className="mx-4 mt-3 h-[38px] px-3 rounded-[11px] bg-black/[0.06] flex items-center gap-2 text-[#8A8A8E]">
        <Svg d={<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3" />} size={17} />
        <input type="search" value={search} onChange={e => { setSearch(e.target.value); if (tab === 'balances') setTab('all') }}
          placeholder="Name, phone or company" enterKeyHint="search"
          className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-[#111] placeholder:text-[#8A8A8E]" />
      </label>
      <Chips value={tab} onPick={setTab} />

      {tab === 'balances' ? <Balances /> : (
        <div className="mt-3">
          {list.isLoading ? <div className={`${card} h-[300px] animate-pulse`} aria-hidden="true" />
            : rows.length === 0 ? <div className={`${card} py-12 px-6 text-center`}><div className="text-[16px] font-semibold">{q ? `Nobody matches “${q}”` : 'No customers here'}</div>
              <div className="text-[13.5px] text-[#8A8A8E] mt-1">Try part of the name or the phone number.</div></div>
            : (
              <>
                <div className={`${card} overflow-hidden`}>
                  {rows.map((c, i) => (
                    <button key={c.id} type="button" onClick={() => setOpenId(c.id)} className="w-full flex items-center gap-3 pl-3.5 text-left active:bg-black/[0.04]">
                      <Avatar c={c} />
                      <span className={`flex-1 min-w-0 flex items-center gap-2 py-2.5 pr-3 ${i ? 'border-t border-black/[0.07]' : ''}`}>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="min-w-0 text-[16px] leading-[21px] font-semibold text-[#1C1C1E] truncate">{nameOf(c)}</span>
                            <Tier tier={c.tier} />
                          </span>
                          <span className="block text-[13px] text-[#6E6E73] truncate tabular-nums">
                            {c.customer_type !== 'INDIVIDUAL' && c.full_name ? `${titleCase(c.full_name)} · ` : ''}{c.phone}
                          </span>
                          {c.affiliation_name && c.affiliation_active && <span className="block text-[12.5px] text-[#2563EB] truncate">Works with {c.affiliation_name}</span>}
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-[15px] font-semibold tabular-nums">{c.visit_count ?? 0}</span>
                          <span className="block text-[11.5px] text-[#8A8A8E]">visit{c.visit_count === 1 ? '' : 's'}</span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                {list.hasNextPage && (
                  <button type="button" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}
                    className="mx-4 mt-3 w-[calc(100%-2rem)] h-[44px] rounded-[14px] bg-white border border-black/[0.06] text-[15px] font-semibold text-[#D70015]">
                    {list.isFetchingNextPage ? 'Loading…' : `Show ${Math.min(PAGE, count - rows.length)} more`}
                  </button>
                )}
              </>
            )}
        </div>
      )}

      {openId && <CustomerPage id={openId} onClose={() => setOpenId(null)} />}
      {adding && <NewCustomerModal onClose={() => setAdding(false)} onSuccess={() => setAdding(false)} />}
    </div>
  )
}
