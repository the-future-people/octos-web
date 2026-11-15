// src/components/shared/ProfileHost.jsx
//
// My profile is opened from every portal's user menu (15 Nov 2026). The menu
// closes as soon as it's used, so the page can't live inside it: the menu
// item sends 'octos:profile', and this one host, mounted once for the whole
// app, opens the page.
import { useEffect, useState } from 'react'
import MyProfile from './MyProfile'

export const openProfile = () => window.dispatchEvent(new Event('octos:profile'))

export default function ProfileHost({ user }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener('octos:profile', show)
    return () => window.removeEventListener('octos:profile', show)
  }, [])
  useEffect(() => { if (!user) setOpen(false) }, [user])
  if (!open || !user) return null
  return <MyProfile onClose={() => setOpen(false)} />
}

// The line in each portal's user menu.
export function ProfileMenuItem({ onPick }) {
  return (
    <button type="button" role="menuitem"
      onClick={() => { onPick?.(); openProfile() }}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-2)]
        hover:bg-[var(--bg)] transition-colors focus:outline-none focus:bg-[var(--bg)]">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
      My profile
    </button>
  )
}
