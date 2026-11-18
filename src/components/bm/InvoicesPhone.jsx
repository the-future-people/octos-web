// src/components/bm/InvoicesPhone.jsx
//
// Proformas and invoices on a phone (18 Nov 2026), in the Overview's look.
//   Proformas | Invoices, and a red "+" for a new one
//   Proformas: Open · Accepted · Expired · All; what is out on quotes, and
//   how many need chasing (three days or fewer left). Each one a row, its
//   state as the icon square. A tap opens what can be done with it, as an
//   iOS action sheet: share the PDF, lower the price, revise, accept.
//   Invoices: All · Today · Week · Month; a tap downloads or resends.
// The same calls as the computer's page (ProformasTab, InvoicesTab).
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { getProformas, issueProforma, convertProforma, getProformaPdf, sendInvoice } from '../../api/bm'
import { saveFile } from '../../api/saveFile'
import { useAuth } from '../../context/AuthContext'
import { mayDiscount } from '../../api/discounts'
import PhoneHeader from './PhoneHeader'
import NewJobModal from './NewJobModal'
import DiscountPanel from './DiscountPanel'
import { InvoiceCreateModal } from './InvoicesTab'

const RED = '#D70015'
const PAGE = 20
const money = v => `GHS ${parseFloat(v || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const day = iso => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—')
const tail = n => (n || '').split('-').pop()

const Svg = ({ d, size = 18, width = 2, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{d}</svg>
)
const DOC = <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5" />
const CHECK = <path d="M20 6 9 17l-5-5" />
const CLOCK = <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2" />
const PEN = <path d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />

// Past its date is expired, even if the record hasn't caught up yet.
const lapsed = p => p.status === 'ISSUED' && (p.is_expired || (p.days_left != null && p.days_left < 0))
const chase = p => p.status === 'ISSUED' && !lapsed(p) && p.days_left != null && p.days_left <= 3
// A proforma's state: its words, its icon square, and the line under it.
function stateOf(p) {
  if (lapsed(p) || p.status === 'EXPIRED') return { word: 'Expired', tile: ['#F1F1F3', '#A1A1AA'], d: CLOCK, line: `Expired ${day(p.valid_until)}`, faded: true }
  if (p.status === 'DRAFT') return { word: 'Draft', tile: ['#F1F1F3', '#52525B'], d: PEN, line: `Draft · ${day(p.created_at)}` }
  if (p.status === 'CONVERTED') return { word: 'Accepted', tile: ['#D3F2DE', '#15803D'], d: CHECK, line: `Accepted ${day(p.converted_at || p.updated_at)}` }
  if (p.status === 'SUPERSEDED') return { word: 'Revised', tile: ['#F1F1F3', '#A1A1AA'], d: DOC, line: 'Replaced by a later version', faded: true }
  if (chase(p)) return { word: 'Chase', tile: ['#FFEDB8', '#B45309'], d: DOC, line: `${p.days_left === 0 ? 'Expires today' : `${p.days_left} day${p.days_left === 1 ? '' : 's'} left`} · chase it`, alarm: true }
  return { word: 'Issued', tile: ['#DCE9FF', '#2563EB'], d: DOC, line: p.days_left != null ? `Issued ${day(p.issued_at)} · ${p.days_left} days left` : `Issued ${day(p.issued_at)}` }
}
const INVOICE = {
  DRAFT: ['Draft', '#A1A1AA'], SENT: ['Sent', '#3B82F6'], VIEWED: ['Viewed', '#F59E0B'], PAID: ['Paid', '#22C55E'],
}

const card = 'mx-4 rounded-[16px] bg-white border border-black/[0.04] shadow-[0_3px_12px_rgba(17,24,39,0.05)]'
const RED_FILL = { background: 'linear-gradient(135deg,#EF1C2C 0%,#C8000F 100%)' }

function Chips({ options, value, onPick }) {
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      {options.map(([v, label, n, alarm]) => {
        const on = value === v
        return (
          <button key={label} type="button" onClick={() => onPick(v)}
            className={`shrink-0 h-[34px] px-3.5 rounded-full flex items-center gap-1.5 text-[14px] font-semibold whitespace-nowrap
              ${on ? 'bg-[#1C1C1E] text-white' : 'bg-white text-[#1C1C1E] border border-black/[0.06]'}`}>
            {label}
            {n > 0 && <span className="tabular-nums" style={{ color: on ? 'rgba(255,255,255,0.7)' : alarm ? RED : '#8A8A8E' }}>{n}</span>}
          </button>
        )
      })}
    </div>
  )
}

// An iOS action sheet: a header, the actions, Cancel apart.
function ActionSheet({ title, sub, actions, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-label={title}>
      <div className="absolute inset-0 bg-black/30 animate-fadeIn" onClick={onClose} />
      <div className="ios absolute inset-x-2.5 animate-slideUp" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
        <div className="rounded-[14px] bg-white/95 backdrop-blur-xl overflow-hidden">
          <div className="px-4 py-3 text-center border-b border-black/[0.08]">
            <div className="text-[14px] font-semibold text-[#3A3A3C]">{title}</div>
            {sub && <div className="text-[13px] text-[#8A8A8E] mt-0.5">{sub}</div>}
          </div>
          {actions.map(({ label, onClick, disabled, note, strong }, i) => (
            <button key={label} type="button" disabled={disabled} onClick={() => { onClose(); onClick() }}
              className={`w-full min-h-[56px] px-4 flex flex-col items-center justify-center active:bg-black/[0.05] disabled:active:bg-transparent
                ${i ? 'border-t border-black/[0.08]' : ''}`}>
              <span className={`text-[18px] ${disabled ? 'text-[#C4C4C7]' : 'text-[#D70015]'} ${strong ? 'font-semibold' : ''}`}>{label}</span>
              {note && <span className="text-[12.5px] text-[#A1A1AA]">{note}</span>}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="mt-2 w-full h-[56px] rounded-[14px] bg-white text-[18px] font-semibold text-[#D70015]">Cancel</button>
      </div>
    </div>,
    document.body,
  )
}

// Accepting: what was agreed, then the job goes to the cashier.
function AcceptSheet({ p, busy, onAccept, onClose }) {
  const [terms, setTerms] = useState('70')
  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-label="Accept this proforma">
      <div className="absolute inset-0 bg-black/30 animate-fadeIn" onClick={onClose} />
      <div className="ios absolute inset-x-0 bottom-0 rounded-t-[24px] animate-slideUp px-4"
        style={{ background: '#F6F6F8', paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}>
        <div className="flex justify-center pt-2"><span className="w-9 h-[5px] rounded-full bg-black/15" aria-hidden="true" /></div>
        <div className="pt-3 text-center">
          <div className="text-[17px] font-bold text-[#111]">Accept {p.proforma_number}</div>
          <div className="text-[13.5px] text-[#8A8A8E] mt-0.5">{p.customer_name}</div>
        </div>
        <div className="mt-4 rounded-[16px] bg-white px-4 py-3.5 text-center">
          <div className="text-[13px] text-[#8A8A8E]">A job for</div>
          <div className="text-[28px] font-extrabold tracking-[-0.02em] tabular-nums text-[#111]">{money(p.total)}</div>
          <div className="text-[13px] text-[#8A8A8E]">goes to the cashier for payment</div>
        </div>
        <div className="mt-4 px-1 text-[13px] font-semibold text-[#6E6E73]">What was agreed</div>
        <div className="mt-2 p-[3px] rounded-[12px] bg-black/[0.06] flex" role="radiogroup">
          {[['70', '70% deposit'], ['100', 'Paid in full'], ['CREDIT', 'On credit']].map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={terms === v} onClick={() => setTerms(v)}
              className={`flex-1 h-[36px] rounded-[9px] text-[14px] font-semibold ${terms === v ? 'bg-white text-[#111] shadow-[0_2px_6px_rgba(0,0,0,0.10)]' : 'text-[#3A3A3C]'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="m-0 mt-2 px-1 text-[12.5px] text-[#8A8A8E]">Kept on the proforma for reference. The cashier still takes the payment.</p>
        <button type="button" onClick={() => onAccept(terms)} disabled={busy}
          className="mt-5 w-full h-[50px] rounded-[16px] text-white text-[16.5px] font-semibold disabled:opacity-50" style={RED_FILL}>
          {busy ? 'Sending…' : 'Send to the cashier'}
        </button>
        <button type="button" onClick={onClose} className="mt-1 w-full h-[44px] text-[16px] text-[#D70015]">Not yet</button>
      </div>
    </div>,
    document.body,
  )
}

