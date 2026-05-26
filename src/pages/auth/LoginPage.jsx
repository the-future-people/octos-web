// src/pages/auth/LoginPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as apiLogin, getMe } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const tokens = await apiLogin(email, password)
      const user   = await getMe()

      login(tokens, user)

      // Role-based redirect
      const role = user.role_name
      if (role === 'CASHIER')        navigate('/cashier')
      else if (role === 'BRANCH_MANAGER') navigate('/bm')
      else navigate('/')

    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Invalid email or password.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="font-display font-black text-3xl text-[var(--text)] tracking-tight">
            Octos
          </div>
          <div className="text-sm text-[var(--text-3)] mt-1">
            Branch Operations Platform
          </div>
        </div>

        {/* Card */}
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-8">
          <h1 className="text-lg font-bold text-[var(--text)] mb-6">
            Sign in to your account
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                  rounded-lg text-sm text-[var(--text)] outline-none
                  focus:border-[var(--border-dark)] transition-colors"
                placeholder="you@farhat.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)]
                  rounded-lg text-sm text-[var(--text)] outline-none
                  focus:border-[var(--border-dark)] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="px-3 py-2.5 bg-[var(--red-bg)] border border-[var(--red-border)]
                rounded-lg text-sm text-[var(--red-text)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[var(--text)] text-white text-sm font-bold
                rounded-lg transition-opacity disabled:opacity-50 mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6 text-xs text-[var(--text-3)]">
          Octos · The Future People · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}
