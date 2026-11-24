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
import AttendantJobs       from '../../components/attendant/AttendantJobs'
import AttendantServices   from '../../components/attendant/AttendantServices'
import HandoverNotes       from '../../components/attendant/HandoverNotes'
import AttendantCollect    from '../../components/attendant/AttendantCollect'
import AttendantWork       from '../../components/attendant/AttendantWork'
import DeskArrival         from '../../components/attendant/DeskArrival'
import { deskQuery, needsHands } from '../../api/desk'
import ClaimStrip          from '../../components/attendant/ClaimStrip'
import SignOffBanner       from '../../components/attendant/SignOffBanner'
import AttendantSignOffWizard from '../../components/attendant/AttendantSignOffWizard'
import Inbox               from '../../components/bm/Inbox'
import NewJobModal         from '../../components/bm/NewJobModal'
import NewCustomerModal    from '../../components/bm/NewCustomerModal'
import DailyGreeting       from '../../components/layout/DailyGreeting'
import NavBadge, { NavDot } from '../../components/shared/NavBadge'
import useInboxBadge      from '../../hooks/useInboxBadge'
import BMInfoStrip         from '../../components/bm/BMInfoStrip'
import OnShift             from '../../components/bm/OnShift'
import IdleCheck           from '../../components/attendant/IdleCheck'

const getSheetToday = () => client.get('/api/v1/finance/sheets/today/').then(r => r.data)