function useList(key, fetchPage) {
  const q = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last?.next ? pages.length + 1 : undefined),
    staleTime: 15_000,
  })
  const rows = (q.data?.pages || []).flatMap(p => (Array.isArray(p) ? p : p?.results || []))
  return { ...q, rows, count: q.data?.pages?.[0]?.count ?? rows.length }
}

function Empty({ title, sub }) {
  return (
    <div className={`${card} py-12 px-6 text-center`}>
      <div className="text-[16px] font-semibold text-[#1C1C1E]">{title}</div>
      <div className="text-[13.5px] text-[#8A8A8E] mt-1">{sub}</div>
    </div>
  )
}

function More({ list, shown }) {
  if (!list.hasNextPage) return null
  return (
    <button type="button" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}
      className="mx-4 mt-3 w-[calc(100%-2rem)] h-[44px] rounded-[14px] bg-white border border-black/[0.06] text-[15px] font-semibold text-[#D70015]">
      {list.isFetchingNextPage ? 'Loading…' : `Show ${Math.min(PAGE, list.count - shown)} more`}
    </button>
  )
}

function Proformas({ onError, creating, setCreating }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [filter, setFilter] = useState('open')
  const [menu, setMenu] = useState(null)
  const [accepting, setAccepting] = useState(null)
  const [revising, setRevising] = useState(null)
  const [pricing, setPricing] = useState(null)
  const [sharing, setSharing] = useState(null)
  const list = useList(['proformas-phone', filter], page => getProformas({ status: filter || undefined, page, page_size: PAGE }).then(r => r.data))
  const rows = filter === 'open' ? list.rows.filter(p => !lapsed(p)) : list.rows
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['proformas-phone'] })

  const pdf = async p => {
    try { const res = await getProformaPdf(p.id); await saveFile(`${p.proforma_number}.pdf`, res.data, `proforma-${p.id}`) } catch { onError('Could not build the document.') }
  }
  const issue = useMutation({
    mutationFn: id => issueProforma(id).then(r => r.data),
    onSuccess: p => { refresh(); setSharing(p) },
    onError: e => onError(e.response?.data?.detail || 'Could not issue this proforma.'),
  })
  const accept = useMutation({
    mutationFn: ({ id, agreed_terms }) => convertProforma(id, { agreed_terms }),
    onSuccess: () => {
      refresh()
      queryClient.invalidateQueries({ queryKey: ['paymentQueue'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setAccepting(null)
    },
    onError: e => { onError(e.response?.data?.detail || 'Could not accept this proforma.'); setAccepting(null) },
  })

  // The summary counts what is loaded; while more pages wait, it says only how many.
  const open = rows.filter(p => p.status === 'ISSUED' && !lapsed(p))
  const outValue = open.reduce((s, p) => s + parseFloat(p.total || 0), 0)
  const toChase = open.filter(chase).length

  const actionsFor = p => {
    const live = (p.status === 'ISSUED' || p.status === 'DRAFT') && !lapsed(p)
    return [
      p.status === 'ISSUED' && !p.is_expired && !lapsed(p) && { label: 'Accept · send to the cashier', strong: true, onClick: () => setAccepting(p) },
      live && { label: p.status === 'DRAFT' ? 'Issue and share' : 'Share the PDF', onClick: () => (p.status === 'DRAFT' ? issue.mutate(p.id) : setSharing(p)) },
      p.status === 'ISSUED' && !p.is_expired && !lapsed(p) && { label: 'Revise', onClick: () => setRevising(p.id) },
      live && mayDiscount(user) && { label: 'Lower the price', onClick: () => setPricing(p) },
      !live && { label: 'Download the PDF', onClick: () => pdf(p) },
      (p.status === 'EXPIRED' || lapsed(p)) && { label: 'Quote again', onClick: () => setCreating(true) },
    ].filter(Boolean)
  }

  return (
    <>
      {filter === 'open' && !list.isLoading && (
        <div className={`${card} mt-3 px-4 py-3.5 flex items-end justify-between gap-3`}>
          <div>
            <div className="text-[13px] font-medium text-[#6E6E73]">Out on quotes</div>
            <div className="text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] tabular-nums text-[#111]">
              {list.hasNextPage ? `${list.count} open` : money(outValue)}
            </div>
          </div>
          <div className="text-right text-[13px]">
            <div className="text-[#8A8A8E]">{list.hasNextPage ? '' : `${open.length} issued`}</div>
            {toChase > 0 && <div className="font-semibold" style={{ color: RED }}>{toChase} to chase</div>}
          </div>
        </div>
      )}

      <Chips value={filter} onPick={setFilter}
        options={[['open', 'Open'], ['CONVERTED', 'Accepted'], ['EXPIRED', 'Expired'], ['', 'All']]} />

      <div className="mt-3">
        {list.isLoading ? <div className={`${card} h-[260px] animate-pulse`} aria-hidden="true" />
          : rows.length === 0 ? <Empty title="No proformas here" sub="Raise one with + to quote a customer before the work starts." />
          : (
            <>
              <div className={`${card} overflow-hidden`}>
                {rows.map((p, i) => {
                  const s = stateOf(p)
                  const saved = parseFloat(p.discount_amount || 0) + parseFloat(p.bulk_saving || 0)
                  return (
                    <button key={p.id} type="button" onClick={() => setMenu(p)}
                      className={`w-full flex items-start gap-3 pl-3.5 pr-3 text-left active:bg-black/[0.04] ${s.faded ? 'opacity-60' : ''}`}>
                      <span className="mt-2.5 w-9 h-9 rounded-[11px] grid place-items-center shrink-0" style={{ background: s.tile[0], color: s.tile[1] }}>
                        <Svg d={s.d} />
                      </span>
                      <span className={`flex-1 min-w-0 py-2.5 ${i ? 'border-t border-black/[0.07]' : ''}`}>
                        <span className="flex items-baseline gap-2">
                          <span className="flex-1 min-w-0 text-[16px] leading-[21px] font-semibold text-[#1C1C1E] truncate">{p.customer_name}</span>
                          <span className="text-[15px] font-semibold tabular-nums text-[#111] whitespace-nowrap">{money(p.total)}</span>
                        </span>
                        <span className="flex items-baseline gap-2 mt-px">
                          <span className="flex-1 min-w-0 text-[13px] leading-[18px] truncate" style={{ color: s.alarm ? RED : '#6E6E73', fontWeight: s.alarm ? 600 : 400 }}>{s.line}</span>
                          <span className="text-[12.5px] text-[#A1A1AA] tabular-nums whitespace-nowrap">#{tail(p.proforma_number)}{p.version > 1 ? ` v${p.version}` : ''}</span>
                        </span>
                        {saved > 0 && <span className="block mt-0.5 text-[12.5px] font-medium text-[#15803D]">Saves {money(saved)}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
              <More list={list} shown={list.rows.length} />
            </>
          )}
      </div>

      {menu && <ActionSheet title={`${menu.proforma_number} · ${menu.customer_name}`} sub={`${money(menu.total)} · ${stateOf(menu).line}`}
        actions={actionsFor(menu)} onClose={() => setMenu(null)} />}
      {sharing && <ActionSheet title={`Share ${sharing.proforma_number}`} sub={sharing.customer_name} onClose={() => setSharing(null)}
        actions={[
          { label: 'Download the PDF', strong: true, onClick: () => pdf(sharing) },
          { label: 'WhatsApp', disabled: true, note: 'Not connected yet', onClick: () => {} },
          { label: 'Email', disabled: true, note: 'Not connected yet', onClick: () => {} },
        ]} />}
      {accepting && <AcceptSheet p={accepting} busy={accept.isPending} onClose={() => setAccepting(null)}
        onAccept={terms => accept.mutate({ id: accepting.id, agreed_terms: terms })} />}
      {pricing && <DiscountPanel kind="proforma" id={pricing.id} title={`${pricing.proforma_number} · ${pricing.customer_name || ''}`}
        onClose={() => { setPricing(null); refresh() }} />}
      {revising && <NewJobModal revise={revising} onClose={() => setRevising(null)} onSuccess={p => { refresh(); if (p) setSharing(p) }} />}
      {creating && <NewJobModal proforma onClose={() => setCreating(false)}
        onSuccess={(p, problem) => { refresh(); if (p) setSharing(p); if (problem) onError(problem) }} />}
    </>
  )
}

function Invoices({ creating, setCreating }) {
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState('')
  const [menu, setMenu] = useState(null)
  const [note, setNote] = useState('')
  const list = useList(['invoices-phone', period], page => client.get('/api/v1/finance/invoices/', { params: { period: period || undefined, page, page_size: PAGE } }).then(r => r.data))
  const resend = useMutation({
    mutationFn: id => sendInvoice(id),
    onSuccess: () => { setNote('Sent again.'); queryClient.invalidateQueries({ queryKey: ['invoices-phone'] }) },
    onError: () => setNote('Could not send it. Try again.'),
  })
  const pdf = async inv => {
    try {
      const res = await client.get(`/api/v1/finance/invoices/${inv.id}/pdf/`, { responseType: 'blob' })
      await saveFile(`${inv.invoice_number}.pdf`, res.data, `invoice-${inv.id}`)
    } catch { setNote('Could not build the document.') }
  }

  return (
    <>
      <Chips value={period} onPick={setPeriod} options={[['', 'All'], ['day', 'Today'], ['week', 'This week'], ['month', 'This month']]} />
      {note && <p className="m-0 mx-5 mt-2 text-[13.5px] font-medium text-[#3A3A3C]">{note}</p>}
      <div className="mt-3">
        {list.isLoading ? <div className={`${card} h-[220px] animate-pulse`} aria-hidden="true" />
          : list.rows.length === 0 ? <Empty title="No invoices yet" sub="Bill a customer for work already done with +." />
          : (
            <>
              <div className={`${card} overflow-hidden`}>
                {list.rows.map((inv, i) => {
                  const [word, dot] = INVOICE[inv.status] || [inv.status, '#A1A1AA']
                  return (
                    <button key={inv.id} type="button" onClick={() => { setNote(''); setMenu(inv) }}
                      className="w-full flex items-start gap-3 pl-3.5 pr-3 text-left active:bg-black/[0.04]">
                      <span className="mt-2.5 w-9 h-9 rounded-[11px] grid place-items-center shrink-0" style={{ background: '#DCE9FF', color: '#2563EB' }}><Svg d={DOC} /></span>
                      <span className={`flex-1 min-w-0 py-2.5 ${i ? 'border-t border-black/[0.07]' : ''}`}>
                        <span className="flex items-baseline gap-2">
                          <span className="flex-1 min-w-0 text-[16px] leading-[21px] font-semibold text-[#1C1C1E] truncate">{inv.bill_to_company || inv.bill_to_name || '—'}</span>
                          <span className="text-[15px] font-semibold tabular-nums text-[#111] whitespace-nowrap">{money(inv.total)}</span>
                        </span>
                        <span className="flex items-center gap-2 mt-0.5 text-[13px]">
                          <span className="w-[7px] h-[7px] rounded-full" style={{ background: dot }} />
                          <span className="flex-1 min-w-0 text-[#3A3A3C] truncate">{word}{inv.job_number ? ` · job #${tail(inv.job_number)}` : ''}</span>
                          <span className="text-[12.5px] text-[#A1A1AA] tabular-nums whitespace-nowrap">#{tail(inv.invoice_number)} · {day(inv.issue_date)}</span>
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <More list={list} shown={list.rows.length} />
            </>
          )}
      </div>
      {menu && <ActionSheet title={`${menu.invoice_number} · ${menu.bill_to_name || ''}`} sub={money(menu.total)} onClose={() => setMenu(null)}
        actions={[
          { label: 'Download the PDF', strong: true, onClick: () => pdf(menu) },
          { label: 'Send it again', onClick: () => resend.mutate(menu.id) },
        ]} />}
      {creating && <InvoiceCreateModal onClose={() => setCreating(false)}
        onSuccess={() => { setCreating(false); queryClient.invalidateQueries({ queryKey: ['invoices-phone'] }) }} />}
    </>
  )
}

export default function InvoicesPhone() {
  const [tab, setTab] = useState('proformas')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="ios min-h-full pb-6" style={{ background: '#F6F6F8' }}>
      <PhoneHeader />
      <div className="px-4 pt-1 flex items-center justify-between">
        <h1 className="m-0 text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] text-[#111]">Invoices</h1>
        <button type="button" onClick={() => setCreating(true)} aria-label={tab === 'proformas' ? 'New proforma' : 'New invoice'}
          className="h-10 pl-3 pr-3.5 rounded-full text-white text-[14.5px] font-semibold inline-flex items-center gap-1.5" style={RED_FILL}>
          <Svg d={<path d="M12 5v14 M5 12h14" />} size={17} width={2.6} />New
        </button>
      </div>

      <div className="mx-4 mt-3 p-[3px] rounded-[10px] bg-black/[0.06] flex" role="tablist">
        {[['proformas', 'Proformas'], ['invoices', 'Invoices']].map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => { setTab(v); setCreating(false) }}
            className={`flex-1 h-[30px] rounded-[8px] text-[13.5px] font-semibold ${tab === v ? 'bg-white text-[#111] shadow-[0_2px_6px_rgba(0,0,0,0.10)]' : 'text-[#3A3A3C]'}`}>
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-[14px] bg-[#FFF2F2] text-[14px] text-[#B91C1C] flex items-start gap-3">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError('')} className="font-semibold">OK</button>
        </div>
      )}

      {tab === 'proformas'
        ? <Proformas onError={setError} creating={creating} setCreating={setCreating} />
        : <Invoices creating={creating} setCreating={setCreating} />}
    </div>
  )
}
