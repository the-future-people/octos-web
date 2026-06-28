// src/pages/bm/BMPortal.jsx
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import useBranchSocket from '../../hooks/useBranchSocket'
import BMTopbar from '../../components/bm/BMTopbar'
import BMSidebar from '../../components/bm/BMSidebar'
import BMInfoStrip from '../../components/bm/BMInfoStrip'
import Overview from '../../components/bm/Overview'
import DaySheet from '../../components/bm/DaySheet'
import Jobs from '../../components/bm/Jobs'
import Customers from '../../components/bm/Customers'
import Reports    from '../../components/bm/Reports'
import Inventory  from '../../components/bm/Inventory'
import Catalogue    from '../../components/bm/Catalogue'
import Performance  from '../../components/bm/Performance'
import Staff        from '../../components/bm/Staff'
import Inbox        from '../../components/bm/Inbox'
import DailyGreeting from '../../components/layout/DailyGreeting'
import PersonalNotes from '../../components/shared/PersonalNotes'
import { useQuery } from '@tanstack/react-query'
import { getDueReminders } from '../../api/personalNotes'

const SECTIONS = [
  {
    group: 'WORKSPACE',
    items: [
      { id: 'overview',    label: 'Overview',        icon: 'grid'     },
      { id: 'daysheet',    label: 'Day Sheet',        icon: 'calendar' },
      { id: 'jobs',        label: 'Jobs',             icon: 'briefcase'},
      { id: 'inbox',       label: 'Inbox',            icon: 'inbox'    },
      { id: 'notes',       label: 'My Notes',         icon: 'lock'     },
    ]
  },
  {
    group: 'BRANCH',
    items: [
      { id: 'performance', label: 'Performance',      icon: 'chart'    },
      { id: 'catalogue',   label: 'Catalogue',        icon: 'tag'      },
      { id: 'staff',       label: 'Staff',            icon: 'users'    },
      { id: 'inventory',   label: 'Inventory',        icon: 'box'      },
      { id: 'customers',   label: 'Customers',        icon: 'person'   },
      { id: 'reports',     label: 'Reports & Filing', icon: 'file'     },
    ]
  }
]

function GenericReminderNudge({ onView, onDismiss }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden
        bg-[var(--panel)] border-2 border-[var(--border)]">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--bg)] flex items-center
            justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" className="text-[var(--text-2)]">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h3 className="text-base font-black text-[var(--text)]">
            You have a reminder waiting
          </h3>
          <p className="text-xs text-[var(--text-3)] mt-1.5 max-w-xs mx-auto">
            One of your private notes needs attention. Enter your PIN to view it.
          </p>
        </div>
        <div className="px-6 pb-6 space-y-2">
          <button
            onClick={onView}
            className="w-full py-2.5 bg-[var(--text)] text-white text-sm font-bold
              rounded-xl hover:opacity-90 transition-opacity">
            View My Notes
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-2.5 bg-[var(--bg)] text-[var(--text-2)] text-sm font-bold
              rounded-xl hover:bg-[var(--border)] transition-colors">
            Remind me later
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BMPortal() {
  const { user, logout } = useAuth()
  useBranchSocket()
  const [activeSection, setActiveSection] = useState('overview')
  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)

  const { data: dueReminders } = useQuery({
    queryKey: ['dueReminders'],
    queryFn:  () => getDueReminders().then(r => r.data),
    refetchInterval: 30_000,
  })

  const hasDueReminder = (dueReminders?.checkpoints?.length > 0 || dueReminders?.notes?.length > 0)
  const onNotesPage    = activeSection === 'notes'
  const showNudge      = hasDueReminder && !onNotesPage && !nudgeDismissed

  const handleNav = (id) => {
    setActiveSection(id)
    setMobileOpen(false)
    if (id === 'notes') setNudgeDismissed(false)
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'overview': return <Overview onNavigate={handleNav} />
      case 'daysheet': return <DaySheet />
      case 'jobs':       return <Jobs />
      case 'customers':  return <Customers />
      case 'reports':    return <Reports />
      case 'inventory':  return <Inventory />
      case 'catalogue':   return <Catalogue />
      case 'performance': return <Performance />
      case 'staff':       return <Staff />
      case 'inbox':       return <Inbox />
      case 'notes':       return <PersonalNotes onIdleRedirect={() => setActiveSection('overview')} />
      default:
        const label = SECTIONS.flatMap(s => s.items).find(i => i.id === activeSection)?.label
        return <Placeholder label={label} />
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg)]">
      <DailyGreeting />

      {/* Topbar */}
      <BMTopbar
        user={user}
        onLogout={logout}
        onMenuToggle={() => setMobileOpen(o => !o)}
        showMenu={mobileOpen}
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden justify-center">
        <div className="flex w-full max-w-6xl">

          {/* Sidebar */}
          <BMSidebar
            sections={SECTIONS}
            active={activeSection}
            onNavigate={handleNav}
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
          />

          {/* Main */}
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            <BMInfoStrip user={user} />
            <div className="flex-1 overflow-y-auto">
              <div key={activeSection} className="animate-pageFade">
                {renderContent()}
              </div>
            </div>
          </main>

        </div>
      </div>
    {showNudge && (
        <GenericReminderNudge
          onView={() => { setActiveSection('notes'); setMobileOpen(false) }}
          onDismiss={() => setNudgeDismissed(true)}
        />
      )}
    </div>
  )
}

function Placeholder({ label }) {
  return (
    <div className="flex items-center justify-center h-40 text-sm text-[var(--text-3)]">
      {label || 'Coming soon'}
    </div>
  )
}