// src/components/cashier/SignOffSuccessOverlay.jsx
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Brief confirmation shown right after a successful EOD sign-off,
 * bridging the gap before the portal-lock overlay takes over.
 * Counts down from 10s, then calls onDone.
 */
export default function SignOffSuccessOverlay({ firstName, onDone }) {
  const [secondsLeft, setSecondsLeft] = useState(10)

  useEffect(() => {
    if (secondsLeft <= 0) {
      onDone?.()
      return
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft, onDone])

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center
      bg-[var(--bg)]/95 backdrop-blur-sm p-6 animate-fadeIn">
      <div className="max-w-sm text-center">
        <div className="text-5xl mb-4">✅</div>
        <div className="text-xl font-black text-[var(--text)] mb-2">
          Sign Off Successful{firstName ? `, ${firstName}` : ''}!
        </div>
        <div className="text-sm text-[var(--text-3)] leading-relaxed">
          Logging off in <span className="font-bold text-[var(--text)]">{secondsLeft}</span>…
        </div>
      </div>
    </div>,
    document.body,
  )
}