// src/components/bm/JobFile.jsx
// The job page (13 Nov 2026): the job's complete file. Always on screen: who
// it is for, the type, where it stands, and six facts. Then three tabs: the
// order, the money (every payment, receipts and invoice), and the history with
// who and when. Built on GET /jobs/<id>/file/ (apps/jobs/services/job_file.py).

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { createInvoice, getJobInvoices, getInvoicePdfUrl, sendInvoice } from '../../api/bm'

const fmt = v => `GHS ${parseFloat(v || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
const when = iso => (iso ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '—')
const time = iso => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }) : '')
const day = iso => (iso ? new Date(iso).toDateString() : '')

const Icon = ({ d, size = 16, width = 1.75 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">{d}</svg>
)
const I = {
  x: <><path d="M18 6 6 18" /><path d="M6 6l12 12" /></>,
  chat: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  printer: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  coins: <><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
}
const TONE = {
  money: 'bg-amber-50 text-amber-700', work: 'bg-violet-50 text-violet-700', done: 'bg-sky-50 text-sky-700',
  chat: 'bg-emerald-50 text-emerald-700', ink: 'bg-zinc-100 text-zinc-700',
}
const STATE_TONE = {
  SETTLED: 'bg-emerald-50 text-emerald-800', DEPOSIT_PAID: 'bg-amber-50 text-amber-800', UNPAID: 'bg-red-50 text-red-800',
  DONE: 'bg-violet-50 text-violet-800', HANDED_OVER: 'bg-sky-50 text-sky-800', AWAITING_COLLECTION: 'bg-amber-50 text-amber-800',
}
const TAG_TONES = {
  'Colour': 'bg-pink-50 text-pink-800 border-pink-200', 'B&W': 'bg-zinc-100 text-zinc-800 border-zinc-300',
  'One side': 'bg-indigo-50 text-indigo-800 border-indigo-200', 'Two sides': 'bg-sky-50 text-sky-800 border-sky-200',
}

async function download(path, filename) {
  const { data } = await client.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

async function printReceipt(id) {
  const { data } = await client.get(`/api/v1/finance/receipts/${id}/thermal/`)
  const win = window.open('', '_blank', 'width=400,height=600')
  if (!win) return
  win.document.write(`<html><head><title>Receipt</title><style>body{font-family:'Courier New',monospace;font-size:12px;white-space:pre;margin:10px;}</style></head><body>${(data.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body></html>`)
  win.document.close(); win.focus(); win.print(); win.close()
}

function Fact({ label, value, sub }) {
  return (
    <div className="rounded-xl bg-[var(--bg)] px-3 py-2.5 min-w-0">
      <div className="text-[10.5px] font-extrabold tracking-wider text-[var(--text-3)]">{label}</div>
      <div className="text-[14px] font-bold mt-0.5 truncate">{value}</div>
      {sub && <div className="text-[12px] text-[var(--text-3)] truncate">{sub}</div>}
    </div>
  )
}

function Button({ icon, children, onClick, dark, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-bold disabled:opacity-50
                        ${dark ? 'bg-[var(--text)] text-white' : 'bg-white border border-black/15 hover:border-black/40'}`}>
      {icon && <Icon d={I[icon]} size={15} />}{children}
    </button>
  )
}

