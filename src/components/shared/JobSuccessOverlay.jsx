// src/components/shared/JobSuccessOverlay.jsx
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function JobSuccessOverlay({ jobNumber, message, onDone }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone?.(), 2400)
    return () => clearTimeout(timer)
  }, [onDone])

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      style={{ animation: 'sof__bg 0.2s ease both' }}>

      <style>{`
        @keyframes sof__bg   { from { opacity:0 } to { opacity:1 } }
        @keyframes sof__card { from { opacity:0; transform:scale(.88) } to { opacity:1; transform:scale(1) } }
        @keyframes sof__ring { to { stroke-dashoffset: 0 } }
        @keyframes sof__tick { to { stroke-dashoffset: 0 } }
        @keyframes sof__msg  { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes sof__num  { from { opacity:0 } to { opacity:1 } }
      `}</style>

      <div className="bg-white rounded-3xl px-10 py-10 flex flex-col items-center gap-4 shadow-2xl"
        style={{ animation: 'sof__card 0.3s cubic-bezier(.34,1.56,.64,1) both' }}>

        {/* Animated circle + checkmark */}
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none"
          xmlns="http://www.w3.org/2000/svg">
          {/* Background circle fill */}
          <circle cx="40" cy="40" r="38" fill="#f0fdf4" />
          {/* Animated ring */}
          <circle
            cx="40" cy="40" r="34"
            stroke="#16a34a"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="213.6"
            strokeDashoffset="213.6"
            style={{
              animation: 'sof__ring 0.55s cubic-bezier(.4,0,.2,1) 0.1s forwards',
              transformOrigin: '40px 40px',
              transform: 'rotate(-90deg)',
            }}
          />
          {/* Animated tick */}
          <polyline
            points="24,41 35,52 57,30"
            stroke="#16a34a"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray="46"
            strokeDashoffset="46"
            style={{ animation: 'sof__tick 0.35s ease 0.6s forwards' }}
          />
        </svg>

        {/* Message */}
        <div className="flex flex-col items-center gap-1"
          style={{ animation: 'sof__msg 0.3s ease 0.75s both' }}>
          <span className="text-base font-bold text-zinc-800 tracking-tight">
            {message || 'Job sent to cashier'}
          </span>
          {jobNumber && (
            <span className="font-mono text-xs font-semibold text-zinc-400"
              style={{ animation: 'sof__num 0.3s ease 0.9s both', opacity: 0 }}>
              {jobNumber}
            </span>
          )}
        </div>

      </div>
    </div>,
    document.body
  )
}