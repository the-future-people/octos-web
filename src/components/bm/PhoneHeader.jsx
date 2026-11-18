// src/components/bm/PhoneHeader.jsx
//
// The top of every redesigned phone page (18 Nov 2026): Octos on the left,
// round bell and profile buttons on the right. It stays put while the page
// scrolls, and turns frosted once the page moves under it. Drawn first by
// the Overview, shared from the Jobs page on.
import { useEffect, useRef, useState } from 'react'
import IOSAccount from '../ios/IOSAccount'
import NotificationBell from '../cashier/NotificationBell'

export default function PhoneHeader({ children }) {
  const top = useRef(null)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = top.current
    if (!el) return undefined
    const watch = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { root: el.closest('.overflow-y-auto'), threshold: 0 })
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  return (
    <>
      <div ref={top} className="h-px" />
      <div className={`sticky top-0 z-30 transition-[background,box-shadow] duration-200 ${scrolled ? 'ios-bar' : ''}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-[58px] px-4 flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-full bg-white grid place-items-center shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
            <img src="/octos-mark.svg" alt="" width={27} height={27} />
          </span>
          <span className="octos-wordmark text-[21px] text-[#111]">OCTOS</span>
          <span className="ml-auto w-10 h-10 rounded-full bg-white grid place-items-center shadow-[0_2px_10px_rgba(0,0,0,0.08)]
            [&_button]:!w-10 [&_button]:!h-10 [&_button]:!rounded-full">
            <NotificationBell />
          </span>
          <IOSAccount variant="card" />
        </div>
        {/* Anything that should stay pinned with the header, e.g. a search field. */}
        {children}
      </div>
    </>
  )
}
