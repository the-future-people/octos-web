// src/components/bm/Inbox.jsx
//
// The inbox, for the Branch Manager and the attendants alike (rebuilt from
// Khofi's mock, 7 Nov 2026): the chats on the left; the chat itself at full
// height in the middle; on the right, a panel with everything that used to
// crowd it (what Octos is doing, the actions, the customer, their job, every
// file in the chat). Who said what is labelled on every group of messages:
// mint is Octos, soft red is a person, dashed yellow is a note only staff
// see. Photos are shown, documents are cards with what Octos read from them,
// and replies can carry files (paperclip, drag, or paste a screenshot).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'

const C = {
  red: '#D0342C', redText: '#B42318', redDeep: '#8E2A22', redSoft: '#FDF0EF', redBorder: '#F3C6C2',
  mint: '#E4F3EB', mintText: '#12241A', mintIcon: '#1E6B47', mintStrip: '#F2F8F4', mintBorder: '#D3EADD',
  staff: '#FBE7E5', staffText: '#2A1412',
  note: '#FFF8E6', noteBorder: '#E8C66A', noteText: '#3A2D05', noteMeta: '#7A5A06',
  amberSoft: '#FFF4E5', amberText: '#8A4B08', read: '#2563A8',
}
const MAX_FILE = 16 * 1024 * 1024
// The emojis a print shop's chats actually use.
const EMOJIS = ['🙏', '👍', '😊', '🙂', '😀', '😂', '❤️', '👌', '✅', '❌', '⚠️', '📄', '🖨️', '📎', '📸', '📦',
  '⏰', '📍', '💳', '💯', '🎉', '👏', '🤝', '🙌', '😅', '🤔', '😢', '😍', '🔥', '⭐', '👋', '📞']
// Wide enough to keep the side panel as a column beside the chat; narrower
// than this it slides over the chat instead, so the chat keeps its width.
const WIDE = '(min-width: 1600px)'
function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches)
  useEffect(() => {
    const query = window.matchMedia(WIDE)
    const change = () => setWide(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  return wide
}
const MEDIA = ['IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO']

const getConversations = () =>
  client.get('/api/v1/communications/').then(r => (Array.isArray(r.data) ? r.data : (r.data?.results || [])))
const getConversation = id => client.get(`/api/v1/communications/${id}/`).then(r => r.data)

const needsYou = c => c?.handled_by === 'STAFF' && !!c?.handoff_reason
const withPerson = c => c?.handled_by === 'STAFF' && !c?.handoff_reason
const inVisit = c => !!c?.counter_until && new Date(c.counter_until) > new Date()

const titleCase = s => (s ? s.toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase()) : s)
const nameOf = c => titleCase(c?.display_name || c?.contact_name) || c?.contact_phone || 'Unknown'
const initialsOf = c => {
  const words = (nameOf(c) || '').replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] || '#') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
}
const clock = iso => new Date(iso).toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(/\s/g, '')
const sameDay = (a, b) => a.toDateString() === b.toDateString()
function dayLabel(iso) {
  const d = new Date(iso), now = new Date()
  if (sameDay(d, now)) return 'Today'
  if (sameDay(d, new Date(now.getTime() - 86400000))) return 'Yesterday'
  return d.toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short' })
}
function ago(iso) {
  if (!iso) return ''
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  if (mins < 1440) return `${Math.floor(mins / 60)}h`
  return dayLabel(iso)
}
function until(iso) {
  const d = new Date(iso), now = new Date()
  if (sameDay(d, now)) return clock(iso)
  if (sameDay(d, new Date(now.getTime() + 86400000))) return `${clock(iso)} tomorrow`
  return `${dayLabel(iso)}, ${clock(iso)}`
}
const size = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

