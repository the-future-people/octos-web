// src/components/attendant/ClaimStrip.jsx
// Files arriving now (Layer 2, Step 2.3, 11 Nov 2026).
//
// Customers who have sent files that nobody has picked up yet, above every page
// of the attendant's portal. One tap ("This is my customer") claims them: Octos
// goes quiet, the visit is marked at the counter with full certainty, and the row
// leaves the strip. A row also leaves by itself once the files are opened, taken
// on in the inbox, or made into a job (the ledger on the server decides).
// Nothing waiting: the strip is not drawn at all.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { openFile } from '../bm/Inbox'

const getArrivals = () => client.get('/api/v1/communications/arrivals/').then(r => r.data)
const claim = conversationId => client.post(`/api/v1/communications/${conversationId}/at-counter/`)

const WHERE = { AT_COUNTER: 'at the counter', UNSURE: 'not sure where', AWAY: 'probably away' }

function waited(since) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 60000))
  return minutes < 1 ? 'just now' : `${minutes} min`
}

function badge(m) {
  const name = m.media_name || ''
  const ext = name.includes('.') ? name.split('.').pop() : ''
  if (ext && ext.length <= 4) return ext.toUpperCase()
  if ((m.media_mime || '').startsWith('image/') || m.message_type === 'IMAGE') return 'PHOTO'
  return 'FILE'
}

export default function ClaimStrip() {
  const queryClient = useQueryClient()
  const { data: rows = [] } = useQuery({
    queryKey: ['arrivals'],
    queryFn: getArrivals,
    refetchInterval: 10_000,
    staleTime: 5_000,
  })
  const tap = useMutation({
    mutationFn: claim,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arrivals'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  if (!rows.length) return null

  return (
    <section aria-label="Files arriving now"
      className="shrink-0 border-b border-[var(--border)] bg-[#FFF8EC] px-4 py-2.5">
      <div className="text-[10.5px] font-bold tracking-wider text-[#8A5A00] mb-1.5">
        FILES ARRIVING NOW · {rows.length}
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map(row => (
          <li key={row.conversation_id}
            className="flex items-center gap-3 flex-wrap bg-white border border-[#F1DFC0] rounded-xl px-3 py-2">
            <span className="min-w-0 flex-1 flex flex-col">
              <span className="text-[13px] font-bold text-[var(--text)] truncate">
                {row.name}{row.number_tail ? <span className="font-medium text-[var(--text-3)]"> · …{row.number_tail}</span> : null}
              </span>
              <span className="text-[11.5px] text-[var(--text-3)]">
                {row.files.length} file{row.files.length === 1 ? '' : 's'} · {waited(row.since)} · {WHERE[row.presence] || ''}
              </span>
            </span>
            <span className="flex gap-1 flex-wrap">
              {row.files.slice(0, 6).map(m => (
                <button key={m.id} type="button" onClick={() => openFile(m)} title={m.media_name || 'Open'}
                  className="h-7 min-w-[38px] px-1.5 rounded-md bg-[#16181D] text-white text-[10px] font-extrabold">
                  {badge(m)}
                </button>
              ))}
              {row.files.length > 6 && <span className="text-[11px] text-[var(--text-3)] self-center">+{row.files.length - 6}</span>}
            </span>
            <button type="button" onClick={() => tap.mutate(row.conversation_id)}
              disabled={tap.isPending && tap.variables === row.conversation_id}
              className="h-8 px-3 rounded-lg bg-[#16181D] text-white text-[12px] font-semibold disabled:opacity-50">
              This is my customer
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
