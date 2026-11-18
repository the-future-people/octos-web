// src/components/bm/ReportsPhoneUI.jsx
//
// The pieces Reports & Filing on a phone is built from (18 Nov 2026), in the
// Overview's look: a sheet from the bottom, a page pushed from the right, a
// month or year stepper, a row of figures, and a small bar chart.
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { RED, RED_FILL } from './reportsKit'

export const Svg = ({ d, size = 18, width = 2, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{d}</svg>
)
export const Chevron = () => <span className="text-[#C4C4C7] shrink-0"><Svg d={<path d="M9 18l6-6-6-6" />} size={17} width={2.4} /></span>

export function Title({ children, extra }) {
  return (
    <div className="px-5 pt-6 pb-2 flex items-end justify-between gap-3">
      <h2 className="m-0 text-[20px] leading-[25px] font-bold text-[#111]">{children}</h2>{extra}
    </div>
  )
}

export const Empty = ({ children }) => <p className="m-0 px-4 py-7 text-center text-[14.5px] text-[#8A8A8E]">{children}</p>

export const Skeleton = ({ rows = [140, 220] }) => (
  <div className="px-4 pt-4 space-y-3 animate-pulse" aria-hidden="true">
    {rows.map((h, i) => <div key={i} className="rounded-[16px] bg-black/[0.05]" style={{ height: h }} />)}
  </div>
)

// A small square of colour behind an icon: the only colour on a row.
export const Tile = ({ bg = '#EEF0F4', ink = '#3A3A3C', children, size = 36 }) => (
  <span className="rounded-[10px] grid place-items-center shrink-0" style={{ width: size, height: size, background: bg, color: ink }}>{children}</span>
)

// Figures side by side under a card's headline.
export function Figures({ items }) {
  return (
    <div className="grid border-t border-black/[0.06]" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
      {items.map(([label, value, tone], i) => (
        <div key={label} className={`px-3 py-2.5 min-w-0 ${i ? 'border-l border-black/[0.06]' : ''}`}>
          <div className="text-[12px] text-[#6E6E73] truncate">{label}</div>
          <div className="text-[17px] font-bold tabular-nums truncate" style={{ color: tone || '#111' }}>{value}</div>
        </div>
      ))}
    </div>
  )
}

// ‹ November 2026 ›
export function Stepper({ label, onPrev, onNext, canNext }) {
  return (
    <div className="mx-4 mt-3 h-[46px] rounded-[14px] bg-white border border-black/[0.04] flex items-center justify-between px-1">
      <button type="button" onClick={onPrev} aria-label="Earlier" className="w-11 h-11 grid place-items-center" style={{ color: RED }}>
        <Svg d={<path d="M15 18l-6-6 6-6" />} size={22} width={2.4} />
      </button>
      <span className="text-[16.5px] font-semibold text-[#111]">{label}</span>
      <button type="button" onClick={onNext} disabled={!canNext} aria-label="Later" className="w-11 h-11 grid place-items-center disabled:opacity-25" style={{ color: RED }}>
        <Svg d={<path d="M9 18l6-6-6-6" />} size={22} width={2.4} />
      </button>
    </div>
  )
}

// Bars for a run of values, the highlighted one red and the rest a quiet blue.
export function Bars({ values, labels, mark = -1, height = 96, show }) {
  const top = Math.max(...values, 1)
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {values.map((v, i) => (
          <div key={i} className="flex-1 h-full flex items-end" title={show ? show(v, i) : String(v)}>
            <span className="block w-full rounded-t-[4px]" style={{ height: v > 0 ? `${Math.max((v / top) * 100, 3)}%` : 2, background: v <= 0 ? '#EDEDF0' : i === mark ? RED : '#9DBDF7' }} />
          </div>
        ))}
      </div>
      {labels && (
        <div className="flex gap-[3px] mt-1.5">
          {labels.map((l, i) => <span key={i} className={`flex-1 text-center text-[10.5px] tabular-nums ${i === mark ? 'font-bold text-[#111]' : 'text-[#8A8A8E]'}`}>{l}</span>)}
        </div>
      )}
    </div>
  )
}

