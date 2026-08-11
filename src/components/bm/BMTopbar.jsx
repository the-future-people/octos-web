// src/components/bm/BMTopbar.jsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTheme } from '../../context/ThemeContext'
import NotificationBell from '../cashier/NotificationBell'
import { useQuery } from '@tanstack/react-query'
import { getLockStatus } from '../../api/bm'

export default function BMTopbar({ user, onLogout, onMenuToggle, showMenu }) {
  const { theme, toggle } = useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const toggleButtonRef = useRef(null)

  // ── Lock status query with error handling ──────────────────────────
  const { 
    data: lockData, 
    isLoading: lockLoading,
    isError: lockError,
    error: lockErrorDetail,
    refetch: refetchLockStatus 
  } = useQuery({
    queryKey: ['lockStatus'],
    queryFn: () => getLockStatus().then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Failed to fetch lock status:', error)
    }
  })

  // ── Close dropdown on outside click ────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Keyboard navigation for dropdown ───────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
        toggleButtonRef.current?.focus()
      }
      if (dropdownOpen && e.key === 'ArrowDown') {
        e.preventDefault()
        const firstButton = dropdownRef.current?.querySelector('button')
        firstButton?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [dropdownOpen])

  // ── Handlers ───────────────────────────────────────────────────────
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

  // ── Derived values ─────────────────────────────────────────────────
  const initials = user?.first_name && user?.last_name
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '??'

  // ── Authentication check ───────────────────────────────────────────
  if (!user) {
    return (
      <header className="bg-[var(--panel)] border-b border-[var(--border)] shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-center">
          <span className="text-sm text-[var(--text-3)]">
            Session expired — please sign in again
          </span>
        </div>
      </header>
    )
  }

  return (
    <header className="bg-[var(--panel)] border-b border-[var(--border)] shrink-0">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* ── Left section ────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            aria-label={showMenu ? 'Close menu' : 'Open menu'}
            aria-expanded={showMenu}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg
              hover:bg-[var(--bg)] text-[var(--text-2)] transition-colors
              focus:outline-none focus:ring-2 focus:ring-[var(--text-3)]"
          >
            {showMenu ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>

          <span className="font-display font-black text-xl text-[var(--text)] tracking-tight">
            Octos
          </span>
          <span className="hidden sm:block w-px h-4 bg-[var(--border)]" aria-hidden="true" />
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
              Branch Manager
            </span>
            <span className="text-xs font-medium text-[var(--text-2)] mt-0.5">
              {user?.branch_detail?.name || '—'}
            </span>
          </div>
        </div>

        {/* ── Right section ───────────────────────────────────────── */}
        <div className="flex items-center gap-3">

          {/* Sheet status pill */}
          {lockData?.sheet_number && (
            <div className="flex items-center gap-1.5 px-2 py-1
              bg-[var(--panel)] border border-[var(--border)] rounded-full text-xs font-semibold
              text-[var(--text-2)]">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                lockData?.sheet_status === 'OPEN' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
              }`} />
              <span className="font-mono font-bold text-[var(--text)] hidden sm:inline">
                {lockData.sheet_number}
              </span>
              <span className="font-mono font-bold text-[var(--text)] sm:hidden text-[10px]">
                {lockData.sheet_number?.split('-').pop()}
              </span>
              <span className="w-px h-3 bg-[var(--border)] hidden sm:block" />
              <span className={`hidden sm:inline ${lockData?.sheet_status === 'OPEN' ? 'text-emerald-600' : 'text-[var(--text-3)]'}`}>
                {lockData?.sheet_status || 'OPEN'}
              </span>
            </div>
          )}

          {/* Notification bell */}
          <NotificationBell />

          {/* Lock status error indicator */}
          {lockError && (
            <button
              onClick={() => refetchLockStatus()}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1
                bg-[var(--red-bg)] border border-[var(--red-border)]
                rounded-full text-xs font-bold text-[var(--red-text)]
                hover:opacity-80 transition-opacity"
              title="Failed to load lock status. Click to retry."
              aria-label="Failed to load lock status. Click to retry."
            >
              ⚠ Sync failed
            </button>
          )}

          {/* Loading indicator for lock status */}
          {lockLoading && !lockData && (
            <div className="hidden sm:block w-4 h-4 border-2 border-[var(--border)] 
              border-t-[var(--text-3)] rounded-full animate-spin"
              aria-label="Loading lock status" />
          )}

          {/* Profile dropdown */}
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
                flex items-center justify-center text-[10px] font-bold shrink-0"
                aria-hidden="true">
                {initials}
              </div>
              <span className="hidden md:inline text-sm font-semibold text-[var(--text)]">
                {user?.full_name || '—'}
              </span>
              <svg className="hidden sm:block w-3 h-3 text-[var(--text-3)]" fill="none"
                stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {dropdownOpen && (
              <div 
                className="absolute right-0 top-10 w-56 bg-[var(--panel)]
                  border border-[var(--border)] rounded-xl shadow-lg z-50 overflow-hidden"
                role="menu"
                aria-label="User menu"
              >
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <div className="text-sm font-bold text-[var(--text)]">{user?.full_name}</div>
                  <div className="text-xs text-[var(--text-3)] mt-0.5">{user?.email}</div>
                  <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mt-1">
                    {user?.branch_detail?.name} · Branch Manager
                  </div>
                </div>
                <div className="py-1">
                  <button
                    onClick={toggle}
                    role="menuitem"
                    className="w-full flex items-center justify-between px-4 py-2.5
                      text-sm text-[var(--text-2)] hover:bg-[var(--bg)] transition-colors
                      focus:outline-none focus:bg-[var(--bg)]"
                  >
                    <div className="flex items-center gap-3">
                      {theme === 'light' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <circle cx="12" cy="12" r="5"/>
                          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                        </svg>
                      )}
                      <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
                    </div>
                    <div className={`w-8 h-4 rounded-full transition-colors relative
                      ${theme === 'dark' ? 'bg-[var(--text)]' : 'bg-[var(--border-dark)]'}`}
                      aria-hidden="true">
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white
                        transition-transform
                        ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </button>
                  <div className="h-px bg-[var(--border)] mx-4 my-1" aria-hidden="true" />
                  <button
                    onClick={handleLogout}
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-4 py-2.5
                      text-sm text-[var(--red-text)] hover:bg-[var(--red-bg)] transition-colors
                      focus:outline-none focus:bg-[var(--red-bg)]"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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