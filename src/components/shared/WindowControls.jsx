// src/components/shared/WindowControls.jsx
//
// Minimise, maximise and close, drawn in the top bar of the Octos desktop app,
// whose own Windows title bar is switched off (8 Nov 2026). Nothing at all in
// a browser.
const appWindow = () => window.__TAURI__?.window?.getCurrentWindow?.()

const Btn = ({ label, onClick, danger, children }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label}
    className={`w-[46px] h-full grid place-items-center text-white/80 transition-colors
      ${danger ? 'hover:bg-[#c42b1c] hover:text-white' : 'hover:bg-white/10 hover:text-white'}`}>
    {children}
  </button>
)

export default function WindowControls() {
  if (typeof window === 'undefined' || !window.__TAURI__) return null
  return (
    <div className="flex self-stretch shrink-0">
      <Btn label="Minimise" onClick={() => appWindow()?.minimize()}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M0 5h10" stroke="currentColor" /></svg>
      </Btn>
      <Btn label="Maximise or restore" onClick={() => appWindow()?.toggleMaximize()}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><rect x=".5" y=".5" width="9" height="9" stroke="currentColor" /></svg>
      </Btn>
      <Btn label="Close" danger onClick={() => appWindow()?.close()}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M0 0l10 10M10 0 0 10" stroke="currentColor" /></svg>
      </Btn>
    </div>
  )
}
