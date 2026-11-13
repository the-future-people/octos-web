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
// Nothing locks before sign-off. The portal is only covered once she has
// signed off (or Octos has, for her).

function clock(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' })
}

export default function SignOffBanner({ status, onStart }) {
  if (!status) return null
  const { phase, can_sign_off, shift_end, deadline, minutes_to_shift_end, minutes_to_deadline } = status

  const content = {
    CLOSING_SOON: {
      tone: 'amber',
      title: `${Math.max(minutes_to_shift_end, 0)} minutes to close`,
      body: `Finish with the customers at the counter. Recording stops at ${clock(shift_end)}.`,
    },
    SIGN_OFF_OPEN: {
      tone: 'amber',
      title: 'Recording closed',
      body: `No new jobs today. Sign off by ${clock(deadline)}.`,
    },
    FINAL_CALL: {
      tone: 'red',
      title: `${Math.max(minutes_to_deadline, 0)} minutes left to sign off`,
      body: `Sign off before ${clock(deadline)}, or Octos will do it for you and tell the branch manager.`,
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