// What happened to the chat (took over, handed back, resolved, at the counter):
// recorded as staff-only messages, but events, not notes anyone wrote.
const EVENT = /(took over from Octos|handed (the conversation|it) back|resolved (this|the) (conversation|chat)|reopened|at the counter|asked for a person)/i
function kindOf(m) {
  if (m.is_internal_note) return !m.media_file && (EVENT.test(m.body || '') || (m.channel === 'SYSTEM' && !m.sent_by)) ? 'event' : 'note'
  if (m.direction === 'INBOUND') return 'customer'
  return m.sent_by ? 'staff' : 'octos'
}
// Files come through Octos's own view, never straight from the bucket
// (settings.py: every file goes through the view that checks who is asking).
const fileUrl = m => `/api/v1/communications/messages/${m.id}/file/`
// Open: the file is handed to the computer to open in its own app (Acrobat,
// Word, PowerPoint, the photo viewer), as WhatsApp Desktop does. On the
// counter computers the browser saves it to a dedicated folder and opens it
// straight away (see the staff guide); Windows empties that folder on a
// schedule. There is no separate Download (Khofi, 8 Nov 2026).
// Inside the Octos desktop app, the app itself keeps the file in its private
// folder and opens it (octos-desktop, open_file); in a browser, as below.
const desktopInvoke = () => window.__TAURI__?.core?.invoke
function openFile(m) {
  client.get(fileUrl(m) + '?download=1', { responseType: 'blob' })
    .then(async r => {
      const name = m.media_name || (isPhoto(m) ? 'photo.png' : 'file')
      const invoke = desktopInvoke()
      if (invoke) {
        const bytes = new Uint8Array(await r.data.arrayBuffer())
        await invoke('open_file', bytes, { headers: { 'x-file-id': String(m.id), 'x-file-name': encodeURIComponent(name) } })
        return
      }
      const url = URL.createObjectURL(r.data)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    })
    .catch(() => window.alert('That file could not be opened. Try again.'))
}
// A photo, fetched with the user's sign-in and shown from memory.
function Photo({ m }) {
  const { data: src, isError } = useQuery({
    queryKey: ['messageFile', m.id],
    queryFn: () => client.get(fileUrl(m), { responseType: 'blob' }).then(r => URL.createObjectURL(r.data)),
    staleTime: Infinity,
  })
  if (isError) return <span className="block px-3 py-6 text-xs text-[var(--text-3)]">This photo could not be loaded.</span>
  if (!src) return <span className="block w-[220px] h-[160px] rounded-lg bg-black/[0.05] animate-pulse" />
  return (
    <button type="button" onClick={() => openFile(m)} className="block" title="Open in the photo viewer">
      <img src={src} alt={m.media_name || 'Photo'} className="block rounded-lg max-w-full" style={{ maxHeight: 340, minWidth: 160 }} />
    </button>
  )
}
const hasFile = m => !!(m.media_file || m.media_id || MEDIA.includes(m.message_type))
const isPhoto = m => (m.media_mime || '').startsWith('image/') || m.message_type === 'IMAGE'
function badge(name, mime, type) {
  const ext = (name || '').includes('.') ? name.split('.').pop() : ''
  if (ext && ext.length <= 4) return ext.toUpperCase()
  if ((mime || '').includes('pdf')) return 'PDF'
  return (type || 'FILE').slice(0, 3).toUpperCase()
}
const badgeColour = b => (b === 'PDF' ? C.red : ['DOC', 'DOCX', 'ODT', 'RTF'].includes(b) ? '#2B579A' : '#5B6B80')
// What Octos read from a file: "1 page, A5, colour, 240 KB".
function fileInfo(m) {
  if (!m.media_file) return 'Not saved yet'
  const i = m.media_info || {}
  const parts = []
  if (m.media_pages) parts.push(`${m.media_pages} page${m.media_pages === 1 ? '' : 's'}`)
  if (i.paper) parts.push(i.paper)
  if (i.colour_mode) parts.push(/^(L|1|GRAY|GREY)/i.test(i.colour_mode) ? 'black and white' : 'colour')
  if (i.word) parts.push('Word, kept as sent')
  if (m.media_size) parts.push(size(m.media_size))
  return parts.join(', ') || 'Saved'
}

// ── Icons ───────────────────────────────────────────────────────────────
const Svg = ({ size: s = 18, children, ...p }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
)
const I = {
  search: p => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>,
  plus: p => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>,
  send: p => <Svg {...p}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></Svg>,
  clip: p => <Svg {...p}><path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7" /></Svg>,
  photo: p => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 8" /></Svg>,
  panel: p => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></Svg>,
  back: p => <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>,
  check: p => <Svg {...p}><path d="m5 12 5 5L20 7" /></Svg>,
  close: p => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>,
  smile: p => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" /><path d="M9 9.5h.01M15 9.5h.01" /></Svg>,
}
const CHANNEL = {
  WHATSAPP: { label: 'WhatsApp', colour: '#1E7A4C' },
  SMS: { label: 'SMS', colour: '#A15C07' },
  EMAIL: { label: 'Email', colour: '#2563A8' },
}
const channelOf = c => CHANNEL[c?.channel] || CHANNEL.SMS

function Avatar({ c, s = 36 }) {
  return (
    <span className="shrink-0 rounded-full grid place-items-center font-bold text-white"
      style={{ width: s, height: s, fontSize: s / 2.8, background: channelOf(c).colour }}>{initialsOf(c)}</span>
  )
}

function Ticks({ msg }) {
  const marks = {
    QUEUED: ['🕓', 'Sending'], SENT: ['✓', 'Sent'], DELIVERED: ['✓✓', 'Delivered'], READ: ['✓✓', 'Read'],
    FAILED: ['Not delivered', msg.error || 'Not delivered'],
  }
  const mark = marks[msg.status]
  if (!mark || msg.channel !== 'WHATSAPP') return null
  const style = msg.status === 'READ' ? { color: C.read } : msg.status === 'FAILED' ? { color: C.redText, fontWeight: 700 } : {}
  return <span title={mark[1]} style={{ letterSpacing: mark[0] === '✓✓' ? -2 : 0, ...style }}>{mark[0]}</span>
}

