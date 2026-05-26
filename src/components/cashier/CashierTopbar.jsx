// src/components/cashier/CashierTopbar.jsx
import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../../context/ThemeContext'

export default function CashierTopbar({ user, onLogout, onMenuToggle, showMenu }) {
  const { theme, toggle } = useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : '??'

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="bg-[var(--panel)] border-b border-[var(--border)] shrink-0">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* Left — hamburger (mobile) + brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg
              hover:bg-[var(--bg)] text-[var(--text-2)] transition-colors"
          >
            {showMenu ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>

          <span className="font-display font-black text-xl text-[var(--text)] tracking-tight">
            Octos
          </span>
          <span className="hidden sm:block w-px h-4 bg-[var(--border)]" />
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
              Cashier
            </span>
            <span className="text-xs font-medium text-[var(--text-2)] mt-0.5">
              {user?.branch_detail?.name || '—'}
            </span>
          </div>
        </div>

        {/* Right — live + profile dropdown */}
        <div className="flex items-center gap-3">

          {/* Live indicator */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--green-text)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--green-text)] animate-pulse" />
            <span className="hidden sm:inline">Live</span>
          </div>

          {/* Profile button + dropdown */}
          <div className="relative pl-3 border-l border-[var(--border)]" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-7 h-7 rounded-full bg-[var(--text)] text-[var(--panel)]
                flex items-center justify-center text-[10px] font-bold shrink-0">
                {initials}
              </div>
              <span className="hidden md:inline text-sm font-semibold text-[var(--text)]">
                {user?.full_name || '—'}
              </span>
              <svg className="hidden sm:block w-3 h-3 text-[var(--text-3)]" fill="none"
                stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div className="absolute right-0 top-10 w-56 bg-[var(--panel)]
                border border-[var(--border)] rounded-xl shadow-lg z-50 overflow-hidden">

                {/* User info */}
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <div className="text-sm font-bold text-[var(--text)]">
                    {user?.full_name || '—'}
                  </div>
                  <div className="text-xs text-[var(--text-3)] mt-0.5">
                    {user?.email || '—'}
                  </div>
                  <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
                    tracking-wider mt-1">
                    {user?.branch_detail?.name || '—'} · Cashier
                  </div>
                </div>

                {/* Actions */}
                <div className="py-1">

                  {/* Theme toggle */}
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
                          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                      )}
                      <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
                    </div>
                    {/* Toggle pill */}
                    <div className={`w-8 h-4 rounded-full transition-colors relative
                      ${theme === 'dark' ? 'bg-[var(--text)]' : 'bg-[var(--border-dark)]'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white
                        transition-transform
                        ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0.5'}`}
                      />
                    </div>
                  </button>

                  <div className="h-px bg-[var(--border)] mx-4 my-1" />

                  {/* Sign out */}
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
    </header>
  )
}