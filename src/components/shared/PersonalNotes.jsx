// src/components/shared/PersonalNotes.jsx
// Strictly private notes — owner-scoped only, no links to jobs/customers/branches.
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPinStatus, setPin, verifyPin,
  getNotes, createNote, updateNote, deleteNote,
} from '../../api/personalNotes'

const COLORS = [
  { id: 'amber',  bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-400'  },
  { id: 'blue',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-400'   },
  { id: 'green',  bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-400'  },
  { id: 'violet', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-400' },
  { id: 'rose',   bg: 'bg-rose-50',   border: 'border-rose-200',   dot: 'bg-rose-400'   },
  { id: 'slate',  bg: 'bg-slate-50',  border: 'border-slate-200',  dot: 'bg-slate-400'  },
]

const IDLE_TIMEOUT_MS = 30_000

function colorClasses(colorId) {
  return COLORS.find(c => c.id === colorId) || COLORS[0]
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── PIN Gate ─────────────────────────────────────────────────────────────────

function PinGate({ onUnlock }) {
  const [pin, setPinInput]   = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError]    = useState('')
  const [mode, setMode]      = useState('checking') // checking | setup | confirm | enter

  const { data: pinStatus, isLoading } = useQuery({
    queryKey: ['notePinStatus'],
    queryFn:  () => getPinStatus().then(r => r.data),
  })

  useEffect(() => {
    if (pinStatus) {
      setMode(pinStatus.has_pin ? 'enter' : 'setup')
    }
  }, [pinStatus])

  const { mutate: doSetPin, isPending: settingPin } = useMutation({
    mutationFn: (p) => setPin(p),
    onSuccess: () => onUnlock(),
    onError: (err) => setError(err.response?.data?.pin?.[0] || 'Could not set PIN.'),
  })

  const { mutate: doVerifyPin, isPending: verifying } = useMutation({
    mutationFn: (p) => verifyPin(p),
    onSuccess: (res) => {
      if (res.data.valid) onUnlock()
      else { setError('Incorrect PIN.'); setPinInput('') }
    },
    onError: () => setError('Could not verify PIN. Try again.'),
  })

  const handleDigit = (digit) => {
    setError('')
    if (mode === 'setup') {
      if (pin.length < 4) setPinInput(p => p + digit)
    } else if (mode === 'confirm') {
      if (confirmPin.length < 4) setConfirmPin(p => p + digit)
    } else if (mode === 'enter') {
      if (pin.length < 4) setPinInput(p => p + digit)
    }
  }

  const handleBackspace = () => {
    setError('')
    if (mode === 'confirm') setConfirmPin(p => p.slice(0, -1))
    else setPinInput(p => p.slice(0, -1))
  }

  // Auto-advance setup -> confirm -> submit
  useEffect(() => {
    if (mode === 'setup' && pin.length === 4) {
      setTimeout(() => setMode('confirm'), 150)
    }
  }, [pin, mode])

  useEffect(() => {
    if (mode === 'confirm' && confirmPin.length === 4) {
      if (confirmPin === pin) {
        doSetPin(pin)
      } else {
        setError('PINs do not match. Try again.')
        setPinInput('')
        setConfirmPin('')
        setMode('setup')
      }
    }
  }, [confirmPin, mode, pin])

  useEffect(() => {
    if (mode === 'enter' && pin.length === 4) {
      doVerifyPin(pin)
    }
  }, [pin, mode])

  const activeValue = mode === 'confirm' ? confirmPin : pin

  if (isLoading || mode === 'checking') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--text-3)]
          rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--bg)] flex items-center justify-center mb-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" className="text-[var(--text-3)]">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>

      <h2 className="text-base font-bold text-[var(--text)]">
        {mode === 'setup' ? 'Set a PIN for your notes' :
         mode === 'confirm' ? 'Confirm your PIN' :
         'Enter your PIN'}
      </h2>
      <p className="text-xs text-[var(--text-3)] mt-1 max-w-xs">
        {mode === 'setup' || mode === 'confirm'
          ? 'This PIN protects your private notes. No one else — not even branch managers or admins — can see them.'
          : 'Your notes are private. Only you can unlock them.'}
      </p>

      {/* Dots */}
      <div className="flex gap-3 mt-6 mb-2">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-3 h-3 rounded-full border-2 transition-colors
            ${i < activeValue.length
              ? 'bg-[var(--text)] border-[var(--text)]'
              : 'border-[var(--border-dark)]'}`}
          />
        ))}
      </div>

      {error && <p className="text-xs text-[var(--red-text)] font-semibold mt-1">{error}</p>}
      {(settingPin || verifying) && (
        <p className="text-xs text-[var(--text-3)] mt-1">Checking…</p>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2 mt-6 w-full max-w-[220px]">
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => handleDigit(String(n))}
            className="aspect-square rounded-xl bg-[var(--panel)] border border-[var(--border)]
              text-lg font-bold text-[var(--text)] hover:border-[var(--border-dark)]
              transition-colors">
            {n}
          </button>
        ))}
        <div />
        <button onClick={() => handleDigit('0')}
          className="aspect-square rounded-xl bg-[var(--panel)] border border-[var(--border)]
            text-lg font-bold text-[var(--text)] hover:border-[var(--border-dark)]
            transition-colors">
          0
        </button>
        <button onClick={handleBackspace}
          className="aspect-square rounded-xl flex items-center justify-center
            text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
            <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
          </svg>
        </button>
      </div>

      {mode === 'enter' && (
        <button className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)]
          underline mt-6 transition-colors">
          Forgot PIN?
        </button>
      )}
    </div>
  )
}

// ── Note Editor Modal ─────────────────────────────────────────────────────────

function NoteEditor({ note, onClose }) {
  const queryClient = useQueryClient()
  const isNew = !note?.id

  const [title, setTitle] = useState(note?.title || '')
  const [body, setBody]   = useState(note?.body || '')
  const [color, setColor] = useState(note?.color || 'amber')
  const [reminderAt, setReminderAt] = useState(
    note?.reminder_at ? note.reminder_at.slice(0, 16) : ''
  )
  const [noteId, setNoteId] = useState(note?.id || null)
  const saveTimerRef = useRef(null)

  const { mutate: doCreate } = useMutation({
    mutationFn: (payload) => createNote(payload),
    onSuccess: (res) => {
      setNoteId(res.data.id)
      queryClient.invalidateQueries({ queryKey: ['personalNotes'] })
    },
  })

  const { mutate: doUpdate } = useMutation({
    mutationFn: (payload) => updateNote(noteId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personalNotes'] }),
  })

  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: () => deleteNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalNotes'] })
      onClose()
    },
  })

  // Debounced auto-save — fires 800ms after the last keystroke
  const triggerSave = useCallback(() => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const payload = {
        title,
        body,
        color,
        reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
      }
      if (!title.trim() && !body.trim()) return // nothing to save yet
      if (noteId) doUpdate(payload)
      else doCreate(payload)
    }, 800)
  }, [title, body, color, reminderAt, noteId])

  useEffect(() => {
    triggerSave()
    return () => clearTimeout(saveTimerRef.current)
  }, [title, body, color, reminderAt, triggerSave])

  // Save immediately on close (so nothing is lost if user closes fast)
  const handleClose = () => {
    clearTimeout(saveTimerRef.current)
    if (title.trim() || body.trim()) {
      const payload = {
        title, body, color,
        reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
      }
      if (noteId) doUpdate(payload)
      else doCreate(payload)
    }
    onClose()
  }

  const c = colorClasses(color)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className={`w-full max-w-lg rounded-2xl shadow-2xl flex flex-col
        max-h-[88vh] overflow-hidden border-2 ${c.bg} ${c.border}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/5">
          <div className="flex gap-1.5">
            {COLORS.map(col => (
              <button key={col.id} onClick={() => setColor(col.id)}
                className={`w-5 h-5 rounded-full ${col.dot} transition-transform
                  ${color === col.id ? 'ring-2 ring-offset-1 ring-[var(--text)] scale-110' : 'opacity-50 hover:opacity-80'}`}
              />
            ))}
          </div>
          <button onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
              hover:bg-black/5 text-[var(--text-3)] transition-colors">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full bg-transparent outline-none text-lg font-bold
              text-[var(--text)] placeholder:text-[var(--text-3)] placeholder:font-bold"
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your note…"
            rows={10}
            className="w-full bg-transparent outline-none text-sm text-[var(--text-2)]
              placeholder:text-[var(--text-3)] resize-none leading-relaxed"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-black/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" className="text-[var(--text-3)] shrink-0">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <input
              type="datetime-local"
              value={reminderAt}
              onChange={e => setReminderAt(e.target.value)}
              className="text-xs bg-transparent outline-none text-[var(--text-2)] flex-1"
            />
            {reminderAt && (
              <button onClick={() => setReminderAt('')}
                className="text-[var(--text-3)] hover:text-[var(--red-text)] text-xs">✕</button>
            )}
          </div>
          {!isNew && (
            <button
              onClick={() => doDelete()}
              disabled={deleting}
              className="text-xs font-semibold text-[var(--red-text)] hover:opacity-70
                transition-opacity shrink-0">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Note Card ──────────────────────────────────────────────────────────────

function NoteCard({ note, onOpen }) {
  const c = colorClasses(note.color)
  const hasReminder = !!note.reminder_at && !note.reminder_dismissed

  return (
    <button
      onClick={() => onOpen(note)}
      className={`text-left rounded-2xl border-2 p-4 flex flex-col gap-2 h-40
        hover:shadow-md transition-shadow ${c.bg} ${c.border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-sm text-[var(--text)] line-clamp-1">
          {note.title || 'Untitled'}
        </h3>
        {hasReminder && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" className="text-[var(--text-2)] shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        )}
      </div>
      <p className="text-xs text-[var(--text-2)] line-clamp-4 flex-1 leading-relaxed">
        {note.body || <span className="text-[var(--text-3)] italic">Empty note</span>}
      </p>
      <div className="text-[10px] text-[var(--text-3)] font-medium">
        {timeAgo(note.updated_at)}
      </div>
    </button>
  )
}

// ── Main Export ──────────────────────────────────────────────────────────────

export default function PersonalNotes({ onIdleRedirect }) {
  const [unlocked, setUnlocked] = useState(false)
  const [openNote, setOpenNote] = useState(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const idleTimerRef = useRef(null)

  const { data: notes, isLoading } = useQuery({
    queryKey: ['personalNotes'],
    queryFn:  () => getNotes().then(r => r.data),
    enabled:  unlocked,
  })

  // ── Idle timeout — resets on any interaction while unlocked ────────────────
  const resetIdleTimer = useCallback(() => {
    clearTimeout(idleTimerRef.current)
    if (!unlocked) return
    idleTimerRef.current = setTimeout(() => {
      setUnlocked(false)
      onIdleRedirect?.()
    }, IDLE_TIMEOUT_MS)
  }, [unlocked, onIdleRedirect])

  useEffect(() => {
    if (!unlocked) return
    resetIdleTimer()
    const events = ['mousemove', 'keydown', 'click', 'scroll']
    events.forEach(e => window.addEventListener(e, resetIdleTimer))
    return () => {
      clearTimeout(idleTimerRef.current)
      events.forEach(e => window.removeEventListener(e, resetIdleTimer))
    }
  }, [unlocked, resetIdleTimer])

  if (!unlocked) {
    return <PinGate onUnlock={() => setUnlocked(true)} />
  }

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">My Notes</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            Strictly private — visible only to you
          </p>
        </div>
        <button
          onClick={() => setCreatingNew(true)}
          className="px-4 py-2 bg-[var(--text)] text-white text-sm font-bold
            rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Note
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-40 bg-[var(--panel)] border border-[var(--border)]
              rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !notes?.length ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-semibold text-[var(--text-2)]">No notes yet</p>
          <p className="text-xs text-[var(--text-3)] mt-1">
            Create your first private note — only you can see it
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {notes.map(note => (
            <NoteCard key={note.id} note={note} onOpen={setOpenNote} />
          ))}
        </div>
      )}

      {openNote && (
        <NoteEditor note={openNote} onClose={() => setOpenNote(null)} />
      )}
      {creatingNew && (
        <NoteEditor note={null} onClose={() => setCreatingNew(false)} />
      )}
    </div>
  )
}