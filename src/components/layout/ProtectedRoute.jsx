// src/components/layout/ProtectedRoute.jsx
// Wraps any route that requires authentication.
// Redirects to /login if no user. Redirects to correct portal if wrong role.

import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-sm text-[var(--text-3)]">Loading…</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(user.role_name)) {
    // Redirect to correct portal
    const role = user.role_name
    if (role === 'CASHIER')         return <Navigate to="/cashier" replace />
    if (role === 'BRANCH_MANAGER')  return <Navigate to="/bm" replace />
    if (role === 'ATTENDANT')       return <Navigate to="/attendant" replace />
    return <Navigate to="/login" replace />
  }

  return children
}
