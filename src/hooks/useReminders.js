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

  // Two kinds of reminder, and they want opposite orderings.
  //
  // A shift warning is about the clock, so only the newest is true — the
  // one from twenty minutes ago is wrong now, and showing it first means
  // clicking through four stale modals to reach the current one. The
  // backend marks the older ones read as each new one is made; this is
  // the same rule on the client, so a poll landing mid-window still shows
  // the right thing.
  //
  // A private note is not about the clock. It waits until it is answered,
  // and the longest-waiting one goes first.
  const shift = reminders.filter(r => r.verb === 'shift_ending')
  const other = reminders.filter(r => r.verb !== 'shift_ending')

  const current =
    other.length > 0 ? other[other.length - 1] :
    shift.length > 0 ? shift[0] :
    null

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