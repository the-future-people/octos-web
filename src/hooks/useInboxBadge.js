// src/hooks/useInboxBadge.js
//
// The inbox's badge on the menu (8 Nov 2026): how many chats have unread
// messages, and how many Octos has asked a person to take. It shares the
// inbox's own query (same key, same request), so it costs nothing extra.
// It also puts the count in the window's title, for the taskbar.
import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../api/client'

const getConversations = () =>
  client.get('/api/v1/communications/').then(r => (Array.isArray(r.data) ? r.data : (r.data?.results || [])))

export default function useInboxBadge() {
  const { data = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
  const unread = data.filter(c => c.unread_count > 0).length
  const needs = data.filter(c => c.handled_by === 'STAFF' && !!c.handoff_reason).length

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

  return { unread, needs }
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
