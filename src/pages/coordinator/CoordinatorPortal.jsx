// src/pages/coordinator/CoordinatorPortal.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { getVerificationQueue } from '../../api/coordinator'
import ProductionBoard from '../../components/coordinator/ProductionBoard'
import VerificationQueue from '../../components/coordinator/VerificationQueue'

const SECTIONS = [
  {
    group: 'WORKSPACE',
    items: [
      { id: 'board',  label: 'Production' },
      { id: 'verify', label: 'To verify'  },
    ],
  },
]

/**
 * The back room. The coordinator moves work through the floor and checks
 * what arrives remotely; they never meet a customer at the counter and
 * never touch money.
 */
export default function CoordinatorPortal() {
  const { user, logout } = useAuth()
  const [section, setSection] = useState('board')

  // The count rides in the sidebar so it is visible from either section,
  // not only from the board.
  const { data: queue = [] } = useQuery({
    queryKey: ['verificationQueue'],
    queryFn:  () => getVerificationQueue().then(r => r.data),
    refetchInterval: 30_000,
  })

  const today = new Date().toLocaleDateString('en-GH', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Topbar */}
      <div className="bg-[var(--panel)] border-b border-[var(--border)]
        px-5 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-black text-lg text-[var(--text)] tracking-tight">
            Octos
          </span>
          <span className="w-px h-7 bg-[var(--border)]" />
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-[var(--text-3)]
              uppercase tracking-wider">
              Flow Coordinator
            </div>
            <div className="text-xs font-semibold text-[var(--text)] truncate">
              {user?.branch_detail?.name || '—'}
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

      {/* Info strip — what a coordinator needs at a glance, which is not
          money. Machine status belongs here once machines can be marked
          down from the portal. */}
      <div className="bg-[var(--panel)] border-b border-[var(--border)]
        px-5 sm:px-6 py-2.5 flex items-center gap-5 flex-wrap
        text-[11px] text-[var(--text-3)]">
        <span>
          BRANCH <span className="font-semibold text-[var(--text)] ml-1">
            {user?.branch_detail?.name || '—'}
          </span>
        </span>
        <span>
          DATE <span className="font-semibold text-[var(--text)] ml-1">{today}</span>
        </span>
        <span>
          ON THE FLOOR <span className="font-semibold text-[var(--text)] ml-1">—</span>
        </span>
        <span>
          MACHINES <span className="font-semibold text-[var(--text)] ml-1">—</span>
        </span>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 min-h-[calc(100vh-108px)]
          bg-[var(--panel)] border-r border-[var(--border)] px-3 py-5 hidden sm:block">
          {SECTIONS.map(group => (
            <div key={group.group} className="mb-6">
              <div className="text-[10px] font-bold text-[var(--text-3)]
                uppercase tracking-wider px-3 mb-2">
                {group.group}
              </div>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <button key={item.id} onClick={() => setSection(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2
                      rounded-xl text-sm font-semibold transition-colors
                      ${section === item.id
                        ? 'bg-[var(--bg)] text-[var(--text)]'
                        : 'text-[var(--text-2)] hover:text-[var(--text)]'}`}>
                    <span>{item.label}</span>
                    {item.id === 'verify' && queue.length > 0 && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full
                        bg-amber-100 text-amber-700">
                        {queue.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* Mobile section switcher, since the sidebar is hidden there */}
        <div className="flex-1 min-w-0">
          <div className="sm:hidden px-5 pt-4">
            <div className="flex gap-1 bg-[var(--panel)] border border-[var(--border)]
              p-1 rounded-2xl">
              {SECTIONS[0].items.map(item => (
                <button key={item.id} onClick={() => setSection(item.id)}
                  className={`flex-1 py-2 text-sm font-bold rounded-xl transition-colors
                    ${section === item.id
                      ? 'bg-[var(--text)] text-white shadow-sm'
                      : 'text-[var(--text-3)]'}`}>
                  {item.label}
                  {item.id === 'verify' && queue.length > 0 && ` · ${queue.length}`}
                </button>
              ))}
            </div>
          </div>

          {section === 'board' && (
            <ProductionBoard onOpenVerification={() => setSection('verify')} />
          )}
          {section === 'verify' && <VerificationQueue />}
        </div>
      </div>
    </div>
  )
}