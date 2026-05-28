// src/components/bm/BMSidebar.jsx
const ICONS = {
  grid: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  ),
  calendar: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  briefcase: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  ),
  inbox: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  ),
  chart: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  tag: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="9" r="2"/>
      <path d="M10.05 2H4a2 2 0 0 0-2 2v6.05L13.59 21.6a2 2 0 0 0 2.82 0l5.18-5.18a2 2 0 0 0 0-2.82L10.05 2z"/>
    </svg>
  ),
  users: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  box: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  person: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  file: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
}

export default function BMSidebar({ sections, active, onNavigate, mobileOpen, onMobileClose }) {
  const SidebarContent = ({ collapsed = false }) => (
    <div className="pt-3">
      {sections.map(section => (
        <div key={section.group}>
          {!collapsed && (
            <div className="px-5 pt-3 pb-1">
              <span className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest">
                {section.group}
              </span>
            </div>
          )}
          {section.items.map(item => (
            <div key={item.id}>
              {/* Full — md+ */}
              <div className="hidden md:block px-3 py-0.5">
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm
                    transition-colors text-left rounded-lg
                    ${active === item.id
                      ? 'bg-[var(--bg)] text-[var(--text)] font-semibold'
                      : 'text-[var(--text-2)] hover:bg-[var(--bg)] font-medium'
                    }`}
                >
                  <span className="shrink-0">{ICONS[item.icon]}</span>
                  {item.label}
                </button>
              </div>
              {/* Icon only — sm collapsed */}
              <div className="hidden sm:block md:hidden">
                <button
                  onClick={() => onNavigate(item.id)}
                  title={item.label}
                  className={`w-full flex items-center justify-center py-3
                    transition-colors
                    ${active === item.id
                      ? 'bg-[var(--bg)] text-[var(--text)]'
                      : 'text-[var(--text-2)] hover:bg-[var(--bg)]'
                    }`}
                >
                  {ICONS[item.icon]}
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-20 md:hidden"
            onClick={onMobileClose}
          />
          <div className="fixed top-14 left-0 bottom-0 w-52 bg-[var(--panel)]
            border-r border-[var(--border)] z-30 md:hidden overflow-y-auto pt-2">
            {sections.map(section => (
              <div key={section.group}>
                <div className="px-5 pt-3 pb-1">
                  <span className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest">
                    {section.group}
                  </span>
                </div>
                {section.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm
                      transition-colors text-left
                      ${active === item.id
                        ? 'bg-[var(--bg)] text-[var(--text)] font-semibold'
                        : 'text-[var(--text-2)] hover:bg-[var(--bg)] font-medium'
                      }`}
                  >
                    <span className="shrink-0">{ICONS[item.icon]}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden sm:flex md:w-52 sm:w-12 shrink-0 bg-[var(--panel)]
        border-r border-[var(--border)] flex-col overflow-y-auto">
        {/* Full labels md+ */}
        <div className="hidden md:block">
          <SidebarContent collapsed={false} />
        </div>
        {/* Icons only sm */}
        <div className="md:hidden pt-3">
          {sections.map((section, sIdx) => (
            <div key={section.group}>
              {sIdx > 0 && (
                <div className="px-3 pt-2 pb-1">
                  <div className="h-px bg-[var(--border)]" />
                </div>
              )}
              {section.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={item.label}
                  className={`w-full flex items-center justify-center py-3
                    transition-colors
                    ${active === item.id
                      ? 'bg-[var(--bg)] text-[var(--text)]'
                      : 'text-[var(--text-2)] hover:bg-[var(--bg)]'
                    }`}
                >
                  {ICONS[item.icon]}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}