// src/components/shared/ReminderModal.jsx
import { useState } from 'react'
import { createPortal } from 'react-dom'
import client from '../../api/client'

const VERB_ICON = {
  shift_ending:    '⏰',
  task_checkpoint: '🔒',
}

/**
 * Single, generic interruptive reminder modal — consumes whatever
 * useReminders() surfaces. Replaces ShiftEndingModal and the inline
 * GenericReminderNudge entirely. Mounted identically in every portal.
 */
export default function ReminderModal({ reminder, onDismiss, isDismissing }) {
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [realContent, setRealContent] = useState(null)

  if (!reminder) return null

  const icon = VERB_ICON[reminder.verb] || '🔔'

  const handleVerifyPin = async () => {
    if (pin.length !== 4) {
      setPinError('Enter your 4-digit PIN.')
      return
    }
    setVerifying(true)
    setPinError('')
    try {
      const verifyRes = await client.post('/api/v1/personal-notes/pin/verify/', { pin })
      if (!verifyRes.data?.valid) {
        setPinError('Incorrect PIN.')
        setPin('')
        setVerifying(false)
        return
      }
      // PIN correct — now fetch the real note content, owner-scoped
      // server-side, never exposed until this point.
      if (reminder.object_id) {
        const noteRes = await client.get(`/api/v1/personal-notes/${reminder.object_id}/`)
        setRealContent(noteRes.data)
      }
      setUnlocked(true)
    } catch (err) {
      setPinError(err.response?.data?.detail || 'Something went wrong. Try again.')
      setPin('')
    } finally {
      setVerifying(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-slideUp">

        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">{icon}</span>
        </div>

        {reminder.requires_pin && !unlocked ? (
          <>
            <h2 className="text-xl font-black text-zinc-900 mb-2">
              You have a reminder waiting
            </h2>
            <p className="text-sm text-zinc-500 mb-5">
              One of your private notes needs attention. Enter your PIN to view it.
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setPinError('') }}
              placeholder="••••"
              className="w-32 mx-auto block px-4 py-3 text-center text-2xl tracking-widest
                bg-zinc-50 border border-zinc-200 rounded-xl outline-none
                focus:border-zinc-400 mb-3"
              autoFocus
            />
            {pinError && (
              <p className="text-xs text-red-500 mb-3">{pinError}</p>
            )}
            <div className="flex gap-3">
              <button onClick={onDismiss} disabled={isDismissing}
                className="flex-1 px-4 py-2.5 border border-zinc-200 rounded-xl text-sm font-semibold
                  text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-40">
                Remind me later
              </button>
              <button onClick={handleVerifyPin} disabled={verifying}
                className="flex-1 px-4 py-2.5 bg-zinc-900 text-white text-sm font-bold
                  rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                {verifying ? 'Checking…' : 'View'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-black text-zinc-900 mb-2">
              {realContent?.title || reminder.message}
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              {realContent?.body || reminder.link ? 'Tap below for details.' : ''}
            </p>
            <button
              onClick={() => {
                if (reminder.requires_pin && reminder.object_id) {
                  client.post(`/api/v1/personal-notes/checkpoints/${reminder.object_id}/acknowledge/`)
                    .catch(() => {}) // best-effort — Notification dismissal is the source of truth for the modal itself
                }
                onDismiss()
              }}
              disabled={isDismissing}
              className="w-full px-4 py-2.5 bg-zinc-900 text-white text-sm font-bold
                rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
              {isDismissing ? 'Dismissing…' : 'Got it'}
            </button>
          </>
        )}

      </div>
    </div>,
    document.body,
  )
}