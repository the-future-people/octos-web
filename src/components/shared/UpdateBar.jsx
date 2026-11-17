// src/components/shared/UpdateBar.jsx
//
// When a newer Octos is live (src/lib/freshness.js): a small bar with
// "Reload now", and a reload on the next move to another section, since
// changing section leaves nothing half-done behind. Otherwise the page
// reloads by itself once it is safe.
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { busy, isWaiting, onWaiting, reloadNow, startFreshness } from '../../lib/freshness'

export default function UpdateBar() {
  const [waiting, setWaiting] = useState(isWaiting)
  const { pathname } = useLocation()
  const first = useRef(true)

  useEffect(() => {
    startFreshness()
    return onWaiting(setWaiting)
  }, [])

  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (isWaiting() && !busy()) reloadNow()
  }, [pathname])

  if (!waiting) return null
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10050] flex items-center gap-3 rounded-full
                    bg-neutral-900 text-white pl-4 pr-1.5 py-1.5 shadow-2xl text-[12.5px]">
      <span>A new version of Octos is ready</span>
      <button onClick={reloadNow}
        className="h-7 px-3 rounded-full bg-white text-neutral-900 text-[12px] font-bold">Reload now</button>
    </div>
  )
}
