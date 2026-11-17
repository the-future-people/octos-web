// src/hooks/useInboxBadge.js
//
// The inbox's badge on the menu (8 Nov 2026): how many chats have unread
// messages, and how many Octos has asked a person to take, and since when.
// It also puts the count in the window's title, for the taskbar.
//
// Counted by the server over every chat (17 Nov 2026), not from the first
// page of the list, which left out anything older than the newest 20.
import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../api/client'

const NONE = { unread: 0, needs: 0, waiting_since: null, by_channel: {} }

// Under the 'conversations' key, so anything that refreshes the inbox
// refreshes these numbers too.
export function useInboxCounts() {
  const { data } = useQuery({
    queryKey: ['conversations', 'counts'],
    queryFn: () => client.get('/api/v1/communications/counts/').then(r => r.data),
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
  return data || NONE
}

export default function useInboxBadge() {
  const counts = useInboxCounts()
  const { unread, needs } = counts
  // When the longest-waiting chat was handed to a person (15 Nov 2026):
  // the menu's line turns red once that is 5 minutes ago.
  const waitingSince = counts.waiting_since

  useEffect(() => {
    document.title = needs ? `(${needs}) Needs you · Octos` : unread ? `(${unread}) Octos` : 'Octos'
  }, [unread, needs])

  // In the desktop app: a red badge on the taskbar icon, and a flash when
  // something new arrives while you're elsewhere, like WhatsApp's (9 Nov 2026).
  const before = useRef(unread + needs)
  useEffect(() => {
    const win = window.__TAURI__?.window?.getCurrentWindow?.()
    if (!win) return
    drawBadge(needs ? '!' : unread ? (unread > 99 ? '99+' : String(unread)) : '')
      .then(icon => win.setOverlayIcon(icon || undefined))
      .catch(() => {})
    if (unread + needs > before.current && !document.hasFocus()) {
      win.requestUserAttention(2).catch(() => {})   // 2: informational, a gentle flash
    }
    before.current = unread + needs
  }, [unread, needs])

  return { unread, needs, waitingSince }
}

// The taskbar badge: a red circle with the count, as PNG bytes; null for none.
async function drawBadge(label) {
  if (!label) return null
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  g.fillStyle = '#CC0000'
  g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#FFFFFF'
  g.font = `bold ${label.length > 2 ? 12 : label.length > 1 ? 15 : 19}px sans-serif`
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(label, size / 2, size / 2 + 1)
  const blob = await new Promise(done => canvas.toBlob(done, 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}
