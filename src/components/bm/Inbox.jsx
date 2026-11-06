// src/components/bm/Inbox.jsx
//
// The inbox: conversations on the left, the open one on the right.
// Colour carries who is speaking: mint is Octos, soft red is a person,
// solid red is "needs you". Built from the Octos Inbox canvas (Nov 2026).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'

const C = {
  red: '#D0342C', redText: '#B42318', redDeep: '#8E2A22', redSoft: '#FDF0EF', redBorder: '#F3C6C2',
  mint: '#E4F3EB', mintText: '#12241A', mintMeta: '#2C5B42', mintStrip: '#F2F8F4', mintBorder: '#D3EADD', mintIcon: '#1E6B47',
  staff: '#FBE7E5', staffText: '#2A1412', staffMeta: '#7A3A33',
  note: '#FFF8E6', noteBorder: '#E8C66A', noteText: '#3A2D05', noteMeta: '#7A5A06',
  bubble: '#F1F2F4', amberSoft: '#FFF4E5', amberText: '#8A4B08', read: '#2563A8',
}

const getConversations = () =>
  client.get('/api/v1/communications/').then(r => {
    const d = r.data
    return Array.isArray(d) ? d : (d?.results || [])
  })
const getConversation = id => client.get(`/api/v1/communications/${id}/`).then(r => r.data)

const needsYou = c => c?.handled_by === 'STAFF' && !!c?.handoff_reason
const withPerson = c => c?.handled_by === 'STAFF' && !c?.handoff_reason
const MEDIA = ['IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO']

