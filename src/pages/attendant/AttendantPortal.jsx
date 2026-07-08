// src/pages/attendant/AttendantPortal.jsx
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import useBranchSocket from '../../hooks/useBranchSocket'
import { getLockStatus } from '../../api/bm'
import PortalLockedOverlay from '../../components/shared/PortalLockedOverlay'
import ReminderModal from '../../components/shared/ReminderModal'
import useReminders from '../../hooks/useReminders'
import AttendantTopbar     from '../../components/attendant/AttendantTopbar'
import AttendantOverview   from '../../components/attendant/AttendantOverview'
import AttendantMyJobs     from '../../components/attendant/AttendantMyJobs'
import AttendantBranchJobs from '../../components/attendant/AttendantBranchJobs'
import AttendantDrafts     from '../../components/attendant/AttendantDrafts'
import AttendantServices   from '../../components/attendant/AttendantServices'
import AttendantInbox      from '../../components/attendant/AttendantInbox'
import Inbox               from '../../components/bm/Inbox'
import NewJobModal         from '../../components/bm/NewJobModal'
import NewCustomerModal    from '../../components/bm/NewCustomerModal'
import DailyGreeting       from '../../components/layout/DailyGreeting'

const getSheetToday = () => client.get('/api/v1/finance/sheets/today/').then(r => r.data)

const NAV = [
  {
    key: 'overview', label: 'Overview', section: 'WORKSPACE',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>,
  },
  {
    key: 'my-jobs', label: 'My Jobs', section: 'WORKSPACE',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>,
  },
  {
    key: 'branch-jobs', label: 'Branch Jobs', section: 'WORKSPACE',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>,
  },
  {
    key: 'drafts', label: 'Drafts', section: 'WORKSPACE',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>,
  },
  {
    key: 'inbox', label: 'Inbox', section: 'BRANCH',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>,
  },
  {
    key: 'services', label: 'Services', section: 'BRANCH',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      <path d="M4.93 4.93a10 10 0 0 0 0 14.14"/>
    </svg>,
  },
]

