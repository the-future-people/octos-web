// src/components/cashier/ReceiptModal.jsx
// Shown after a successful payment confirmation.
import { useState } from 'react'
import client from '../../api/client'

function fmt(amount) {
  return `GHS ${parseFloat(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

const METHOD_LABELS = {
  CASH : 'Cash',
  MOMO : 'MoMo',
  POS  : 'Card (POS)',
  SPLIT: 'Split',
}

// "3:40 pm today", "10:00 am tomorrow", "Friday 2:00 pm".
function readyLabel(iso) {
  const at = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const time = at.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (at.toDateString() === today.toDateString()) return `${time} today`
  if (at.toDateString() === tomorrow.toDateString()) return `${time} tomorrow`
  return `${at.toLocaleDateString('en-GB', { weekday: 'long' })} ${time}`
}

export default function ReceiptModal({ result, onClose, waStatus = null }) {
  // WhatsApp receipt (12 Nov 2026): the endpoint existed, the button waited.
  const [wa, setWa] = useState({ state: 'idle', note: '' })   // idle | sending | sent | failed
  const sendWhatsApp = async receiptId => {
    if (!receiptId || wa.state === 'sending') return
    setWa({ state: 'sending', note: '' })
    try {
      const { data } = await client.post(`/api/v1/finance/receipts/${receiptId}/send-whatsapp/`)
      setWa({ state: 'sent', note: data?.detail || 'Sent on WhatsApp.' })
    } catch (err) {
      // The server says why (no number, the 24-hour window closed...).
      setWa({ state: 'failed', note: err?.response?.data?.detail || 'Could not send. Try again.' })
    }
  }

  // Sent from the payment modal on confirm, when the cashier asked for it:
  // that result shows until this screen's own button is used.
  const shown = wa.state === 'idle' && waStatus ? waStatus : wa

  const handlePrint = async (receiptId) => {
    if (!receiptId) return
    try {
      // Through the portal's own connection: the live server, signed in.
      // The old address was this computer's (localhost), so printing
      // only ever worked on the machine the code was written on.
      const { data } = await client.get(`/api/v1/finance/receipts/${receiptId}/thermal/`)
      const text = data.text || ''
      const win  = window.open('', '_blank', 'width=400,height=600')
      win.document.write(`<html><head><title>Receipt</title>
        <style>body{font-family:'Courier New',monospace;font-size:12px;white-space:pre;margin:10px;}</style>
        </head><body>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body></html>`)
      win.document.close()
      win.focus()
      win.print()
      win.close()
    } catch (err) {
      console.error('Print failed:', err)
    }
  }

  if (!result) return null

  const showCash = result.payment_method === 'CASH' && result.cash_tendered

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

        {/* Success banner */}
        <div className="bg-[var(--text)] px-6 py-5 text-center">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="text-white font-bold text-base">Payment Confirmed</div>
          <div className="text-white/60 text-xs font-mono mt-1">{result.job_number}</div>
        </div>

        {/* Details */}
        <div className="px-6 py-4 space-y-3">
          <Row label="Amount Paid"     value={fmt(result.amount_paid)} bold />
          <Row label={result.ready_at ? 'Balance on Collection' : 'Balance Due'} value={fmt(result.balance_due)} />
          <Row label="Payment Method"  value={METHOD_LABELS[result.payment_method] || result.payment_method} />
          {showCash && (
            <>
              <Row label="Cash Tendered" value={fmt(result.cash_tendered)} />
              <Row label="Change Given"  value={fmt(result.change_given)} />
            </>
          )}
          <div className="border-t border-[var(--border)] pt-3">
            <Row label="Receipt No." value={result.receipt_number} mono />
          </div>

          {/* Floor work: when it will be ready, and where to follow it. */}
          {result.ready_at && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Ready about</div>
              <div className="text-base font-black text-blue-900">{readyLabel(result.ready_at)}</div>
              {result.track_url && (
                <div className="mt-1.5 text-xs text-blue-900/80">
                  Follow it: <span className="font-mono font-semibold break-all">{result.track_url}</span>
                </div>
              )}
              <div className="mt-1 text-[11px] text-blue-900/70">
                The customer has been sent this, with their collection PIN to follow when it’s ready.
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handlePrint(result.receipt_id)}
              className="py-2.5 bg-[var(--bg)] text-[var(--text-2)] text-sm font-semibold
                rounded-xl border border-[var(--border)] hover:border-[var(--border-dark)]
                transition-colors flex items-center justify-center gap-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print
            </button>
            <button
              type="button"
              onClick={() => sendWhatsApp(result.receipt_id)}
              disabled={shown.state === 'sending' || shown.state === 'sent'}
              className={`py-2.5 text-sm font-semibold rounded-xl border flex items-center justify-center gap-2 transition-colors
                ${shown.state === 'sent' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-dark)]'}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
              </svg>
              {shown.state === 'sending' ? 'Sending…' : shown.state === 'sent' ? 'Sent' : shown.state === 'failed' ? 'Try WhatsApp again' : 'WhatsApp'}
            </button>
          </div>
          {shown.note && (
            <p className={`text-xs text-center ${shown.state === 'failed' ? 'text-red-600' : 'text-emerald-700'}`}>{shown.note}</p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-[var(--text-3)] text-sm
              hover:text-[var(--text)] transition-colors">
            {shown.state === 'sent' ? 'Done' : 'Skip for now'}
          </button>
        </div>

      </div>
    </div>
  )
}

function Row({ label, value, bold, mono }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">
        {label}
      </span>
      <span className={`text-sm ${bold ? 'font-bold text-[var(--text)]' : 'text-[var(--text-2)]'}
        ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  )
}
