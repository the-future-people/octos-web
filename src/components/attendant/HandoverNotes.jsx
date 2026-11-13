// src/components/attendant/HandoverNotes.jsx
//
// What last night's attendants left for this morning (13 Nov 2026): the
// handover notes written at sign-off. Shown on Today until she has read it.

import { useState } from 'react'

export default function HandoverNotes({ notes }) {
  const [read, setRead] = useState(false)
  if (read || !notes?.length) return null

  return (
    <div className="mx-5 sm:mx-6 mt-5 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold">From last night</div>
          <ul className="mt-1.5 space-y-1">
            {notes.map((n, i) => (
              <li key={i} className="text-sm">
                <span className="font-semibold">{n.attendant_name}:</span> {n.note}
              </li>
            ))}
          </ul>
        </div>
        <button onClick={() => setRead(true)}
          className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg bg-white/70 border border-blue-200
            hover:bg-white transition-colors">
          Got it
        </button>
      </div>
    </div>
  )
}