// A sheet from the bottom, with a title and a red button at its foot.
export function Sheet({ title, sub, onClose, children, action, busy, error }) {
  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-label={title}>
      <div className="absolute inset-0 bg-black/30 animate-fadeIn" onClick={onClose} />
      <div className="ios absolute inset-x-0 bottom-0 rounded-t-[24px] animate-slideUp px-4 max-h-[90dvh] overflow-y-auto"
        style={{ background: '#F6F6F8', paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}>
        <div className="flex justify-center pt-2"><span className="w-9 h-[5px] rounded-full bg-black/15" aria-hidden="true" /></div>
        <div className="flex items-center justify-between pt-2.5">
          <button type="button" onClick={onClose} className="text-[16px] w-16 text-left" style={{ color: RED }}>Cancel</button>
          <span className="text-center min-w-0"><span className="block text-[17px] font-bold">{title}</span>{sub && <span className="block text-[13px] text-[#8A8A8E] truncate">{sub}</span>}</span>
          <span className="w-16" />
        </div>
        <div className="mt-4 space-y-3">{children}</div>
        {error && <p className="m-0 mt-3 text-[14px] text-[#B91C1C]">{error}</p>}
        <button type="button" onClick={action.onClick} disabled={busy || action.disabled}
          className="mt-5 w-full h-[50px] rounded-[16px] text-white text-[16.5px] font-semibold disabled:opacity-50" style={RED_FILL}>
          {busy ? action.busy || 'Saving…' : action.label}
        </button>
      </div>
    </div>,
    document.body,
  )
}

// Pages can stack (a year, then its months), so the tab bar stays hidden
// until the last one closes: a count rather than a flag.
function useFullscreen() {
  useEffect(() => {
    const b = document.body.dataset
    b.fullscreen = String((parseInt(b.fullscreen, 10) || 0) + 1)
    return () => {
      const n = (parseInt(b.fullscreen, 10) || 1) - 1
      if (n > 0) b.fullscreen = String(n)
      else delete b.fullscreen
    }
  }, [])
}

// A page pushed in from the right, with "‹ Back" in red.
export function Pushed({ back, title, onBack, right, footer, children, label }) {
  useFullscreen()
  return createPortal(
    <section aria-label={label || title || back} className="ios ios-push fixed inset-0 z-[65] flex flex-col" style={{ background: '#F6F6F8' }}>
      <div className="ios-bar shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-[50px] px-2 grid grid-cols-[1fr_auto_1fr] items-center">
          <button type="button" onClick={onBack} className="justify-self-start flex items-center text-[17px] pr-2" style={{ color: RED }}>
            <Svg d={<path d="M15 18l-6-6 6-6" />} size={26} width={2.4} />{back}
          </button>
          <span className="text-[16px] font-semibold text-[#111] truncate max-w-[180px]">{title}</span>
          <span className="justify-self-end">{right}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-8">{children}</div>
      {footer && (
        <div className="shrink-0 px-4 pt-2.5 bg-white/95 border-t border-black/[0.06]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>{footer}</div>
      )}
    </section>,
    document.body,
  )
}

export const RedButton = ({ children, onClick, disabled, busy }) => (
  <button type="button" onClick={onClick} disabled={disabled || busy}
    className="w-full h-[50px] rounded-[16px] text-white text-[16.5px] font-semibold disabled:opacity-45" style={RED_FILL}>
    {busy || children}
  </button>
)

export const Field = ({ label, children }) => (
  <label className="block rounded-[16px] bg-white px-4 py-3">
    <span className="block text-[13px] text-[#6E6E73]">{label}</span>
    {children}
  </label>
)
