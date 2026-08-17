// src/pages/coordinator/CoordinatorPortal.jsx
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import ProductionBoard from '../../components/coordinator/ProductionBoard'
import VerificationQueue from '../../components/coordinator/VerificationQueue'

const SECTIONS = [
  { id: 'board',  label: 'Production' },
  { id: 'verify', label: 'To verify'  },
]

/**
 * The back room. The coordinator moves work through the floor and checks
 * what arrives remotely; they never meet a customer at the counter and
 * never touch money.
 *
 * Two sections only. This is a screen someone glances at with ink on their
 * hands, not one they navigate.
 */
export default function CoordinatorPortal() {
  const { user, logout } = useAuth()
  const [section, setSection] = useState('board')

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="bg-[var(--panel)] border-b border-[var(--border)]">
        <div className="px-5 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-black text-lg text-[var(--text)] tracking-tight">
              Octos
            </span>
            <span className="w-px h-6 bg-[var(--border)]" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
                Flow Coordinator
              </div>
              <div className="text-xs text-[var(--text-2)] truncate">
                {user?.branch_name || 'Branch'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-semibold text-[var(--text)] hidden sm:inline">
              {user?.full_name}
            </span>
            <button onClick={logout}
              className="px-3 py-1.5 text-xs font-bold border border-[var(--border)]
                rounded-lg text-[var(--text-2)] hover:border-[var(--border-dark)]
                transition-colors">
              Sign out
            </button>
          </div>
        </div>

        <div className="px-5 sm:px-6 pb-3">
          <div className="flex gap-1 bg-[var(--bg)] p-1 rounded-xl max-w-sm">
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors
                  ${section === s.id
                    ? 'bg-[var(--text)] text-white shadow-sm'
                    : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {section === 'board' && (
          <ProductionBoard onOpenVerification={() => setSection('verify')} />
        )}
        {section === 'verify' && <VerificationQueue />}
      </div>
    </div>
  )
}