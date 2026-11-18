// src/components/bm/JobFilePhone.jsx
//
// A job's page on a phone (18 Nov 2026): it slides in over the Jobs list, as
// iOS opens a row, with "‹ Jobs" to go back. The same file as the computer's
// panel (JobFile.jsx, both on useJobFile), laid out for one hand:
//   who it is for, the number, the type, and where it stands
//   the money in one card: total, paid, still owed
//   the facts as a list, the customer's number tappable to call
//   Order | Money | History
//   Chat and Remind along the bottom; the rest behind "•••".
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getInvoicePdfUrl } from '../../api/bm'
import { download, printReceipt, useJobFile } from './jobFileQuery'
import DiscountPanel from './DiscountPanel'
import { useAuth } from '../../context/AuthContext'
import { mayDiscount } from '../../api/discounts'

const RED = '#D70015'
const money = v => `GHS ${parseFloat(v || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
const when = iso => (iso ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '—')
const time = iso => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }) : '')
const day = iso => (iso ? new Date(iso).toDateString() : '')

const Svg = ({ d, size = 18, width = 2, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{d}</svg>
)
const I = {
  back: <path d="M15 18l-6-6 6-6" />,
  more: <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  bell: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0" />,
  check: <path d="M20 6 9 17l-5-5" />,
}
// Where it stands, as quiet pills with a coloured dot.
const STATE_DOT = {
  SETTLED: '#22C55E', DEPOSIT_PAID: '#F59E0B', UNPAID: RED,
  DONE: '#8B5CF6', HANDED_OVER: '#3B82F6', AWAITING_COLLECTION: '#F59E0B',
}
const HISTORY_TINT = {
  money: ['#FFEDB8', '#B45309'], work: ['#E7DCFF', '#7C3AED'], done: ['#DCE9FF', '#2563EB'],
  chat: ['#D3F2DE', '#15803D'], ink: ['#F1F1F3', '#52525B'],
}

function Card({ children, className = '' }) {
  return <div className={`rounded-[16px] bg-white border border-black/[0.04] shadow-[0_3px_12px_rgba(17,24,39,0.05)] ${className}`}>{children}</div>
}

function Row({ label, value, sub, first, action }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${first ? '' : 'border-t border-black/[0.07]'}`}>
      <span className="w-[104px] shrink-0 text-[14.5px] text-[#6E6E73]">{label}</span>
      <span className="flex-1 min-w-0 text-right">
        <span className="block text-[15px] font-semibold text-[#1C1C1E] truncate">{value}</span>
        {sub && <span className="block text-[12.5px] text-[#8A8A8E] truncate">{sub}</span>}
      </span>
      {action}
    </div>
  )
}

function Pill({ children, onClick, dark, disabled, icon }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`h-[38px] px-3.5 rounded-full inline-flex items-center gap-1.5 text-[14px] font-semibold disabled:opacity-50
        ${dark ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F4] text-[#1C1C1E]'}`}>
      {icon && <Svg d={I[icon]} size={16} />}{children}
    </button>
  )
}

