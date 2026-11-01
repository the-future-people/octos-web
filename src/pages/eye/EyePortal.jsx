// src/pages/eye/EyePortal.jsx
//
// The Eye of Agamotto: the owner's view of the whole business.
//
// Where you are (scope), what you look through (lens), which day and which
// period all live in the address bar, so the browser's back button walks
// back through the Eye and any view can be bookmarked or reopened.

import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { eyeMe } from '../../api/eye'
import { C, DISPLAY } from '../../components/eye/theme'
import Overview from '../../components/eye/lenses/Overview'
import People from '../../components/eye/lenses/People'
import Money from '../../components/eye/lenses/Money'
import Jobs from '../../components/eye/lenses/Jobs'
import Machines from '../../components/eye/lenses/Machines'
import Stock from '../../components/eye/lenses/Stock'
import Customers from '../../components/eye/lenses/Customers'
import Online from '../../components/eye/lenses/Online'
import AppLens from '../../components/eye/lenses/App'
import Health from '../../components/eye/lenses/Health'

const LENSES = [
  ['overview', 'Overview', Overview], ['people', 'People', People], ['money', 'Money', Money],
  ['jobs', 'Jobs', Jobs], ['machines', 'Machines', Machines], ['inventory', 'Inventory', Stock],
  ['customers', 'Customers', Customers], ['online', 'Online', Online], ['app', 'App', AppLens],
  ['health', 'Health', Health],
]

export default function EyePortal() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const me = useQuery({ queryKey: ['eye', 'me'], queryFn: eyeMe, retry: false })

  const lens = params.get('lens') || 'overview'
  const scope = params.get('scope') || 'company'
  const day = params.get('day') || undefined
  const period = params.get('period') || 'today'
  const entity = params.get('id') ? Number(params.get('id')) : null

  const set = (changes, replace = false) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v === null || v === undefined || v === '') ? next.delete(k) : next.set(k, v))
    setParams(next, { replace })
  }

  const nav = {
    scope, day, period, entity, dayChosen: !!day,
    go: (key) => set({ scope: key, id: null }),
    open: (id) => set({ id }),
    setDay: (d) => set({ day: d }),
    setPeriod: (p) => set({ period: p }),
    setLens: (l, id) => set({ lens: l, id: id || null }),
  }

  useEffect(() => { window.scrollTo(0, 0) }, [lens, scope, entity])

  if (me.isLoading) return <Shell><div className="py-24 text-center text-[12px]" style={{ color: C.muted }}>Opening the Eye…</div></Shell>
  if (me.error) {
    return <Shell><div className="py-24 text-center text-[13px]" style={{ color: C.text2 }}>
      The Eye is for the business owner only.
      <div className="mt-3"><button className="underline" style={{ color: C.gold }} onClick={() => { logout(); navigate('/login') }}>Sign in as someone else</button></div>
    </div></Shell>
  }

  const Lens = (LENSES.find(([k]) => k === lens) || LENSES[0])[2]
  return (
    <Shell>
      <div className="flex items-center gap-1.5 px-3 sticky top-0 z-10" style={{ background: C.ground, borderBottom: `1px solid ${C.border}` }}>
        <span className="font-extrabold text-[16px] mr-2 cursor-pointer" style={{ color: C.text, fontFamily: DISPLAY }}
              onClick={() => set({ lens: 'overview', scope: 'company', id: null, day: null })}>Octos</span>
        <div className="flex overflow-x-auto flex-1 min-w-0">
          {LENSES.map(([k, label]) => (
            <button key={k} onClick={() => set({ lens: k, id: null })}
                    className="text-[12px] px-2 pt-2.5 pb-2 whitespace-nowrap"
                    style={{ color: k === lens ? C.text : '#9a9690', fontWeight: k === lens ? 700 : 400,
                             borderBottom: `2px solid ${k === lens ? C.gold : 'transparent'}` }}>{label}</button>
          ))}
        </div>
        <button onClick={() => { logout(); navigate('/login') }} title="Sign out"
                className="w-7 h-7 rounded-full text-[10px] font-bold shrink-0"
                style={{ background: C.gold, color: '#1a1a1a' }}>
          {(user?.first_name?.[0] || me.data?.first_name?.[0] || 'O')}{(user?.last_name?.[0] || '')}
        </button>
      </div>
      <div className="max-w-[1100px] mx-auto">
        <Lens key={`${lens}-${entity || ''}`} nav={nav} />
      </div>
    </Shell>
  )
}

function Shell({ children }) {
  return <div className="min-h-screen" style={{ background: C.ground, color: C.text, fontFamily: "'DM Sans', sans-serif", colorScheme: 'dark' }}>{children}</div>
}
