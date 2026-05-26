// src/pages/cashier/CashierPortal.jsx
// Cashier portal — top level shell.
// Handles shift status polling, tab navigation, and layout.

import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import CashierTopbar from '../../components/cashier/CashierTopbar'
import PaymentQueue from '../../components/cashier/PaymentQueue'
import InfoStrip from '../../components/cashier/InfoStrip'
import SummaryStrip from '../../components/cashier/SummaryStrip'

const TABS = [
  { id: 'queue',   label: 'Payment Queue' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'log',     label: "Today's Log" },
  { id: 'credit',  label: 'Credit Accounts' },
]

export default function CashierPortal() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('queue')

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">

      <CashierTopbar user={user} onLogout={logout} />

      <div className="flex flex-1">

        {/* Sidebar */}
        <aside className="w-52 bg-[var(--panel)] border-r border-[var(--border)] flex flex-col pt-4 shrink-0">
          <div className="px-4 mb-2">
            <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
              Station
            </span>
          </div>
          {TABS.slice(0, 3).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium
                transition-colors text-left w-full
                ${activeTab === tab.id
                  ? 'bg-[var(--bg)] text-[var(--text)] font-semibold'
                  : 'text-[var(--text-2)] hover:bg-[var(--bg)]'
                }`}
            >
              {tab.label}
            </button>
          ))}

          <div className="px-4 mt-4 mb-2">
            <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
              Collections
            </span>
          </div>
          <button
            onClick={() => setActiveTab('credit')}
            className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium
              transition-colors text-left w-full
              ${activeTab === 'credit'
                ? 'bg-[var(--bg)] text-[var(--text)] font-semibold'
                : 'text-[var(--text-2)] hover:bg-[var(--bg)]'
              }`}
          >
            Credit Accounts
          </button>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <InfoStrip />
          <SummaryStrip />

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'queue'   && <PaymentQueue />}
            {activeTab === 'receipts' && <div className="text-sm text-[var(--text-3)]">Receipts — coming soon</div>}
            {activeTab === 'log'     && <div className="text-sm text-[var(--text-3)]">Today's Log — coming soon</div>}
            {activeTab === 'credit'  && <div className="text-sm text-[var(--text-3)]">Credit Accounts — coming soon</div>}
          </div>
        </main>

      </div>
    </div>
  )
}
