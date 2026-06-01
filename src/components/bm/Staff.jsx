// src/components/bm/Staff.jsx
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import client from '../../api/client'

const getStaff = (branchId) =>
  client.get(`/api/v1/accounts/users/?branch=${branchId}`).then(r => {
    const d = r.data
    return Array.isArray(d) ? d : (d?.results || [])
  })

function toTitleCase(str) {
  if (!str) return str
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}

const ROLE_CONFIG = {
  BRANCH_MANAGER: { label: 'Branch Manager', dot: 'bg-red-900',  badge: 'bg-red-900/10 text-red-900 border-red-200'  },
  CASHIER:        { label: 'Cashier',         dot: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700 border-rose-200'   },
  ATTENDANT:      { label: 'Attendant',        dot: 'bg-red-400', badge: 'bg-red-50 text-red-600 border-red-100'      },
}

const getRoleConfig = (roleName) =>
  ROLE_CONFIG[roleName] || {
    label: roleName?.replace(/_/g, ' '),
    dot:   'bg-slate-400',
    badge: 'bg-slate-50 text-slate-600 border-slate-200',
  }

function Avatar({ name }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-red-900
      flex items-center justify-center font-black text-white text-xl
      shadow-lg ring-4 ring-white shrink-0">
      {initials}
    </div>
  )
}

// ── ID Card ───────────────────────────────────────────────────────────────────
function StaffCard({ member }) {
  const role   = getRoleConfig(member.role_name)
  const name   = toTitleCase(member.full_name)
  const branch = member.branch_detail?.name || 'Main Branch'

  return (
    <div className="bg-white rounded-2xl border border-red-100 shadow-sm
      hover:shadow-md hover:border-red-200 transition-all duration-200 overflow-hidden">

      {/* Red gradient header */}
      <div className="bg-gradient-to-br from-red-600 to-red-900 px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[9px] font-bold text-red-200 uppercase tracking-widest">
              Farhat Printing Press
            </div>
            <div className="text-[8px] text-red-300/70 mt-0.5">{branch}</div>
          </div>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border
            ${member.is_active
              ? 'bg-white/20 text-white border-white/30'
              : 'bg-black/20 text-white/60 border-white/10'
            }`}>
            {member.is_active ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </div>

        {/* Avatar centered */}
        <div className="flex justify-center">
          {member.photo ? (
            <img src={member.photo} alt={name}
              className="w-16 h-16 rounded-full object-cover ring-4 ring-white/30 shadow-md" />
          ) : (
            <Avatar name={name} />
          )}
        </div>
      </div>

      {/* Name + role */}
      <div className="text-center px-5 pt-3 pb-2">
        <div className="text-sm font-black text-slate-800 leading-tight">{name}</div>
        <div className="flex items-center justify-center gap-1.5 mt-1">
          <span className={`w-1.5 h-1.5 rounded-full ${role.dot}`} />
          <span className="text-xs font-medium text-slate-500">{role.label}</span>
        </div>
      </div>

      {/* Info */}
      <div className="px-5 pb-5 space-y-2">
        <div className="grid grid-cols-2 gap-2 py-2 border-t border-red-50">
          <div>
            <div className="text-[9px] font-bold text-red-300 uppercase tracking-wider mb-0.5">Employee ID</div>
            <div className="font-mono text-xs font-bold text-slate-700">{member.employee_id || '—'}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-bold text-red-300 uppercase tracking-wider mb-0.5">Joined</div>
            <div className="text-xs text-slate-600">{fmtDate(member.created_at)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 py-2 border-t border-red-50">
          <svg className="w-3 h-3 text-red-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-xs text-slate-600 truncate">{member.email}</span>
        </div>

        {member.phone && (
          <div className="flex items-center gap-2 py-2 border-t border-red-50">
            <svg className="w-3 h-3 text-red-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span className="text-xs text-slate-600">{member.phone}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-red-50">
          <div className="flex gap-0.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`w-1 h-1 rounded-full ${i % 2 === 0 ? 'bg-red-300' : 'bg-red-100'}`} />
            ))}
          </div>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${role.badge}`}>
            {member.role_detail?.scope || 'BRANCH'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Staff() {
  const { user } = useAuth()
  const branchId = typeof user?.branch === 'object' ? user?.branch?.id : (user?.branch || 2)

  const { data: allStaff = [], isLoading } = useQuery({
    queryKey: ['staff', branchId],
    queryFn:  () => getStaff(branchId),
    staleTime: 60_000,
  })

  const staff    = allStaff.filter(s => s.branch === branchId)
  const active   = staff.filter(s => s.is_active)
  const inactive = staff.filter(s => !s.is_active)

  const roleCounts = {
    manager:   active.filter(s => s.role_name === 'BRANCH_MANAGER').length,
    cashier:   active.filter(s => s.role_name === 'CASHIER').length,
    attendant: active.filter(s => s.role_name === 'ATTENDANT').length,
  }

  return (
    <div className="p-5 sm:p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Staff</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {staff.length} team member{staff.length !== 1 ? 's' : ''} · {active.length} active
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {roleCounts.manager > 0 && (
            <div className="px-3 py-1.5 bg-red-50 border border-red-100 rounded-xl flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-900" />
              <span className="text-xs font-semibold text-red-900">{roleCounts.manager} Manager</span>
            </div>
          )}
          {roleCounts.cashier > 0 && (
            <div className="px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span className="text-xs font-semibold text-rose-700">{roleCounts.cashier} Cashier</span>
            </div>
          )}
          {roleCounts.attendant > 0 && (
            <div className="px-3 py-1.5 bg-red-50 border border-red-100 rounded-xl flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-xs font-semibold text-red-600">{roleCounts.attendant} Attendant</span>
            </div>
          )}
        </div>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-72 bg-[var(--panel)] border border-[var(--border)] rounded-2xl animate-pulse" />)}
        </div>
      ) : staff.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          flex flex-col items-center justify-center py-16">
          <p className="text-sm font-semibold text-[var(--text-2)]">No staff found</p>
          <p className="text-xs text-[var(--text-3)] mt-1">Staff are assigned through HQ</p>
        </div>
      ) : (
        <>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-red-600 rounded-full" />
              <span className="text-sm font-bold text-[var(--text)]">Active</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-700 rounded-full border border-red-100">
                {active.length}
              </span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {active.map(m => <StaffCard key={m.id} member={m} />)}
            </div>
          </div>

          {inactive.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-slate-300 rounded-full" />
                <span className="text-sm font-bold text-[var(--text-3)]">Inactive</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-[var(--bg)] text-[var(--text-3)] rounded-full border border-[var(--border)]">
                  {inactive.length}
                </span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-50">
                {inactive.map(m => <StaffCard key={m.id} member={m} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}