// src/components/attendant/AttendantJobs.jsx
//
// One Jobs tab (13 Nov 2026), replacing My Jobs, Branch Jobs and Drafts.
// "Has my customer's job been done?" is one question whichever attendant
// recorded it, so both lists live here behind a switch. Drafts were dropped:
// New Job never creates one, so the old tab could only ever be empty.

import { useState } from 'react'
import AttendantMyJobs from './AttendantMyJobs'
import AttendantBranchJobs from './AttendantBranchJobs'

const VIEWS = [
  { key: 'mine',   label: 'Mine' },
  { key: 'branch', label: 'Whole branch' },
]

export default function AttendantJobs({ sheet, initialView = 'mine' }) {
  const [view, setView] = useState(initialView)

  const heading = (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <h2 className="text-lg font-bold text-[var(--text)]">Jobs</h2>
      <div className="flex gap-1 bg-[var(--bg)] border border-[var(--border)] p-1 rounded-xl" role="tablist">
        {VIEWS.map(v => (
          <button key={v.key} role="tab" aria-selected={view === v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors
              ${view === v.key
                ? 'bg-[var(--panel)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-3)] hover:text-[var(--text)]'}`}>
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )

  return view === 'mine'
    ? <AttendantMyJobs sheet={sheet} heading={heading} />
    : <AttendantBranchJobs sheet={sheet} heading={heading} />
}
