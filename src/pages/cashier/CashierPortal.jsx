// src/pages/cashier/CashierPortal.jsx
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import useBranchSocket from '../../hooks/useBranchSocket'
import { getShiftStatus, getPaymentQueue } from '../../api/cashier'
import CashierTopbar from '../../components/cashier/CashierTopbar'
import InfoStrip from '../../components/cashier/InfoStrip'
import SummaryStrip from '../../components/cashier/SummaryStrip'
import PaymentQueue from '../../components/cashier/PaymentQueue'
import MyShift from '../../components/cashier/MyShift'
import CreditAccounts from '../../components/cashier/CreditAccounts'
import FloatAcknowledgeModal from '../../components/cashier/FloatAcknowledgeModal'
import IntakeHeldModal from '../../components/cashier/IntakeHeldModal'
import SignOffWizard from '../../components/cashier/SignOffWizard'
import PortalLockedOverlay from '../../components/shared/PortalLockedOverlay'
import ReminderModal from '../../components/shared/ReminderModal'
import DailyGreeting from '../../components/layout/DailyGreeting'
import useReminders from '../../hooks/useReminders'
import { getLockStatus } from '../../api/bm'

// Outline icons, in the redesign's style (13 Nov 2026).
const tabIcon = d => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)

// Receipts and Today's Log were two views of the same thing: both now live in
// My shift, with the drawer and the cashier's own numbers (13 Nov 2026).
const TABS = [
  {
    id: 'queue', label: 'Payment queue', section: 'STATION',
    icon: tabIcon(<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" /></>),
  },
  {
    id: 'shift', label: 'My shift', section: 'STATION',
    icon: tabIcon(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>),
  },
  {
    id: 'credit', label: 'Credit Accounts', section: 'COLLECTIONS',
    icon: tabIcon(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />),
  },
]

export default function CashierPortal() {
  const { user, logout } = useAuth()
  useBranchSocket()
  const [activeTab,          setActiveTab]          = useState('queue')
  const [mobileOpen,         setMobileOpen]         = useState(false)
  const [showSignOff,        setShowSignOff]         = useState(false)
  const [pendingJobs,        setPendingJobs]         = useState(0)
  const [deferUntil,         setDeferUntil]          = useState(0)
  const reminder = useReminders()

  // Poll shift status every 30s
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

  // No float attached to today's sheet. Usually means a previous day was
  // never closed, since the next day's float is only staged during close.
  // Payments still record correctly against the sheet, so she keeps working —
  // but the header will show blanks and she deserves to know why.
  const noFloatToday = !!shiftData && !floatId && !isSignedOff

  // Portal-lock overlay takes precedence over everything else once true.
  // The sign-off wizard now owns its full success+countdown+logout
  // lifecycle internally, so no separate bridging state is needed here.
  const showPortalLocked = lockData?.is_today_sunday || lockData?.is_today_holiday || isSignedOff

  // Show intake-held modal — only after float is acknowledged, per
  // business rule: float comes first (near-certain, daily), intake-held
  // resolution second (conditional, only when overnight jobs exist).
  // Must also respect showPortalLocked. Starts false: IntakeHeldModal
  // reports what it actually finds via onPendingChange.
  const [intakeHeldPending, setIntakeHeldPending] = useState(false)
  const showIntakeHeld = !showFloatAck && !showPortalLocked && intakeHeldPending

  // Sign-off opens when she asks for it, or by itself when time is up
  // (shouldLock) or the float awaits sign-off. Worked out while drawing,
  // not set by an effect (13 Nov 2026). should_lock stays true all evening,
  // so "later" (deferUntil) hides it for 15 minutes, then it comes back.
  const signOffDue = (shouldLock || floatStatus === 'PENDING_SIGNOFF') && !!floatId && !isSignedOff && !deferUntil
  const signOffOpen = showSignOff || signOffDue

  // Clearing the deferral makes sign-off due again, which reopens the wizard.
  // The shift reminder keeps firing every five minutes in the meantime, so
  // sign-off can be postponed but not forgotten.
  useEffect(() => {
    if (!deferUntil) return
    const t = setTimeout(() => setDeferUntil(0), Math.max(deferUntil - Date.now(), 0))
    return () => clearTimeout(t)
  }, [deferUntil])

  const deferSignOff = () => {
    setShowSignOff(false)
    setDeferUntil(Date.now() + 15 * 60_000)
  }

  // Fetch pending job count for sign-off step 1
  useEffect(() => {
    if (signOffOpen && shiftData?.sheet_id) {
      getPaymentQueue().then(r => {
        const data = r.data
        const items = Array.isArray(data) ? data : (data?.results || [])
        setPendingJobs(items.length)
      }).catch(() => setPendingJobs(0))
    }
  }, [signOffOpen, shiftData?.sheet_id])

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

            {noFloatToday && (
              <div className="shrink-0 px-4 sm:px-5 py-3 bg-amber-50 border-b border-amber-200">
                <div className="flex items-start gap-2.5">
                  <span className="text-amber-500 text-sm mt-0.5">&#9432;</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-amber-900">
                      No float set for today yet
                    </div>
                    <div className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                      Your Branch Manager still has a previous day to close. Carry on
                      as normal — every payment you take is being recorded against
                      today&rsquo;s sheet. The float and shift details will appear once
                      that day is settled.
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'queue' && (
              <div className="shrink-0 border-b border-[var(--border)]">
                <SummaryStrip />
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {activeTab === 'queue'    && <PaymentQueue />}
              {activeTab === 'shift'    && <MyShift onSignOff={floatId && !isSignedOff ? () => setShowSignOff(true) : undefined} />}
              {activeTab === 'credit'   && <CreditAccounts />}
            </div>
          </div>

        </div>
      </div>

      {/* ── Modals ── */}

      {/* Greeting waits until the float is acknowledged and nothing is
          locking the portal — she has counted her cash before being
          welcomed, not during. */}
      <DailyGreeting enabled={!showFloatAck && !showPortalLocked && !!floatId} />

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
          onSignOff={
            reminder.current?.link === 'signoff' && floatId && !isSignedOff
              ? () => setShowSignOff(true)
              : undefined
          }
        />
      )}

      {/* Intake-held handover — only after float ack clears */}
      {!showFloatAck && !showPortalLocked && (
        <IntakeHeldModal onPendingChange={setIntakeHeldPending} />
      )}

      {/* Sign-off wizard — triggered at shift end or PENDING_SIGNOFF.
          Owns its own success message, countdown, and real logout
          internally — no separate overlay or bridging state needed. */}
      {!showPortalLocked && signOffOpen && !showFloatAck && !showIntakeHeld && floatId && !isSignedOff && (
        <SignOffWizard
          floatId={floatId}
          expectedCash={expectedCash}
          openingFloat={openingFloat}
          pendingJobs={pendingJobs}
          firstName={user?.first_name}
          onLogout={logout}
          onDefer={deferSignOff}
        />
      )}

    </div>
  )
}
