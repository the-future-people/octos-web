// src/components/eye/ui.jsx
// Small building blocks shared by every lens.
import { C, TONE, DISPLAY } from './theme'

export function Pane({ title, tone, children, className = '' }) {
  const t = tone ? TONE[tone] : null
  return (
    <div className={`rounded-xl p-3 ${className}`}
         style={{ background: C.panel, border: `1px solid ${t ? t.border + '66' : C.border}` }}>
      {title && <div className="text-[9.5px] font-bold tracking-[.6px] mb-1"
                     style={{ color: t ? t.text : C.muted }}>{title}</div>}
      {children}
    </div>
  )
}

export function Row({ label, value, tone, onClick }) {
  return (
    <div onClick={onClick}
         className={`flex justify-between gap-2 py-1 text-[11.5px] ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
         style={{ borderTop: `1px solid ${C.line}`, color: C.text2 }}>
      <span>{label}</span>
      <b style={{ color: tone ? TONE[tone].text : C.text }}>{value}</b>
    </div>
  )
}

export function Tile({ label, value, sub, subTone }) {
  return (
    <Pane title={label}>
      <div className="font-bold text-[17px]" style={{ color: C.text, fontFamily: DISPLAY }}>{value}</div>
      {sub && <div className="text-[10.5px]" style={{ color: subTone ? TONE[subTone].text : C.muted }}>{sub}</div>}
    </Pane>
  )
}

export function Chip({ tone = 'grey', children }) {
  const t = TONE[tone]
  return <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
               style={{ background: t.bg, color: t.text }}>{children}</span>
}

export function Change({ value, invert }) {
  if (value === null || value === undefined) return null
  const good = invert ? value <= 0 : value >= 0
  return <span className="text-[11px] font-bold" style={{ color: good ? C.green : C.red }}>
    {value >= 0 ? '▲' : '▼'} {Math.abs(value)}%</span>
}

export function NotYet({ title, children }) {
  return (
    <div className="rounded-xl p-3 text-[11.5px]"
         style={{ background: '#1a1917', border: `1px dashed ${C.faint}`, color: C.text2 }}>
      <b style={{ color: C.text }}>{title}</b> {children}
    </div>
  )
}

export function Alerts({ alerts, onOpen, title = 'ALERTS' }) {
  return (
    <Pane title={title} tone={alerts?.length ? 'red' : undefined}>
      {alerts?.length ? alerts.map((a, i) => {
        const t = TONE[a.level === 'red' ? 'red' : 'amber']
        return (
          <div key={i} onClick={() => onOpen?.(a)}
               className={`text-[11px] py-1.5 ${a.lens ? 'cursor-pointer hover:opacity-80' : ''}`}
               style={{ borderTop: `1px solid ${C.line}`, color: t.text }}>
            <b>{a.title}</b>{a.where ? <><br /><span style={{ opacity: .8 }}>{a.where}</span></> : null}
          </div>
        )
      }) : <div className="text-[11px] mt-1" style={{ color: TONE.green.text }}>Nothing open</div>}
    </Pane>
  )
}

export function Loading() {
  return <div className="py-24 text-center text-[12px]" style={{ color: C.muted }}>Opening the Eye…</div>
}

export function Failed({ error }) {
  return <div className="py-24 text-center text-[12px]" style={{ color: TONE.red.text }}>
    {error?.response?.data?.detail || 'The Eye could not load this. Try again in a moment.'}</div>
}

export function BackLink({ label, onClick }) {
  return <button onClick={onClick} className="text-[11px] underline" style={{ color: C.muted }}>← {label}</button>
}

export function Bar({ parts }) {
  const total = parts.reduce((s, p) => s + Number(p.value || 0), 0) || 1
  return (
    <div className="flex h-2 rounded overflow-hidden my-1.5">
      {parts.map((p, i) => <div key={i} style={{ width: `${Number(p.value || 0) / total * 100}%`, background: p.colour }} />)}
    </div>
  )
}