function titleCase(s) {
  return s ? s.toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase()) : s
}
function nameOf(c) {
  return titleCase(c?.display_name || c?.contact_name) || c?.contact_phone || 'Unknown'
}
function clock(iso) {
  return new Date(iso).toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' })
    .toLowerCase().replace(/\s/g, '')
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function dayLabel(iso) {
  const d = new Date(iso), now = new Date(), yesterday = new Date(now.getTime() - 86400000)
  if (sameDay(d, now)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
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
  const d = new Date(iso), now = new Date(), tomorrow = new Date(now.getTime() + 86400000)
  if (sameDay(d, now)) return clock(iso)
  if (sameDay(d, tomorrow)) return `${clock(iso)} tomorrow`
  return `${dayLabel(iso)}, ${clock(iso)}`
}
// Who said it: the customer, a file they sent, Octos, a person, a staff-only
// note, or an event (took over, handed back, resolved), which is one quiet line.
function kindOf(m) {
  if (m.is_internal_note) return m.channel === 'SYSTEM' ? 'event' : 'note'
  if (m.direction === 'INBOUND') {
    return (m.media_id || m.media_file || MEDIA.includes(m.message_type)) ? 'file' : 'customer'
  }
  return m.sent_by ? 'staff' : 'octos'
}

// A file's badge (its extension, else its type) and its details line.
function fileBadge(m) {
  const ext = (m.media_name || '').includes('.') ? m.media_name.split('.').pop() : ''
  return (ext && ext.length <= 4 ? ext : (m.message_type || 'FILE').slice(0, 3)).toUpperCase()
}
function fileDetail(m) {
  if (!m.media_file) return 'Not saved yet'
  const parts = []
  if (m.media_pages) parts.push(`${m.media_pages} page${m.media_pages === 1 ? '' : 's'}`)
  if (m.media_size) parts.push(m.media_size >= 1048576
    ? `${(m.media_size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(m.media_size / 1024))} KB`)
  return parts.join(', ') || 'Saved'
}
// ── Icons ───────────────────────────────────────────────────────────────
const Svg = ({ size = 18, children, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
)
const WhatsAppIcon = p => <Svg {...p}><path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3.2 3.2Z" /><path d="M9 9.5c.3 2.3 2.2 4.3 4.5 4.8l1.2-1.2 1.8.8-.4 1.6c-3.6.3-7.4-3.4-7.2-7.1l1.6-.4.8 1.8Z" /></Svg>
const MailIcon = p => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Svg>
const SmsIcon = p => <Svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" /></Svg>
const PersonIcon = p => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>
const FolderIcon = p => <Svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></Svg>
const SearchIcon = p => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
const CheckIcon = p => <Svg {...p}><path d="m5 12 5 5L20 7" /></Svg>
const SendIcon = p => <Svg {...p}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></Svg>
const BackIcon = p => <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>
const Spark = ({ size = 12, color = C.mintIcon }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4Z" />
  </svg>
)

const CHANNEL = {
  WHATSAPP: { label: 'WhatsApp', Icon: WhatsAppIcon, tile: '#E9F6EE', ink: '#1E7A4C' },
  EMAIL: { label: 'Email', Icon: MailIcon, tile: '#EAF1FB', ink: '#2563A8' },
  SMS: { label: 'SMS', Icon: SmsIcon, tile: '#FFF4E5', ink: '#A15C07' },
}
const channelOf = c => CHANNEL[c?.channel] || CHANNEL.SMS

function ChannelTile({ channel, size = 40 }) {
  const ch = CHANNEL[channel] || CHANNEL.SMS
  return (
    <span className="flex items-center justify-center shrink-0 rounded-xl"
      style={{ width: size, height: size, background: ch.tile, color: ch.ink }}>
      <ch.Icon size={size / 2} />
    </span>
  )
}

// WhatsApp's own ticks; a failed message names Meta's reason on hover.
function Ticks({ msg }) {
  const marks = {
    QUEUED: { text: '🕓', title: 'Sending' },
    SENT: { text: '✓', title: 'Sent' },
    DELIVERED: { text: '✓✓', title: 'Delivered' },
    READ: { text: '✓✓', title: 'Read', style: { color: C.read } },
    FAILED: { text: 'Not delivered', title: msg.error || 'Not delivered', style: { color: C.redText, fontWeight: 700 } },
  }
  const mark = marks[msg.status]
  if (!mark || msg.channel !== 'WHATSAPP') return null
  return <span title={mark.title} style={{ letterSpacing: mark.text === '✓✓' ? -2 : 0, ...mark.style }}>{mark.text}</span>
}

// ── The list ────────────────────────────────────────────────────────────
function Row({ c, selected, onOpen }) {
  const asked = needsYou(c)
  return (
    <button type="button" onClick={() => onOpen(c.id)}
      className="flex gap-2.5 w-full text-left px-3.5 py-3 border-b border-[var(--border)] transition-colors"
      style={{ background: selected ? C.redSoft : 'var(--panel)' }}>
      <ChannelTile channel={c.channel} size={34} />
      <span className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="flex justify-between gap-2 items-baseline">
          <span className="font-semibold text-sm truncate text-[var(--text)]">{nameOf(c)}</span>
          <span className="text-xs text-[var(--text-3)] shrink-0">{ago(c.last_message_at)}</span>
        </span>
        <span className="text-[12.5px] truncate"
          style={asked ? { color: C.redText, fontWeight: 600 } : { color: 'var(--text-2)' }}>
          {asked ? `Needs you: ${c.handoff_reason}` : (c.last_message_preview || 'No messages yet')}
        </span>
        <span className="flex gap-1.5 items-center flex-wrap mt-0.5">
          {asked ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: C.red }}>Needs you</span>
          ) : withPerson(c) ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: C.staff, color: C.redDeep }}>
              {c.assigned_to_name || 'Staff'}
            </span>
          ) : c.channel === 'WHATSAPP' ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: C.mint, color: C.mintIcon }}>Octos</span>
          ) : null}
          {c.job && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-2)] inline-flex items-center gap-1 max-w-[220px]">
              <FolderIcon size={12} /><span className="truncate">Job {c.job.ref}, {c.job.what}</span>
            </span>
          )}
          {c.unread_count > 0 && (
            <span className="ml-auto w-2.5 h-2.5 rounded-full" style={{ background: C.red }} aria-label="Unread" />
          )}
        </span>
      </span>
    </button>
  )
}