export default function JobFile({ jobId, onClose, onOpenChat }) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('order')
  const [note, setNote] = useState({ text: '', bad: false })
  const say = (text, bad = false) => setNote({ text, bad })

  const { data: file, isLoading, error } = useQuery({
    queryKey: ['job-file', jobId],
    queryFn: () => client.get(`/api/v1/jobs/${jobId}/file/`).then(r => r.data),
    enabled: !!jobId,
  })
  const { data: invData } = useQuery({
    queryKey: ['job-invoices', jobId],
    queryFn: () => getJobInvoices(jobId).then(r => r.data),
    enabled: !!jobId,
  })
  const invoices = Array.isArray(invData) ? invData : (invData?.results || [])
  const invoice = invoices[0] || null

  const fail = err => say(err?.response?.data?.detail || 'That did not work. Try again.', true)
  const sendReceipt = useMutation({
    mutationFn: id => client.post(`/api/v1/finance/receipts/${id}/send-whatsapp/`),
    onSuccess: r => { say(r.data?.detail || 'Receipt sent on WhatsApp.'); queryClient.invalidateQueries({ queryKey: ['job-file', jobId] }) },
    onError: fail,
  })
  const makeInvoice = useMutation({
    mutationFn: () => createInvoice({
      job_id: jobId, invoice_type: 'PROFORMA', delivery_channel: 'DOWNLOAD',
      bill_to_name: file?.owner?.name || '', bill_to_phone: file?.owner?.phone || '',
      bill_to_email: '', bill_to_company: '', bm_note: '',
    }),
    onSuccess: () => { say('Invoice generated.'); queryClient.invalidateQueries({ queryKey: ['job-invoices', jobId] }) },
    onError: fail,
  })
  const sendInv = useMutation({
    mutationFn: id => sendInvoice(id),
    onSuccess: r => { say(r?.data?.detail || 'Invoice sent.'); queryClient.invalidateQueries({ queryKey: ['job-invoices', jobId] }) },
    onError: fail,
  })
  const remind = useMutation({
    mutationFn: () => client.post(`/api/v1/jobs/${jobId}/remind/`),
    onSuccess: r => { say(r.data?.detail || 'Reminder sent.'); queryClient.invalidateQueries({ queryKey: ['job-file', jobId] }) },
    onError: fail,
  })

  if (!jobId) return null
  const latest = file?.payments?.[file.payments.length - 1]
  const f = file?.facts || {}
  const owner = file?.owner || {}
  const tabs = [['order', 'Order', file?.items?.filter(i => !i.is_addon).length ?? 0],
                ['money', 'Money', file?.payments?.length ?? 0],
                ['history', 'History', file?.history?.length ?? 0]]
  const promised = f.promised || f.deadline
  const onTime = promised && f.ready_at ? (new Date(f.ready_at) <= new Date(promised) ? 'on time' : 'late') : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <section aria-label="Job" onClick={e => e.stopPropagation()}
               className="w-full max-w-[760px] max-h-[94vh] bg-[var(--bg)] rounded-[22px] shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-[var(--panel)] px-5 py-4 border-b border-[var(--border)] flex gap-3 items-start">
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[13px] text-[var(--text-3)]">{file?.job_number || '…'}</div>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <h2 className="text-[21px] font-extrabold">{owner.name || (isLoading ? 'Loading…' : '')}</h2>
              {owner.from_chat && <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800"><Icon d={I.chat} size={12} width={2} />WhatsApp</span>}
              {file && <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800">{file.job_type}</span>}
            </div>
            {file && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {Object.values(file.states).filter(s => s.code).map(s => (
                  <span key={s.code} className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${STATE_TONE[s.code] || 'bg-zinc-100 text-zinc-700'}`}>{s.words}</span>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-xl border border-[var(--border)] grid place-items-center hover:bg-[var(--bg)]"><Icon d={I.x} size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3.5">
          {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">{error?.response?.data?.detail || 'This job could not be loaded.'}</div>}
          {file && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Fact label="OWNER" value={owner.name} sub={[owner.phone, owner.jobs_count > 1 ? `${owner.jobs_count} jobs with us` : 'first job with us'].filter(Boolean).join(' · ')} />
                <Fact label="RECORDED BY" value={f.recorded_by} sub={when(f.recorded_at)} />
                <Fact label="CAME IN BY" value={f.channel} />
                <Fact label="TOTAL" value={fmt(f.total)} />
                <Fact label="PAID" value={fmt(f.paid)} sub={parseFloat(f.balance) > 0 ? `${fmt(f.balance)} still owed` : [...new Set((file.payments || []).map(p => p.method_label))].join(' · ')} />
                <Fact label="PROMISED" value={promised ? when(promised) : '—'} sub={f.ready_at ? `ready ${when(f.ready_at)}${onTime ? `, ${onTime}` : ''}` : ''} />
              </div>

              <div role="tablist" aria-label="Job details" className="flex gap-1 bg-black/[0.06] p-1 rounded-xl">
                {tabs.map(([id, label, count]) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                          className={`flex-1 h-10 rounded-lg text-[13.5px] font-bold ${tab === id ? 'bg-white shadow-sm' : 'text-[var(--text-2)]'}`}>
                    {label} <span className="font-semibold opacity-60">· {count}</span>
                  </button>
                ))}
              </div>

              {tab === 'order' && (
                <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl px-4 py-1">
                  {file.items.map((it, i) => {
                    const detail = it.sum || (it.count && it.count !== '1' ? it.count : '')
                    return (
                      <div key={i} className={`flex gap-2.5 py-2.5 ${i ? 'border-t border-[var(--border)]' : ''} ${it.is_addon ? 'pl-8' : ''}`}>
                        {it.is_addon
                          ? <span className="w-5 text-center font-bold text-[var(--text-3)]">+</span>
                          : <span className="w-5 h-5 rounded-full bg-[var(--bg)] grid place-items-center text-[11px] font-extrabold shrink-0">{it.number}</span>}
                        <div className="flex-1 min-w-0">
                          <div className="text-[13.5px] font-bold">{it.name}</div>
                          {detail && <div className="text-[12.5px] text-[var(--text-2)] mt-0.5">{detail}</div>}
                          {it.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {it.tags.map(t => <span key={t} className={`inline-flex items-center h-5 px-1.5 rounded-md border text-[11px] font-bold ${TAG_TONES[t] || 'bg-zinc-50 text-zinc-700 border-zinc-200'}`}>{t}</span>)}
                            </div>
                          )}
                        </div>
                        <span className="font-mono text-[13px] font-bold whitespace-nowrap">GHS {it.amount}</span>
                      </div>
                    )
                  })}
                  {file.notes && <div className="border-t border-[var(--border)] py-2.5 text-[13px] text-amber-800">{file.notes}</div>}
                </div>
              )}

              {tab === 'money' && (
                <>
                  <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl px-4 py-1">
                    {file.payments.length === 0 && <p className="py-4 text-sm text-[var(--text-3)]">No payments yet.</p>}
                    {file.payments.map(p => (
                      <div key={p.id} className="flex gap-3 py-2.5 border-b border-[var(--border)] last:border-0 items-start">
                        <div className="flex-1 min-w-0">
                          <div className="text-[13.5px] font-bold">{p.label} · <span className="text-[var(--text-2)]">{p.method_label}</span></div>
                          <div className="text-[12px] text-[var(--text-3)]">
                            {when(p.at)}{p.reference ? ` · Ref ${p.reference}` : ''}{p.by ? ` · taken by ${p.by}` : ''} · {p.receipt_number}
                          </div>
                        </div>
                        <span className="font-mono text-[14px] font-bold">{fmt(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-4 space-y-2.5">
                      <div className="text-[14.5px] font-extrabold">Receipt{file.payments.length > 1 ? 's' : ''}</div>
                      <div className="text-[12.5px] text-[var(--text-3)]">{latest ? `Latest: ${latest.receipt_number}` : 'Issued when a payment is taken.'}</div>
                      {latest && (
                        <div className="flex gap-1.5 flex-wrap">
                          <Button icon="chat" dark disabled={sendReceipt.isPending} onClick={() => sendReceipt.mutate(latest.id)}>WhatsApp</Button>
                          <Button icon="download" onClick={() => download(`/api/v1/finance/receipts/${latest.id}/pdf/`, `${latest.receipt_number}.pdf`).catch(fail)}>PDF</Button>
                          <Button icon="printer" onClick={() => printReceipt(latest.id).catch(fail)}>Print</Button>
                        </div>
                      )}
                    </div>
                    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-4 space-y-2.5">
                      <div className="text-[14.5px] font-extrabold">Invoice</div>
                      <div className="text-[12.5px] text-[var(--text-3)]">
                        {invoice ? `${invoice.invoice_number || 'Invoice'}${invoice.status ? ` · ${invoice.status.toLowerCase()}` : ''}` : 'None yet. One click makes it from the job.'}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {invoice ? (
                          <>
                            <Button icon="chat" dark disabled={sendInv.isPending} onClick={() => sendInv.mutate(invoice.id)}>Send</Button>
                            <Button icon="download" onClick={() => download(getInvoicePdfUrl(invoice.id), `${invoice.invoice_number || 'invoice'}.pdf`).catch(fail)}>PDF</Button>
                          </>
                        ) : (
                          <Button icon="plus" dark disabled={makeInvoice.isPending} onClick={() => makeInvoice.mutate()}>Generate invoice</Button>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {tab === 'history' && (
                <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl px-4 py-2">
                  {file.history.map((h, i) => {
                    const newDay = i === 0 || day(h.at) !== day(file.history[i - 1].at)
                    return (
                      <div key={i}>
                        {newDay && <div className="text-[11px] font-extrabold tracking-wider text-[var(--text-3)] pt-2.5 pb-1">{new Date(h.at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</div>}
                        <div className="grid grid-cols-[28px_1fr_auto] gap-2.5 py-1.5 items-start">
                          <span className={`w-7 h-7 rounded-full grid place-items-center ${TONE[h.tone] || TONE.ink}`}><Icon d={I.check} size={13} width={2.25} /></span>
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-bold">{h.title}</div>
                            <div className="text-[12px] text-[var(--text-3)]">{[h.by && `by ${h.by}`, h.detail].filter(Boolean).join(' · ')}</div>
                          </div>
                          <span className="text-[12px] text-[var(--text-3)] whitespace-nowrap pt-0.5">{time(h.at)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-[var(--panel)] border-t border-[var(--border)] px-5 py-3 flex flex-wrap items-center gap-2">
          {onOpenChat && owner.conversation_id && <Button icon="chat" onClick={() => onOpenChat(owner.conversation_id)}>Open the chat</Button>}
          {file?.can_remind && <Button icon="bell" disabled={remind.isPending} onClick={() => remind.mutate()}>Remind the customer</Button>}
          {note.text && <span className={`text-[12.5px] font-semibold ${note.bad ? 'text-red-600' : 'text-emerald-700'}`}>{note.text}</span>}
        </div>
      </section>
    </div>
  )
}
