// src/components/shared/PersonalNotes.jsx
// Strictly private notes — owner-scoped only, no links to jobs/customers/branches.
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPinStatus, setPin, verifyPin,
  getNotes, createNote, updateNote, deleteNote,
  completeTask, acknowledgeCheckpoint, getDueReminders,
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

function dueLabel(dateStr) {
  const due  = new Date(dateStr)
  const now  = new Date()
  const diff = Math.floor((due - now) / 1000)
  const dateStrFmt = due.toLocaleDateString('en-GH', { day: '2-digit', month: 'short' })
  if (diff < 0) return { text: `Overdue · ${dateStrFmt}`, urgent: true }
  if (diff < 86400) return { text: `Due today, ${due.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}`, urgent: true }
  if (diff < 172800) return { text: `Due tomorrow`, urgent: false }
  return { text: `Due ${dateStrFmt}`, urgent: false }
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
  const isTask = note?.note_type === 'TASK'

  const [title, setTitle] = useState(note?.title || '')
  const [body, setBody]   = useState(note?.body || '')
  const [color, setColor] = useState(note?.color || 'amber')
  const [reminderAt, setReminderAt] = useState(
    note?.reminder_at ? note.reminder_at.slice(0, 16) : ''
  )
  const [noteType, setNoteType] = useState(note?.note_type || 'NOTE')
  const [dueDate, setDueDate]   = useState(
    note?.due_date ? note.due_date.slice(0, 16) : ''
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

  const { mutate: doComplete, isPending: completing } = useMutation({
    mutationFn: () => completeTask(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalNotes'] })
      onClose()
    },
  })

  const buildPayload = () => ({
    title, body, color,
    note_type: noteType,
    due_date: noteType === 'TASK' && dueDate ? new Date(dueDate).toISOString() : null,
    reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
  })

  // Debounced auto-save — fires 800ms after the last keystroke
  const triggerSave = useCallback(() => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (!title.trim() && !body.trim()) return
      const payload = buildPayload()
      if (noteId) doUpdate(payload)
      else doCreate(payload)
    }, 800)
  }, [title, body, color, reminderAt, noteType, dueDate, noteId])

  useEffect(() => {
    triggerSave()
    return () => clearTimeout(saveTimerRef.current)
  }, [title, body, color, reminderAt, noteType, dueDate, triggerSave])

  const handleClose = () => {
    clearTimeout(saveTimerRef.current)
    if (title.trim() || body.trim()) {
      const payload = buildPayload()
      if (noteId) doUpdate(payload)
      else doCreate(payload)
    }
    onClose()
  }

  const handleConvertToTask = () => {
    setNoteType('TASK')
    // Default due date: 24 hours from now, user can change it
    if (!dueDate) {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000)
      setDueDate(tomorrow.toISOString().slice(0, 16))
    }
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
          <div className="flex items-center gap-2">
            {noteType === 'TASK' && (
              <span className="px-2 py-0.5 rounded-full bg-black/10 text-[10px] font-bold
                text-[var(--text-2)] uppercase tracking-wider">
                Task
              </span>
            )}
            <button onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center rounded-full
                hover:bg-black/5 text-[var(--text-3)] transition-colors">
              ✕
            </button>
          </div>
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
            rows={9}
            className="w-full bg-transparent outline-none text-sm text-[var(--text-2)]
              placeholder:text-[var(--text-3)] resize-none leading-relaxed"
          />

          {/* Task due date field — only when noteType === TASK */}
          {noteType === 'TASK' && (
            <div className="bg-black/5 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" className="text-[var(--text-3)] shrink-0">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span className="text-xs font-semibold text-[var(--text-2)] shrink-0">Due</span>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="text-xs bg-transparent outline-none text-[var(--text)] flex-1"
              />
              <button
                onClick={() => { setNoteType('NOTE'); setDueDate('') }}
                className="text-[var(--text-3)] hover:text-[var(--red-text)] text-xs shrink-0">
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-black/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {noteType === 'NOTE' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" className="text-[var(--text-3)] shrink-0">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <input
                  type="datetime-local"
                  value={reminderAt}
                  onChange={e => setReminderAt(e.target.value)}
                  placeholder="Reminder"
                  className="text-xs bg-transparent outline-none text-[var(--text-2)] flex-1 min-w-0"
                />
                {reminderAt && (
                  <button onClick={() => setReminderAt('')}
                    className="text-[var(--text-3)] hover:text-[var(--red-text)] text-xs shrink-0">✕</button>
                )}
                <button
                  onClick={handleConvertToTask}
                  className="text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text)]
                    underline shrink-0 ml-1">
                  Convert to Task
                </button>
              </>
            ) : (
              <button
                onClick={() => doComplete()}
                disabled={completing || isNew}
                className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5
                  rounded-lg hover:bg-emerald-200 transition-colors disabled:opacity-40
                  flex items-center gap-1.5 shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {completing ? 'Completing…' : 'Mark Complete'}
              </button>
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
  const isTask = note.note_type === 'TASK'
  const isComplete = note.status === 'COMPLETE'
  const due = isTask && note.due_date ? dueLabel(note.due_date) : null

  return (
    <button
      onClick={() => onOpen(note)}
      className={`text-left rounded-2xl border-2 p-4 flex flex-col gap-2 h-40
        hover:shadow-md transition-shadow relative ${c.bg} ${c.border}
        ${isComplete ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className={`font-bold text-sm text-[var(--text)] line-clamp-1
          ${isComplete ? 'line-through' : ''}`}>
          {note.title || 'Untitled'}
        </h3>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {isTask && !isComplete && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" className="text-[var(--text-2)]">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          )}
          {isComplete && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
              className="text-emerald-600">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
          {hasReminder && !isTask && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" className="text-[var(--text-2)]">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          )}
        </div>
      </div>
      <p className={`text-xs text-[var(--text-2)] line-clamp-4 flex-1 leading-relaxed
        ${isComplete ? 'line-through' : ''}`}>
        {note.body || <span className="text-[var(--text-3)] italic">Empty note</span>}
      </p>
      <div className={`text-[10px] font-bold
        ${isComplete ? 'text-[var(--text-3)]' :
          due?.urgent ? 'text-red-600' : 'text-[var(--text-3)]'}`}>
        {isComplete ? `Completed ${timeAgo(note.completed_at)}` :
         due ? due.text : timeAgo(note.updated_at)}
      </div>
    </button>
  )
}

// ── Main Export ──────────────────────────────────────────────────────────────
// ── Checkpoint Reminder Modal ───────────────────────────────────────────────

function CheckpointReminderModal({ checkpoint, onDone }) {
  const queryClient = useQueryClient()
  const note = checkpoint.note
  const c = colorClasses(note.color)

  const { mutate: doAcknowledge, isPending: acking } = useMutation({
    mutationFn: () => acknowledgeCheckpoint(checkpoint.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dueReminders'] })
      queryClient.invalidateQueries({ queryKey: ['personalNotes'] })
      onDone()
    },
  })

  const { mutate: doComplete, isPending: completing } = useMutation({
    mutationFn: () => completeTask(note.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dueReminders'] })
      queryClient.invalidateQueries({ queryKey: ['personalNotes'] })
      onDone()
    },
  })

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
      <div className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border-2 ${c.bg} ${c.border}`}>
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-12 h-12 rounded-full bg-black/10 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="text-[var(--text-2)]">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
            Task Reminder
          </p>
          <h3 className="text-base font-black text-[var(--text)] mt-1">
            {note.title || 'Untitled task'}
          </h3>
          {note.body && (
            <p className="text-sm text-[var(--text-2)] mt-2 leading-relaxed line-clamp-3">
              {note.body}
            </p>
          )}
          {note.due_date && (
            <p className={`text-xs font-bold mt-3 ${dueLabel(note.due_date).urgent ? 'text-red-600' : 'text-[var(--text-3)]'}`}>
              {dueLabel(note.due_date).text}
            </p>
          )}
        </div>
        <div className="px-6 pb-6 space-y-2">
          <button
            onClick={() => doComplete()}
            disabled={completing || acking}
            className="w-full py-2.5 bg-emerald-600 text-white text-sm font-bold
              rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40
              flex items-center justify-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {completing ? 'Completing…' : 'Mark Complete'}
          </button>
          <button
            onClick={() => doAcknowledge()}
            disabled={completing || acking}
            className="w-full py-2.5 bg-black/5 text-[var(--text-2)] text-sm font-bold
              rounded-xl hover:bg-black/10 transition-colors disabled:opacity-40">
            {acking ? 'Saving…' : "Still working on it"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Export ──────────────────────────────────────────────────────────────

export default function PersonalNotes({ onIdleRedirect }) {
  const [unlocked, setUnlocked]   = useState(false)
  const [openNote, setOpenNote]   = useState(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [tab, setTab]             = useState('active') // active | completed
  const idleTimerRef = useRef(null)

  const { data: notes, isLoading } = useQuery({
    queryKey: ['personalNotes'],
    queryFn:  () => getNotes().then(r => r.data),
    enabled:  unlocked,
  })

  const { data: dueReminders } = useQuery({
    queryKey: ['dueReminders'],
    queryFn:  () => getDueReminders().then(r => r.data),
    enabled:  unlocked,
    refetchInterval: 30_000,
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

  const activeNotes    = (notes || []).filter(n => n.status !== 'COMPLETE')
  const completedNotes = (notes || []).filter(n => n.status === 'COMPLETE')
  const visibleNotes   = tab === 'active' ? activeNotes : completedNotes

  const nextCheckpoint = dueReminders?.checkpoints?.[0]

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
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

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-black/5 p-1 rounded-xl max-w-xs">
        {[
          { key: 'active',    label: `Active (${activeNotes.length})` },
          { key: 'completed', label: `Completed (${completedNotes.length})` },
        ].map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors
              ${tab === t.key
                ? 'bg-[var(--panel)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
              }`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-40 bg-[var(--panel)] border border-[var(--border)]
              rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !visibleNotes.length ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-semibold text-[var(--text-2)]">
            {tab === 'active' ? 'No notes yet' : 'No completed tasks yet'}
          </p>
          <p className="text-xs text-[var(--text-3)] mt-1">
            {tab === 'active'
              ? 'Create your first private note — only you can see it'
              : 'Tasks you complete will show up here'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibleNotes.map(note => (
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
      {nextCheckpoint && !openNote && !creatingNew && (
        <CheckpointReminderModal
          checkpoint={nextCheckpoint}
          onDone={() => {}}
        />
      )}
    </div>
  )
}