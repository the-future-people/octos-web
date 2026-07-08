// src/pages/cashier/CashierPortal.jsx
import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import useBranchSocket from '../../hooks/useBranchSocket'
import { getShiftStatus } from '../../api/cashier'
import CashierTopbar from '../../components/cashier/CashierTopbar'
import InfoStrip from '../../components/cashier/InfoStrip'
import SummaryStrip from '../../components/cashier/SummaryStrip'
import PaymentQueue from '../../components/cashier/PaymentQueue'
import Receipts from '../../components/cashier/Receipts'
import TodaysLog from '../../components/cashier/TodaysLog'
import CreditAccounts from '../../components/cashier/CreditAccounts'
import FloatAcknowledgeModal from '../../components/cashier/FloatAcknowledgeModal'
import IntakeHeldModal from '../../components/cashier/IntakeHeldModal'
import SignOffWizard from '../../components/cashier/SignOffWizard'
import PortalLockedOverlay from '../../components/shared/PortalLockedOverlay'
import ReminderModal from '../../components/shared/ReminderModal'
import useReminders from '../../hooks/useReminders'
import { getLockStatus } from '../../api/bm'

const TABS = [
  {
    id: 'queue', label: 'Payment Queue', section: 'STATION',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  {
    id: 'receipts', label: 'Receipts', section: 'STATION',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    id: 'log', label: "Today's Log", section: 'STATION',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
  },
  {
    id: 'credit', label: 'Credit Accounts', section: 'COLLECTIONS',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
]

export default function CashierPortal() {
  const { user, logout } = useAuth()
  useBranchSocket()
  const [activeTab,          setActiveTab]          = useState('queue')
  const [mobileOpen,         setMobileOpen]         = useState(false)
  const [showSignOff,        setShowSignOff]         = useState(false)
  const [pendingJobs,        setPendingJobs]         = useState(0)
  const reminder = useReminders()

  // Poll shift status every 60s
  const { data: shiftData } = useQuery({
    queryKey: ['shiftStatus'],
    queryFn:  () => getShiftStatus().then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 0,
  })

  // Poll branch lock status — drives the Sunday/holiday/shift-ended overlay
  const { data: lockData } = useQuery({
    queryKey: ['lockStatus'],
    queryFn:  () => getLockStatus().then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 0,
  })

  const floatStatus      = shiftData?.float_status
  const floatId          = shiftData?.float_id
  const shouldLock       = shiftData?.should_lock
  const expectedCash     = shiftData?.expected_cash   || 0
  const openingFloat     = shiftData?.opening_float   || 0

  // Show float acknowledge modal — fires on PENDING_ACK (morning)
  const showFloatAck = floatStatus === 'PENDING_ACK' && !!floatId

  const isSignedOff = floatStatus === 'SIGNED_OFF' || shiftData?.is_signed_off

  // Portal-lock overlay takes precedence over everything else once true.
  // The sign-off wizard now owns its full success+countdown+logout
  // lifecycle internally, so no separate bridging state is needed here.
  const showPortalLocked = lockData?.is_today_sunday || lockData?.is_today_holiday || isSignedOff

  // Show intake-held modal — only after float is acknowledged, per
  // business rule: float comes first (near-certain, daily), intake-held
  // resolution second (conditional, only when overnight jobs exist).
  // Must also respect showPortalLocked — otherwise a job left unresolved
  // in the morning keeps rendering this modal all the way into an
  // active evening lock, since intakeHeldPending never resets on its own.
  const [intakeHeldPending, setIntakeHeldPending] = useState(true)
  const showIntakeHeld = !showFloatAck && !showPortalLocked && intakeHeldPending

  // Auto-trigger sign-off when time is up (shouldLock) or PENDING_SIGNOFF
  useEffect(() => {
    if ((shouldLock || floatStatus === 'PENDING_SIGNOFF') && !showSignOff && floatId && !isSignedOff) {
      setShowSignOff(true)
    }
  }, [shouldLock, floatStatus, floatId, showSignOff, isSignedOff])

  // Fetch pending job count for sign-off step 1
  useEffect(() => {
    if (showSignOff && shiftData?.sheet_id) {
      import('../../api/cashier').then(({ getCashierQueue }) => {
        getCashierQueue().then(r => {
          const data = r.data
          const items = Array.isArray(data) ? data : (data?.results || [])
          setPendingJobs(items.length)
        }).catch(() => setPendingJobs(0))
      })
    }
  }, [showSignOff, shiftData?.sheet_id])

  const handleTabClick = (id) => {
    setActiveTab(id)
    setMobileOpen(false)
  }

  const TabButton = ({ tab, collapsed = false }) => (
    <button
      key={tab.id}
      onClick={() => handleTabClick(tab.id)}
      title={tab.label}
      className={`w-full transition-colors text-sm
        ${collapsed
          ? 'flex items-center justify-center py-3'
          : 'flex items-center gap-3 px-4 py-2.5 text-left'
        }
        ${activeTab === tab.id
          ? 'bg-[var(--bg)] text-[var(--text)] font-semibold'
          : 'text-[var(--text-2)] hover:bg-[var(--bg)] font-medium'
        }`}
    >
      <span className="shrink-0">{tab.icon}</span>
      {!collapsed && <span>{tab.label}</span>}
    </button>
  )

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg)]">

      {/* Topbar */}
      <CashierTopbar
        user={user}
        onLogout={logout}
        onMenuToggle={() => setMobileOpen(o => !o)}
        showMenu={mobileOpen}
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden justify-center relative">
        <div className="flex w-full max-w-6xl relative">

          {/* Mobile overlay sidebar */}
          {mobileOpen && (
            <>
              <div className="fixed inset-0 bg-black/30 z-20 sm:hidden"
                onClick={() => setMobileOpen(false)} />
              <div className="fixed top-14 left-0 bottom-0 w-52 bg-[var(--panel)]
                border-r border-[var(--border)] z-30 sm:hidden overflow-y-auto pt-2">
                {['STATION', 'COLLECTIONS'].map(section => (
                  <div key={section}>
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest">
                        {section}
                      </span>
                    </div>
                    {TABS.filter(t => t.section === section).map(tab => (
                      <TabButton key={tab.id} tab={tab} collapsed={false} />
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Desktop sidebar */}
          <aside className="hidden sm:flex md:w-48 sm:w-14 shrink-0 bg-[var(--panel)]
            border-r border-[var(--border)] flex-col pt-3 overflow-y-auto">
            {['STATION', 'COLLECTIONS'].map(section => (
              <div key={section}>
                <div className="md:block hidden px-4 pt-3 pb-1">
                  <span className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest">
                    {section}
                  </span>
                </div>
                <div className="md:hidden px-3 pt-3 pb-1">
                  <div className="h-px bg-[var(--border)]" />
                </div>
                {TABS.filter(t => t.section === section).map(tab => (
                  <div key={tab.id}>
                    <div className="hidden md:block">
                      <TabButton tab={tab} collapsed={false} />
                    </div>
                    <div className="md:hidden">
                      <TabButton tab={tab} collapsed={true} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </aside>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="shrink-0 bg-[var(--panel)] border-b border-[var(--border)]">
              <InfoStrip />
            </div>
            {activeTab === 'queue' && (
              <div className="shrink-0 border-b border-[var(--border)]">
                <SummaryStrip />
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {activeTab === 'queue'    && <PaymentQueue />}
              {activeTab === 'receipts' && <Receipts />}
              {activeTab === 'log'      && <TodaysLog />}
              {activeTab === 'credit'   && <CreditAccounts />}
            </div>
          </div>

        </div>
      </div>

      {/* ── Modals ── */}

      {/* Portal lock — Sunday, holiday, or shift ended. Takes priority
          over everything else, including float acknowledgement, since
          a closed/off day means there's nothing to acknowledge. */}
      {showPortalLocked && (
        <PortalLockedOverlay lockData={lockData} isLocked={isSignedOff} />
      )}

      {/* Float acknowledgement — morning, blocks until done */}
      {!showPortalLocked && showFloatAck && (
        <FloatAcknowledgeModal
          floatId={floatId}
          openingFloat={openingFloat}
          onSuccess={() => {
            // shiftStatus will refetch automatically via invalidation
          }}
        />
      )}

      {/* Harmonized reminder system — replaces the old ShiftEndingModal.
          Backend Celery task generates these; this just displays whatever
          useReminders() surfaces, identically across all three portals. */}
      {!showPortalLocked && reminder.hasReminder && (
        <ReminderModal
          reminder={reminder.current}
          onDismiss={reminder.dismiss}
          isDismissing={reminder.isDismissing}
        />
      )}

      {/* Intake-held handover — only after float ack clears */}
      {showIntakeHeld && (
        <IntakeHeldModal onAllResolved={() => setIntakeHeldPending(false)} />
      )}

      {/* Sign-off wizard — triggered at shift end or PENDING_SIGNOFF.
          Owns its own success message, countdown, and real logout
          internally — no separate overlay or bridging state needed. */}
      {!showPortalLocked && showSignOff && !showFloatAck && !showIntakeHeld && floatId && !isSignedOff && (
        <SignOffWizard
          floatId={floatId}
          expectedCash={expectedCash}
          openingFloat={openingFloat}
          pendingJobs={pendingJobs}
          firstName={user?.first_name}
          onLogout={logout}
        />
      )}

    </div>
  )
}