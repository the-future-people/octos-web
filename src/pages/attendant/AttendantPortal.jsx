// src/pages/attendant/AttendantPortal.jsx
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import useBranchSocket from '../../hooks/useBranchSocket'
import { getLockStatus } from '../../api/bm'
import { getSignOffStatus } from '../../api/attendant'
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
import AttendantCollect    from '../../components/attendant/AttendantCollect'
import ClaimStrip          from '../../components/attendant/ClaimStrip'
import SignOffBanner       from '../../components/attendant/SignOffBanner'
import AttendantSignOffWizard from '../../components/attendant/AttendantSignOffWizard'
import Inbox               from '../../components/bm/Inbox'
import NewJobModal         from '../../components/bm/NewJobModal'
import NewCustomerModal    from '../../components/bm/NewCustomerModal'
import DailyGreeting       from '../../components/layout/DailyGreeting'
import NavBadge, { NavDot } from '../../components/shared/NavBadge'
import useInboxBadge      from '../../hooks/useInboxBadge'

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
    key: 'collect', label: 'Collect', section: 'WORKSPACE',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>
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
  const [showSignOff,   setShowSignOff]   = useState(false)

  const { data: sheet } = useQuery({
    queryKey: ['sheet-today'],
    queryFn:  getSheetToday,
    staleTime: 60_000,
    retry: false,
  })

  // Poll branch lock status — drives the Sunday/holiday overlay and tells us
  // when recording has closed (can_create_jobs flips at job_lock_at).
  const { data: lockData } = useQuery({
    queryKey: ['lockStatus'],
    queryFn:  () => getLockStatus().then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 0,
  })

  // The attendant's end of day (13 Nov 2026): phase, times, and whether she
  // has signed off. Recording closing no longer locks the portal; only
  // signing off does, so she can still answer customers and sign off.
  const { data: signOff } = useQuery({
    queryKey: ['attendantSignoff'],
    queryFn:  () => getSignOffStatus().then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 0,
  })

  const recordingClosed  = lockData ? !lockData.can_create_jobs : false
  const isSignedOff      = !!signOff?.is_signed_off
  const canSignOff       = !!signOff?.can_sign_off
  const showPortalLocked = lockData?.is_today_sunday || lockData?.is_today_holiday || isSignedOff
  const reminder = useReminders()
  // The inbox's badge on the menu: unread chats, and chats that need a person.
  const badge = useInboxBadge()

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
          recordingClosed={recordingClosed}
        />
      )
      case 'collect':     return <AttendantCollect />
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
          recordingClosed={recordingClosed}
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
                              ? 'octos-nav-active'
                              : 'text-[var(--text-2)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
                            }`}>
                          <span className="shrink-0">{item.icon}</span>
                          {item.label}
                          {item.key === 'inbox' && <NavBadge {...badge} />}
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
                            ? 'octos-nav-active'
                            : 'text-[var(--text-2)] hover:bg-[var(--bg)] font-medium'
                          }`}>
                        <span className="shrink-0">{item.icon}</span>
                        {item.label}
                        {item.key === 'inbox' && <NavBadge {...badge} />}
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
                      className={`relative w-full flex items-center justify-center py-3
                        transition-colors
                        ${page === item.key
                          ? 'octos-nav-active octos-nav-icon'
                          : 'text-[var(--text-2)] hover:bg-[var(--bg)]'
                        }`}>
                      {item.icon}
                      {item.key === 'inbox' && <NavDot {...badge} />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Files arriving now: above every page, drawn only when someone is waiting */}
            {!showPortalLocked && <ClaimStrip />}
            {!showPortalLocked && (
              <SignOffBanner status={signOff} onStart={() => setShowSignOff(true)} />
            )}
            <div className="flex-1 overflow-y-auto">
              <div key={page} className="animate-pageFade">
                {renderPage()}
              </div>
            </div>
          </main>

        </div>
      </div>

      {/* Portal lock — Sunday, holiday, or signed off for the day. Takes
          priority over everything else on this portal. */}
      {showPortalLocked && (
        <PortalLockedOverlay lockData={lockData} isLocked={isSignedOff} />
      )}

      {/* Harmonized reminder system — same hook/component as every
          other portal. Attendants get the half-hour shift-ending
          reminders, then "minutes left to sign off" with a way into
          sign-off, and personal-notes checkpoints. */}
      {!showPortalLocked && !showSignOff && reminder.hasReminder && (
        <ReminderModal
          reminder={reminder.current}
          onDismiss={reminder.dismiss}
          isDismissing={reminder.isDismissing}
          onSignOff={
            reminder.current?.link === 'signoff' && canSignOff
              ? () => setShowSignOff(true)
              : undefined
          }
        />
      )}

      {!showPortalLocked && showSignOff && canSignOff && (
        <AttendantSignOffWizard
          firstName={user?.first_name}
          onClose={() => setShowSignOff(false)}
          onLogout={logout}
        />
      )}

      {/* Modals — lifted to portal level. No new job once recording has
          closed; the server refuses it too. */}
      {!showPortalLocked && !recordingClosed && showNewJob && (
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