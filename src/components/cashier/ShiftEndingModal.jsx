// src/components/cashier/ShiftEndingModal.jsx
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function ShiftEndingModal({ shiftEnd, minutesRemaining, onDismiss }) {
  const [countdown, setCountdown] = useState(15)

  useEffect(() => {
    if (countdown <= 0) { onDismiss(); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, onDismiss])

  const fmtTime = (t) => {
    if (!t) return '—'
    if (typeof t === 'string') return t
    // time object {hour, minute, second}
    const h = String(t.hour ?? 0).padStart(2, '0')
    const m = String(t.minute ?? 0).padStart(2, '0')
    const suffix = (t.hour ?? 0) >= 12 ? 'pm' : 'am'
    const h12 = (t.hour ?? 0) % 12 || 12
    return `${h12}:${m} ${suffix}`
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 animate-fadeIn"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm text-center p-8 animate-slideUp">

        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>

        <h2 className="text-2xl font-black text-zinc-900 mb-2">Shift Ending Soon</h2>
        <p className="text-sm text-zinc-500 mb-1">
          Your shift ends at <strong className="text-zinc-800">{fmtTime(shiftEnd)}</strong>.
        </p>
        <p className="text-sm text-zinc-500 mb-6">
          Please complete any active payments and prepare for sign-off.
        </p>

        {minutesRemaining <= 5 && (
          <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs font-bold text-red-600">
              ⚠ {minutesRemaining} minute{minutesRemaining !== 1 ? 's' : ''} remaining
            </p>
          </div>
        )}

        <p className="text-xs text-zinc-400 mb-4">Auto-dismissing in {countdown}s</p>

        <button onClick={onDismiss}
          className="px-6 py-2.5 border border-zinc-200 rounded-xl text-sm font-semibold
            text-zinc-600 hover:bg-zinc-50 transition-colors">
          Dismiss
        </button>

      </div>
    </div>
  )

  return createPortal(modal, document.body)
}