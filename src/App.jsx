// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import DailyGreeting from './components/layout/DailyGreeting'
import PortalPreloader from './components/layout/PortalPreloader'
import LoginPage from './pages/auth/LoginPage'
import CashierPortal from './pages/cashier/CashierPortal'
import BMPortal        from './pages/bm/BMPortal'
import AttendantPortal from './pages/attendant/AttendantPortal'
import CoordinatorPortal from './pages/coordinator/CoordinatorPortal'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Refetch when the operator returns to the tab. The branch socket
      // pushes updates live, but a socket that dies quietly — laptop asleep,
      // wifi blip, an idle proxy timing it out — stops delivering with no
      // error anywhere, and messages sent while disconnected are gone for
      // good. Returning to the tab is the cheapest reliable moment to
      // reconcile, and it is exactly when someone is about to act on what
      // they see.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/cashier/*"
              element={
                <ProtectedRoute allowedRoles={['CASHIER']}>
                  <CashierPortal />
                </ProtectedRoute>
              }
            />

            <Route
              path="/bm/*"
              element={
                <ProtectedRoute allowedRoles={['BRANCH_MANAGER']}>
                  <PortalPreloader>
                    <BMPortal />
                  </PortalPreloader>
                </ProtectedRoute>
              }
            />

            <Route
              path="/attendant/*"
              element={
                <ProtectedRoute allowedRoles={['ATTENDANT']}>
                  <AttendantPortal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/coordinator/*"
              element={
                <ProtectedRoute allowedRoles={['FLOW_COORDINATOR']}>
                  <CoordinatorPortal />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