export default function AttendantPortal() {
  const { user, logout } = useAuth()
  useBranchSocket()

  const [page,          setPage]          = useState('overview')
  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [showNewJob,    setShowNewJob]    = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)

  const { data: sheet } = useQuery({
    queryKey: ['sheet-today'],
    queryFn:  getSheetToday,
    staleTime: 60_000,
    retry: false,
  })

  // Poll branch lock status — drives the Sunday/holiday/shift-locked overlay.
  // Attendants have no sign-off action yet, so their lock is purely
  // time-based: can_create_jobs flips false once job_lock_at passes.
  const { data: lockData } = useQuery({
    queryKey: ['lockStatus'],
    queryFn:  () => getLockStatus().then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 0,
  })

  const isTimeLocked = lockData ? !lockData.can_create_jobs : false
  const showPortalLocked = lockData?.is_today_sunday || lockData?.is_today_holiday || isTimeLocked
  const reminder = useReminders()

  const sections = [...new Set(NAV.map(n => n.section))]

  const handleNav = (id) => {
    setPage(id)
    setMobileOpen(false)
  }

  const renderPage = () => {
    switch (page) {
      case 'overview':    return (
        <AttendantOverview
          sheet={sheet}
          onNavigate={handleNav}
          onNewJob={() => setShowNewJob(true)}
          onRegisterCustomer={() => setShowNewCustomer(true)}
        />
      )
      case 'my-jobs':     return <AttendantMyJobs sheet={sheet} />
      case 'branch-jobs': return <AttendantBranchJobs sheet={sheet} />
      case 'drafts':      return <AttendantDrafts sheet={sheet} onNavigate={handleNav} />
      case 'inbox':       return <Inbox />
      case 'services':    return <AttendantServices />
      default:            return (
        <AttendantOverview
          sheet={sheet}
          onNavigate={handleNav}
          onNewJob={() => setShowNewJob(true)}
          onRegisterCustomer={() => setShowNewCustomer(true)}
        />
      )
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg)]">
      <DailyGreeting />

      <AttendantTopbar
        user={user}
        onLogout={logout}
        onMenuToggle={() => setMobileOpen(o => !o)}
        showMenu={mobileOpen}
        sheet={sheet}
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden justify-center">
        <div className="flex w-full max-w-6xl">

          {/* Mobile slide-in sidebar */}
          {mobileOpen && (
            <>
              <div className="fixed inset-0 bg-black/30 z-20 sm:hidden"
                onClick={() => setMobileOpen(false)} />
              <div className="fixed top-0 left-0 bottom-0 w-56 bg-[var(--panel)]
                border-r border-[var(--border)] z-30 sm:hidden flex flex-col">
                {/* Mobile header */}
                <div className="flex items-center justify-between px-5 py-4
                  border-b border-[var(--border)] shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-[var(--text)] rounded-lg flex items-center justify-center">
                      <span className="text-white font-black text-xs">O</span>
                    </div>
                    <div>
                      <div className="font-black text-sm text-[var(--text)]">Octos</div>
                      <div className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-wider">
                        Attendant
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setMobileOpen(false)}
                    className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors">✕</button>
                </div>
                {/* Mobile nav */}
                <nav className="flex-1 overflow-y-auto px-3 py-4">
                  {sections.map(section => (
                    <div key={section} className="mb-4">
                      <div className="text-[9px] font-black text-[var(--text-3)] uppercase
                        tracking-widest px-2 mb-1">{section}</div>
                      {NAV.filter(n => n.section === section).map(item => (
                        <button key={item.key} onClick={() => handleNav(item.key)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl
                            text-sm font-semibold transition-colors mb-0.5 text-left
                            ${page === item.key
                              ? 'bg-[var(--text)] text-white'
                              : 'text-[var(--text-2)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
                            }`}>
                          <span className="shrink-0">{item.icon}</span>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </nav>
              </div>
            </>
          )}

          {/* Desktop sidebar — icon only on sm, full on md+ */}
          <aside className="hidden sm:flex md:w-56 sm:w-12 shrink-0 bg-[var(--panel)]
            border-r border-[var(--border)] flex-col overflow-y-auto">

            {/* Full labels — md+ */}
            <div className="hidden md:block pt-3">
              {sections.map(section => (
                <div key={section} className="mb-4">
                  <div className="text-[9px] font-black text-[var(--text-3)] uppercase
                    tracking-widest px-5 pt-3 pb-1">{section}</div>
                  {NAV.filter(n => n.section === section).map(item => (
                    <div key={item.key} className="px-3 py-0.5">
                      <button onClick={() => handleNav(item.key)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-sm
                          transition-colors text-left rounded-lg
                          ${page === item.key
                            ? 'bg-[var(--bg)] text-[var(--text)] font-semibold'
                            : 'text-[var(--text-2)] hover:bg-[var(--bg)] font-medium'
                          }`}>
                        <span className="shrink-0">{item.icon}</span>
                        {item.label}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Icons only — sm */}
            <div className="md:hidden pt-3">
              {sections.map((section, sIdx) => (
                <div key={section}>
                  {sIdx > 0 && (
                    <div className="px-3 pt-2 pb-1">
                      <div className="h-px bg-[var(--border)]" />
                    </div>
                  )}
                  {NAV.filter(n => n.section === section).map(item => (
                    <button key={item.key} onClick={() => handleNav(item.key)}
                      title={item.label}
                      className={`w-full flex items-center justify-center py-3
                        transition-colors
                        ${page === item.key
                          ? 'bg-[var(--bg)] text-[var(--text)]'
                          : 'text-[var(--text-2)] hover:bg-[var(--bg)]'
                        }`}>
                      {item.icon}
                    </button>
                  ))}
                </div>
              ))}
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

      {/* Portal lock — Sunday, holiday, or past job_lock_at. Takes
          priority over everything else on this portal. */}
      {showPortalLocked && (
        <PortalLockedOverlay lockData={lockData} isLocked={isTimeLocked} />
      )}

      {/* Harmonized reminder system — same hook/component as every
          other portal. Attendants get shift-ending reminders (7pm)
          and personal-notes checkpoints, nothing bespoke needed here. */}
      {!showPortalLocked && reminder.hasReminder && (
        <ReminderModal
          reminder={reminder.current}
          onDismiss={reminder.dismiss}
          isDismissing={reminder.isDismissing}
        />
      )}

      {/* Modals — lifted to portal level */}
      {!showPortalLocked && showNewJob && (
        <NewJobModal
          onClose={() => setShowNewJob(false)}
          onSuccess={() => setShowNewJob(false)}
        />
      )}
      {!showPortalLocked && showNewCustomer && (
        <NewCustomerModal
          onClose={() => setShowNewCustomer(false)}
          onSuccess={() => setShowNewCustomer(false)}
        />
      )}
    </div>
  )
}