// Sidebar (13 Nov 2026): Today, Pickup, Jobs, Inbox, Price list.
// Work joined on 14 Nov 2026: front-desk jobs that come to the attendants.
// My Jobs, Branch Jobs and Drafts became one Jobs tab; Collect became Pickup
// (it will grow to every ready job, not only online orders); Services is
// what the counter uses it for, a price list. New icons on 16 Nov 2026.
// No Customers tab: attendants register customers from Today's band and
// from New job, and look them up there.
const icon = (children) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)
const NAV = [
  {
    key: 'overview', label: 'Today', section: 'WORKSPACE',
    // A sun: the day at a glance
    icon: icon(<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>),
  },
  {
    key: 'work', label: 'Work', section: 'WORKSPACE',
    // A bell at the counter: work that came to the front desk
    icon: icon(<><path d="M4 18h16"/><path d="M6 18a6 6 0 0 1 12 0"/><path d="M12 9V7"/><path d="M10 7h4"/></>),
  },
  {
    key: 'collect', label: 'Pickup', section: 'WORKSPACE',
    // A bag going home
    icon: icon(<><path d="M6 7h12l1 13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></>),
  },
  {
    key: 'jobs', label: 'Jobs', section: 'WORKSPACE',
    // A clipboard with lines
    icon: icon(<><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h3"/></>),
  },
  {
    key: 'inbox', label: 'Inbox', section: 'BRANCH',
    // A speech bubble: chats
    icon: icon(<><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></>),
  },
  {
    key: 'services', label: 'Price list', section: 'BRANCH',
    // A price tag
    icon: icon(<><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></>),
  },
]

// Front-desk jobs nobody has taken yet: a red count on Work, so the menu
// says it even when the arrival alert is waiting behind a modal.
function WorkCount({ n, dot }) {
  if (!n) return null
  if (dot) return <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#D92D20]" />
  return (
    <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-[#D92D20] text-white
      text-[11px] font-bold flex items-center justify-center">{n}</span>
  )
}

export default function AttendantPortal() {
  const { user, logout } = useAuth()
  useBranchSocket()

  const [page,          setPage]          = useState('overview')
  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [showNewJob,    setShowNewJob]    = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [showSignOff,   setShowSignOff]   = useState(false)
  const [jobsView,      setJobsView]      = useState('mine')
  // A chat to open in the Inbox, and a chat to record a job for (Today's scan-in card)
  const [inboxFocus,    setInboxFocus]    = useState(null)
  const [chatJob,       setChatJob]       = useState(null)

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
  const canSignOff       = !!signOff?.can_sign_off
  // Locked once she has signed off, the day sheet has closed, or the deadline
  // has passed with nothing for her to sign off (the server decides).
  const isLocked         = !!signOff?.is_locked
  const showPortalLocked = lockData?.is_today_sunday || lockData?.is_today_holiday || isLocked
  const morning          = signOff?.phase === 'OPEN' || signOff?.phase === 'CLOSING_SOON'
  const reminder = useReminders()
  // Front-desk work: shared with the Work tab and the arrival alert.
  const { data: desk } = useQuery(deskQuery)
  const waitingWork = (desk?.jobs || []).filter(needsHands).length
  // The inbox's badge on the menu: unread chats, and chats that need a person.
  const badge = useInboxBadge()

  const sections = [...new Set(NAV.map(n => n.section))]

  // Older links (from Today's cards) still say my-jobs, branch-jobs or drafts.
  const handleNav = (id) => {
    const legacy = { 'my-jobs': 'mine', 'drafts': 'mine', 'branch-jobs': 'branch' }
    if (legacy[id]) { setJobsView(legacy[id]); id = 'jobs' }
    if (id === 'inbox') setInboxFocus(null)
    setPage(id)
    setMobileOpen(false)
  }

  // Today's "Her chat" and "chats handed to you": the Inbox, at that chat.
  const openChat = (id) => {
    setInboxFocus({ id, at: Date.now() })
    setPage('inbox')
    setMobileOpen(false)
  }

  const today = (
    <AttendantOverview
      onNavigate={handleNav}
      onNewJob={() => setShowNewJob(true)}
      onRegisterCustomer={() => setShowNewCustomer(true)}
      onOpenChat={openChat}
      onStartChatJob={setChatJob}
      recordingClosed={recordingClosed}
    />
  )

  const renderPage = () => {
    switch (page) {
      case 'overview':    return (
        <>
        {morning && <HandoverNotes notes={signOff?.handover_notes} />}
        {today}
        </>
      )
      case 'work':        return <AttendantWork />
      case 'collect':     return <AttendantCollect />
      case 'jobs':        return <AttendantJobs key={jobsView} sheet={sheet} initialView={jobsView} />
      case 'inbox':       return <Inbox focus={inboxFocus} />
      case 'services':    return <AttendantServices />
      default:            return today
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
        signOff={signOff}
      />
      {/* Belt, date, floor load, machines up, promises kept: the same strip as the manager's */}
      <BMInfoStrip user={user} />

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
                          {item.key === 'work' && <WorkCount n={waitingWork} />}
                        </button>
                      ))}
                    </div>
                  ))}
                </nav>
                <OnShift />
              </div>
            </>
          )}

          {/* Desktop sidebar — icon only on sm, full on md+ */}
          <aside className="hidden sm:flex md:w-56 sm:w-12 shrink-0 bg-[var(--panel)]
            border-r border-[var(--border)] flex-col overflow-y-auto">

            {/* Full labels — md+, with who is on shift at the foot */}
            <div className="hidden md:flex flex-col min-h-full pt-3">
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
                        {item.key === 'work' && <WorkCount n={waitingWork} />}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
              <div className="mt-auto pt-3"><OnShift /></div>
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
                      {item.key === 'work' && <WorkCount n={waitingWork} dot />}
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

      {/* A front-desk job has landed: the full alert when she's free, a bar
          above everything while New Job, Register Customer or sign-off is
          open, so her work is never covered. Taking it opens Work, unless
          she took it from the bar mid-task. */}
      {!showPortalLocked && (
        <DeskArrival
          busy={showNewJob || showNewCustomer || showSignOff || !!chatJob}
          onTaken={({ fromBar }) => { if (!fromBar) handleNav('work') }}
        />
      )}

      {/* Portal lock — Sunday, holiday, or signed off for the day. Takes
          priority over everything else on this portal. */}
      {showPortalLocked && (
        <PortalLockedOverlay lockData={lockData} isLocked={isLocked} />
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
      {!showPortalLocked && !recordingClosed && chatJob && (
        <NewJobModal
          fromChat={chatJob}
          onClose={() => setChatJob(null)}
          onSuccess={() => setChatJob(null)}
        />
      )}
      {/* Thirty quiet minutes: "Hey Kofi, are you there?", and breaks */}
      <IdleCheck user={user} enabled={!showPortalLocked && !showSignOff} />
      {!showPortalLocked && showNewCustomer && (
        <NewCustomerModal
          onClose={() => setShowNewCustomer(false)}
          onSuccess={() => setShowNewCustomer(false)}
        />
      )}
    </div>
  )
}
