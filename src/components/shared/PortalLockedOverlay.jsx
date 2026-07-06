// src/components/shared/PortalLockedOverlay.jsx
import { createPortal } from 'react-dom'

/**
 * Full-portal lock overlay for Cashier and Attendant portals.
 * Consumes the shared /api/v1/finance/lock-status/ response and derives
 * its own display state — priority order: Sunday > Holiday > Shift ended.
 * Renders nothing if none of these apply.
 *
 * Props:
 *   lockData   — the full lock-status response object
 *   isLocked   — boolean, role-specific "should this render at all" check
 *                (Cashier: cashier_signed_off; Attendant: !can_create_jobs)
 */
export default function PortalLockedOverlay({ lockData, isLocked }) {
  if (!lockData) return null

  const {
    is_today_sunday,
    is_today_holiday,
    today_holiday_name,
    tomorrow_is_sunday,
    tomorrow_holiday_name,
  } = lockData

  // Sunday and holiday always lock, regardless of role-specific shift state
  const forcedClosed = is_today_sunday || is_today_holiday
  if (!forcedClosed && !isLocked) return null

  const nextOpenMessage = () => {
    if (tomorrow_is_sunday) return "We're closed Sunday too — see you Monday!"
    if (tomorrow_holiday_name) return `Tomorrow's also closed for ${tomorrow_holiday_name} — see you the day after.`
    return 'See you tomorrow!'
  }

  let icon = '🔒'
  let title = 'Portal Locked'
  let message = 'Come back when your next shift begins.'

  if (is_today_sunday) {
    icon = '☀️'
    title = 'Business Closed — Sunday'
    message = "Enjoy your weekend! We're closed today. See you Monday."
  } else if (is_today_holiday) {
    icon = '🎉'
    title = `Business Closed — ${today_holiday_name}`
    message = `We're closed today for ${today_holiday_name}. Enjoy the day!`
  } else if (isLocked) {
    icon = '🔒'
    title = 'Shift Ended'
    message = `Your shift is done for today. ${nextOpenMessage()}`
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center
      bg-[var(--bg)]/95 backdrop-blur-sm p-6 animate-fadeIn">
      <div className="max-w-sm text-center">
        <div className="text-5xl mb-4">{icon}</div>
        <div className="text-xl font-black text-[var(--text)] mb-2">{title}</div>
        <div className="text-sm text-[var(--text-3)] leading-relaxed">{message}</div>
      </div>
    </div>,
    document.body,
  )
}