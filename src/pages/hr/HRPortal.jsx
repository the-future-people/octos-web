// src/pages/hr/HRPortal.jsx
// The HR portal, moving here from the Django template (hr_portal.js) one pane at
// a time. Panes not moved yet show a "Moving here soon" page inside the portal,
// with a link to the classic version for anyone who needs it today.

import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import HRTopbar from '../../components/hr/HRTopbar'
import Vacancies from '../../components/hr/Vacancies'
import Applications, { waitingCount } from '../../components/hr/Applications'
import { getApplications, CLASSIC_HR_URL } from '../../api/hr'

// Links and redirects use full /hr/... paths. Relative ones inside the /hr/* splat route
// resolve against the whole address in React Router 7 (/hr/vacancies → /hr/vacancies/vacancies),
// which sent the portal into a redirect loop.

const ICON = {
  vacancies: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  applications: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></>,
  onboarding: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v2h6V3M9 13l2 2 4-4" /></>,
  employees: <><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M8 17a4 4 0 0 1 8 0" /></>,
  overview: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
}

const PANES = [
  { path: 'vacancies', label: 'Vacancies' },
  { path: 'applications', label: 'Applications', badge: true },
  { path: 'onboarding', label: 'Onboarding', soon: 'Verifying new hires’ information, creating their staff accounts, and offer letters.' },
  { path: 'employees', label: 'Employees', soon: 'Everyone on the staff list, by branch and role.' },
  { path: 'overview', label: 'Overview', soon: 'People and recruitment at a glance.' },
]

function Sidebar({ waiting }) {
  const link = ({ isActive }) =>
    'flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ' +
    (isActive ? 'bg-[var(--text)] text-[var(--panel)]' : 'text-[var(--text-2)] hover:bg-[var(--panel)]')
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="HR sections">
      {PANES.map((p) => (
        <NavLink key={p.path} to={`/hr/${p.path}`} className={link}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICON[p.path]}
          </svg>
          <span className="flex-1">{p.label}</span>
          {p.badge && waiting > 0 && (
            <span className="rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: '#BA7517' }}>{waiting}</span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function MovingSoon({ label, text }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-bold text-[var(--text)]">{label}</h1>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-10 text-center">
        <p className="font-display text-lg font-bold text-[var(--text)]">Moving here soon</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-2)]">{text}</p>
        <a href={CLASSIC_HR_URL} target="_blank" rel="noreferrer"
           className="mt-5 inline-block text-sm font-semibold underline" style={{ color: '#185FA5' }}>
          Open it in the classic portal for now
        </a>
      </div>
    </div>
  )
}

export default function HRPortal() {
  const { user, logout } = useAuth()
  // Same query as the Applications pane, so the badge and the lanes always agree
  const appsQ = useQuery({ queryKey: ['hrApplications'], queryFn: () => getApplications().then((r) => r.data), refetchInterval: 60_000 })

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <HRTopbar user={user} onLogout={logout} />
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 grid gap-5 lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:pt-1"><Sidebar waiting={waitingCount(appsQ.data)} /></aside>
        <main className="min-w-0">
          <Routes>
            <Route path="vacancies" element={<Vacancies />} />
            <Route path="applications" element={<Applications />} />
            {PANES.filter((p) => p.soon).map((p) => (
              <Route key={p.path} path={p.path} element={<MovingSoon label={p.label} text={p.soon} />} />
            ))}
            <Route path="*" element={<Navigate to="/hr/vacancies" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