// ── The list ────────────────────────────────────────────────────────────
function Row({ c, selected, onOpen }) {
  const asked = needsYou(c)
  const tag = asked ? ['Needs you', { background: C.red, color: '#fff' }]
    : withPerson(c) ? [c.assigned_to_name || 'Staff', { background: C.staff, color: C.redDeep }]
    : c.channel === 'WHATSAPP' ? ['Octos', { background: C.mint, color: C.mintIcon }] : null
  return (
    <button type="button" onClick={() => onOpen(c.id)}
      className="flex gap-2.5 w-full text-left px-3 py-2.5 border-b border-[var(--border)] transition-colors hover:bg-black/[0.02]"
      style={selected ? { background: C.redSoft, boxShadow: `inset 3px 0 0 ${C.red}` } : {}}>
      <Avatar c={c} />
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="flex justify-between gap-2 items-baseline">
          <span className="font-bold text-[13px] truncate text-[var(--text)]">{nameOf(c)}</span>
          <span className="text-[11px] text-[var(--text-3)] shrink-0">{ago(c.last_message_at)}</span>
        </span>
        <span className="text-xs truncate" style={asked ? { color: C.redText, fontWeight: 600 } : { color: 'var(--text-2)' }}>
          {asked ? `Needs you: ${c.handoff_reason}` : (c.last_message_preview || 'No messages yet')}
        </span>
        <span className="flex gap-1.5 items-center">
          {tag && <span className="text-[10.5px] font-bold px-2 py-px rounded-full" style={tag[1]}>{tag[0]}</span>}
          {c.job && <span className="text-[10.5px] text-[var(--text-3)] truncate">Job {c.job.ref}</span>}
          <span className="text-[10.5px] font-semibold" style={{ color: channelOf(c).colour }}>{channelOf(c).label}</span>
          {c.unread_count > 0 && !selected && <span className="ml-auto w-2 h-2 rounded-full" style={{ background: C.red }} aria-label="Unread" />}
        </span>
      </span>
    </button>
  )
}

// ── Starting a chat: approved messages only, until the customer replies ──
function NewMessage({ onClose, onStarted }) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [pick, setPick] = useState(null)
  const [params, setParams] = useState([])
  const [error, setError] = useState('')
  const { data } = useQuery({
    queryKey: ['startTemplates'],
    queryFn: () => client.get('/api/v1/communications/start/').then(r => r.data.templates),
    staleTime: 600_000,
  })
  const templates = data || []
  const chosen = templates.find(t => t.name === pick)
  useEffect(() => { if (chosen) setParams(p => Array.from({ length: chosen.params }, (_, i) => p[i] || (i === 0 ? name.split(' ')[0] : ''))) }, [pick]) // eslint-disable-line
  const start = useMutation({
    mutationFn: () => client.post('/api/v1/communications/start/', { phone, name, template: pick, params }),
    onSuccess: r => onStarted(r.data.conversation),
    onError: e => setError(e?.response?.data?.detail || 'That message could not be sent.'),
  })
  const preview = chosen ? params.reduce((t, v, i) => t.replace(`{${i + 1}}`, v || '…'), chosen.text) : ''
  const field = 'w-full h-9 px-2.5 text-[13px] rounded-lg border border-black/15 bg-white outline-none focus:border-zinc-900'
  return (
    <div className="absolute inset-0 z-20 bg-[var(--panel)] p-3.5 flex flex-col gap-3 overflow-y-auto">
      <div className="flex justify-between items-center">
        <span className="font-bold text-sm">New message</span>
        <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 grid place-items-center rounded-lg hover:bg-black/5"><I.close size={16} /></button>
      </div>
      <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-2)]">Customer’s name
        <input value={name} onChange={e => setName(e.target.value)} className={field} placeholder="e.g. Ama Owusu" />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-2)]">Phone number
        <input value={phone} onChange={e => setPhone(e.target.value)} className={field} placeholder="e.g. 024 400 0776" inputMode="tel" />
      </label>
      <div className="text-[11px] font-semibold text-[var(--text-2)]">Start with an approved message</div>
      {templates.map(t => (
        <button key={t.name} type="button" onClick={() => setPick(t.name)}
          className={`text-left px-3 py-2 rounded-lg bg-white text-xs leading-snug ${pick === t.name ? 'border-2 border-zinc-900' : 'border border-black/10'}`}>
          {t.text.replace(/\{1\}/, 'name').replace(/\{2\}/, 'reference')}
        </button>
      ))}
      {chosen && Array.from({ length: chosen.params }, (_, i) => (
        <label key={i} className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-2)]">{i === 0 ? 'Their name, as greeted' : 'The job or proforma number'}
          <input value={params[i] || ''} onChange={e => setParams(p => p.map((v, j) => (j === i ? e.target.value : v)))} className={field} />
        </label>
      ))}
      {chosen && <div className="px-3 py-2 rounded-lg text-xs leading-relaxed" style={{ background: C.staff }}>{preview}</div>}
      <p className="m-0 text-[11px] leading-snug text-[var(--text-3)]">WhatsApp allows only approved messages to someone who hasn’t written in 24 hours. Once they reply, you can write freely.</p>
      {error && <p className="m-0 text-xs" style={{ color: C.redText }}>{error}</p>}
      <button type="button" disabled={!chosen || !phone.trim() || params.some(p => !p?.trim()) || start.isPending}
        onClick={() => { setError(''); start.mutate() }}
        className="h-9 rounded-lg bg-zinc-900 text-white text-[13px] font-semibold disabled:bg-black/20">{start.isPending ? 'Sending…' : 'Send'}</button>
    </div>
  )
}

