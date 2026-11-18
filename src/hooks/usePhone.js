// src/hooks/usePhone.js
//
// True on a phone-width screen (under Tailwind's sm, 640px), and kept up to
// date as the window turns or resizes (18 Nov 2026). For the few layouts that
// need a different structure on a phone, not just different CSS.
import { useEffect, useState } from 'react'

const QUERY = '(max-width: 639px)'

export default function usePhone() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches)
  useEffect(() => {
    const m = window.matchMedia(QUERY)
    const on = () => setPhone(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return phone
}
