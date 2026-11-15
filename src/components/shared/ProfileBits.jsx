// src/components/shared/ProfileBits.jsx
// Small pieces shared by My profile and the Staff page (15 Nov 2026).
import { useRef } from 'react'
import { shrinkPhoto } from '../../api/profile'

export const PERIODS = [['today', 'Today'], ['week', 'Week'], ['month', 'Month']]

// Today / Week / Month.
export function PeriodSwitch({ value, onChange }) {
  return (
    <div className="inline-flex bg-[var(--bg)] border border-[var(--border)] rounded-full p-0.5" role="tablist">
      {PERIODS.map(([key, label]) => (
        <button key={key} type="button" role="tab" aria-selected={value === key} onClick={() => onChange(key)}
          className={`px-3 h-7 rounded-full text-xs font-semibold transition-colors
            ${value === key ? 'bg-[var(--panel)] text-[var(--text)] shadow-sm' : 'text-[var(--text-3)] hover:text-[var(--text)]'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

// "Take a photo" opens the camera on a phone (a file picker on a computer);
// "Upload one" always picks a file. Either hands back a shrunk JPEG.
export function PhotoButtons({ onPhoto, onRemove, hasPhoto, busy }) {
  const camera = useRef(null)
  const picker = useRef(null)
  const picked = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onPhoto(await shrinkPhoto(file))
  }
  const btn = 'h-8 px-3 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--bg)] disabled:opacity-50'
  return (
    <div className="flex flex-wrap gap-1.5">
      <input ref={camera} type="file" accept="image/*" capture="user" hidden onChange={picked} />
      <input ref={picker} type="file" accept="image/*" hidden onChange={picked} />
      <button type="button" className={btn} disabled={busy} onClick={() => camera.current?.click()}>Take a photo</button>
      <button type="button" className={btn} disabled={busy} onClick={() => picker.current?.click()}>Upload one</button>
      {hasPhoto && onRemove && (
        <button type="button" className={`${btn} text-[var(--red-text)]`} disabled={busy} onClick={onRemove}>Remove</button>
      )}
    </div>
  )
}

// Three numbers in tiles.
export function NumberTiles({ numbers = [], compact = false }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {numbers.map(n => (
        <div key={n.label} className={compact ? 'text-center' : 'rounded-lg bg-[var(--bg)] px-3 py-2.5'}>
          {compact ? (
            <>
              <div className="text-base font-bold text-[var(--text)] leading-tight">{n.value}</div>
              <div className="text-[10.5px] text-[var(--text-3)] leading-tight mt-0.5">{n.label}</div>
            </>
          ) : (
            <>
              <div className="text-[11.5px] text-[var(--text-3)]">{n.label}</div>
              <div className="text-xl font-bold text-[var(--text)] mt-0.5">{n.value}</div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

export function fmtJoined(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}
