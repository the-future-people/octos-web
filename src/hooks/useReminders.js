// src/hooks/useReminders.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../api/client'

const getInterruptiveReminders = () =>
  client.get('/api/v1/notifications/', {
    params: { display_mode: 'INTERRUPTIVE', unread: 'true' },
  })

const markRead = (id) =>
  client.post(`/api/v1/notifications/${id}/read/`)

/**
 * Single source of truth for interruptive reminders across every portal.
 * Polls every 30s (matches NotificationBell's existing cadence) and
 * returns the oldest unread interruptive reminder to display, plus a
 * dismiss mutation. One hook, reused identically by Cashier, Attendant,
 * and BM — extend to a new portal by importing this, nothing else.
 */
export default function useReminders() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['interruptiveReminders'],
    queryFn:  () => getInterruptiveReminders().then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 0,
  })

  const reminders = Array.isArray(data) ? data : (data?.results || [])
  // Oldest first — same ordering the backend already returns
  // (Notification.Meta.ordering = ['-created_at'] means newest first,
  // so reverse to surface the longest-waiting reminder)
  const current = reminders.length > 0 ? reminders[reminders.length - 1] : null

  const { mutate: dismiss, isPending: isDismissing } = useMutation({
    mutationFn: (id) => markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interruptiveReminders'] })
      queryClient.invalidateQueries({ queryKey: ['notifCount'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return {
    current,
    hasReminder: !!current,
    isLoading,
    dismiss: () => current && dismiss(current.id),
    isDismissing,
  }
}