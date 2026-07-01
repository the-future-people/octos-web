// src/components/layout/PortalPreloader.jsx
// Shown once, immediately after login, while critical Overview/Day
// Sheet/Jobs data is prefetched into the React Query cache. Capped
// at a max wait so a slow endpoint never blocks entry indefinitely.

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { getTodaySummary, getLockStatus, getWorkload } from '../../api/bm'
import client from '../../api/client'

const MAX_WAIT_MS = 2000

export default function PortalPreloader({ children }) {
  const { justLoggedIn, clearJustLoggedIn, user } = useAuth()
  const queryClient = useQueryClient()
  const [ready, setReady] = useState(!justLoggedIn)

  useEffect(() => {
    if (!justLoggedIn) return

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      setReady(true)
      clearJustLoggedIn()
    }

    const capTimer = setTimeout(finish, MAX_WAIT_MS)

    const prefetches = [
      queryClient.prefetchQuery({
        queryKey: ['todaySummary'],
        queryFn:  () => getTodaySummary().then(r => r.data),
      }),
      queryClient.prefetchQuery({
        queryKey: ['lockStatus'],
        queryFn:  () => getLockStatus().then(r => r.data),
      }),
      queryClient.prefetchQuery({
        queryKey: ['workload'],
        queryFn:  () => getWorkload().then(r => r.data),
      }),
      queryClient.prefetchQuery({
        queryKey: ['performance-today', 'day'],
        queryFn:  () => client.get('/api/v1/jobs/performance/?period=day').then(r => r.data),
      }),
      queryClient.prefetchQuery({
        queryKey: ['eodPrediction'],
        queryFn:  () => client.get('/api/v1/analytics/prediction/').then(r => r.data),
      }),
      queryClient.prefetchQuery({
        queryKey: ['jobs', 'day', 1, 20],
        queryFn:  () => client.get('/api/v1/jobs/?period=day&page=1&page_size=20').then(r => r.data),
      }),
    ]

    Promise.all(prefetches.map(p => p.catch(() => null))).then(finish)

    return () => clearTimeout(capTimer)
  }, [justLoggedIn])

  if (!ready) {
    return <LoadingScreen />
  }

  return children
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <span
            className="font-display font-black text-4xl text-white tracking-tight animate-octosPulse"
          >
            Octos
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/60 animate-octosDot"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <p className="text-xs text-white/50 font-medium tracking-wide">
          Getting you in there shortly…
        </p>
      </div>
    </div>
  )
}