export default function JobFilePhone({ jobId, onClose, onOpenChat }) {
  const [tab, setTab] = useState('order')
  const [menu, setMenu] = useState(false)
  const [pricing, setPricing] = useState(false)
  const { user } = useAuth()
  const { file, isLoading, error, invoice, note, fail, sendReceipt, makeInvoice, sendInv, remind } = useJobFile(jobId)

  // Full screen: the bottom tab bar steps aside while the job is open.
  useEffect(() => {
    document.body.dataset.fullscreen = '1'
    return () => { delete document.body.dataset.fullscreen }
  }, [])

  const f = file?.facts || {}
  const owner = file?.owner || {}
  const latest = file?.payments?.[file.payments.length - 1]
  const balance = parseFloat(f.balance || 0)
  const promised = f.promised || f.deadline
  const onTime = promised && f.ready_at ? (new Date(f.ready_at) <= new Date(promised) ? 'on time' : 'late') : ''
  const canChat = onOpenChat && owner.conversation_id
  const canLower = mayDiscount(user) && parseFloat(f.paid || 0) === 0 && parseFloat(f.total || 0) > 0
  const tabs = [['order', 'Order', file?.items?.filter(i => !i.is_addon).length ?? 0],
                ['money', 'Money', file?.payments?.length ?? 0],
                ['history', 'History', file?.history?.length ?? 0]]
  const typeWord = file?.job_type ? file.job_type.charAt(0) + file.job_type.slice(1).toLowerCase() : ''

  return createPortal(
    <section aria-label="Job" className="ios ios-push fixed inset-0 z-[65] flex flex-col" style={{ background: '#F6F6F8' }}>
      {/* The navigation bar */}
      <div className="ios-bar shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-[50px] px-2 grid grid-cols-[1fr_auto_1fr] items-center">
          <button type="button" onClick={onClose} className="justify-self-start flex items-center text-[17px] text-[#D70015] pr-2">
            <Svg d={I.back} size={26} width={2.4} />Jobs
          </button>
          <span className="text-[16px] font-semibold text-[#111] tabular-nums">{file ? `#${file.job_number.split('-').pop()}` : ''}</span>
          {(canLower || file?.can_remind || canChat) ? (
            <button type="button" onClick={() => setMenu(true)} aria-label="More actions"
              className="justify-self-end w-9 h-9 mr-1 rounded-full bg-black/[0.05] grid place-items-center text-[#1C1C1E]">
              <Svg d={I.more} size={20} width={2.4} />
            </button>
          ) : <span />}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        {error && <div className="mx-4 mt-4 rounded-[14px] bg-[#FFF2F2] px-4 py-3 text-[14px] text-[#B91C1C]">{error?.response?.data?.detail || 'This job could not be loaded.'}</div>}
        {isLoading && (
          <div className="px-4 pt-4 space-y-3 animate-pulse" aria-hidden="true">
            <div className="h-8 w-48 rounded-lg bg-black/[0.06]" />
            <div className="h-[84px] rounded-[16px] bg-black/[0.06]" />
            <div className="h-[180px] rounded-[16px] bg-black/[0.06]" />
          </div>
        )}

        {file && (
          <>
            {/* Who, what, where it stands */}
            <div className="px-4 pt-3">
              <h1 className="m-0 text-[26px] leading-[32px] font-extrabold tracking-[-0.02em] text-[#111]">{owner.name}</h1>
              <div className="text-[13.5px] text-[#6E6E73] mt-0.5 tabular-nums">
                {file.job_number} · {typeWord}{owner.from_chat ? ' · from WhatsApp' : ''}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {Object.values(file.states).filter(s => s.code).map(s => (
                  <span key={s.code} className="h-[26px] px-2.5 rounded-full bg-white border border-black/[0.06] inline-flex items-center gap-1.5
                    text-[12.5px] font-semibold text-[#1C1C1E]">
                    <span className="w-[7px] h-[7px] rounded-full" style={{ background: STATE_DOT[s.code] || '#A1A1AA' }} />{s.words}
                  </span>
                ))}
              </div>
            </div>

            {/* The money, at a glance */}
            <Card className="mx-4 mt-4 grid grid-cols-3">
              {[['Total', money(f.total)], ['Paid', money(f.paid)], ['Owed', money(balance)]].map(([label, v], i) => (
                <div key={label} className={`px-3 py-3 ${i ? 'border-l border-black/[0.06]' : ''}`}>
                  <div className="text-[12.5px] text-[#8A8A8E]">{label}</div>
                  <div className="text-[16px] font-bold tabular-nums tracking-[-0.01em] mt-0.5 truncate"
                    style={{ color: label === 'Owed' && balance > 0 ? RED : '#111' }}>{v}</div>
                </div>
              ))}
            </Card>

            {/* The facts */}
            <Card className="mx-4 mt-3 overflow-hidden">
              <Row first label="Phone" value={owner.phone || '—'}
                sub={owner.jobs_count > 1 ? `${owner.jobs_count} jobs with us` : 'First job with us'}
                action={owner.phone && (
                  <a href={`tel:${owner.phone}`} aria-label={`Call ${owner.name}`}
                    className="w-9 h-9 rounded-full grid place-items-center shrink-0" style={{ background: '#D3F2DE', color: '#15803D' }}>
                    <Svg d={I.phone} size={16} />
                  </a>
                )} />
              <Row label="Promised" value={promised ? when(promised) : '—'}
                sub={f.ready_at ? `Ready ${when(f.ready_at)}${onTime ? `, ${onTime}` : ''}` : ''} />
              <Row label="Recorded by" value={f.recorded_by} sub={when(f.recorded_at)} />
              <Row label="Came in by" value={f.channel} />
            </Card>

            {/* Order | Money | History */}
            <div className="mx-4 mt-5 p-[3px] rounded-[10px] bg-black/[0.06] flex" role="tablist" aria-label="Job details">
              {tabs.map(([id, label, n]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                  className={`flex-1 h-[30px] rounded-[8px] text-[13.5px] font-semibold
                    ${tab === id ? 'bg-white text-[#111] shadow-[0_2px_6px_rgba(0,0,0,0.10)]' : 'text-[#3A3A3C]'}`}>
                  {label} <span className="opacity-50 font-medium">{n}</span>
                </button>
              ))}
            </div>

            {tab === 'order' && (
              <Card className="mx-4 mt-3 overflow-hidden">
                {file.items.map((it, i) => {
                  const detail = it.sum || (it.count && it.count !== '1' ? it.count : '')
                  return (
                    <div key={i} className={`flex gap-3 px-4 py-3 ${i ? 'border-t border-black/[0.07]' : ''} ${it.is_addon ? 'pl-11' : ''}`}>
                      {it.is_addon
                        ? <span className="w-4 text-center font-bold text-[#A1A1AA]">+</span>
                        : <span className="w-6 h-6 rounded-full bg-[#F2F2F4] grid place-items-center text-[12px] font-bold shrink-0">{it.number}</span>}
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-semibold text-[#1C1C1E]">{it.name}</div>
                        {detail && <div className="text-[13px] text-[#6E6E73] mt-0.5">{detail}</div>}
                        {it.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {it.tags.map(t => <span key={t} className="h-[22px] px-2 rounded-md bg-[#F2F2F4] text-[12px] font-semibold text-[#3A3A3C] inline-flex items-center">{t}</span>)}
                          </div>
                        )}
                      </div>
                      <span className="text-[15px] font-semibold tabular-nums whitespace-nowrap">GHS {it.amount}</span>
                    </div>
                  )
                })}
                {file.notes && <div className="border-t border-black/[0.07] px-4 py-3 text-[14px] text-[#92400E] bg-[#FFFBEB]">{file.notes}</div>}
              </Card>
            )}

            {tab === 'money' && (
              <>
                <Card className="mx-4 mt-3 overflow-hidden">
                  {file.payments.length === 0 && <p className="m-0 px-4 py-4 text-[14.5px] text-[#8A8A8E]">No payments yet.</p>}
                  {file.payments.map((p, i) => (
                    <div key={p.id} className={`flex gap-3 px-4 py-3 items-start ${i ? 'border-t border-black/[0.07]' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-semibold text-[#1C1C1E]">{p.label} · <span className="text-[#6E6E73] font-medium">{p.method_label}</span></div>
                        <div className="text-[12.5px] text-[#8A8A8E] mt-0.5">
                          {when(p.at)}{p.by ? ` · ${p.by}` : ''}{p.reference ? ` · Ref ${p.reference}` : ''}
                        </div>
                      </div>
                      <span className="text-[15px] font-bold tabular-nums">{money(p.amount)}</span>
                    </div>
                  ))}
                </Card>
                <Card className="mx-4 mt-3 px-4 py-3.5">
                  <div className="text-[15.5px] font-bold">Receipt{file.payments.length > 1 ? 's' : ''}</div>
                  <div className="text-[13px] text-[#8A8A8E] mt-0.5">{latest ? `Latest: ${latest.receipt_number}` : 'Issued when a payment is taken.'}</div>
                  {latest && (
                    <div className="flex gap-2 flex-wrap mt-3">
                      <Pill dark icon="chat" disabled={sendReceipt.isPending} onClick={() => sendReceipt.mutate(latest.id)}>WhatsApp</Pill>
                      <Pill onClick={() => download(`/api/v1/finance/receipts/${latest.id}/pdf/`, `${latest.receipt_number}.pdf`).catch(fail)}>PDF</Pill>
                      <Pill onClick={() => printReceipt(latest.id).catch(fail)}>Print</Pill>
                    </div>
                  )}
                </Card>
                <Card className="mx-4 mt-3 px-4 py-3.5">
                  <div className="text-[15.5px] font-bold">Invoice</div>
                  <div className="text-[13px] text-[#8A8A8E] mt-0.5">
                    {invoice ? `${invoice.invoice_number || 'Invoice'}${invoice.status ? ` · ${invoice.status.toLowerCase()}` : ''}` : 'None yet. One tap makes it from the job.'}
                  </div>
                  <div className="flex gap-2 flex-wrap mt-3">
                    {invoice ? (
                      <>
                        <Pill dark icon="chat" disabled={sendInv.isPending} onClick={() => sendInv.mutate(invoice.id)}>Send</Pill>
                        <Pill onClick={() => download(getInvoicePdfUrl(invoice.id), `${invoice.invoice_number || 'invoice'}.pdf`).catch(fail)}>PDF</Pill>
                      </>
                    ) : (
                      <Pill dark disabled={makeInvoice.isPending} onClick={() => makeInvoice.mutate()}>Make the invoice</Pill>
                    )}
                  </div>
                </Card>
              </>
            )}

            {tab === 'history' && (
              <Card className="mx-4 mt-3 px-4 py-1.5">
                {file.history.map((h, i) => {
                  const newDay = i === 0 || day(h.at) !== day(file.history[i - 1].at)
                  const [bg, ink] = HISTORY_TINT[h.tone] || HISTORY_TINT.ink
                  return (
                    <div key={i}>
                      {newDay && <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[#8A8A8E] pt-2.5 pb-1">
                        {new Date(h.at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </div>}
                      <div className="grid grid-cols-[28px_1fr_auto] gap-3 py-2 items-start">
                        <span className="w-7 h-7 rounded-full grid place-items-center" style={{ background: bg, color: ink }}><Svg d={I.check} size={13} width={2.6} /></span>
                        <div className="min-w-0">
                          <div className="text-[14.5px] font-semibold text-[#1C1C1E]">{h.title}</div>
                          <div className="text-[12.5px] text-[#8A8A8E]">{[h.by && `by ${h.by}`, h.detail].filter(Boolean).join(' · ')}</div>
                        </div>
                        <span className="text-[12.5px] text-[#8A8A8E] whitespace-nowrap pt-0.5">{time(h.at)}</span>
                      </div>
                    </div>
                  )
                })}
              </Card>
            )}
          </>
        )}
      </div>

      {/* The two things done most, within thumb reach */}
      {(canChat || file?.can_remind || note.text) && (
        <div className="shrink-0 bg-white border-t border-black/[0.08] px-4 pt-2.5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
          {note.text && <div className={`text-[13px] font-semibold mb-2 ${note.bad ? 'text-[#B91C1C]' : 'text-[#15803D]'}`}>{note.text}</div>}
          <div className="flex gap-2.5">
            {canChat && (
              <button type="button" onClick={() => onOpenChat(owner.conversation_id)}
                className="flex-1 h-[46px] rounded-[14px] bg-[#1C1C1E] text-white text-[15.5px] font-semibold inline-flex items-center justify-center gap-2">
                <Svg d={I.chat} size={18} />Chat
              </button>
            )}
            {file?.can_remind && (
              <button type="button" onClick={() => remind.mutate()} disabled={remind.isPending}
                className="flex-1 h-[46px] rounded-[14px] bg-[#F2F2F4] text-[#1C1C1E] text-[15.5px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                <Svg d={I.bell} size={18} />Remind
              </button>
            )}
          </div>
        </div>
      )}

      {/* "•••": an iOS action sheet */}
      {menu && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-label="More actions">
          <div className="absolute inset-0 bg-black/30 animate-fadeIn" onClick={() => setMenu(false)} />
          <div className="absolute inset-x-2.5 animate-slideUp" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
            <div className="rounded-[14px] bg-white/95 backdrop-blur-xl overflow-hidden">
              {[
                canLower && ['Lower the price', () => setPricing(true)],
                file?.can_remind && ['Remind the customer', () => remind.mutate()],
                canChat && ['Open the chat', () => onOpenChat(owner.conversation_id)],
                owner.phone && [`Call ${owner.phone}`, () => { window.location.href = `tel:${owner.phone}` }],
              ].filter(Boolean).map(([label, act], i) => (
                <button key={label} type="button" onClick={() => { setMenu(false); act() }}
                  className={`w-full h-[56px] text-[18px] text-[#D70015] active:bg-black/[0.05] ${i ? 'border-t border-black/[0.08]' : ''}`}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setMenu(false)}
              className="mt-2 w-full h-[56px] rounded-[14px] bg-white text-[18px] font-semibold text-[#D70015]">Cancel</button>
          </div>
        </div>
      )}

      {pricing && (
        <DiscountPanel kind="job" id={jobId} title={`${file?.job_number || ''} · ${owner.name || ''}`}
          onClose={() => setPricing(false)} />
      )}
    </section>,
    document.body,
  )
}
