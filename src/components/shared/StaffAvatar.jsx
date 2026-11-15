// src/components/shared/StaffAvatar.jsx
// A staff member's face: their photo, or their initials in their role's colour.
import { useState } from 'react'

export const ROLE_FACE = {
  ATTENDANT:        { bg: 'rgba(29, 158, 117, 0.16)', fg: '#0F6E56' },
  CASHIER:          { bg: 'rgba(239, 159, 39, 0.20)', fg: '#854F0B' },
  OPERATOR:         { bg: 'rgba(127, 119, 221, 0.18)', fg: '#3C3489' },
  BRANCH_MANAGER:   { bg: 'rgba(204, 0, 0, 0.12)',    fg: '#A32D2D' },
  FLOW_COORDINATOR: { bg: 'rgba(55, 138, 221, 0.16)', fg: '#185FA5' },
  COORDINATOR:      { bg: 'rgba(55, 138, 221, 0.16)', fg: '#185FA5' },
}
const GREY = { bg: 'rgba(136, 135, 128, 0.18)', fg: '#5F5E5A' }

export default function StaffAvatar({ person, size = 64, ring = false }) {
  // A link that has expired (an hour) falls back to initials until the next load.
  const [broken, setBroken] = useState(false)
  const face = ROLE_FACE[person?.role] || GREY
  const style = {
    width: size, height: size,
    boxShadow: ring ? '0 0 0 3px var(--panel)' : undefined,
  }
  if (person?.photo_url && !broken) {
    return <img src={person.photo_url} alt={person.full_name} onError={() => setBroken(true)}
      className="rounded-full object-cover shrink-0" style={style} />
  }
  return (
    <div className="rounded-full grid place-items-center font-bold shrink-0"
      style={{
        ...style, color: face.fg, fontSize: size * 0.34,
        // The tint laid over a solid panel, so a coloured card behind never shows through.
        backgroundColor: 'var(--panel)', backgroundImage: `linear-gradient(${face.bg}, ${face.bg})`,
      }}>
      {person?.initials || '?'}
    </div>
  )
}
