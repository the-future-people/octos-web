// src/hooks/useBranchSocket.js
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import {
  invalidateAfterJobCreated,
  invalidateAfterPaymentConfirmed,
  invalidateAfterJobTransitioned,
  invalidateAfterSheetClosed,
  invalidateAfterCustomerRegistered,
} from '../api/invalidations'

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

// Backoff grows to a ceiling rather than stopping. A cashier whose
// connection wobbles once at 9am should not be left with a dead socket
// for the rest of the shift, silently missing every job the attendant
// sends. Retrying every 30s indefinitely costs almost nothing.
const RECONNECT_BASE_MS = 3000
const RECONNECT_MAX_MS  = 30000

export default function useBranchSocket() {
  const { user, getAccessToken } = useAuth()
  const queryClient  = useQueryClient()
  const socketRef    = useRef(null)
  const attemptsRef  = useRef(0)
  const unmountedRef = useRef(false)

  useEffect(() => {
    if (!user) return

    unmountedRef.current = false

    const connect = () => {
      if (unmountedRef.current) return

      // Get a fresh access token for the handshake
      const token = getAccessToken()
      if (!token) return

      const ws = new WebSocket(`${WS_BASE}/ws/branch/?token=${token}`)
      socketRef.current = ws

      ws.onopen = () => {
        attemptsRef.current = 0

        // Anything sent while we were disconnected is gone — the socket
        // carries new events only, it does not replay. Without this the
        // queue stays stale after every reconnect until something else
        // happens to invalidate it, which is the usual reason a cashier
        // has to refresh to see a job that arrived minutes ago.
        queryClient.invalidateQueries()
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type !== 'invalidate' || !Array.isArray(msg.events)) return
          dispatchInvalidations(msg.events, queryClient)
        } catch {
          // Malformed message — ignore
        }
      }

      ws.onclose = (event) => {
        if (unmountedRef.current) return
        // 4001 = unauthenticated, 4002 = no branch — don't retry
        if (event.code === 4001 || event.code === 4002) return
        attemptsRef.current += 1
        const delay = Math.min(
          RECONNECT_BASE_MS * attemptsRef.current,
          RECONNECT_MAX_MS,
        )
        setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      unmountedRef.current = true
      socketRef.current?.close()
    }
  }, [user])
}

// ── Dispatch invalidations based on event list from server ────────────────────

function dispatchInvalidations(events, queryClient) {
  // Use sets for O(1) lookup
  const set = new Set(events)

  // Map server event names to invalidation functions
  if (set.has('paymentQueue') && set.has('cashierSummary')) {
    invalidateAfterPaymentConfirmed(queryClient)
    return
  }
  if (set.has('paymentQueue') && set.has('jobStats') && set.has('todaySummary')) {
    invalidateAfterJobCreated(queryClient)
    return
  }
  if (set.has('paymentQueue') && set.has('job-detail')) {
    invalidateAfterJobTransitioned(queryClient)
    return
  }
  if (set.has('lockStatus')) {
    invalidateAfterSheetClosed(queryClient)
    return
  }
  if (set.has('customers')) {
    invalidateAfterCustomerRegistered(queryClient)
    return
  }

  // Fallback — invalidate each key individually
  events.forEach(key => {
    queryClient.invalidateQueries({ queryKey: [key] })
  })
}