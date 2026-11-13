// src/components/attendant/AttendantTopbar.jsx
//
// The attendant's top bar (redesigned 13 Nov 2026), in the BM's form:
// identity and actions in the bar, nothing else.
//
//   left   menu toggle · Octos · Attendant / branch
//   right  sheet pill (status dot · sheet number · shift end) · bell · you
//
// The red line under the bar is the shift rail: it fills from the start of
// the shift to the sign-off deadline, with marks at the warning, the shift
// end and the deadline. Red through the day, amber once recording has
// closed, green once she has signed off. Times come from the server.

import OctosBrand from '../shared/OctosBrand'
import WindowControls from '../shared/WindowControls'
import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../../context/ThemeContext'
import NotificationBell from '../cashier/NotificationBell'

const BRAND_RED = '#E3000F'
const AMBER     = '#F59E0B'
const GREEN     = '#10B981'

const DONE_PHASES = new Set(['SIGNED_OFF', 'DAY_CLOSED', 'ENDED'])

function clock(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' })
}

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function dotFor(phase) {
  if (phase === 'OPEN') return 'bg-emerald-500 animate-pulse'
  if (phase === 'CLOSING_SOON' || phase === 'SIGN_OFF_OPEN') return 'bg-amber-400'
  if (phase === 'FINAL_CALL' || phase === 'OVERDUE') return 'bg-red-500 animate-pulse'
  return 'bg-zinc-400'
}

function ShiftRail({ status }) {
  const now = useNow()
  if (!status?.shift_start || !status?.deadline) return null

  const start    = new Date(status.shift_start).getTime()
  const deadline = new Date(status.deadline).getTime()
  const span     = Math.max(deadline - start, 1)
  const at       = (iso) => Math.min(100, Math.max(0, ((new Date(iso).getTime() - start) / span) * 100))

  const finished = DONE_PHASES.has(status.phase)
  const fill     = finished ? 100 : Math.min(100, Math.max(0, ((now - start) / span) * 100))
  const color    = status.phase === 'SIGNED_OFF' ? GREEN
                 : finished ? '#71717a'
                 : now >= new Date(status.shift_end).getTime() ? AMBER
                 : BRAND_RED

  return (
    <div className="absolute left-0 right-0 bottom-0 h-[5px] bg-[#4a0a0f] pointer-events-none"
      role="progressbar" aria-label="Shift progress" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(fill)}>
      <div className="h-full transition-[width] duration-700" style={{ width: `${fill}%`, background: color }} />
      {[status.warning_at, status.shift_end].map(iso => (
        <span key={iso} className="absolute top-[-3px] w-px h-[11px] bg-white/50"
          style={{ left: `${at(iso)}%` }} />
      ))}
    </div>
  )
}

export default function AttendantTopbar({ user, onLogout, onMenuToggle, showMenu, signOff }) {
  const { theme, toggle } = useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : '??'

  const sheetNumber = signOff?.sheet_number

  return (
    <header className="octos-topbar relative bg-[var(--panel)] border-b border-[var(--border)] shrink-0" data-tauri-drag-region>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between" data-tauri-drag-region>

        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            aria-label={showMenu ? 'Close menu' : 'Open menu'}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg
              hover:bg-[var(--bg)] text-[var(--text-2)] transition-colors"
          >
            {showMenu ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>

          <OctosBrand />
          <span className="hidden sm:block w-px h-4 bg-[var(--border)]" />
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
              Attendant
            </span>
            <span className="text-xs font-medium text-[var(--text-2)] mt-0.5">
              {user?.branch_detail?.name || user?.branch_name || '—'}
            </span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">

          {/* Sheet pill: the sheet, then when the shift ends. The dot carries the phase. */}
          {sheetNumber && (
            <div className="flex items-center gap-1.5 px-2.5 py-1
              bg-[var(--panel)] border border-[var(--border)] rounded-full text-xs font-semibold
              text-[var(--text-2)] whitespace-nowrap">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotFor(signOff?.phase)}`} />
              <span className="font-mono font-bold text-[var(--text)] hidden sm:inline">{sheetNumber}</span>
              <span className="font-mono font-bold text-[var(--text)] sm:hidden text-[10px]">
                {sheetNumber.split('-').pop()}
              </span>
              <span className="w-px h-3 bg-[var(--border)] hidden sm:block" />
              <span className="hidden sm:inline text-[var(--text-3)]">Shift ends</span>
              <span className="hidden sm:inline text-[var(--text)]">{clock(signOff?.shift_end)}</span>
            </div>
          )}

          {/* Notification bell */}
          <NotificationBell />

          {/* Profile dropdown */}
          <div className="relative pl-3 border-l border-[var(--border)]" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="relative w-7 h-7 rounded-full bg-[var(--text)] text-[var(--panel)]
                flex items-center justify-center text-[10px] font-bold shrink-0">
                {initials}
                {/* On shift: replaces the separate "Active" label */}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500
                  border-2 border-[var(--panel)]" aria-label="On shift" />
              </div>
              <span className="hidden md:inline text-sm font-semibold text-[var(--text)]">
                {user?.full_name || '—'}
              </span>
              <svg className="hidden sm:block w-3 h-3 text-[var(--text-3)]" fill="none"
                stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-10 w-56 bg-[var(--panel)]
                border border-[var(--border)] rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <div className="text-sm font-bold text-[var(--text)]">{user?.full_name}</div>
                  <div className="text-xs text-[var(--text-3)] mt-0.5">{user?.email}</div>
                  <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mt-1">
                    {user?.branch_detail?.name || user?.branch_name} · Attendant
                  </div>
                </div>
                <div className="py-1">
                  <button
                    onClick={toggle}
                    className="w-full flex items-center justify-between px-4 py-2.5
                      text-sm text-[var(--text-2)] hover:bg-[var(--bg)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {theme === 'light' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="5"/>
                          <line x1="12" y1="1" x2="12" y2="3"/>
                          <line x1="12" y1="21" x2="12" y2="23"/>
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                          <line x1="1" y1="12" x2="3" y2="12"/>
                          <line x1="21" y1="12" x2="23" y2="12"/>
                        </svg>
                      )}
                      <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
                    </div>
                    <div className={`w-8 h-4 rounded-full transition-colors relative
                      ${theme === 'dark' ? 'bg-[var(--text)]' : 'bg-[var(--border-dark)]'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white
                        transition-transform
                        ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </button>
                  <div className="h-px bg-[var(--border)] mx-4 my-1" />
                  <button
                    onClick={() => { setDropdownOpen(false); onLogout() }}
                    className="w-full flex items-center gap-3 px-4 py-2.5
                      text-sm text-[var(--red-text)] hover:bg-[var(--red-bg)] transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ShiftRail status={signOff} />
      <WindowControls />
    </header>
  )
}
