// src/components/shared/NavBadge.jsx
//
// The inbox's badge on the menu: a red number for chats with unread messages,
// a pulsing "Needs you" when Octos has asked for a person; a red dot when the
// menu shows icons only (8 Nov 2026).
export default function NavBadge({ unread = 0, needs = 0 }) {
  if (needs) {
    return <span className="ml-auto px-2 py-0.5 rounded-full bg-[#CC0000] text-white text-[10.5px] font-bold octos-pulse">Needs you</span>
  }
  if (unread) {
    return (
      <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-[#CC0000] text-white text-[11px] font-bold grid place-items-center"
        aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</span>
    )
  }
  return null
}

export function NavDot({ unread = 0, needs = 0 }) {
  if (!unread && !needs) return null
  return <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#CC0000] ${needs ? 'octos-pulse' : ''}`} aria-hidden="true" />
}
