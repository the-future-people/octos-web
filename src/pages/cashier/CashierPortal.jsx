// src/pages/cashier/CashierPortal.jsx
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import CashierTopbar from '../../components/cashier/CashierTopbar'
import InfoStrip from '../../components/cashier/InfoStrip'
import SummaryStrip from '../../components/cashier/SummaryStrip'
import PaymentQueue from '../../components/cashier/PaymentQueue'
import Receipts from '../../components/cashier/Receipts'

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
  const [activeTab, setActiveTab] = useState('queue')
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleTabClick = (id) => {
    setActiveTab(id)
    setMobileOpen(false)
  }

  // Shared tab button used in both mobile overlay and desktop sidebar
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
              <div
                className="fixed inset-0 bg-black/30 z-20 sm:hidden"
                onClick={() => setMobileOpen(false)}
              />
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
                {/* Section label — full sidebar only */}
                <div className="md:block hidden px-4 pt-3 pb-1">
                  <span className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest">
                    {section}
                  </span>
                </div>
                {/* Divider — collapsed sidebar only */}
                <div className="md:hidden px-3 pt-3 pb-1">
                  <div className="h-px bg-[var(--border)]" />
                </div>

                {TABS.filter(t => t.section === section).map(tab => (
                  <div key={tab.id}>
                    {/* Full label version — md+ */}
                    <div className="hidden md:block">
                      <TabButton tab={tab} collapsed={false} />
                    </div>
                    {/* Icon only version — sm collapsed */}
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
              {activeTab === 'queue' && <PaymentQueue />}
              {activeTab === 'receipts' && <Receipts />}
              {activeTab === 'log' && <Placeholder label="Today's Log" />}
              {activeTab === 'credit' && <Placeholder label="Credit Accounts" />}
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