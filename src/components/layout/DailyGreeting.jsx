// src/components/layout/DailyGreeting.jsx
// Shows once per day on first login. Slides in, stays 30s, fades out.

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'

const DAY_CONFIG = {
  0: { // Sunday
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    emoji: '☀️',
    title: (name) => `Good Sunday, ${name}!`,
    sub: 'Rest well — the week ahead will need your best.',
    note: 'Branch is closed today.',
  },
  1: { // Monday
    gradient: 'from-blue-600 via-violet-600 to-purple-700',
    emoji: '🚀',
    title: (name) => `New week, ${name}!`,
    sub: 'A fresh start. Set the tone — make this week count.',
    note: 'Let\'s build something great this week.',
  },
  2: { // Tuesday
    gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
    emoji: '💪',
    title: (name) => `Good morning, ${name}!`,
    sub: 'Tuesday energy — momentum is building.',
    note: 'Keep pushing forward.',
  },
  3: { // Wednesday
    gradient: 'from-violet-500 via-purple-600 to-indigo-700',
    emoji: '⚡',
    title: (name) => `Midweek, ${name}!`,
    sub: 'Halfway through — stay focused and finish strong.',
    note: 'You\'re doing great.',
  },
  4: { // Thursday
    gradient: 'from-orange-500 via-amber-500 to-yellow-500',
    emoji: '🎯',
    title: (name) => `Almost there, ${name}!`,
    sub: 'One more push — the weekend is within sight.',
    note: 'Finish the week on a high.',
  },
  5: { // Friday
    gradient: 'from-rose-500 via-pink-500 to-fuchsia-600',
    emoji: '🎉',
    title: (name) => `It\'s Friday, ${name}!`,
    sub: 'End the week the way you started it — with excellence.',
    note: 'Make today count.',
  },
  6: { // Saturday
    gradient: 'from-cyan-500 via-blue-500 to-indigo-600',
    emoji: '🌟',
    title: (name) => `Final push, ${name}!`,
    sub: 'Last working day — finish strong and close the week well.',
    note: 'One great day to go.',
  },
}

function getFirstName(fullName) {
  if (!fullName) return 'there'
  return fullName.split(' ')[0]
}

function getStorageKey(userId) {
  const today = new Date().toISOString().split('T')[0]
  return `greeting_shown_${userId}_${today}`
}

export default function DailyGreeting() {
  const { user } = useAuth()
  const [visible,  setVisible]  = useState(false)
  const [fading,   setFading]   = useState(false)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (!user?.id) return

    const key = getStorageKey(user.id)
    if (localStorage.getItem(key)) return

    // Mark as shown for today
    localStorage.setItem(key, '1')

    // Small delay then show
    const showT = setTimeout(() => setVisible(true), 600)
    return () => clearTimeout(showT)
  }, [user?.id])

  useEffect(() => {
    if (!visible) return

    // Progress bar countdown
    const start    = Date.now()
    const duration = 30_000
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const pct     = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(pct)
      if (pct <= 0) clearInterval(interval)
    }, 100)

    // Fade out at 30s
    const fadeT   = setTimeout(() => setFading(true), 30_000)
    const removeT = setTimeout(() => setVisible(false), 31_000)

    return () => {
      clearInterval(interval)
      clearTimeout(fadeT)
      clearTimeout(removeT)
    }
  }, [visible])

  const dismiss = () => {
    setFading(true)
    setTimeout(() => setVisible(false), 500)
  }

  if (!visible || !user) return null

  const day    = new Date().getDay()
  const config = DAY_CONFIG[day]
  const name   = getFirstName(user.full_name || user.name || user.email)
  const role   = user.role?.name?.replace(/_/g, ' ') || ''
  const branch = user.branch_name || ''

  return createPortal(
    <div
      className={`fixed z-[99999] w-full max-w-lg px-4`}
      style={{
        top: '16px',
        left: '50%',
        transform: fading ? 'translateX(-50%) translateY(-16px)' : 'translateX(-50%) translateY(0)',
        opacity: fading ? 0 : 1,
        filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.3))',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}
    >
      <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${config.gradient}`}>

        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/20">
          <div
            className="h-full bg-white/60 transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center
            rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white text-xs">
          ✕
        </button>

        {/* Content */}
        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            {/* Emoji */}
            <div className="text-4xl shrink-0 mt-0.5">{config.emoji}</div>

            <div className="flex-1 min-w-0">
              <div className="text-xl font-black text-white leading-tight mb-1">
                {config.title(name)}
              </div>
              <div className="text-sm text-white/80 font-medium mb-3">
                {config.sub}
              </div>

              {/* Role + branch chip */}
              <div className="flex items-center gap-2 flex-wrap">
                {role && (
                  <span className="text-[10px] font-bold px-2.5 py-1 bg-white/20
                    text-white rounded-full uppercase tracking-wider">
                    {role}
                  </span>
                )}
                {branch && (
                  <span className="text-[10px] font-bold px-2.5 py-1 bg-white/20
                    text-white rounded-full">
                    {branch}
                  </span>
                )}
                <span className="text-[10px] text-white/60 font-medium">
                  {new Date().toLocaleDateString('en-GH', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Note strip */}
          <div className="mt-4 pt-3 border-t border-white/20">
            <p className="text-xs text-white/70 font-medium">{config.note}</p>
          </div>
        </div>

      </div>
    </div>,
    document.body
  )
}