// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import LoginPage from './pages/auth/LoginPage'
import CashierPortal from './pages/cashier/CashierPortal'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
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

            {/* More portals added here as we build them */}
            {/* <Route path="/bm/*" element={<ProtectedRoute allowedRoles={['BRANCH_MANAGER']}><BMPortal /></ProtectedRoute>} /> */}

            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
