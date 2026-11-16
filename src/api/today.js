// src/api/today.js
//
// The attendant's Today screen in one call (16 Nov 2026): her day, what needs
// her, the team, her jobs, the shift's times and who just scanned in. Shared
// by the Today screen and the idle check, so both read the same poll.
import client from './client'

export const todayQuery = {
  queryKey: ['attendantToday'],
  queryFn: () => client.get('/api/v1/jobs/attendant/today/').then(r => r.data),
  refetchInterval: 30_000,
  staleTime: 15_000,
}

// Going on and coming off a break: the manager's On shift says "On break".
export const setBreak = (on) =>
  client.post('/api/v1/analytics/session/break/', { on }).then(r => r.data)
