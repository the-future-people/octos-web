// src/pages/bm/BMPortal.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import useBranchSocket from '../../hooks/useBranchSocket'
import BMTopbar from '../../components/bm/BMTopbar'
import BMSidebar from '../../components/bm/BMSidebar'
import BMInfoStrip from '../../components/bm/BMInfoStrip'
import Overview from '../../components/bm/Overview'
import DaySheet from '../../components/bm/DaySheet'
import Jobs from '../../components/bm/Jobs'
import ProformasTab from '../../components/bm/ProformasTab'
import Customers from '../../components/bm/Customers'
import Reports    from '../../components/bm/Reports'
import Inventory  from '../../components/bm/Inventory'
import Catalogue    from '../../components/bm/Catalogue'
import Performance  from '../../components/bm/Performance'
import Staff        from '../../components/bm/Staff'
import Inbox        from '../../components/bm/Inbox'
import DailyGreeting from '../../components/layout/DailyGreeting'
import PersonalNotes from '../../components/shared/PersonalNotes'
import ReminderModal from '../../components/shared/ReminderModal'
import WeeklyFilingBlock from '../../components/bm/WeeklyFilingBlock'
import useReminders from '../../hooks/useReminders'
import Workload from '../../components/bm/Workload'
import ErrorBoundary from '../../components/shared/ErrorBoundary'

const SECTIONS = [
  {
    group: 'WORKSPACE',
    items: [
      { id: 'overview',    label: 'Overview',        icon: 'grid'     },
      { id: 'daysheet',    label: 'Day Sheet',        icon: 'calendar' },
      { id: 'jobs',        label: 'Jobs',             icon: 'briefcase'},
      { id: 'proformas',   label: 'Invoices',         icon: 'receipt'  },
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

export default function BMPortal() {
  const { user, logout } = useAuth()
  useBranchSocket()
  const [activeSection, setActiveSection] = useState('overview')
  const [mobileOpen,    setMobileOpen]    = useState(false)
  const reminder = useReminders()
  // A notification opens the page it is about, and the item in it (8 Nov 2026).
  const [focus, setFocus] = useState(null)
  useEffect(() => {
    const open = (e) => {
      const { section, id, filter } = e.detail || {}
      // Only a page this portal has; never "Coming soon" from a notification.
      if (!section || !SECTIONS.some(s => s.items.some(i => i.id === section))) return
      setActiveSection(section)
      setFocus({ section, id, filter, at: Date.now() })
      setMobileOpen(false)
    }
    window.addEventListener('octos:open', open)
    return () => window.removeEventListener('octos:open', open)
  }, [])

  const handleNav = (id) => {
    setActiveSection(id)
    setMobileOpen(false)
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'overview': return <Overview onNavigate={handleNav} />
      case 'pending_payment':
      case 'in_production':
      case 'ready_for_pickup':
      case 'awaiting_feedback':
      case 'overdue':   return <Workload view={activeSection} onNavigate={handleNav}
                                 onOpenJob={id => { setFocus({ section: 'jobs', id, at: Date.now() }); setActiveSection('jobs') }} />
      case 'daysheet': return <DaySheet />
      case 'jobs':       return <Jobs focus={focus?.section === 'jobs' ? focus : null} />
      case 'proformas':  return <ProformasTab />
      case 'customers':  return <Customers />
      case 'reports':    return <Reports />
      case 'inventory':  return <Inventory />
      case 'catalogue':   return <Catalogue />
      case 'performance': return <Performance />
      case 'staff':       return <Staff />
      case 'inbox':       return <Inbox focus={focus?.section === 'inbox' ? focus : null} />
      case 'notes':       return <PersonalNotes onIdleRedirect={() => setActiveSection('overview')} />
      default: {
        const label = SECTIONS.flatMap(s => s.items).find(i => i.id === activeSection)?.label
        return <Placeholder label={label} />
      }
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
<ErrorBoundary key={activeSection} onBack={() => setActiveSection('overview')}>{renderContent()}</ErrorBoundary>
              </div>
            </div>
          </main>

        </div>
      </div>
          {/* Mounted at the portal rather than inside Reports: the block is
          meant to stop work, not wait until the manager happens to open
          the filing page. */}
      <WeeklyFilingBlock onGoToDaySheet={() => handleNav('daysheet')} />

    {reminder.hasReminder && (
        <ReminderModal
          reminder={reminder.current}
          onDismiss={reminder.dismiss}
          isDismissing={reminder.isDismissing}
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