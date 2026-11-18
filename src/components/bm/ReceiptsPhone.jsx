// src/components/bm/ReceiptsPhone.jsx
//
// Receipts on a phone (18 Nov 2026), under Jobs | Receipts, in the Overview's look.
//   Today · Week · Month
//   The period's takings in one card: the total, then Cash, MoMo and Card
//   (the server counts every receipt in the period, not just the page shown)
//   Every receipt as a row, its method as the icon square; "Show more".
// Tapping one slides the receipt in, drawn like the paper slip, with
// WhatsApp, Print and PDF along the bottom.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import { getJobReceipt, sendReceiptWhatsApp } from '../../api/bm'
import { download, printReceipt } from './jobFileQuery'

const RED = '#D70015'
const PAGE = 20
const PERIODS = [['day', 'Today'], ['week', 'Week'], ['month', 'Month']]
const TAKEN = { day: 'Taken today', week: 'Taken this week', month: 'Taken this month' }

const Svg = ({ d, size = 18, width = 2, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{d}</svg>
)
// Each way of paying, its colour and mark.
const METHOD = {
  CASH:   { label: 'Cash',   tile: '#D3F2DE', ink: '#15803D', d: <path d="M2 6h20v12H2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 9v.01 M18 15v.01" /> },
  MOMO:   { label: 'MoMo',   tile: '#FFEDB8', ink: '#B45309', d: <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M11 18h2" /> },
  POS:    { label: 'Card',   tile: '#DCE9FF', ink: '#2563EB', d: <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M2 10h20 M6 15h4" /> },
  ONLINE: { label: 'Online', tile: '#E7DCFF', ink: '#7C3AED', d: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2a15 15 0 0 1 0 20 M12 2a15 15 0 0 0 0 20" /> },
  CREDIT: { label: 'Credit', tile: '#F1F1F3', ink: '#52525B', d: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5" /> },
}
const methodOf = m => METHOD[m] || METHOD.CREDIT

const money = v => `GHS ${parseFloat(v || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const short = v => {
  const n = parseFloat(v || 0)
  return `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
}
function stamp(iso) {
  if (!iso) return ''
  const d = new Date(iso), now = new Date()
  const days = Math.round((new Date(now.toDateString()) - new Date(d.toDateString())) / 86_400_000)
  if (days === 0) return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
const titleCase = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
const tail = n => (n || '').split('-').pop()

function Tile({ method, size = 36 }) {
  const m = methodOf(method)
  return (
    <span className="rounded-[11px] grid place-items-center shrink-0" style={{ width: size, height: size, background: m.tile, color: m.ink }}>
      <Svg d={m.d} size={size * 0.5} />
    </span>
  )
}

function ReceiptRow({ r, first, onOpen }) {
  const owed = parseFloat(r.balance_due || 0) > 0
  return (
    <button type="button" onClick={onOpen} className="w-full flex items-start gap-3 pl-3.5 pr-3 text-left active:bg-black/[0.04]">
      <span className="mt-2.5"><Tile method={r.payment_method} /></span>
      <span className={`flex-1 min-w-0 py-2.5 ${first ? '' : 'border-t border-black/[0.07]'}`}>
        <span className="flex items-baseline gap-2">
          <span className={`flex-1 min-w-0 text-[16px] leading-[21px] font-semibold truncate ${r.is_void ? 'text-[#A1A1AA] line-through' : 'text-[#1C1C1E]'}`}>
            {titleCase(r.customer_name) || 'Walk-in'}
          </span>
          <span className={`text-[15px] font-semibold tabular-nums whitespace-nowrap ${r.is_void ? 'text-[#A1A1AA] line-through' : 'text-[#111]'}`}>{short(r.amount_paid)}</span>
        </span>
        <span className="flex items-baseline gap-2 mt-px">
          <span className="flex-1 min-w-0 text-[13px] leading-[18px] text-[#6E6E73] truncate">
            {r.is_void ? <span className="text-[#B91C1C] font-medium">Voided</span> : methodOf(r.payment_method).label}
            {owed && !r.is_void && <span style={{ color: RED }}> · {short(r.balance_due)} still owed</span>}
          </span>
          <span className="text-[12.5px] text-[#8A8A8E] whitespace-nowrap tabular-nums">#{tail(r.receipt_number)} · {stamp(r.created_at)}</span>
        </span>
      </span>
    </button>
  )
}

// The receipt, drawn like the printed slip: a torn edge at the foot.
function ReceiptPage({ id, onClose }) {
  const [note, setNote] = useState({ text: '', bad: false })
  const [sending, setSending] = useState(false)
  const { data: r, isLoading } = useQuery({
    queryKey: ['receipt-detail', id],
    queryFn: () => client.get(`/api/v1/finance/receipts/${id}/`).then(res => res.data),
    staleTime: 30_000,
  })
  useEffect(() => {
    document.body.dataset.fullscreen = '1'
    return () => { delete document.body.dataset.fullscreen }
  }, [])
  const fail = () => setNote({ text: 'That did not work. Try again.', bad: true })
  const whatsapp = async () => {
    setSending(true); setNote({ text: '', bad: false })
    try { await sendReceiptWhatsApp(id); setNote({ text: 'Sent on WhatsApp.', bad: false }) } catch { fail() } finally { setSending(false) }
  }
  const m = methodOf(r?.payment_method)
  const when = r?.created_at ? new Date(r.created_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ''
  const line = (label, value, strong, tone) => value != null && (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'pt-2' : ''}`}>
      <span className={`text-[14px] ${strong ? 'font-semibold text-[#1C1C1E]' : 'text-[#6E6E73]'}`}>{label}</span>
      <span className={`tabular-nums ${strong ? 'text-[17px] font-bold' : 'text-[14.5px] font-semibold'}`} style={{ color: tone || '#111' }}>{value}</span>
    </div>
  )
  const more = v => parseFloat(v || 0) > 0

  return createPortal(
    <section aria-label="Receipt" className="ios ios-push fixed inset-0 z-[65] flex flex-col" style={{ background: '#F6F6F8' }}>
      <div className="ios-bar shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-[50px] px-2 grid grid-cols-[1fr_auto_1fr] items-center">
          <button type="button" onClick={onClose} className="justify-self-start flex items-center text-[17px] text-[#D70015] pr-2">
            <Svg d={<path d="M15 18l-6-6 6-6" />} size={26} width={2.4} />Receipts
          </button>
          <span className="text-[16px] font-semibold text-[#111] tabular-nums">{r ? `#${tail(r.receipt_number)}` : ''}</span>
          <span />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
        {isLoading || !r ? (
          <div className="h-[420px] rounded-[18px] bg-black/[0.05] animate-pulse" aria-hidden="true" />
        ) : (
          <div className="relative bg-white rounded-t-[18px] shadow-[0_3px_14px_rgba(17,24,39,0.07)] pb-5"
            style={{ WebkitMaskImage: 'radial-gradient(circle at 8px 100%, transparent 6px, #000 6.5px)', WebkitMaskSize: '16px 100%',
              maskImage: 'radial-gradient(circle at 8px 100%, transparent 6px, #000 6.5px)', maskSize: '16px 100%' }}>
            {/* The amount, how it was paid, when */}
            <div className="px-5 pt-6 pb-5 text-center">
              <span className="inline-grid"><Tile method={r.payment_method} size={44} /></span>
              <div className={`mt-3 text-[32px] leading-[38px] font-extrabold tracking-[-0.02em] tabular-nums ${r.is_void ? 'line-through text-[#A1A1AA]' : 'text-[#111]'}`}>{money(r.amount_paid)}</div>
              <div className="mt-1 text-[14px] text-[#3A3A3C] font-medium">
                {r.is_void ? <span className="text-[#B91C1C]">Voided</span> : `Paid by ${m.label}`}
                {r.momo_reference ? ` · Ref ${r.momo_reference}` : ''}{r.pos_approval_code ? ` · Approval ${r.pos_approval_code}` : ''}
              </div>
              <div className="mt-0.5 text-[13px] text-[#8A8A8E]">{when}</div>
            </div>

            <div className="mx-5 border-t border-dashed border-black/[0.15]" />

            {/* What was bought */}
            <div className="px-5 py-4 space-y-3">
              {(r.line_items || []).map((li, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-[#1C1C1E]">{li.service_name}</div>
                    <div className="text-[13px] text-[#8A8A8E]">{li.pages} page{li.pages === 1 ? '' : 's'} × {li.sets} cop{li.sets === 1 ? 'y' : 'ies'} · {li.is_color ? 'Colour' : 'B&W'}</div>
                  </div>
                  <span className="text-[15px] font-semibold tabular-nums whitespace-nowrap">{money(li.line_total)}</span>
                </div>
              ))}
              {!(r.line_items || []).length && <div className="text-[15px] font-semibold">{r.job_title}</div>}
            </div>

            <div className="mx-5 border-t border-dashed border-black/[0.15]" />

            {/* The money */}
            <div className="px-5 py-4 space-y-1.5">
              {line('Subtotal', money(r.subtotal || r.amount_paid))}
              {more(r.vat_amount) && line('VAT and levies', money(parseFloat(r.vat_amount) + parseFloat(r.nhil_amount || 0) + parseFloat(r.getfund_amount || 0)))}
              {more(r.cash_tendered) && line('Cash given', money(r.cash_tendered))}
              {more(r.change_given) && line('Change', money(r.change_given))}
              {line('Paid', money(r.amount_paid), true)}
              {more(r.balance_due) && line('Still owed', money(r.balance_due), true, RED)}
            </div>

            <div className="mx-5 border-t border-dashed border-black/[0.15]" />

            {/* Who */}
            <div className="px-5 pt-4 space-y-1.5">
              {[
                ['Customer', titleCase(r.customer_name) || 'Walk-in'],
                r.customer_phone && ['Phone', r.customer_phone],
                ['Job', r.job_number],
                ['Receipt', r.receipt_number],
                ['Cashier', r.cashier_name || '—'],
                ['Attendant', r.intake_by_name || '—'],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] text-[#6E6E73]">{label}</span>
                  <span className="text-[14px] font-semibold text-[#1C1C1E] truncate tabular-nums">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {r?.whatsapp_status === 'SENT' && (
          <p className="m-0 mt-4 text-center text-[13px] text-[#15803D] font-medium">
            Sent on WhatsApp{r.whatsapp_sent_at ? ` at ${new Date(r.whatsapp_sent_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}` : ''}
          </p>
        )}
      </div>

      {r && !r.is_void && (
        <div className="shrink-0 bg-white border-t border-black/[0.08] px-4 pt-2.5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
          {note.text && <div className={`text-[13px] font-semibold mb-2 ${note.bad ? 'text-[#B91C1C]' : 'text-[#15803D]'}`}>{note.text}</div>}
          <div className="flex gap-2.5">
            {r.customer_phone && (
              <button type="button" onClick={whatsapp} disabled={sending}
                className="flex-[1.4] h-[46px] rounded-[14px] bg-[#1C1C1E] text-white text-[15.5px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                <Svg d={<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />} size={18} />{sending ? 'Sending…' : 'WhatsApp'}
              </button>
            )}
            <button type="button" onClick={() => printReceipt(id).catch(fail)}
              className="flex-1 h-[46px] rounded-[14px] bg-[#F2F2F4] text-[#1C1C1E] text-[15.5px] font-semibold">Print</button>
            <button type="button" onClick={() => download(`/api/v1/finance/receipts/${id}/pdf/`, `${r.receipt_number}.pdf`).catch(fail)}
              className="flex-1 h-[46px] rounded-[14px] bg-[#F2F2F4] text-[#1C1C1E] text-[15.5px] font-semibold">PDF</button>
          </div>
        </div>
      )}
    </section>,
    document.body,
  )
}

export default function ReceiptsPhone() {
  const [period, setPeriod] = useState('day')
  const [openId, setOpenId] = useState(null)
  const list = useInfiniteQuery({
    queryKey: ['receipts-phone', period],
    queryFn: ({ pageParam }) => getJobReceipt(null, { period, page: pageParam, page_size: PAGE }).then(r => r.data),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last?.next ? pages.length + 1 : undefined),
    staleTime: 15_000,
  })
  const receipts = (list.data?.pages || []).flatMap(p => (Array.isArray(p) ? p : p?.results || []))
  const first = list.data?.pages?.[0]
  const count = first?.count ?? receipts.length
  const totals = first?.totals
  // Cash, MoMo and Card always; Online and Credit only when used.
  const methods = ['CASH', 'MOMO', 'POS', ...['ONLINE', 'CREDIT'].filter(k => totals?.by_method?.[k])]

  return (
    <div className="pb-2">
      <div className="mx-4 mt-3 p-[3px] rounded-[10px] bg-black/[0.06] flex" role="radiogroup" aria-label="Period">
        {PERIODS.map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={period === v} onClick={() => setPeriod(v)}
            className={`flex-1 h-[30px] rounded-[8px] text-[13.5px] font-semibold
              ${period === v ? 'bg-white text-[#111] shadow-[0_2px_6px_rgba(0,0,0,0.10)]' : 'text-[#3A3A3C]'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* The takings */}
      <div className="mx-4 mt-3 rounded-[18px] bg-white border border-black/[0.04] shadow-[0_3px_12px_rgba(17,24,39,0.05)]">
        <div className="px-4 pt-3.5 pb-3">
          <div className="text-[13px] font-medium text-[#6E6E73]">{TAKEN[period]}</div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] tabular-nums text-[#111]">
              {totals ? money(totals.amount) : '—'}
            </span>
            <span className="text-[13px] text-[#8A8A8E]">{totals ? `${totals.count} receipt${totals.count === 1 ? '' : 's'}` : ''}</span>
          </div>
        </div>
        <div className="grid border-t border-black/[0.06]" style={{ gridTemplateColumns: `repeat(${methods.length}, minmax(0, 1fr))` }}>
          {methods.map((k, i) => {
            const v = totals?.by_method?.[k]
            return (
              <div key={k} className={`px-3.5 py-2.5 min-w-0 ${i ? 'border-l border-black/[0.06]' : ''}`}>
                <span className="flex items-center gap-1.5 text-[12.5px] text-[#6E6E73]">
                  <span className="w-2 h-2 rounded-full" style={{ background: methodOf(k).ink }} />{methodOf(k).label}
                  {v?.count ? <span className="text-[#A1A1AA]">{v.count}</span> : null}
                </span>
                <span className="block mt-0.5 text-[15px] font-semibold tabular-nums text-[#111] truncate">{v ? short(v.amount) : 'GHS 0'}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-4 mt-4 mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[#8A8A8E]">Receipts</span>
        <span className="text-[13px] text-[#8A8A8E]">{list.isLoading ? '' : `${count}`}</span>
      </div>

      {list.isLoading ? (
        <div className="mx-4 rounded-[16px] bg-white animate-pulse h-[260px]" aria-hidden="true" />
      ) : list.isError ? (
        <div className="mx-4 rounded-[16px] bg-white py-10 px-6 text-center">
          <div className="text-[16px] font-semibold text-[#1C1C1E]">The receipts could not load</div>
          <button type="button" onClick={() => list.refetch()} className="mt-2 text-[15px] font-semibold text-[#D70015]">Try again</button>
        </div>
      ) : receipts.length === 0 ? (
        <div className="mx-4 rounded-[16px] bg-white py-12 px-6 text-center">
          <div className="text-[16px] font-semibold text-[#1C1C1E]">No receipts yet</div>
          <div className="text-[13.5px] text-[#8A8A8E] mt-1">Each payment the cashier takes appears here.</div>
        </div>
      ) : (
        <>
          <div className="mx-4 rounded-[16px] bg-white overflow-hidden border border-black/[0.04] shadow-[0_3px_12px_rgba(17,24,39,0.05)]">
            {receipts.map((r, i) => <ReceiptRow key={r.id} r={r} first={i === 0} onOpen={() => setOpenId(r.id)} />)}
          </div>
          {list.hasNextPage && (
            <button type="button" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}
              className="mx-4 mt-3 w-[calc(100%-2rem)] h-[44px] rounded-[14px] bg-white border border-black/[0.06] text-[15px] font-semibold text-[#D70015]">
              {list.isFetchingNextPage ? 'Loading…' : `Show ${Math.min(PAGE, count - receipts.length)} more`}
            </button>
          )}
        </>
      )}

      {openId && <ReceiptPage id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
