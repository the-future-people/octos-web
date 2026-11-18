// src/components/ios/IOSAccount.jsx
//
// The profile circle at the top right of a phone page (18 Nov 2026). A tap
// opens an iOS action sheet: who is signed in, My profile, light or dark,
// Sign out, and a separate Cancel.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { openProfile } from '../shared/ProfileHost'

export default function IOSAccount({ role = 'Branch Manager', variant = 'plain' }) {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || '·'
  const item = 'w-full h-[57px] text-[20px] ios-press'

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Your account"
        className={variant === 'card'
          ? 'w-11 h-11 rounded-full bg-white text-[#111] grid place-items-center text-[15px] font-bold shadow-[0_2px_10px_rgba(0,0,0,0.08)] active:opacity-60'
          : 'w-[34px] h-[34px] rounded-full bg-[var(--ios-label)] text-[var(--ios-cell)] grid place-items-center text-[13px] font-semibold active:opacity-60'}>
        {initials}
      </button>
      {open && createPortal(
        <div className="ios fixed inset-0 z-[10000] !bg-transparent" role="dialog" aria-label="Your account">
          <div className="absolute inset-0 bg-black/40 animate-fadeIn" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-2 bottom-0 animate-slideUp space-y-2"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
            <div className="rounded-[14px] overflow-hidden bg-[var(--ios-cell)] text-center">
              <div className="px-4 py-3.5" style={{ boxShadow: 'inset 0 -0.5px 0 var(--ios-sep)' }}>
                <div className="text-[13px] font-semibold text-[var(--ios-secondary)]">{user?.full_name}</div>
                <div className="text-[13px] text-[var(--ios-secondary)]">
                  {role}{user?.branch_detail?.name ? ` · ${user.branch_detail.name}` : ''}
                </div>
              </div>
              <button type="button" className={item} style={{ color: '#007AFF', boxShadow: 'inset 0 -0.5px 0 var(--ios-sep)' }}
                onClick={() => { setOpen(false); openProfile() }}>My profile</button>
              <button type="button" className={item} style={{ color: '#007AFF', boxShadow: 'inset 0 -0.5px 0 var(--ios-sep)' }}
                onClick={() => { toggle() }}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
              <button type="button" className={item} style={{ color: '#FF3B30' }}
                onClick={() => { setOpen(false); logout(); navigate('/login') }}>Sign out</button>
            </div>
            <button type="button" onClick={() => setOpen(false)}
              className="w-full h-[57px] rounded-[14px] bg-[var(--ios-cell)] text-[20px] font-semibold ios-press"
              style={{ color: '#007AFF' }}>Cancel</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
