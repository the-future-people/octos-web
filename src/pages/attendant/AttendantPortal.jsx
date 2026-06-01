// src/pages/attendant/AttendantPortal.jsx
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import AttendantOverview   from '../../components/attendant/AttendantOverview'
import AttendantMyJobs     from '../../components/attendant/AttendantMyJobs'
import AttendantBranchJobs from '../../components/attendant/AttendantBranchJobs'
import AttendantDrafts     from '../../components/attendant/AttendantDrafts'
import AttendantServices   from '../../components/attendant/AttendantServices'
import AttendantInbox      from '../../components/attendant/AttendantInbox'
import DailyGreeting       from '../../components/layout/DailyGreeting'

const getSheetToday = () => client.get('/api/v1/finance/sheets/today/').then(r => r.data)

const NAV = [
  { key: 'overview',    label: 'Overview',     section: 'WORKSPACE',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
  { key: 'my-jobs',     label: 'My Jobs',      section: 'WORKSPACE',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  { key: 'branch-jobs', label: 'Branch Jobs',  section: 'WORKSPACE',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  { key: 'drafts',      label: 'Drafts',       section: 'WORKSPACE',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
  { key: 'inbox',       label: 'Inbox',        section: 'BRANCH',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
  { key: 'services',    label: 'Services',     section: 'BRANCH',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg> },
]

function toTitleCase(str) {
  if (!str) return str
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function UserDropdown({ name, initials, user, logout }) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme || 'light'
  )

  // Close on outside click
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = next
    setTheme(next)
    localStorage.setItem('theme', next)
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl
          hover:bg-[var(--bg)] transition-colors">
        <div className="w-8 h-8 rounded-full bg-[var(--text)] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-black">{initials}</span>
        </div>
        <span className="text-sm font-bold text-[var(--text)] hidden sm:block">{name}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-[var(--text-3)] transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--panel)] border border-[var(--border)]
          rounded-xl shadow-lg z-50 overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <div className="text-sm font-bold text-[var(--text)]">{name}</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">{user?.email}</div>
            <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mt-1">
              {user?.branch_name} · Attendant
            </div>
          </div>
          {/* Theme toggle */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border)]">
            <div className="flex items-center gap-2 text-sm text-[var(--text-2)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              Dark mode
            </div>
            <button onClick={toggleTheme}
              className={`w-10 h-5 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-[var(--text)]' : 'bg-[var(--border-dark)]'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {/* Sign out */}
          <button onClick={() => { setOpen(false); logout() }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold
              text-red-600 hover:bg-red-50 transition-colors text-left">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function DailyTargetWidget({ sheetId }) {
  const { data: statsData } = useQuery({
    queryKey: ['attendant-stats-sidebar', sheetId],
    queryFn:  () => client.get(`/api/v1/jobs/stats/${sheetId ? `?daily_sheet=${sheetId}` : ''}`).then(r => r.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: !!sheetId,
  })

  const personal  = statsData?.personal || {}
  const target    = personal.daily_target || 10
  const myTotal   = personal.my_total || 0
  const progress  = Math.min((myTotal / target) * 100, 100)
  const remaining = Math.max(target - myTotal, 0)

  return (
    <div className="mx-3 mt-3 mb-1 px-3 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
          Daily target — {target} jobs
        </span>
        <span className="text-[10px] font-mono font-bold text-[var(--text)]">{myTotal}/{target}</span>
      </div>
      <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden mb-1.5">
        <div className={`h-full rounded-full transition-all duration-500
          ${progress >= 100 ? 'bg-emerald-500' : progress >= 70 ? 'bg-blue-500' : 'bg-amber-400'}`}
          style={{ width: `${progress}%` }} />
      </div>
      <div className="text-[9px] text-[var(--text-3)]">
        {remaining > 0 ? `${remaining} more to hit target` : '🎉 Target reached!'}
      </div>
      {personal.personal_best && (
        <div className="text-[9px] text-violet-600 font-bold mt-1 truncate">
          Personal best: {personal.personal_best} jobs — {personal.personal_best_date}
        </div>
      )}
    </div>
  )
}

export default function AttendantPortal() {
  const { user, logout } = useAuth()
  const [page, setPage] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data: sheet } = useQuery({
    queryKey: ['sheet-today'],
    queryFn: getSheetToday,
    staleTime: 60_000,
    retry: false,
  })

  const name = toTitleCase(user?.full_name || user?.first_name || 'Attendant')
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const sections = [...new Set(NAV.map(n => n.section))]

  const renderPage = () => {
    switch (page) {
      case 'overview': return <AttendantOverview sheet={sheet} onNavigate={setPage} />
      case 'my-jobs': return <AttendantMyJobs sheet={sheet} />
      case 'branch-jobs': return <AttendantBranchJobs sheet={sheet} />
      case 'drafts': return <AttendantDrafts sheet={sheet} onNavigate={setPage} />
      case 'inbox': return <AttendantInbox />
      case 'services': return <AttendantServices />
      default: return <AttendantOverview sheet={sheet} onNavigate={setPage} />
    }
  }

  const currentNav = NAV.find(n => n.key === page)

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg)]">
      <DailyGreeting />

      {/* Topbar */}
      <header className="bg-[var(--panel)] border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-4 px-4 py-3 mx-auto max-w-6xl">
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="font-bold text-sm text-[var(--text)]">
            <span className="text-[var(--text-3)] font-normal">Attendant · </span>
            {user?.branch_name || 'Westland Branch'}
          </div>
          <div className="flex-1" />
          {/* Status + user */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-600">Active</span>
            </div>
            <UserDropdown name={name} initials={initials} user={user} logout={logout} />
          </div>
        </div>
        {/* Info strip */}
        <div className="border-t border-[var(--border)]">
          <div className="flex items-center gap-6 px-4 py-2 mx-auto max-w-6xl
            text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider overflow-x-auto">
            <span>Branch <span className="text-[var(--text)] normal-case font-semibold">{user?.branch_name || '—'}</span></span>
            <span>Date <span className="text-[var(--text)] normal-case font-semibold">{new Date().toLocaleDateString('en-GH',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</span></span>
            <span>Sheet <span className="text-[var(--text)] normal-case font-semibold">{sheet?.sheet_number || '—'}</span></span>
            <span>Shift Ends <span className="text-[var(--text)] normal-case font-semibold">{sheet?.closing_time || 'No shift'}</span></span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden justify-center">
        <div className="flex w-full max-w-6xl">
          
          {/* Sidebar overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
          )}

          {/* Sidebar */}
          <aside className={`
            fixed inset-y-0 left-0 z-40 w-56 bg-[var(--panel)] border-r border-[var(--border)]
            flex flex-col transition-transform duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:relative lg:translate-x-0 lg:flex
          `}>
            {/* Logo */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-[var(--text)] rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-xs">O</span>
                </div>
                <div>
                  <div className="font-black text-sm text-[var(--text)]">Octos</div>
                  <div className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-wider">Attendant</div>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-[var(--text-3)]">✕</button>
            </div>

            {/* Daily target widget */}
            <DailyTargetWidget sheetId={sheet?.id} />

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              {sections.map(section => (
                <div key={section} className="mb-4">
                  <div className="text-[9px] font-black text-[var(--text-3)] uppercase tracking-widest px-2 mb-1">
                    {section}
                  </div>
                  {NAV.filter(n => n.section === section).map(item => (
                    <button 
                      key={item.key} 
                      onClick={() => { setPage(item.key); setSidebarOpen(false) }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold
                        transition-colors mb-0.5 text-left
                        ${page === item.key
                          ? 'bg-[var(--text)] text-white'
                          : 'text-[var(--text-2)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
                        }`}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
            </nav>

            {/* User — compact bottom */}
            <div className="px-3 py-3 border-t border-[var(--border)] shrink-0">
              <div className="flex items-center gap-2 px-2">
                <div className="w-6 h-6 rounded-full bg-[var(--text)] flex items-center justify-center shrink-0">
                  <span className="text-white text-[9px] font-black">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-[var(--text)] truncate">{name}</div>
                  <div className="text-[9px] text-[var(--text-3)] truncate">{user?.employee_id || '—'}</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="flex-1 overflow-y-auto">
              <div key={page} className="animate-pageFade">
                {renderPage()}
              </div>
            </div>
          </main>

        </div>
      </div>
    </div>
  )
}