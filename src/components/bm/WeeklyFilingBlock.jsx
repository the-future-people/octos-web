// src/components/bm/WeeklyFilingBlock.jsx
// Stops the branch manager until last week is filed.
//
// A mandatory modal, but never a dead end: if a day in that week is still
// open it cannot be filed, so the way out is the day sheet rather than a
// button that fails. A blockade that traps someone is worse than the
// thing it was meant to prevent — five weeks once went unfiled because
// nothing ever asked for them, and a branch that cannot trade because a
// filing is late would be a worse outcome than a late filing.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'

const getOutstanding = () =>
  client.get('/api/v1/finance/weekly/outstanding/')

const submitWeek = (id) =>
  client.post(`/api/v1/finance/weekly/${id}/submit/`, { bm_notes: '' })

const money = (n) =>
  parseFloat(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })

const longDay = (iso) =>
  new Date(iso).toLocaleDateString('en-GH', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

const dayName = (iso) =>
  new Date(iso).toLocaleDateString('en-GH', { weekday: 'long' })

const span = (from, to) => {
  const a = new Date(from)
  const b = new Date(to)
  const month = b.toLocaleDateString('en-GH', { month: 'long' })
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${month}`
    : `${a.getDate()} ${a.toLocaleDateString('en-GH', { month: 'long' })} – ${b.getDate()} ${month}`
}

export default function WeeklyFilingBlock({ onGoToDaySheet }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')

  // Stepping aside to let the day be settled, not dismissing. The block
  // covers the screen, so sending someone to the day sheet while staying
  // in front of it is a trap. Half an hour is long enough to close a day
  // and short enough that it returns in the same sitting.
  const [standBackUntil, setStandBackUntil] = useState(0)
  const standingBack = Date.now() < standBackUntil

  const { data } = useQuery({
    queryKey: ['outstanding-week'],
    queryFn: () => getOutstanding().then(r => r.data),
    refetchInterval: 300_000,
    staleTime: 60_000,
  })

  const week = data?.outstanding

  const { mutate: file, isPending } = useMutation({
    mutationFn: () => submitWeek(week.id),
    onSuccess: () => {
      setError('')
      queryClient.invalidateQueries({ queryKey: ['outstanding-week'] })
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] })
    },
    onError: (err) => {
      const d = err.response?.data
      setError(
        Array.isArray(d?.detail) ? d.detail.join(' · ')
          : d?.detail || 'Could not file that week. Please try again.'
      )
    },
  })

  if (!week || standingBack) return null

  const openDays = week.open_days || []
  const blocked  = !week.can_submit

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-md
        overflow-hidden animate-slideUp">

        <div className="px-6 pt-6">
          <div className="w-11 h-11 rounded-full bg-amber-50 flex items-center
            justify-center mb-3.5">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
              strokeLinejoin="round" className="text-amber-600">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <polyline points="9 16 11 18 15 14" />
            </svg>
          </div>
          <div className="text-lg font-bold text-[var(--text)]">
            Last week needs filing
          </div>
          <div className="text-[13px] text-[var(--text-2)] leading-relaxed mt-1.5">
            Monday to Saturday, {span(week.date_from, week.date_to)}.
            {!blocked && ' Finance cannot review the month until every week in it is filed.'}
          </div>
        </div>

        {blocked ? (
          <div className="mx-6 my-4 px-3.5 py-3 bg-[var(--red-bg)] rounded-xl">
            <div className="text-xs text-[var(--text)] leading-relaxed">
              {longDay(openDays[0])} was never closed
              {openDays.length > 1 && `, along with ${openDays.length - 1} other day${openDays.length > 2 ? 's' : ''}`}.
              A week cannot be filed with a day still open.
            </div>
          </div>
        ) : (
          <div className="mx-6 my-4 px-3.5 py-3 bg-[var(--bg)] rounded-xl flex gap-6">
            <div>
              <div className="text-[10px] text-[var(--text-3)]">Jobs</div>
              <div className="font-mono text-base font-bold text-[var(--text)] mt-0.5">
                {week.jobs}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-3)]">Collected</div>
              <div className="font-mono text-base font-bold text-emerald-700 mt-0.5">
                {money(week.total)}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-6 mb-3 px-3 py-2.5 bg-[var(--red-bg)] border
            border-[var(--red-border)] rounded-lg text-xs text-[var(--red-text)]">
            {error}
          </div>
        )}

        <div className="px-6 pb-6">
          {blocked ? (
            <>
                            <button
                onClick={() => {
                  setStandBackUntil(Date.now() + 30 * 60 * 1000)
                  onGoToDaySheet()
                }}
                className="w-full py-2.5 bg-[var(--text)] text-white text-sm
                  font-bold rounded-xl hover:opacity-90 transition-opacity">
                Settle {dayName(openDays[0])} first
              </button>
              <p className="text-[11px] text-[var(--text-3)] text-center mt-2 leading-relaxed">
                Takes you to the day sheet. This will be waiting when you come back.
              </p>
            </>
          ) : (
            <>
              <button onClick={() => { setError(''); file() }} disabled={isPending}
                className="w-full py-2.5 bg-[var(--text)] text-white text-sm
                  font-bold rounded-xl hover:opacity-90 disabled:opacity-40
                  transition-opacity">
                {isPending ? 'Filing…' : 'File the week'}
              </button>
              <p className="text-[11px] text-[var(--text-3)] text-center mt-2 leading-relaxed">
                This locks the week. You will not be able to edit it afterwards.
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}