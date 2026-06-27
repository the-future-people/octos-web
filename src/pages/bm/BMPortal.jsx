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

export default function BMPortal() {
  const { user, logout } = useAuth()
  useBranchSocket()
  const [activeSection, setActiveSection] = useState('overview')
  const [mobileOpen,    setMobileOpen]    = useState(false)

  const handleNav = (id) => {
    setActiveSection(id)
    setMobileOpen(false)
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