// ── The open conversation ───────────────────────────────────────────────
function StatusStrip({ conv }) {
  if (needsYou(conv)) {
    return (
      <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl flex gap-2.5 items-start text-[13px]"
        style={{ background: C.redSoft, border: `1px solid ${C.redBorder}` }}>
        <span style={{ color: C.redText }} className="mt-0.5"><PersonIcon size={17} /></span>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-bold" style={{ color: C.redDeep }}>
            Octos asked for a person{conv.handled_since ? ` at ${clock(conv.handled_since)}` : ''}
          </span>
          <span className="leading-relaxed" style={{ color: '#3B2321' }}>{conv.handoff_reason}</span>
          <span className="text-[13px]" style={{ color: '#6B4743' }}>Octos keeps answering until someone takes over.</span>
        </div>
      </div>
    )
  }
  if (withPerson(conv)) {
    return (
      <div className="mx-4 mt-3 px-3.5 py-2 rounded-xl flex gap-2 items-center text-[13px]"
        style={{ background: C.staff, border: `1px solid ${C.redBorder}`, color: '#5C1F1A' }}>
        <PersonIcon size={18} />
        <span>
          {conv.assigned_to_name || 'A person'} is handling this
          {conv.handled_since ? ` since ${clock(conv.handled_since)}` : ''}. Octos is quiet until you hand it back.
        </span>
      </div>
    )
  }
  if (conv.channel !== 'WHATSAPP') return null
  return (
    <div className="mx-4 mt-3 px-3.5 py-2 rounded-xl flex gap-2 items-center text-[13px]"
      style={{ background: C.mintStrip, border: `1px solid ${C.mintBorder}`, color: '#1D4630' }}>
      <Spark size={16} />
      <span>Octos is answering. Take over, or just reply, to step in.</span>
    </div>
  )
}

function JobCard({ job }) {
  if (!job) return null
  const done = job.ready_to_collect ? 'Ready to collect' : job.out_for_delivery ? 'Out for delivery' : job.stage
  const parts = [
    job.what,
    job.promised_ready && `Promised ${job.promised_ready}`,
    job.paid_in_full ? 'Paid in full' : job.balance_due && `${job.balance_due} to pay`,
  ].filter(Boolean)
  return (
    <div className="mx-4 mt-2.5 px-3.5 py-2.5 rounded-xl border border-[var(--border)] flex gap-3 items-center">
      <span className="text-[var(--text-2)]"><FolderIcon size={18} /></span>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-[var(--text)]">Job {job.ref}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: C.amberSoft, color: C.amberText }}>{done}</span>
          {job.branch && <span className="text-xs text-[var(--text-3)]">{job.branch}</span>}
        </span>
        <span className="text-[13px] text-[var(--text-2)]">{parts.join('. ')}</span>
      </div>
    </div>
  )
}

function Bubble({ m }) {
  const kind = kindOf(m)
  if (kind === 'event') {
    return (
      <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-3)] py-1 px-6 text-center">
        <PersonIcon size={14} /><span>{m.body}, {clock(m.created_at)}</span>
      </div>
    )
  }
  if (kind === 'note') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-lg px-3 py-2 flex flex-col gap-1"
          style={{ background: C.note, border: `1px dashed ${C.noteBorder}` }}>
          <span className="text-xs font-bold" style={{ color: C.noteMeta }}>Note, only staff see this</span>
          <span className="leading-relaxed whitespace-pre-wrap" style={{ color: C.noteText }}>{m.body}</span>
          <span className="text-[11px] self-end" style={{ color: C.noteMeta }}>{m.sent_by_name || 'Staff'}, {clock(m.created_at)}</span>
        </div>
      </div>
    )
  }
  if (kind === 'customer' || kind === 'file') {
    return (
      <div className="flex">
        <div className="max-w-[75%] flex flex-col gap-0.5 px-3 py-2"
          style={{ background: C.bubble, borderRadius: '16px 16px 16px 6px' }}>
          {kind === 'file' && (
            <span className="flex items-center gap-3 py-1">
              <span className="w-9 h-11 rounded-lg flex items-center justify-center text-[11px] font-bold"
                style={{ background: C.redSoft, color: C.redText }}>{fileBadge(m)}</span>
              <span className="flex flex-col">
                <span className="font-semibold text-[var(--text)]">{m.media_file ? <a href={m.media_file} target="_blank" rel="noreferrer" className="underline">{m.media_name || titleCase(m.message_type) || 'File'}</a> : (m.media_name || titleCase(m.message_type) || 'File')}</span>
                <span className="text-xs text-[var(--text-3)]">
                  {fileDetail(m)}
                </span>
              </span>
            </span>
          )}
          {m.body && m.body !== m.media_name && <span className="leading-relaxed whitespace-pre-wrap text-[var(--text)]">{m.body}</span>}
          <span className="text-[11px] text-[var(--text-3)] self-end">{clock(m.created_at)}</span>
        </div>
      </div>
    )
  }
  const octos = kind === 'octos'
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] flex flex-col gap-0.5 px-3 py-2"
        style={{ background: octos ? C.mint : C.staff, borderRadius: '16px 16px 6px 16px' }}>
        {m.message_type === 'IMAGE' && m.media_file && (<a href={m.media_file} target="_blank" rel="noreferrer"><img src={m.media_file} alt="Card sent to the customer" className="rounded-lg max-w-full mb-1" style={{ maxHeight: 360 }} /></a>)}
        <span className="leading-relaxed whitespace-pre-wrap" style={{ color: octos ? C.mintText : C.staffText }}>{m.body}</span>
        <span className="text-[11px] self-end flex items-center gap-1.5" style={{ color: octos ? C.mintMeta : C.staffMeta }}>
          {octos && <Spark />}
          {octos ? 'Octos' : (m.sent_by_name || 'Staff')}, {clock(m.created_at)}
          <Ticks msg={m} />
        </span>
      </div>
    </div>
  )
}

