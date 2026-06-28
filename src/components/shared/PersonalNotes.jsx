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
  { id: 'amber',  bg: '#FEF3E2', text: '#5c3d10', textMuted: '#7c6a4f', dot: '#d97706' },
  { id: 'blue',   bg: '#E8F1FA', text: '#1e3a5f', textMuted: '#4a6a8a', dot: '#2563eb' },
  { id: 'green',  bg: '#EBF5E9', text: '#1e4620', textMuted: '#4a6b4c', dot: '#16a34a' },
  { id: 'violet', bg: '#F1EDF9', text: '#3b2a5e', textMuted: '#6a5a8a', dot: '#7c3aed' },
  { id: 'rose',   bg: '#FBEAEE', text: '#5e2a3a', textMuted: '#8a5a6a', dot: '#e11d48' },
  { id: 'slate',  bg: '#EEF0F2', text: '#2c3640', textMuted: '#5a6670', dot: '#475569' },
]

const HEADER_NOTE = { bg: '#B8A47A' }
const HEADER_TASK = { bg: '#E8884F' }

const IDLE_TIMEOUT_MS = 30_000

function colorClasses(colorId) {
  return COLORS.find(c => c.id === colorId) || COLORS[0]
}

function headerStyle(noteType) {
  return noteType === 'TASK' ? HEADER_TASK : HEADER_NOTE
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
// ── Warm Date/Time Picker ───────────────────────────────────────────────────

function WarmDateTimePicker({ value, onChange, accentColor }) {
  const [open, setOpen] = useState(false)
  const initial = value ? new Date(value) : new Date()
  const [viewMonth, setViewMonth] = useState(initial.getMonth())
  const [viewYear, setViewYear]   = useState(initial.getFullYear())
  const pickerRef = useRef(null)

  const selected = value ? new Date(value) : null

  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })
  const firstDay  = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const isSameDay = (d) => selected &&
    selected.getDate() === d && selected.getMonth() === viewMonth && selected.getFullYear() === viewYear

  const pickDay = (d) => {
    const base = selected || new Date()
    const next = new Date(viewYear, viewMonth, d, base.getHours(), base.getMinutes())
    onChange(toLocalInputValue(next))
  }

  const adjustTime = (field, delta) => {
    const base = selected || new Date()
    const next = new Date(base)
    if (field === 'hour')   next.setHours((next.getHours() + delta + 24) % 24)
    if (field === 'minute') next.setMinutes((next.getMinutes() + delta + 60) % 60)
    onChange(toLocalInputValue(next))
  }

  const hour12   = selected ? (selected.getHours() % 12 || 12) : 12
  const minuteStr = selected ? String(selected.getMinutes()).padStart(2, '0') : '00'
  const ampm     = selected ? (selected.getHours() >= 12 ? 'PM' : 'AM') : 'AM'

  const label = selected
    ? `${selected.toLocaleDateString('en-GH', { day: '2-digit', month: 'short' })}, ${hour12}:${minuteStr} ${ampm}`
    : 'Set date and time'

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-medium"
        style={{ color: accentColor }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        {label}
      </button>

      {open && (
        <div
          className="absolute z-50 bottom-full mb-2 left-0 rounded-2xl p-4"
          style={{ background: '#FFFCF7', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.12)', width: '260px' }}
        >
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => {
              if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
              else setViewMonth(m => m - 1)
            }} className="text-[#92600a] hover:opacity-70">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: '#5c3d10' }}>{monthName}</span>
            <button type="button" onClick={() => {
              if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
              else setViewMonth(m => m + 1)
            }} className="text-[#92600a] hover:opacity-70">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1.5">
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <span key={i} style={{ fontSize: '10px', color: '#a08b66' }} className="text-center">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 mb-4">
            {cells.map((d, i) => (
              <button
                type="button"
                key={i}
                disabled={!d}
                onClick={() => d && pickDay(d)}
                style={{
                  fontSize: '12px',
                  color: isSameDay(d) ? '#fff' : '#7c6a4f',
                  background: isSameDay(d) ? '#E8884F' : 'transparent',
                  borderRadius: '50%',
                  padding: '6px 0',
                  visibility: d ? 'visible' : 'hidden',
                }}
                className="hover:opacity-80 transition-opacity"
              >
                {d}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid rgba(146,96,10,0.1)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92600a" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => adjustTime('hour', -1)} className="text-[#92600a] text-xs px-1">−</button>
              <span style={{ fontSize: '13px', color: '#5c3d10', fontWeight: 500, minWidth: '14px', textAlign: 'center' }}>{hour12}</span>
              <button type="button" onClick={() => adjustTime('hour', 1)} className="text-[#92600a] text-xs px-1">+</button>
            </div>
            <span style={{ color: '#a08b66' }}>:</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => adjustTime('minute', -5)} className="text-[#92600a] text-xs px-1">−</button>
              <span style={{ fontSize: '13px', color: '#5c3d10', fontWeight: 500, minWidth: '20px', textAlign: 'center' }}>{minuteStr}</span>
              <button type="button" onClick={() => adjustTime('minute', 5)} className="text-[#92600a] text-xs px-1">+</button>
            </div>
            <button
              type="button"
              onClick={() => {
                const base = selected || new Date()
                const next = new Date(base)
                next.setHours((next.getHours() + 12) % 24)
                onChange(toLocalInputValue(next))
              }}
              style={{ fontSize: '11px', color: '#a08b66', marginLeft: '4px' }}
            >
              {ampm}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

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

  // Debounced auto-save — silent safety net, never the primary save action
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

  // Done — deliberate, immediate save and close, no debounce wait
  const handleDone = () => {
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
    if (!dueDate) {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000)
      setDueDate(toLocalInputValue(tomorrow))
    }
  }

  const c = colorClasses(color)
  const header = headerStyle(noteType)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div
        style={{ background: c.bg, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 20px 50px rgba(0,0,0,0.25)' }}
        className="w-full max-w-lg rounded-2xl flex flex-col max-h-[88vh] overflow-hidden"
      >

        {/* Header strip — matches card header */}
        <div style={{ background: header.bg }} className="px-5 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            {isTask ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <rect x="3" y="3" width="18" height="18" rx="3"/><polyline points="8 12 11 15 16 9"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            )}
            <span style={{ fontSize: '10px', fontWeight: 500, color: '#fff', letterSpacing: '0.3px' }}>
              {isTask ? 'TASK' : 'NOTE'}
            </span>
          </div>
          <div className="flex gap-1.5">
            {COLORS.map(col => (
              <button key={col.id} onClick={() => setColor(col.id)}
                style={{
                  width: '16px', height: '16px', borderRadius: '50%', background: col.dot,
                  opacity: color === col.id ? 1 : 0.45,
                  boxShadow: color === col.id ? '0 0 0 2px rgba(255,255,255,0.8)' : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title"
            style={{ fontFamily: 'Georgia, serif', color: c.text }}
            className="w-full bg-transparent outline-none text-xl font-normal
              placeholder:opacity-50"
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your note…"
            rows={8}
            style={{ color: c.textMuted }}
            className="w-full bg-transparent outline-none text-sm
              placeholder:opacity-50 resize-none leading-relaxed"
          />

          {noteType === 'TASK' && (
            <div
              style={{ background: 'rgba(0,0,0,0.04)' }}
              className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
            >
              <WarmDateTimePicker
                value={dueDate}
                onChange={setDueDate}
                accentColor={c.text}
              />
              <button
                onClick={() => { setNoteType('NOTE'); setDueDate('') }}
                style={{ color: c.textMuted }}
                className="text-xs hover:opacity-70 shrink-0"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {noteType === 'NOTE' ? (
              <>
                <WarmDateTimePicker
                  value={reminderAt}
                  onChange={setReminderAt}
                  accentColor={c.textMuted}
                />
                {reminderAt && (
                  <button
                    onClick={() => setReminderAt('')}
                    style={{ color: c.textMuted }}
                    className="text-xs hover:opacity-70 shrink-0">
                    Clear
                  </button>
                )}
                <button
                  onClick={handleConvertToTask}
                  style={{ color: c.text }}
                  className="text-xs font-medium underline shrink-0 ml-auto"
                >
                  Convert to task
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
                {completing ? 'Completing…' : 'Mark complete'}
              </button>
            )}
            {!isNew && (
              <button
                onClick={() => doDelete()}
                disabled={deleting}
                className="text-xs font-medium text-[var(--red-text)] hover:opacity-70
                  transition-opacity shrink-0">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
          <button
            onClick={handleDone}
            style={{ background: c.text, color: c.bg }}
            className="px-5 py-2 rounded-xl text-sm font-medium hover:opacity-90
              transition-opacity shrink-0"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Note Card ──────────────────────────────────────────────────────────────

function NoteCard({ note, onOpen }) {
  const c = colorClasses(note.color)
  const isTask = note.note_type === 'TASK'
  const isComplete = note.status === 'COMPLETE'
  const due = isTask && note.due_date ? dueLabel(note.due_date) : null
  const header = headerStyle(note.note_type)

  return (
    <button
      onClick={() => onOpen(note)}
      style={{
        background: c.bg,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 10px rgba(0,0,0,0.08)',
      }}
      className={`text-left rounded-2xl flex flex-col h-40 overflow-hidden
        hover:shadow-md transition-shadow relative
        ${isComplete ? 'opacity-55' : ''}`}
    >
      {/* Header strip */}
      <div
        style={{ background: isComplete ? '#9ca3af' : header.bg }}
        className="px-3.5 py-1.5 flex items-center gap-1.5 shrink-0"
      >
        {isComplete ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : isTask ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
            <rect x="3" y="3" width="18" height="18" rx="3"/><polyline points="8 12 11 15 16 9"/>
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        )}
        <span style={{ fontSize: '10px', fontWeight: 500, color: '#fff', letterSpacing: '0.3px' }}>
          {isComplete ? 'DONE' : isTask ? 'TASK' : 'NOTE'}
        </span>
      </div>

      {/* Body */}
      <div className="px-3.5 py-3 flex flex-col gap-2 flex-1 min-h-0">
        <h3
          style={{ fontFamily: 'Georgia, serif', color: c.text }}
          className={`font-normal text-base leading-tight line-clamp-1 shrink-0
            ${isComplete ? 'line-through' : ''}`}
        >
          {note.title || 'Untitled'}
        </h3>
        <p
          style={{ color: c.textMuted }}
          className={`text-xs leading-relaxed line-clamp-3 flex-1
            ${isComplete ? 'line-through' : ''}`}
        >
          {note.body || <span className="italic opacity-60">Empty note</span>}
        </p>
        <div
          style={{ color: isComplete ? '#9ca3af' : due?.urgent ? '#b45309' : c.textMuted }}
          className="text-[10px] font-medium flex items-center gap-1 shrink-0"
        >
          {due && !isComplete && <i className="ti ti-clock" style={{ fontSize: '11px' }} aria-hidden="true" />}
          {isComplete ? `Completed ${timeAgo(note.completed_at)}` :
           due ? due.text : timeAgo(note.updated_at)}
        </div>
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
  const [closing, setClosing] = useState(false)

  const { mutate: doAcknowledge } = useMutation({
    mutationFn: () => acknowledgeCheckpoint(checkpoint.id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dueReminders'] })
      queryClient.invalidateQueries({ queryKey: ['personalNotes'] })
    },
  })

  const { mutate: doComplete } = useMutation({
    mutationFn: () => completeTask(note.id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dueReminders'] })
      queryClient.invalidateQueries({ queryKey: ['personalNotes'] })
    },
  })

  // Optimistic close — fade out immediately, mutation fires in background
  const handleStillWorking = () => {
    setClosing(true)
    doAcknowledge()
    setTimeout(onDone, 200)
  }

  const handleComplete = () => {
    setClosing(true)
    doComplete()
    setTimeout(onDone, 200)
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 transition-opacity duration-200"
      style={{ opacity: closing ? 0 : 1 }}
    >
      <div
        style={{
          background: c.bg,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 20px 50px rgba(0,0,0,0.25)',
          transform: closing ? 'scale(0.96)' : 'scale(1)',
          transition: 'transform 200ms ease',
        }}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
      >
        {/* Header strip */}
        <div style={{ background: HEADER_TASK.bg }} className="px-5 py-2 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
            <rect x="3" y="3" width="18" height="18" rx="3"/><polyline points="8 12 11 15 16 9"/>
          </svg>
          <span style={{ fontSize: '10px', fontWeight: 500, color: '#fff', letterSpacing: '0.3px' }}>
            TASK REMINDER
          </span>
        </div>

        <div className="px-6 pt-5 pb-4 text-center">
          <h3 style={{ fontFamily: 'Georgia, serif', color: c.text }} className="text-lg font-normal">
            {note.title || 'Untitled task'}
          </h3>
          {note.body && (
            <p style={{ color: c.textMuted }} className="text-sm mt-2 leading-relaxed line-clamp-3">
              {note.body}
            </p>
          )}
          {note.due_date && (
            <div
              style={{ background: 'rgba(0,0,0,0.06)', color: dueLabel(note.due_date).urgent ? '#b45309' : c.textMuted }}
              className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-medium"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {dueLabel(note.due_date).text}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 space-y-2">
          <button
            onClick={handleComplete}
            style={{ background: '#16a34a', color: '#fff' }}
            className="w-full py-2.5 text-sm font-medium rounded-xl hover:opacity-90
              transition-opacity flex items-center justify-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Mark complete
          </button>
          <button
            onClick={handleStillWorking}
            style={{ background: 'rgba(0,0,0,0.06)', color: c.text }}
            className="w-full py-2.5 text-sm font-medium rounded-xl hover:opacity-80 transition-opacity">
            Still working on it
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