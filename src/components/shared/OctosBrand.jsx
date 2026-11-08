// src/components/shared/OctosBrand.jsx
//
// The Octos lock-up: the octopus and OCTOS in the logo's type (brand, 8 Nov
// 2026). Every portal's top bar uses it. Inside the desktop app the bar is
// Octos Black, so the octopus sits on its light tile there; black arms would
// vanish on black.
const desktop = typeof window !== 'undefined' && !!window.__TAURI__

export default function OctosBrand({ size = 32 }) {
  return (
    <span className="inline-flex items-center gap-2 select-none shrink-0" aria-label="Octos">
      <img src={desktop ? '/octos-tile.svg' : '/octos-mark.svg'} alt="" width={size} height={size}
        draggable="false" className="shrink-0" />
      <span className="octos-wordmark text-[17px] text-[var(--text)]">OCTOS</span>
    </span>
  )
}
