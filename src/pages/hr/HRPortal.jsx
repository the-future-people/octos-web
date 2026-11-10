// src/pages/hr/HRPortal.jsx
// The HR portal, moving here from the Django template (hr_portal.js) one
// pane at a time. Panes not yet moved open the classic portal until their
// React version is ready; then the link goes and the Django pane retires.

import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import HRTopbar from '../../components/hr/HRTopbar'
import Vacancies from '../../components/hr/Vacancies'
import Applications from '../../components/hr/Applications'
import { CLASSIC_HR_URL } from '../../api/hr'

// Links and redirects use full /hr/... paths. Relative ones inside the /hr/* splat route
// resolve against the whole address in React Router 7 (/hr/vacancies → /hr/vacancies/vacancies),
// which sent the portal into a redirect loop.
const PANES = [
  { path: 'vacancies', label: 'Vacancies', ready: true },
  { path: 'applications', label: 'Applications', ready: true },
  { path: 'onboarding', label: 'Onboarding' },
  { path: 'employees', label: 'Employees' },
  { path: 'overview', label: 'Overview' },
]

function Sidebar() {
  const link = ({ isActive }) =>
    'block rounded-lg px-3 py-2 text-sm font-semibold transition-colors ' +
    (isActive ? 'bg-[var(--text)] text-[var(--panel)]' : 'text-[var(--text-2)] hover:bg-[var(--panel)]')

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="HR sections">
      {PANES.map(p => p.ready ? (
        <NavLink key={p.path} to={`/hr/${p.path}`} className={link}>{p.label}</NavLink>
      ) : (
        <a key={p.path} href={CLASSIC_HR_URL} target="_blank" rel="noreferrer"
           className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm text-[var(--text-3)] hover:bg-[var(--panel)]">
          {p.label}
          <span className="ml-1 text-[10px] uppercase tracking-wider">· classic</span>
        </a>
      ))}
    </nav>
  )
}

export default function HRPortal() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <HRTopbar user={user} onLogout={logout} />
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:pt-1"><Sidebar /></aside>
        <main className="min-w-0">
          <Routes>
            <Route path="vacancies" element={<Vacancies />} />
            <Route path="applications" element={<Applications />} />
            <Route path="*" element={<Navigate to="/hr/vacancies" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
