// src/components/attendant/SignOffBanner.jsx
//
// The attendant's end of day, shown above every page (13 Nov 2026).
// Times come from the server (ShiftRoleConfig), never from this file:
//
//   CLOSING_SOON   half an hour before shift end: finish with customers
//   SIGN_OFF_OPEN  recording has closed and sign-off is open
//   FINAL_CALL     the last 15 minutes before the deadline
//   OVERDUE        past the deadline: Octos will sign off within minutes
//
// The rail and the dot on the top bar carry the 7:00 warning, so CLOSING_SOON
// shows nothing here: there is nothing to press yet. The portal is covered
// once the server says is_locked (signed off, day closed, or nothing to sign).

function clock(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' })
}

export default function SignOffBanner({ status, onStart }) {
  if (!status) return null
  const { phase, can_sign_off, is_due, deadline, minutes_to_deadline } = status

  const content = {
    SIGN_OFF_OPEN: {
      tone: 'amber',
      title: 'Recording closed',
      body: `No new jobs today. Sign off by ${clock(deadline)}.`,
    },
    FINAL_CALL: {
      tone: 'red',
      title: `${Math.max(minutes_to_deadline, 0)} minutes left to sign off`,
      // Octos only signs off for someone who recorded jobs today.
      body: is_due
        ? `Sign off before ${clock(deadline)}, or Octos will do it for you and tell the branch manager.`
        : `Sign off before ${clock(deadline)}.`,
    },
    OVERDUE: {
      tone: 'red',
      title: 'Sign-off deadline passed',
      body: 'Sign off now. If you don’t, Octos will sign off for you in the next few minutes.',
    },
  }[phase]

  if (!content) return null

  const tones = {
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red:   'bg-red-50 border-red-200 text-red-700',
  }

  return (
    <div className={`mx-4 sm:mx-5 mt-4 px-4 py-3 rounded-xl border flex items-center gap-3 flex-wrap ${tones[content.tone]}`}
      role="status">
      <div className="flex-1 min-w-[200px]">
        <div className="text-sm font-bold">{content.title}</div>
        <div className="text-xs opacity-90">{content.body}</div>
      </div>
      {can_sign_off && (
        <button onClick={onStart}
          className="px-4 py-2 bg-[var(--text)] text-white text-sm font-bold rounded-xl
            hover:opacity-90 transition-opacity">
          Start sign-off
        </button>
      )}
    </div>
  )
}