// ── One message ─────────────────────────────────────────────────────────
function FileCard({ m, tint }) {
  const b = badge(m.media_name, m.media_mime, m.message_type)
  return (
    <div className="flex items-center gap-2.5 w-full max-w-[400px] min-w-0 p-2 rounded-lg border border-black/5" style={{ background: tint }}>
      <span className="w-10 h-12 shrink-0 rounded-md grid place-items-center text-[11px] font-extrabold text-white" style={{ background: badgeColour(b) }}>{b}</span>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="font-bold text-[13px] truncate">{m.media_name || 'File'}</span>
        <span className="text-[11.5px] text-[var(--text-3)]">{fileInfo(m)}</span>
      </span>
      {m.media_file && (
        <span className="flex gap-1.5 shrink-0">
          <button type="button" onClick={() => openFile(m)} className="px-3 py-1 rounded-md bg-zinc-900 text-white text-[11.5px] font-semibold">Open</button>
        </span>
      )}
    </div>
  )
}

function Bubble({ m, who, first }) {
  const kind = kindOf(m)
  if (kind === 'event') {
    return <div className="self-center text-[11px] text-[var(--text-3)] py-1 text-center">{(m.body || '').replace(/\.$/, '')}, {clock(m.created_at)}</div>
  }
  if (kind === 'note') {
    // A note: a small annotation under the conversation, never mistaken for a message.
    return (
      <div className="self-end max-w-[75%] mt-0.5 flex items-start gap-1.5 px-2 py-1 rounded-md text-[11.5px] leading-snug"
        style={{ background: C.note, borderLeft: `3px solid ${C.noteBorder}`, color: C.noteText }} title="A note only staff see">
        <span aria-hidden="true">📝</span>
        <span className="min-w-0">
          <b style={{ color: C.noteMeta }}>{(m.sent_by_name || 'Staff').split(' ')[0]}:</b>{' '}
          <span className="whitespace-pre-line">{m.body && m.body !== m.media_name ? m.body : ''}</span>
          {m.media_file && <> <button type="button" onClick={() => openFile(m)} className="underline">{m.media_name || 'file'}</button></>}
        </span>
        <span className="shrink-0 text-[10px] opacity-70">{clock(m.created_at)}</span>
      </div>
    )
  }
  const mine = kind !== 'customer'
  const look = {
    octos: { bg: C.mint, label: C.mintIcon },
    staff: { bg: C.staff, label: C.redDeep },
    note: { bg: C.note, label: C.noteMeta, border: `1px dashed ${C.noteBorder}` },
    customer: { bg: '#FFFFFF', label: 'var(--text-3)', border: '1px solid #ECECEA' },
  }[kind]
  const file = hasFile(m)
  const photo = file && isPhoto(m) && m.media_file
  const text = m.body && m.body !== m.media_name ? m.body : ''
  return (
    <div className={`flex flex-col gap-0.5 ${mine ? 'items-end' : 'items-start'} ${first ? 'mt-2.5' : ''}`}>
      {first && <span className="text-[11px] font-bold px-1" style={{ color: look.label }}>{who}</span>}
      <div className={`max-w-[75%] min-w-0 flex flex-col gap-1.5 ${photo ? 'p-1.5' : 'px-3 py-2'}`}
        style={{ background: look.bg, border: look.border || 0, borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px' }}>
        {photo && <Photo m={m} />}
        {file && !photo && <FileCard m={m} tint="rgba(255,255,255,.75)" />}
        {text && <span className={`whitespace-pre-line leading-relaxed text-[13.5px] ${photo ? 'px-1.5' : ''}`}>{text}</span>}
        <span className={`self-end text-[10.5px] text-[var(--text-3)] flex items-center gap-1 ${photo ? 'px-1.5 pb-0.5' : ''}`}>
          {clock(m.created_at)} <Ticks msg={m} />
        </span>
      </div>
    </div>
  )
}

// ── The side panel ──────────────────────────────────────────────────────
function Panel({ conv, actions, files, onClose }) {
  const whatsapp = conv.channel === 'WHATSAPP'
  const state = inVisit(conv)
    ? ['At the counter', `Octos is quiet until ${clock(conv.counter_until)}.`, C.amberSoft, C.noteBorder, C.amberText]
    : needsYou(conv)
    ? [`Octos asked for a person${conv.handled_since ? ` at ${clock(conv.handled_since)}` : ''}`, `${conv.handoff_reason} Octos keeps answering until someone takes over.`, C.redSoft, C.redBorder, C.redDeep]
    : withPerson(conv)
    ? [`${conv.assigned_to_name || 'A person'} is handling this`, 'Octos is quiet until it is handed back.', C.staff, C.redBorder, C.redDeep]
    : whatsapp ? ['Octos is answering', 'Take over, or just reply, to step in.', C.mintStrip, C.mintBorder, C.mintIcon]
    : ['No assistant on this channel', 'Replies here are written by staff.', '#F6F6F4', '#E7E7E4', 'var(--text-2)']
  const job = conv.job_card
  const resolved = conv.status === 'RESOLVED'
  const small = 'flex-1 h-8 rounded-lg border border-black/15 bg-white text-xs font-semibold disabled:opacity-40'
  return (
    <aside aria-label="Details" className="w-[290px] shrink-0 bg-[var(--panel)] border-l border-[var(--border)] p-3.5 flex flex-col gap-4 overflow-y-auto">
      {onClose && (
        <button type="button" onClick={onClose} className="self-end -mb-2 h-7 px-2 rounded-md text-xs font-semibold text-[var(--text-3)] hover:bg-black/5">Close details</button>
      )}
      <div className="flex flex-col gap-1.5 p-3 rounded-xl" style={{ background: state[2], border: `1px solid ${state[3]}` }}>
        <span className="font-bold text-[13px]" style={{ color: state[4] }}>{resolved ? 'Resolved' : state[0]}</span>
        {!resolved && <span className="text-[12.5px] leading-snug text-[var(--text)]">{state[1]}</span>}
        {!resolved && (
          <div className="flex gap-1.5">
            {whatsapp && !inVisit(conv) && <button type="button" onClick={actions.atCounter} className={small}>At the counter</button>}
            <button type="button" onClick={actions.resolve} className={small}>✓ Resolve</button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10.5px] font-bold tracking-wider text-[var(--text-3)]">CUSTOMER</span>
        <span className="font-bold text-sm">{nameOf(conv)}</span>
        <span className="text-[12.5px] text-[var(--text-2)]">{conv.contact_phone || conv.contact_email}</span>
        <span className="text-xs text-[var(--text-3)]">{conv.customer ? 'Registered customer' : 'Not registered yet'}</span>
      </div>

      {job && (
        <div className="flex flex-col gap-1 p-2.5 rounded-xl border border-[var(--border)]">
          <span className="text-[10.5px] font-bold tracking-wider text-[var(--text-3)]">JOB</span>
          <span className="flex items-center gap-1.5 flex-wrap">
            <b className="text-[13px]">{job.ref}</b>
            <span className="text-[11px] font-semibold px-2 py-px rounded-full" style={{ background: C.amberSoft, color: C.amberText }}>
              {job.ready_to_collect ? 'Ready to collect' : job.out_for_delivery ? 'Out for delivery' : job.stage}
            </span>
          </span>
          {job.what && <span className="text-[12.5px] text-[var(--text-2)]">{job.what}</span>}
          {job.promised_ready && <span className="text-xs text-[var(--text-3)]">Promised {job.promised_ready}</span>}
          <span className="text-xs text-[var(--text-3)]">{job.paid_in_full ? 'Paid in full' : job.balance_due ? `${job.balance_due} to pay` : ''}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[10.5px] font-bold tracking-wider text-[var(--text-3)]">FILES IN THIS CHAT</span>
        {files.length === 0 && <span className="text-xs text-[var(--text-3)]">None yet</span>}
        {files.map(m => {
          const b = badge(m.media_name, m.media_mime, m.message_type)
          return (
            <button type="button" key={m.id} onClick={() => openFile(m)} className="flex items-center gap-2 text-left text-[12.5px] hover:bg-black/[0.03] rounded-md p-0.5">
              <span className="w-7 h-9 shrink-0 rounded grid place-items-center text-[9px] font-extrabold text-white" style={{ background: badgeColour(b) }}>{b}</span>
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="font-semibold truncate">{m.media_name || (isPhoto(m) ? 'Photo' : 'File')}</span>
                <span className="text-[11px] text-[var(--text-3)] truncate">{kindOf(m) === 'customer' ? 'From the customer' : kindOf(m) === 'octos' ? 'From Octos' : 'From staff'}, {clock(m.created_at)}</span>
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

// ── The open chat ───────────────────────────────────────────────────────
function Thread({ convId, onBack, panel, setPanel }) {
  const queryClient = useQueryClient()
  const wide = useWide()
  const [reply, setReply] = useState('')
  const [asNote, setAsNote] = useState(false)
  const [chips, setChips] = useState([])
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const scroller = useRef(null)
  const filePick = useRef(null)
  const box = useRef(null)
  const [emojis, setEmojis] = useState(false)
  // An emoji goes where the cursor is, and the box keeps its focus.
  const addEmoji = e => {
    const el = box.current
    const at = el ? el.selectionStart : reply.length
    const end = el ? el.selectionEnd : reply.length
    setReply(r => r.slice(0, at) + e + r.slice(end))
    setEmojis(false)
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(at + e.length, at + e.length) } })
  }

  const { data: conv, isLoading } = useQuery({
    queryKey: ['conversation', convId],
    queryFn: () => getConversation(convId),
    staleTime: 2_000,
    refetchInterval: 3_000,   // new messages and ticks appear on their own
  })
  const messages = conv?.messages || []
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight }, [messages.length, convId])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['conversation', convId] })
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }
  const act = path => ({ mutationFn: () => client.post(`/api/v1/communications/${convId}/${path}/`), onSuccess: refresh })
  const takeOver = useMutation(act('take-over'))
  const handBack = useMutation(act('hand-back'))
  const atCounter = useMutation(act('at-counter'))
  const resolve = useMutation(act('resolve'))
  const send = useMutation({
    mutationFn: () => {
      if (!chips.length) return client.post(`/api/v1/communications/${convId}/reply/`, { body: reply, is_internal_note: asNote })
      const form = new FormData()
      chips.forEach(f => form.append('attachments', f))
      form.append('body', reply)
      form.append('is_internal_note', asNote ? 'true' : 'false')
      return client.post(`/api/v1/communications/${convId}/reply/`, form)
    },
    onSuccess: () => { setReply(''); setChips([]); setError(''); setAsNote(false); refresh() },
    // The server says why (a closed window, a file too big); what was typed stays.
    onError: err => setError(err?.response?.data?.detail || 'Could not send. Try again.'),
  })

  const addFiles = list => {
    const files = Array.from(list || [])
    const big = files.filter(f => f.size > MAX_FILE)
    if (big.length) setError(`${big.map(f => f.name).join(', ')} is over 16 MB.`)
    setChips(c => [...c, ...files.filter(f => f.size <= MAX_FILE)])
  }

  if (isLoading || !conv) {
    return <div className="flex-1 p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-[var(--bg)] rounded-xl animate-pulse" />)}</div>
  }

  const whatsapp = conv.channel === 'WHATSAPP'
  const resolved = conv.status === 'RESOLVED'
  const closes = conv.window_closes_at
  const windowOpen = whatsapp && closes && new Date(closes) > new Date()
  const windowLine = !whatsapp ? `${channelOf(conv).label}: text only.`
    : windowOpen ? `Free replies open until ${until(closes)}.` : 'Free replies closed until the customer writes again. Use New message.'
  const taken = withPerson(conv)
  const mainButton = (
    <button type="button" onClick={() => (taken ? handBack : takeOver).mutate()} disabled={takeOver.isPending || handBack.isPending}
      className="w-full h-[34px] px-3.5 rounded-lg text-[12.5px] font-semibold disabled:opacity-40"
      style={taken ? { background: C.mintStrip, border: `1px solid ${C.mintBorder}`, color: C.mintIcon } : { background: '#16181D', color: '#fff' }}>
      {taken ? 'Hand back to Octos' : 'Take over'}
    </button>
  )
  const files = messages.filter(m => hasFile(m) && m.media_file)
  const submit = () => { if ((reply.trim() || chips.length) && !send.isPending) send.mutate() }

  let lastWho = '', lastDay = ''
  return (
    <div className="flex-1 min-w-0 flex relative">
      <section aria-label="Conversation" className="flex-1 min-w-0 flex flex-col bg-[#FBFBFA]"
        onDragOver={e => { e.preventDefault(); if (!resolved) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); if (!resolved) addFiles(e.dataTransfer.files) }}>
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[var(--panel)] border-b border-[var(--border)]">
          <button type="button" onClick={onBack} aria-label="All conversations" className="lg:hidden w-8 h-8 -ml-1 grid place-items-center rounded-lg"><I.back size={18} /></button>
          <Avatar c={conv} s={38} />
          <div className="flex-1 min-w-0 flex flex-col">
            <h2 className="m-0 text-[14.5px] font-bold truncate">{nameOf(conv)}</h2>
            <span className="text-[11.5px] text-[var(--text-3)] truncate">{channelOf(conv).label}, {conv.contact_phone || conv.contact_email}</span>
          </div>
          {!resolved && whatsapp && <div className="w-auto">{mainButton}</div>}
          <button type="button" onClick={() => setPanel(p => !p)} aria-label="Details" title="Details" aria-pressed={panel}
            className="w-[34px] h-[34px] rounded-lg grid place-items-center"
            style={panel ? { background: '#16181D', color: '#fff' } : { border: '1px solid var(--border)' }}><I.panel size={17} /></button>
        </div>

        <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 py-3 flex flex-col gap-1 relative">
          {dragging && <div className="absolute inset-2 z-10 rounded-xl border-2 border-dashed border-zinc-900 bg-white/80 grid place-items-center text-sm font-semibold">Drop to attach</div>}
          {messages.length === 0 && <div className="text-center text-sm text-[var(--text-3)] py-8">No messages yet</div>}
          {messages.map(m => {
            const kind = kindOf(m)
            const who = kind === 'octos' ? 'Octos' : kind === 'staff' ? `${m.sent_by_name || 'Staff'}, staff`
              : kind === 'customer' ? nameOf(conv) : ''
            const day = dayLabel(m.created_at)
            const newDay = day !== lastDay
            const first = newDay || (who && who !== lastWho)
            lastDay = day
            if (who) lastWho = who   // notes and events don't break a speaker's run
            return (
              <div key={m.id} className="flex flex-col">
                {newDay && (
                  <div className="flex items-center gap-3 text-[11px] text-[var(--text-3)] py-2">
                    <span className="flex-1 h-px bg-[var(--border)]" /><span>{day}</span><span className="flex-1 h-px bg-[var(--border)]" />
                  </div>
                )}
                <Bubble m={m} who={who} first={!!who && first} />
              </div>
            )
          })}
        </div>

        {!resolved && (
          <div className="bg-[var(--panel)] border-t border-[var(--border)] px-4 pt-2 pb-2.5 flex flex-col gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div role="tablist" aria-label="Write" className="flex gap-0.5 p-[3px] rounded-lg bg-black/[0.05]">
                {[[false, 'Reply'], [true, 'Note, staff only']].map(([note, label]) => (
                  <button key={label} type="button" role="tab" aria-selected={asNote === note} onClick={() => setAsNote(note)}
                    className={`h-7 px-3 rounded-md text-xs ${asNote === note ? 'bg-white shadow-sm font-bold' : 'font-semibold text-[var(--text-3)]'}`}>{label}</button>
                ))}
              </div>
              <span className="text-[11.5px]" style={{ color: asNote ? C.noteMeta : windowOpen ? '#1E7A4C' : 'var(--text-3)' }}>
                {asNote ? 'Only staff see notes.' : `${!taken && whatsapp ? 'Sending takes this chat over from Octos. ' : ''}${windowLine}`}
              </span>
            </div>
            {chips.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {chips.map((f, i) => {
                  const b = badge(f.name, f.type)
                  return (
                    <span key={`${f.name}-${i}`} className="inline-flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-lg border border-black/10 bg-[#FAFAF9]">
                      {f.type.startsWith('image/')
                        ? <img src={URL.createObjectURL(f)} alt="" className="w-8 h-8 rounded object-cover" />
                        : <span className="w-8 h-8 rounded grid place-items-center text-[9px] font-extrabold text-white" style={{ background: badgeColour(b) }}>{b}</span>}
                      <span className="flex flex-col"><span className="text-xs font-semibold max-w-[180px] truncate">{f.name}</span><span className="text-[10.5px] text-[var(--text-3)]">{size(f.size)}</span></span>
                      <button type="button" onClick={() => setChips(c => c.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="w-6 h-6 grid place-items-center rounded hover:bg-black/5"><I.close size={13} /></button>
                    </span>
                  )
                })}
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={filePick} type="file" multiple className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
              <button type="button" onClick={() => filePick.current?.click()} aria-label="Attach photos or documents" title="Attach photos or documents"
                className="w-[38px] h-[38px] shrink-0 rounded-lg border border-[var(--border)] bg-white grid place-items-center text-[var(--text-2)]"><I.clip size={18} /></button>
              <div className="relative">
                <button type="button" onClick={() => setEmojis(v => !v)} aria-label="Add an emoji" title="Add an emoji" aria-expanded={emojis}
                  className="w-[38px] h-[38px] shrink-0 rounded-lg border border-[var(--border)] bg-white grid place-items-center text-[var(--text-2)]"><I.smile size={18} /></button>
                {emojis && (
                  <div className="absolute bottom-[46px] left-0 z-30 w-[288px] p-2 rounded-xl border border-[var(--border)] bg-white shadow-xl grid grid-cols-8 gap-0.5">
                    {EMOJIS.map(e => (
                      <button key={e} type="button" onClick={() => addEmoji(e)} aria-label={e}
                        className="w-8 h-8 rounded-md text-lg hover:bg-black/5 grid place-items-center">{e}</button>
                    ))}
                  </div>
                )}
              </div>
              <label htmlFor="reply" className="sr-only">{asNote ? 'Note' : 'Reply'}</label>
              <textarea id="reply" ref={box} rows={2} value={reply}
                onChange={e => { setReply(e.target.value); setError('') }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }}
                onPaste={e => { if (e.clipboardData?.files?.length) { e.preventDefault(); addFiles(e.clipboardData.files) } }}
                placeholder={asNote ? 'Write a note only staff see' : `Reply to ${nameOf(conv)}`}
                className="flex-1 min-h-[38px] max-h-32 px-3 py-2 text-[13.5px] leading-snug rounded-lg outline-none resize-none"
                style={asNote ? { background: C.note, border: `1px dashed ${C.noteBorder}` } : { background: '#fff', border: '1px solid var(--border)' }} />
              <button type="button" onClick={submit} disabled={(!reply.trim() && !chips.length) || send.isPending} aria-label={asNote ? 'Save note' : 'Send'}
                className="w-[42px] h-[38px] shrink-0 rounded-lg grid place-items-center text-white disabled:opacity-40"
                style={{ background: asNote ? C.noteMeta : C.red }}>{asNote ? <I.check size={18} /> : <I.send size={17} />}</button>
            </div>
            {error && <p className="m-0 text-xs" style={{ color: C.redText }}>{error}</p>}
            <span className="text-[11px] text-[var(--text-3)]">Enter sends, Shift+Enter adds a line. Drop files here, or paste a screenshot.</span>
          </div>
        )}
      </section>

      {panel && (
        <div className={wide ? 'flex' : 'absolute right-0 top-0 bottom-0 z-30 flex shadow-2xl'}>
          <Panel conv={conv} files={files} onClose={wide ? null : () => setPanel(false)} actions={{
            atCounter: () => atCounter.mutate(),
            resolve: () => resolve.mutate(),
          }} />
        </div>
      )}
    </div>
  )
}

// ── The page ────────────────────────────────────────────────────────────
const TABS = ['ALL', 'WHATSAPP', 'SMS', 'EMAIL']
const FILTERS = [
  { key: 'needs', label: 'Needs you', test: needsYou },
  { key: 'octos', label: 'Octos', test: c => c.handled_by === 'OCTOS' && c.channel === 'WHATSAPP' },
  { key: 'people', label: 'People', test: withPerson },
]

export default function Inbox() {
  const queryClient = useQueryClient()
  const [channel, setChannel] = useState('ALL')
  const [filter, setFilter] = useState(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [panel, setPanel] = useState(() => window.matchMedia(WIDE).matches)
  const [starting, setStarting] = useState(false)

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    staleTime: 10_000,
    refetchInterval: 15_000,
    placeholderData: prev => prev,
  })

  const needsCount = conversations.filter(needsYou).length
  const unread = conversations.filter(c => c.unread_count > 0).length
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const f = FILTERS.find(x => x.key === filter)
    return conversations
      .filter(c => channel === 'ALL' || c.channel === channel)
      .filter(c => !f || f.test(c))
      .filter(c => !q || [nameOf(c), c.contact_phone, c.last_message_preview, c.job?.ref, c.job?.what].some(v => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => (needsYou(b) - needsYou(a)) || (new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)))
  }, [conversations, channel, filter, query])

  useEffect(() => {
    if (!selectedId && shown.length && window.matchMedia('(min-width: 1024px)').matches) setSelectedId(shown[0].id)
  }, [shown, selectedId])

  return (
    <div className="flex flex-col text-[13.5px] bg-[#F6F6F4] border border-[var(--border)] rounded-2xl overflow-hidden m-2"
      style={{ height: 'calc(100vh - 100px)', minHeight: 560 }}>
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--panel)] border-b border-[var(--border)]">
        <div className="flex flex-col shrink-0">
          <span className="text-base font-bold">Inbox</span>
          <span className="text-[11.5px] text-[var(--text-2)]">
            {needsCount > 0 && <b style={{ color: C.redText }}>{needsCount} need{needsCount === 1 ? 's' : ''} you, </b>}
            {unread} unread. Octos is answering the rest.
          </span>
        </div>
        <div className="relative flex-[1_1_220px] max-w-[320px] min-w-[140px]">
          <I.search size={15} className="absolute left-2.5 top-[9px] text-[var(--text-3)]" />
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search conversations"
            placeholder="Search names, numbers, messages or jobs"
            className="w-full h-[33px] pl-8 pr-2.5 text-[12.5px] rounded-lg border border-[var(--border)] bg-[#FAFAF9] outline-none focus:border-zinc-900" />
        </div>
        <div role="tablist" aria-label="Channel" className="flex shrink-0 gap-0.5 p-[3px] rounded-[10px] bg-black/[0.05]">
          {TABS.map(t => (
            <button key={t} type="button" role="tab" aria-selected={channel === t} onClick={() => setChannel(t)}
              className={`h-7 px-3 rounded-md text-xs ${channel === t ? 'bg-white shadow-sm font-bold' : 'font-semibold text-[var(--text-3)]'}`}>
              {t === 'ALL' ? 'All' : CHANNEL[t].label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setStarting(s => !s)}
          className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-[33px] px-3.5 rounded-lg bg-zinc-900 text-white text-[12.5px] font-semibold">
          <I.plus size={14} />New message
        </button>
      </div>

      <div className="flex-1 min-h-0 flex">
        <section aria-label="Conversations"
          className={`${selectedId ? 'hidden lg:flex' : 'flex'} w-full lg:w-[280px] shrink-0 flex-col bg-[var(--panel)] border-r border-[var(--border)] relative`}>
          <div className="flex gap-1.5 flex-wrap px-3 py-2 border-b border-[var(--border)]">
            {FILTERS.map(f => {
              const on = filter === f.key, red = f.key === 'needs'
              return (
                <button key={f.key} type="button" aria-pressed={on} onClick={() => setFilter(on ? null : f.key)}
                  className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                  style={on ? { background: red ? C.red : '#16181D', color: '#fff', border: '1px solid transparent' }
                    : red ? { background: C.redSoft, color: C.redText, border: `1px solid ${C.redBorder}` }
                    : { background: 'var(--panel)', border: '1px solid var(--border)' }}>
                  {f.label}{red && needsCount ? `, ${needsCount}` : ''}
                </button>
              )
            })}
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? [1, 2, 3].map(i => <div key={i} className="h-16 m-3 bg-[var(--bg)] rounded-xl animate-pulse" />)
              : shown.length === 0 ? (
                <div className="p-8 text-center text-sm text-[var(--text-3)]">
                  {query || filter ? 'Nothing matches. Clear the search or filter to see everything.' : 'Messages from customers will appear here.'}
                </div>
              ) : shown.map(c => <Row key={c.id} c={c} selected={c.id === selectedId} onOpen={setSelectedId} />)}
          </div>
          {starting && (
            <NewMessage onClose={() => setStarting(false)} onStarted={id => {
              setStarting(false)
              queryClient.invalidateQueries({ queryKey: ['conversations'] })
              setSelectedId(id)
            }} />
          )}
        </section>

        <div className={`${selectedId ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0`}>
          {selectedId
            ? <Thread key={selectedId} convId={selectedId} onBack={() => setSelectedId(null)} panel={panel} setPanel={setPanel} />
            : <div className="flex-1 grid place-items-center text-sm text-[var(--text-3)]">Choose a conversation to read it.</div>}
        </div>
      </div>
    </div>
  )
}
