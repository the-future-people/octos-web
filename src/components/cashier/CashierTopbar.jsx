// src/components/cashier/CashierTopbar.jsx
export default function CashierTopbar({ user, onLogout }) {
  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : '??'

  return (
    <header className="h-14 bg-[var(--panel)] border-b border-[var(--border)] flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <span className="font-display font-black text-xl text-[var(--text)] tracking-tight">
          Octos
        </span>
        <span className="w-px h-4 bg-[var(--border)]" />
        <div className="flex flex-col leading-none">
          <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
            Cashier
          </span>
          <span className="text-xs font-medium text-[var(--text-2)] mt-0.5">
            {user?.branch_detail?.name || '—'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--green-text)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--green-text)] animate-pulse" />
          Live
        </div>

        {/* User */}
        <div className="flex items-center gap-2 pl-3 border-l border-[var(--border)]">
          <div className="w-7 h-7 rounded-full bg-[var(--text)] text-white flex items-center justify-center text-[10px] font-bold">
            {initials}
          </div>
          <span className="text-sm font-semibold text-[var(--text)]">
            {user?.full_name || '—'}
          </span>
          <button
            onClick={onLogout}
            className="ml-2 text-xs text-[var(--text-3)] hover:text-[var(--red-text)] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
