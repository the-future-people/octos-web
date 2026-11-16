// src/components/attendant/TodayCard.jsx
//
// The look shared by the cards on the attendant's Today screen (16 Nov 2026):
// a white card with a firm edge on a greyer page, opened by a small coloured
// icon tile, so each card is found by its colour at a glance.
//   My day red · Needs you now amber · My jobs green · Price check blue · Team purple
// Tints are translucent, so they read in dark mode too.

export const todayCard =
  'rounded-2xl border border-[var(--today-line)] bg-[var(--panel)] shadow-[0_1px_2px_rgba(0,0,0,0.05)]'

const TONES = {
  red:    { background: 'rgba(226, 75, 74, 0.14)',  color: '#C42B2B' },
  amber:  { background: 'rgba(239, 159, 39, 0.18)', color: '#9A5B0B' },
  green:  { background: 'rgba(29, 158, 117, 0.16)', color: '#0F7A5C' },
  blue:   { background: 'rgba(55, 138, 221, 0.16)', color: '#1F6BB8' },
  purple: { background: 'rgba(127, 119, 221, 0.18)', color: '#5148B8' },
}

const ICONS = {
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  bolt:   <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  list:   <><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" /></>,
  tag:    <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
  team:   <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
}

export function CardHead({ tone, icon, title, children }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="w-7 h-7 rounded-lg grid place-items-center shrink-0" style={TONES[tone]}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[icon]}</svg>
      </span>
      <h3 className="text-[13.5px] font-bold text-[var(--text)]">{title}</h3>
      {children && <div className="ml-auto flex items-center">{children}</div>}
    </div>
  )
}