function Thread({ convId, onBack }) {
  const queryClient = useQueryClient()
  const [reply, setReply] = useState('')
  const [asNote, setAsNote] = useState(false)
  const [error, setError] = useState('')
  const scroller = useRef(null)

  const { data: conv, isLoading } = useQuery({
    queryKey: ['conversation', convId],
    queryFn: () => getConversation(convId),
    staleTime: 2_000,
    // While open, every 3 seconds: new messages and ticks appear on their own.
    refetchInterval: 3_000,
  })
  const messages = conv?.messages || []

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight
  }, [messages.length, convId])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['conversation', convId] })
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }
  const act = path => ({ mutationFn: () => client.post(`/api/v1/communications/${convId}/${path}/`), onSuccess: refresh })
  const takeOver = useMutation(act('take-over'))
  const handBack = useMutation(act('hand-back'))
  const resolve = useMutation(act('resolve'))
  const send = useMutation({
    mutationFn: () => client.post(`/api/v1/communications/${convId}/reply/`, { body: reply, is_internal_note: asNote }),
    onSuccess: () => { setReply(''); setError(''); setAsNote(false); refresh() },
    // The server says why (a closed WhatsApp window, say); the typed text stays.
    onError: err => setError(err?.response?.data?.detail || 'Could not send. Try again.'),
  })

  if (isLoading || !conv) {
    return <div className="flex-1 p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-[var(--bg)] rounded-xl animate-pulse" />)}</div>
  }

  const ch = channelOf(conv)
  const closes = conv.window_closes_at
  const windowLine = conv.channel !== 'WHATSAPP' || !closes ? ''
    : new Date(closes) > new Date() ? `Free replies open until ${until(closes)}`
    : 'Free replies closed until the customer writes again'
  const sub = [ch.label, conv.contact_phone || conv.contact_email, windowLine].filter(Boolean).join('. ')
  const resolved = conv.status === 'RESOLVED'

  const submit = () => { if (reply.trim() && !send.isPending) send.mutate() }
  const onKey = e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() }
  }

  let lastDay = ''
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 border-b border-[var(--border)]">
        <button type="button" onClick={onBack} aria-label="All conversations"
          className="lg:hidden w-9 h-9 -ml-1 flex items-center justify-center rounded-xl text-[var(--text)]"><BackIcon size={20} /></button>
        <ChannelTile channel={conv.channel} size={36} />
        <div className="flex-1 min-w-[180px] flex flex-col gap-0.5">
          <h2 className="m-0 text-[15px] font-bold text-[var(--text)]">{nameOf(conv)}</h2>
          <span className="text-xs text-[var(--text-3)]">{sub}</span>
        </div>
        {!resolved && conv.channel === 'WHATSAPP' && (withPerson(conv) ? (
          <button type="button" onClick={() => handBack.mutate()} disabled={handBack.isPending}
            className="h-9 px-3 rounded-lg font-semibold text-[13px] flex items-center gap-2 disabled:opacity-40"
            style={{ background: C.mintStrip, border: `1px solid ${C.mintBorder}`, color: '#1D4630' }}>
            <Spark size={14} />Hand back to Octos
          </button>
        ) : (
          <button type="button" onClick={() => takeOver.mutate()} disabled={takeOver.isPending}
            className="h-9 px-4 rounded-lg font-semibold text-[13px] text-white bg-[var(--text)] disabled:opacity-40">
            Take over
          </button>
        ))}
        {!resolved && (
          <button type="button" onClick={() => resolve.mutate()} disabled={resolve.isPending}
            className="h-9 px-3 rounded-lg font-semibold text-[13px] flex items-center gap-2 border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] disabled:opacity-40">
            <CheckIcon size={16} />Resolve
          </button>
        )}
      </div>

      {!resolved && <StatusStrip conv={conv} />}
      <JobCard job={conv.job_card} />

      <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {messages.length === 0 && <div className="text-center text-sm text-[var(--text-3)] py-8">No messages yet</div>}
        {messages.map(m => {
          const day = dayLabel(m.created_at)
          const separator = day !== lastDay
          lastDay = day
          return (
            <div key={m.id} className="flex flex-col gap-2.5">
              {separator && (
                <div className="flex items-center gap-3 text-xs text-[var(--text-3)] py-1">
                  <span className="flex-1 h-px bg-[var(--border)]" /><span>{day}</span><span className="flex-1 h-px bg-[var(--border)]" />
                </div>
              )}
              <Bubble m={m} />
            </div>
          )
        })}
      </div>

      {!resolved && (
        <div className="border-t border-[var(--border)] px-4 pt-3 pb-3 flex flex-col gap-2">
          <div className="flex gap-2.5 items-end">
            <label htmlFor="reply" className="sr-only">{asNote ? 'Note' : 'Reply'}</label>
            <textarea id="reply" rows={1} value={reply}
              onChange={e => { setReply(e.target.value); setError('') }} onKeyDown={onKey}
              placeholder={asNote ? 'Write a note only staff see' : `Reply to ${nameOf(conv)}`}
              className="flex-1 min-h-[36px] max-h-40 px-3 py-2 text-sm rounded-lg outline-none resize-none text-[var(--text)]"
              style={asNote ? { background: C.note, border: `1px dashed ${C.noteBorder}` } : { background: 'var(--panel)', border: '1px solid var(--border)' }} />
            <button type="button" onClick={submit} disabled={!reply.trim() || send.isPending} aria-label={asNote ? 'Save note' : 'Send'}
              className="w-10 h-9 shrink-0 rounded-lg flex items-center justify-center text-white disabled:opacity-40"
              style={{ background: asNote ? C.noteMeta : C.red }}>
              {asNote ? <CheckIcon size={18} /> : <SendIcon size={18} />}
            </button>
          </div>
          {error && <p className="text-xs m-0" style={{ color: C.redText }}>{error}</p>}
          <div className="flex gap-4 flex-wrap text-xs text-[var(--text-3)]">
            <span>
              {asNote ? 'Only staff see notes.' : conv.handled_by === 'OCTOS' || needsYou(conv) ? 'Sending takes this conversation over from Octos.' : ''}
              {' '}Enter sends, Shift+Enter adds a line.
            </span>
            <button type="button" onClick={() => setAsNote(n => !n)} className="underline text-[var(--text-2)]">
              {asNote ? 'Write a reply instead' : 'Write a note only staff see'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── The page ────────────────────────────────────────────────────────────
const TABS = [{ key: 'ALL', label: 'All' }, { key: 'WHATSAPP' }, { key: 'EMAIL' }, { key: 'SMS' }]
const FILTERS = [
  { key: 'needs', label: 'Needs you', test: needsYou },
  { key: 'octos', label: 'Octos', test: c => c.handled_by === 'OCTOS' && c.channel === 'WHATSAPP' },
  { key: 'people', label: 'People', test: withPerson },
]

export default function Inbox() {
  const [channel, setChannel] = useState('ALL')
  const [filter, setFilter] = useState(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    staleTime: 10_000,
    refetchInterval: 15_000,
    placeholderData: prev => prev,
  })

  const unreadIn = key => conversations.filter(c => (key === 'ALL' || c.channel === key) && c.unread_count > 0).length
  const needsCount = conversations.filter(needsYou).length

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const f = FILTERS.find(x => x.key === filter)
    return conversations
      .filter(c => channel === 'ALL' || c.channel === channel)
      .filter(c => !f || f.test(c))
      .filter(c => !q || [nameOf(c), c.last_message_preview, c.job?.ref, c.job?.what]
        .some(v => (v || '').toLowerCase().includes(q)))
      // Needs you first, then the newest.
      .sort((a, b) => (needsYou(b) - needsYou(a)) ||
        (new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)))
  }, [conversations, channel, filter, query])

  // On a wide screen, open the first conversation; on a phone, start with the list.
  useEffect(() => {
    if (!selectedId && shown.length && window.matchMedia('(min-width: 1024px)').matches) setSelectedId(shown[0].id)
  }, [shown, selectedId])

  return (
    <div className="p-5 sm:p-6 flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px] flex flex-col gap-1">
          <h2 className="m-0 text-lg font-bold text-[var(--text)]">Inbox</h2>
          <span className="text-[13px] text-[var(--text-2)]">
            {needsCount > 0 && <span className="font-semibold" style={{ color: C.redText }}>{needsCount} need you, </span>}
            {unreadIn('ALL')} unread. Octos is answering the rest.
          </span>
        </div>
        <div className="relative flex-[0_1_420px] min-w-[220px]">
          <label htmlFor="inbox-search" className="sr-only">Search conversations</label>
          <span className="absolute left-3 top-2.5 text-[var(--text-3)]"><SearchIcon size={16} /></span>
          <input id="inbox-search" type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search names, messages or jobs"
            className="w-full h-9 pl-9 pr-3 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] outline-none focus:border-[var(--border-dark)]" />
        </div>
      </div>

      <div role="tablist" aria-label="Channel" className="flex gap-2 flex-wrap">
        {TABS.map(t => {
          const active = channel === t.key
          const count = unreadIn(t.key)
          const ch = CHANNEL[t.key]
          return (
            <button key={t.key} type="button" role="tab" aria-selected={active} onClick={() => setChannel(t.key)}
              className="h-8 px-3 rounded-lg text-[13px] flex items-center gap-1.5 transition-colors"
              style={active ? { background: C.red, color: '#FFFFFF', fontWeight: 700 }
                : { background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600 }}>
              {ch && <span style={{ color: active ? '#FFFFFF' : ch.ink }}><ch.Icon size={15} /></span>}
              {t.label || ch.label}
              {count > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[11px] flex items-center justify-center"
                  style={active ? { background: '#FFFFFF', color: C.redText } : { background: C.red, color: '#FFFFFF' }}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex gap-4 items-stretch" style={{ height: 'calc(100vh - 240px)', minHeight: 520 }}>
        <section aria-label="Conversations"
          className={`${selectedId ? 'hidden lg:flex' : 'flex'} w-full lg:w-[340px] shrink-0 flex-col bg-[var(--panel)] border border-[var(--border)] rounded-2xl overflow-hidden`}>
          <div className="flex gap-1.5 flex-wrap p-3 border-b border-[var(--border)]">
            {FILTERS.map(f => {
              const on = filter === f.key
              const red = f.key === 'needs'
              return (
                <button key={f.key} type="button" aria-pressed={on} onClick={() => setFilter(on ? null : f.key)}
                  className="rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={on ? { background: red ? C.red : 'var(--text)', color: '#FFFFFF', border: '1px solid transparent' }
                    : red ? { background: C.redSoft, color: C.redText, border: `1px solid ${C.redBorder}` }
                    : { background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                  {f.label}{red && needsCount ? `, ${needsCount}` : ''}
                </button>
              )
            })}
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              [1, 2, 3].map(i => <div key={i} className="h-20 m-3 bg-[var(--bg)] rounded-xl animate-pulse" />)
            ) : shown.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--text-3)]">
                {query || filter ? 'Nothing matches. Clear the search or filter to see everything.' : 'Messages from customers will appear here.'}
              </div>
            ) : shown.map(c => <Row key={c.id} c={c} selected={c.id === selectedId} onOpen={setSelectedId} />)}
          </div>
        </section>

        <section aria-label="Conversation"
          className={`${selectedId ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0 flex-col bg-[var(--panel)] border border-[var(--border)] rounded-2xl overflow-hidden`}>
          {selectedId ? (
            <Thread key={selectedId} convId={selectedId} onBack={() => setSelectedId(null)} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-3)]">Choose a conversation to read it.</div>
          )}
        </section>
      </div>
    </div>
  )
}