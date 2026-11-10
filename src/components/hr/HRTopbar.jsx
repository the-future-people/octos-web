// src/components/hr/HRTopbar.jsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTheme } from '../../context/ThemeContext'

/**
 * Follows OperatorTopbar and CoordinatorTopbar: same dropdown, same theme
 * toggle, same keyboard and outside-click handling. The role reads HR and
 * the second line names the scope (a branch, or National for HQ).
 */
const ROLE_LABEL = {
  HQ_HR_MANAGER: 'HR Manager',
  REGIONAL_HR_COORDINATOR: 'HR Coordinator',
}

export default function HRTopbar({ user, onLogout }) {
  const { theme, toggle } = useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef     = useRef(null)
  const toggleButtonRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
        toggleButtonRef.current?.focus()
      }
      if (dropdownOpen && e.key === 'ArrowDown') {
        e.preventDefault()
        dropdownRef.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [dropdownOpen])

  const handleLogout = useCallback(() => {
    setDropdownOpen(false)
    onLogout()
  }, [onLogout])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setDropdownOpen(o => !o)
    }
  }, [])

  const initials = user?.first_name && user?.last_name
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '??'

  const scope = user?.branch_detail?.name || 'National'
  const role = ROLE_LABEL[user?.role_name] || 'HR'

  return (
    <header className="bg-[var(--panel)] border-b border-[var(--border)] shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

        <div className="flex items-center gap-3 min-w-0">
          <span className="font-display font-black text-xl text-[var(--text)] tracking-tight">Octos</span>
          <span className="hidden sm:block w-px h-4 bg-[var(--border)]" aria-hidden="true" />
          <div className="hidden sm:flex flex-col leading-none min-w-0">
            <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">HR</span>
            <span className="text-xs font-medium text-[var(--text-2)] mt-0.5 truncate">{scope}</span>
          </div>
        </div>

        <div className="relative pl-3 border-l border-[var(--border)]" ref={dropdownRef}>
          <button
            ref={toggleButtonRef}
            onClick={() => setDropdownOpen(o => !o)}
            onKeyDown={handleKeyDown}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
            aria-label={`User menu for ${user?.full_name || 'User'}`}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity
              focus:outline-none focus:ring-2 focus:ring-[var(--text-3)] rounded-lg px-1 py-0.5"
          >
            <div className="w-7 h-7 rounded-full bg-[var(--text)] text-[var(--panel)]
              flex items-center justify-center text-[10px] font-bold shrink-0" aria-hidden="true">
              {initials}
            </div>
            <span className="hidden md:inline text-sm font-semibold text-[var(--text)]">{user?.full_name || '—'}</span>
            <svg className="hidden sm:block w-3 h-3 text-[var(--text-3)]" fill="none"
              stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-10 w-56 bg-[var(--panel)] border border-[var(--border)]
              rounded-xl shadow-lg z-50 overflow-hidden" role="menu" aria-label="User menu">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <div className="text-sm font-bold text-[var(--text)]">{user?.full_name}</div>
                <div className="text-xs text-[var(--text-3)] mt-0.5">{user?.email}</div>
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mt-1">
                  {scope} · {role}
                </div>
              </div>
              <div className="py-1">
                <button onClick={toggle} role="menuitem"
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-[var(--text-2)]
                    hover:bg-[var(--bg)] transition-colors focus:outline-none focus:bg-[var(--bg)]">
                  <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
                  <div className={`w-8 h-4 rounded-full transition-colors relative
                    ${theme === 'dark' ? 'bg-[var(--text)]' : 'bg-[var(--border-dark)]'}`} aria-hidden="true">
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform
                      ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
                <div className="h-px bg-[var(--border)] mx-4 my-1" aria-hidden="true" />
                <button onClick={handleLogout} role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--red-text)]
                    hover:bg-[var(--red-bg)] transition-colors focus:outline-none focus:bg-[var(--red-bg)]">
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
