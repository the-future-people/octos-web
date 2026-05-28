// src/components/bm/BMInfoStrip.jsx
import { useRef, useState, useEffect } from 'react'

export default function BMInfoStrip({ user }) {
  const branch = user?.branch_detail || {}
  const today  = new Date().toLocaleDateString('en-GH', {
    day: 'numeric', month: 'short', year: 'numeric'
  })

  const scrollRef = useRef(null)
  const [canLeft,  setCanLeft]  = useState(false)
  const [canRight, setCanRight] = useState(false)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 0)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [])

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 150, behavior: 'smooth' })
  }

  const items = [
    { label: 'REGION', value: branch.region_name || '—' },
    { label: 'BELT',   value: branch.belt_name   || '—' },
    { label: 'DATE',   value: today                     },
    { label: 'BRANCH LOAD', value: '0%'                 },
    { label: 'ACTIVE SERVICES', value: '—'              },
    { label: 'BRANCH RATING',   value: null             },
  ]

  return (
    <div className="bg-[var(--panel)] border-b border-[var(--border)] shrink-0">
      <div className="max-w-6xl mx-auto flex items-center">

        {/* Left arrow */}
        {canLeft && (
          <button
            onClick={() => scroll(-1)}
            className="px-2 py-2.5 text-[var(--text-3)] hover:text-[var(--text)]
              transition-colors shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}

        {/* Scrollable items */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex-1 flex items-center gap-5 px-4 py-2.5 text-xs
            overflow-x-auto whitespace-nowrap
            [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 shrink-0">
              <span className="font-bold text-[var(--text-3)] uppercase tracking-wider">
                {item.label}
              </span>
              {item.value !== null ? (
                <span className="font-semibold text-[var(--text)]">{item.value}</span>
              ) : (
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} width="10" height="10" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2"
                      className="text-[var(--border-dark)]">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                  <span className="text-[var(--text-3)] ml-1">—</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right arrow */}
        {canRight && (
          <button
            onClick={() => scroll(1)}
            className="px-2 py-2.5 text-[var(--text-3)] hover:text-[var(--text)]
              transition-colors shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}

      </div>
    </div>
  )
}