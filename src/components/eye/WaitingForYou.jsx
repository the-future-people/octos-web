// src/components/eye/WaitingForYou.jsx
//
// Prices waiting for the owner (17 Nov 2026): a Branch Manager asked to go
// below the floor (2.5 times cost), or further than allowed where costs are
// unknown. Shown at the top of the Eye until each is approved or declined.
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getWaitingCuts, approveCut, declineCut } from '../../api/discounts'
import { C, TONE, since } from './theme'

const money = n => `GHS ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function WaitingForYou() {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState({})
  const { data: cuts = [] } = useQuery({
    queryKey: ['waiting-cuts'],
    queryFn: getWaitingCuts,
    refetchInterval: 60_000,
    retry: false,
  })
  const decide = useMutation({
    mutationFn: ({ id, yes }) => (yes ? approveCut(id) : declineCut(id, notes[id] || '')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['waiting-cuts'] }),
  })
  if (!cuts.length) return null

  return (
    <div className="mx-3 mt-3 rounded-xl p-3" style={{ background: TONE.amber.bg, border: `1px solid ${TONE.amber.border}` }}>
      <div className="text-[12px] font-bold mb-2" style={{ color: TONE.amber.text }}>
        Waiting for you · {cuts.length} price{cuts.length === 1 ? '' : 's'} below the floor
      </div>
      <div className="space-y-2">
        {cuts.map(c => (
          <div key={c.id} className="rounded-lg p-2.5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]" style={{ color: C.text }}>
              <b>{c.number}</b><span style={{ color: C.text2 }}>{c.customer}</span>
              <span className="ml-auto text-[11px]" style={{ color: C.muted }}>{c.asked_by} · {since(c.asked_at)} ago</span>
            </div>
            <div className="text-[12.5px] mt-1" style={{ color: C.text2 }}>
              {money(c.before_total)} → <b style={{ color: C.text }}>{money(c.new_total)}</b> ({c.percent}% off)
              {c.cost && <> · costs {money(c.cost)}, floor {money(c.floor_total)}</>}
            </div>
            <div className="text-[12px] mt-0.5" style={{ color: C.muted }}>“{c.reason}”</div>
            <div className="flex flex-wrap gap-2 mt-2">
              <button onClick={() => decide.mutate({ id: c.id, yes: true })} disabled={decide.isPending}
                className="h-8 px-3 rounded-lg text-[12px] font-bold" style={{ background: C.green, color: '#0f0f0e' }}>Approve</button>
              <input value={notes[c.id] || ''} onChange={e => setNotes({ ...notes, [c.id]: e.target.value })}
                placeholder="Why not (optional)" className="h-8 px-2 rounded-lg text-[12px] flex-1 min-w-[140px]"
                style={{ background: C.raised, border: `1px solid ${C.border}`, color: C.text }} />
              <button onClick={() => decide.mutate({ id: c.id, yes: false })} disabled={decide.isPending}
                className="h-8 px-3 rounded-lg text-[12px] font-bold" style={{ border: `1px solid ${C.border}`, color: C.text2 }}>Decline</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
