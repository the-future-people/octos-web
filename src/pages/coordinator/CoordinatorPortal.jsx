// src/pages/coordinator/CoordinatorPortal.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { getVerificationQueue } from '../../api/coordinator'
import CoordinatorTopbar from '../../components/coordinator/CoordinatorTopbar'
import CoordinatorOverview from '../../components/coordinator/CoordinatorOverview'
import ProductionBoard from '../../components/coordinator/ProductionBoard'

const ICONS = {
  grid: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  briefcase: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
}

const SECTIONS = [
  {
    group: 'WORKSPACE',
    items: [
      { id: 'overview', label: 'Overview',   icon: 'grid'      },
      { id: 'board',    label: 'Production', icon: 'briefcase' },
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

  // The open job lives here rather than in the board, so that stepping
  // over to Overview and back leaves the workspace exactly as it was. A
  // coordinator half way through inspecting a file should not lose it to
  // a glance at the floor.
  //
  // An id, not the job itself: the board re-reads it from fresh data every
  // poll, so a held object cannot go stale against a job the server has
  // since moved on.
  const [openJobId, setOpenJobId] = useState(null)

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
            <CoordinatorTopbar user={user} onLogout={logout} />

      {/* Info strip — what a coordinator needs at a glance, which is not
          money. Machine status belongs here once machines can be marked
          down from the portal. */}
            <div className="bg-[var(--panel)] border-b border-[var(--border)]">
        <div className="w-full max-w-6xl mx-auto px-5 sm:px-6 py-2.5
          flex items-center gap-5 flex-wrap text-[11px] text-[var(--text-3)]">
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
      </div>

        <div className="flex w-full max-w-6xl mx-auto h-[calc(100vh-108px)] overflow-hidden">
        {/* Sidebar */}
        <aside className="w-44 shrink-0 h-full overflow-y-auto
          bg-[var(--panel)] border-r border-[var(--border)] px-2.5 py-5 hidden sm:block">
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
                    <span className="flex items-center gap-2.5">
                      <span className="text-[var(--text-3)]">{ICONS[item.icon]}</span>
                      {item.label}
                    </span>
                      {item.id === 'board' && queue.length > 0 && (
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
                        <div className="flex-1 min-w-0 h-full overflow-y-auto">
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
                  {item.id === 'board' && queue.length > 0 && ` · ${queue.length}`}
                </button>
              ))}
            </div>
          </div>

                    {section === 'overview' && (
            <CoordinatorOverview onGoToProduction={() => setSection('board')} />
          )}
                    {section === 'board' && (
            <ProductionBoard openJobId={openJobId} setOpenJobId={setOpenJobId} />
          )}
        </div>
      </div>
    </div>
  )
}