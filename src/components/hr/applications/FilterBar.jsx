// The List view's filter bar: search, vacancy, stage, and a Filter button for the
// less common filters. Everything applies instantly; the button opens the extras.

import { useEffect, useRef, useState } from 'react'

const RED = '#C8211B'

const icon = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  sliders: <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  check: <path d="m5 12 5 5 9-10" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
}
function Icon({ name, size = 18, color = 'currentColor', stroke = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      {icon[name]}
    </svg>
  )
}

// Close a popover on outside click or Esc
function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const key = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])
  return { open, setOpen, ref }
}

const FIELD = 'flex h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 transition-colors'

function Picker({ iconName, value, options, onChange, label }) {
  const { open, setOpen, ref } = usePopover()
  const current = options.find((o) => o.value === value) || options[0]
  return (
    <div ref={ref} className="relative min-w-0 lg:w-[230px]">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={label}
              className={FIELD + ' w-full text-left hover:border-[var(--border-dark)]'}
              style={open ? { borderColor: 'var(--border-dark)' } : undefined}>
        <Icon name={iconName} size={20} color="var(--text)" />
        <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--text)]">{current.label}</span>
        <Icon name="chevron" size={18} color="var(--text-2)" stroke={2.2} />
      </button>
      {open && (
        <ul role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-72 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1.5 shadow-xl shadow-black/10">
          {options.map((o) => {
            const on = o.value === value
            return (
              <li key={o.value}>
                <button type="button" role="option" aria-selected={on}
                        onClick={() => { onChange(o.value); setOpen(false) }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--bg)]"
                        style={on ? { background: '#FCEBEB', color: '#791F1F' } : { color: 'var(--text)' }}>
                  {o.dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.dot }} />}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  <span className="text-xs" style={{ color: on ? '#A32D2D' : 'var(--text-3)' }}>{o.count}</span>
                  {on && <Icon name="check" size={14} color={RED} stroke={2.5} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function MoreFilters({ extra, setExtra, activeCount }) {
  const { open, setOpen, ref } = usePopover()
  const toggle = (k, v) => setExtra((x) => ({ ...x, [k]: x[k] === v ? '' : v }))
  const chip = (on) => 'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ' +
    (on ? 'border-transparent text-white' : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-dark)]')
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              className="flex h-12 items-center gap-2.5 rounded-xl px-5 text-[15px] font-semibold text-white shadow-md transition-opacity hover:opacity-90"
              style={{ background: RED, boxShadow: '0 6px 16px -6px rgba(200,33,27,.55)' }}>
        <Icon name="sliders" size={20} color="#fff" />
        Filter
        {activeCount > 0 && <span className="rounded-full bg-white px-1.5 text-[11px] font-bold" style={{ color: RED }}>{activeCount}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-72 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-xl shadow-black/10">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">How they came in</p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {[['WEBSITE', 'Website'], ['RECOMMENDATION', 'Recommended'], ['APPOINTMENT', 'Appointed']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => toggle('track', v)} className={chip(extra.track === v)}
                      style={extra.track === v ? { background: RED } : undefined}>{l}</button>
            ))}
          </div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">Waiting</p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {[['3', 'Over 3 days'], ['7', 'Over a week']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => toggle('waited', v)} className={chip(extra.waited === v)}
                      style={extra.waited === v ? { background: RED } : undefined}>{l}</button>
            ))}
          </div>
          <label className="flex items-center gap-2.5 text-sm text-[var(--text)]">
            <input type="checkbox" checked={!!extra.priority} onChange={(e) => setExtra((x) => ({ ...x, priority: e.target.checked }))}
                   className="h-4 w-4" style={{ accentColor: RED }} />
            Priority only <span style={{ color: '#BA7517' }}>★</span>
          </label>
          {activeCount > 0 && (
            <button type="button" onClick={() => setExtra({ track: '', waited: '', priority: false })}
                    className="mt-4 text-xs font-semibold underline text-[var(--text-2)]">Clear these filters</button>
          )}
        </div>
      )}
    </div>
  )
}

export default function FilterBar({ search, setSearch, vacancy, setVacancy, vacancyOptions, stage, setStage, stageOptions, extra, setExtra, activeExtra }) {
  const inputRef = useRef(null)
  // "/" anywhere jumps to the search box
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3 shadow-lg shadow-black/[0.04] lg:flex-row lg:items-center">
      <label className={FIELD + ' min-w-0 flex-1 focus-within:border-[var(--border-dark)]'}>
        <Icon name="search" size={22} color={RED} stroke={2} />
        <input ref={inputRef} value={search} onChange={(e) => setSearch(e.target.value)}
               placeholder="Search by name, phone or email"
               className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none" />
        {search
          ? <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><Icon name="x" size={16} color="var(--text-3)" /></button>
          : <kbd className="hidden rounded border border-[var(--border)] px-1.5 text-[11px] text-[var(--text-3)] sm:inline">/</kbd>}
      </label>
      <div className="grid grid-cols-2 gap-3 lg:flex">
        <Picker iconName="briefcase" label="Vacancy" value={vacancy} onChange={setVacancy} options={vacancyOptions} />
        <Picker iconName="layers" label="Stage" value={stage} onChange={setStage} options={stageOptions} />
      </div>
      <MoreFilters extra={extra} setExtra={setExtra} activeCount={activeExtra} />
    </div>
  )
}
