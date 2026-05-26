// src/pages/cashier/CashierPortal.jsx
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import CashierTopbar from '../../components/cashier/CashierTopbar'
import InfoStrip from '../../components/cashier/InfoStrip'
import SummaryStrip from '../../components/cashier/SummaryStrip'
import PaymentQueue from '../../components/cashier/PaymentQueue'

const TABS = [
  { id: 'queue',    label: 'Payment Queue',  section: 'STATION'     },
  { id: 'receipts', label: 'Receipts',       section: 'STATION'     },
  { id: 'log',      label: "Today's Log",    section: 'STATION'     },
  { id: 'credit',   label: 'Credit Accounts', section: 'COLLECTIONS' },
]

export default function CashierPortal() {
  const { user, logout } = useAuth()
  const [activeTab,   setActiveTab]   = useState('queue')
  const [mobileOpen,  setMobileOpen]  = useState(false)

  const handleTabClick = (id) => {
    setActiveTab(id)
    setMobileOpen(false) // close overlay on mobile after selection
  }

  const SidebarContent = () => (
    <>
      {['STATION', 'COLLECTIONS'].map(section => (
        <div key={section}>
          <div className="px-4 pt-3 pb-1">
            <span className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest">
              {section}
            </span>
          </div>
          {TABS.filter(t => t.section === section).map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                ${activeTab === tab.id
                  ? 'bg-[var(--bg)] text-[var(--text)] font-semibold'
                  : 'text-[var(--text-2)] hover:bg-[var(--bg)] font-medium'
                }`}
            >
              {/* Icon + label on medium, icon only on collapsed */}
              <span className="md:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      ))}
    </>
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

          {/* Mobile overlay sidebar — visible only when mobileOpen */}
          {mobileOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/30 z-20 sm:hidden"
                onClick={() => setMobileOpen(false)}
              />
              {/* Slide-in sidebar */}
              <div className="fixed top-14 left-0 bottom-0 w-52 bg-[var(--panel)]
                border-r border-[var(--border)] z-30 sm:hidden overflow-y-auto pt-2">
                <SidebarContent />
              </div>
            </>
          )}

          {/* Desktop sidebar — full labels (md+), hidden on mobile */}
          <aside className="hidden sm:flex md:w-48 sm:w-14 shrink-0 bg-[var(--panel)]
            border-r border-[var(--border)] flex-col pt-3 overflow-y-auto">

            {['STATION', 'COLLECTIONS'].map(section => (
              <div key={section}>
                {/* Section label — hidden on collapsed sidebar */}
                <div className="px-4 pt-3 pb-1 md:block hidden">
                  <span className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest">
                    {section}
                  </span>
                </div>
                <div className="md:hidden px-2 pt-3 pb-1">
                  <div className="h-px bg-[var(--border)]" />
                </div>

                {TABS.filter(t => t.section === section).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    title={tab.label}
                    className={`w-full text-left transition-colors
                      md:px-4 md:py-2.5 px-0 py-2.5
                      flex md:block items-center justify-center
                      text-sm
                      ${activeTab === tab.id
                        ? 'bg-[var(--bg)] text-[var(--text)] font-semibold'
                        : 'text-[var(--text-2)] hover:bg-[var(--bg)] font-medium'
                      }`}
                  >
                    {/* Label — shown on md+, hidden on sm collapsed */}
                    <span className="hidden md:inline">{tab.label}</span>
                    {/* Dot indicator — shown on sm collapsed */}
                    <span className={`md:hidden w-1.5 h-1.5 rounded-full
                      ${activeTab === tab.id ? 'bg-[var(--text)]' : 'bg-[var(--border-dark)]'}`}
                    />
                  </button>
                ))}
              </div>
            ))}
          </aside>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">

            {/* Info strip — always visible */}
            <div className="shrink-0 bg-[var(--panel)] border-b border-[var(--border)]">
              <InfoStrip />
            </div>

            {/* Summary strip — payment queue only */}
            {activeTab === 'queue' && (
              <div className="shrink-0 border-b border-[var(--border)]">
                <SummaryStrip />
              </div>
            )}

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {activeTab === 'queue'    && <PaymentQueue />}
              {activeTab === 'receipts' && <Placeholder label="Receipts" />}
              {activeTab === 'log'      && <Placeholder label="Today's Log" />}
              {activeTab === 'credit'   && <Placeholder label="Credit Accounts" />}
            </div>

          </div>

        </div>
      </div>
    </div>
  )
}

function Placeholder({ label }) {
  return (
    <div className="flex items-center justify-center h-40 text-sm text-[var(--text-3)]">
      {label} — coming soon
    </div>
  )
}