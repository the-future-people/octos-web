// src/hooks/useInboxBadge.js
//
// The inbox's badge on the menu (8 Nov 2026): how many chats have unread
// messages, and how many Octos has asked a person to take. It shares the
// inbox's own query (same key, same request), so it costs nothing extra.
// It also puts the count in the window's title, for the taskbar.
import { useEffect } from 'react'
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

  return { unread, needs }
}
