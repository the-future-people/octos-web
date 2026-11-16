// src/context/AuthContext.jsx
// Global auth state. Wraps the entire app.
// Any component can call useAuth() to get the current user.

import { createContext, useContext, useState, useEffect } from 'react'
import { getMe } from '../api/auth'
import usePresence, { endPresence } from '../hooks/usePresence'
import ProfileHost from '../components/shared/ProfileHost'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { setLoading(false); return }

    getMe()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      })
      .finally(() => setLoading(false))
  }, [])

  // Every staff portal reports who is using it, for the manager's "On shift".
  usePresence(user)

  const [justLoggedIn, setJustLoggedIn] = useState(false)

  const login = (tokens, userData) => {
    localStorage.setItem('access_token',  tokens.access)
    localStorage.setItem('refresh_token', tokens.refresh)
    setUser(userData)
    setLoading(false)
    setJustLoggedIn(true)
  }

  const clearJustLoggedIn = () => setJustLoggedIn(false)

  const logout = () => {
    endPresence()
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }

  const getAccessToken = () => {
    return localStorage.getItem('access_token')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, getAccessToken, justLoggedIn, clearJustLoggedIn }}>
      {children}
      {/* My profile, opened from any portal's user menu */}
      <ProfileHost user={user} />
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
