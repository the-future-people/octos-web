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
//
// Each channel looks like its own app (15 Nov 2026): a WhatsApp chat on a
// beige doodle wallpaper with green bubbles, Telegram with its blue and soft
// green, SMS like a phone's Messages, and email as a mail thread, not bubbles.
// The tabs are the channels' marks (no "All"), each with its own unread count.
// The marks are files in public/brand/ (whatsapp.png, telegram.png,
// wechat.svg, email.png); a plain coloured disc stands in for a missing one. Telegram and WeChat are ready
// in the inbox; their connections come later.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { getCustomers } from '../../api/bm'
import NewJobModal from './NewJobModal'

// Octos's colours, from the logo (8 Nov 2026): black, and red only for what
// needs attention. Octos's own messages are Mist grey with its mark beside its
// name; 'mint' keeps its name below, but is the Mist family now.
const C = {
  red: '#CC0000', redText: '#B30000', redDeep: '#8A0000', redSoft: '#FBEAEA', redBorder: '#F2C2C2',
  mint: '#F0F0F0', mintText: '#080808', mintIcon: '#080808', mintStrip: '#F7F7F7', mintBorder: '#DCDCDC',
  staff: '#FBE7E5', staffText: '#2A1412',
  note: '#FFF8E6', noteBorder: '#E8C66A', noteText: '#3A2D05', noteMeta: '#7A5A06',
  amberSoft: '#FFF4E5', amberText: '#8A4B08', read: '#2563A8',
}
const MAX_FILE = 16 * 1024 * 1024
// Octos's own print-shop doodles, drawn for Octos; each channel tints them.
const DOODLES = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22260%22%20height%3D%22260%22%20viewBox%3D%220%200%20260%20260%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%234a4a4a%22%20stroke-opacity%3D%22.07%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cg%20transform%3D%22translate%2818%2020%29%20rotate%28-8%29%22%3E%3Crect%20x%3D%224%22%20y%3D%2212%22%20width%3D%2234%22%20height%3D%2218%22%20rx%3D%223%22%2F%3E%3Cpath%20d%3D%22M10%2012V3h22v9M10%2024h22v13H10z%22%2F%3E%3Cpath%20d%3D%22M14%2030h14M14%2034h9%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate%28150%2014%29%20rotate%2810%29%22%3E%3Cpath%20d%3D%22M3%202h20l7%207v29H3z%22%2F%3E%3Cpath%20d%3D%22M23%202v7h7M8%2016h16M8%2022h16M8%2028h10%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate%28212%2092%29%20rotate%28-12%29%22%3E%3Cpath%20d%3D%22M14%202c6%209%2011%2015%2011%2021a11%2011%200%200%201-22%200c0-6%205-12%2011-21z%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate%2892%2098%29%20rotate%2818%29%22%3E%3Cpath%20d%3D%22M20%2026%208%2014a6%206%200%200%201%208.5-8.5l13%2013a3.5%203.5%200%200%201-5%205L12.5%2011.5%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate%2826%20120%29%20rotate%286%29%22%3E%3Crect%20x%3D%222%22%20y%3D%224%22%20width%3D%2234%22%20height%3D%2224%22%20rx%3D%223%22%2F%3E%3Cpath%20d%3D%22m2%207%2017%2012L36%207%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate%28176%20170%29%20rotate%280%29%22%3E%3Cpath%20d%3D%22M12%202v8M12%2016v8M2%2013h8M16%2013h8%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate%28120%20186%29%20rotate%28-20%29%22%3E%3Cpath%20d%3D%22M4%2030c-2-12%206-20%2016-20%208%200%2012%206%209%2011-2%204-8%204-9%200-1-3%202-5%204-4%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate%2828%20206%29%20rotate%2814%29%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22%2F%3E%3Cpath%20d%3D%22M12%206v6l4%203%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate%28222%20222%29%20rotate%28-6%29%22%3E%3Crect%20x%3D%222%22%20y%3D%222%22%20width%3D%2216%22%20height%3D%2226%22%20rx%3D%223%22%2F%3E%3Cpath%20d%3D%22M8%2024h4%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20fill%3D%22%234a4a4a%22%20fill-opacity%3D%22.07%22%3E%3Ccircle%20cx%3D%2264%22%20cy%3D%2272%22%20r%3D%222%22%2F%3E%3Ccircle%20cx%3D%22200%22%20cy%3D%2256%22%20r%3D%222.4%22%2F%3E%3Ccircle%20cx%3D%22246%22%20cy%3D%22160%22%20r%3D%222%22%2F%3E%3Ccircle%20cx%3D%2274%22%20cy%3D%22168%22%20r%3D%222.2%22%2F%3E%3Ccircle%20cx%3D%22160%22%20cy%3D%22124%22%20r%3D%221.8%22%2F%3E%3Ccircle%20cx%3D%22100%22%20cy%3D%22250%22%20r%3D%222%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E'
const doodles = (bg, ink, alpha) => ({
  backgroundColor: bg,
  backgroundImage: `url(${DOODLES.replaceAll('%234a4a4a', encodeURIComponent(ink)).replaceAll('.07', String(alpha))})`,
  backgroundSize: '260px 260px',
})
const WALL = doodles('#F2F2F1', '#4a4a4a', 0.07)
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
// WhatsApp names in decorative letters (𝐀𝐫𝐭𝐡𝐮𝐫) read as plain ones (NFKC), so they look like
// everyone else's and give a proper initial.
const nameOf = c => titleCase((c?.display_name || c?.contact_name || '').normalize('NFKC')) || c?.contact_phone || 'Unknown'
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
const EVENT = /(took over from Octos|handed (the conversation|it) back|resolved (this|the) (conversation|chat)|conversation resolved|resolved by|reopened|at the counter|asked for a person)/i
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
// In a browser, Open downloads straight from storage with a signed link
// (15 Nov 2026): the file comes from R2's edge, not through our server first.
// The link is asked for here, so the check of who may see the chat still runs.
async function signedLink(m, download) {
  try {
    const { data } = await client.get(fileUrl(m), { params: { link: 1, ...(download ? { download: 1 } : {}) } })
    return data?.url || null
  } catch {
    return null
  }
}
export async function openFile(m) {
  if (!desktopInvoke()) {
    const url = await signedLink(m, true)
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.rel = 'noopener'
      document.body.appendChild(a); a.click(); a.remove()
      return
    }
  }
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
// A photo's address: a signed link straight to storage (good for an hour, so
// kept 50 minutes), or the file itself fetched through our server where
// files aren't in R2.
const photoSrc = async m => (await signedLink(m, false))
  || client.get(fileUrl(m), { responseType: 'blob' }).then(r => URL.createObjectURL(r.data))
const PHOTO_FRESH = 50 * 60 * 1000
function Photo({ m }) {
  const { data: src, isError } = useQuery({
    queryKey: ['messageFile', m.id],
    queryFn: () => photoSrc(m),
    staleTime: PHOTO_FRESH,
    gcTime: PHOTO_FRESH,
  })
  if (isError) return <span className="block px-3 py-6 text-xs text-[var(--text-3)]">This photo could not be loaded.</span>
  if (!src) return <span className="block w-[220px] h-[160px] rounded-lg bg-black/[0.05] animate-pulse" />
  return (
    <button type="button" onClick={() => openFile(m)} className="block" title="Open in the photo viewer">
      <img src={src} alt={m.media_name || 'Photo'} className="block rounded-lg max-w-full" style={{ maxHeight: 340, minWidth: 160 }} />
    </button>
  )
}
// Octos's mark (public/octos-mark.svg), beside its name wherever it speaks.
const OctosMark = ({ s = 14 }) => <img src="/octos-mark.svg" alt="" width={s} height={s} className="inline-block shrink-0" />
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
  // Openable already; pages and paper size follow in a moment (15 Nov 2026).
  if (i.measuring) parts.push('checking pages…')
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
  reply: p => <Svg {...p}><path d="M9 17 4 12l5-5" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></Svg>,
  lock: p => <Svg {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>,
  smile: p => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" /><path d="M9 9.5h.01M15 9.5h.01" /></Svg>,
  user: p => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>,
  pin: p => <Svg {...p}><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></Svg>,
  info: p => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>,
  mail: p => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Svg>,
  sms: p => <Svg {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></Svg>,
}
const CHANNEL = {
  WHATSAPP: { label: 'WhatsApp', colour: '#25D366', tint: '#E7FCEB', text: '#0B5F2A', logo: '/brand/whatsapp.png' },
  TELEGRAM: { label: 'Telegram', colour: '#2AABEE', tint: '#E3F2FD', text: '#0F5E99', logo: '/brand/telegram.png' },
  WECHAT: { label: 'WeChat', colour: '#07C160', tint: '#E6F9EE', text: '#06783C', logo: '/brand/wechat.svg' },
  SMS: { label: 'SMS', colour: '#0B57D0', tint: '#E8F0FE', text: '#0B57D0', icon: 'sms' },
  EMAIL: { label: 'Email', colour: '#5F6368', tint: '#F1F3F4', text: '#3C4043', icon: 'mail', logo: '/brand/email.png' },
}
const channelOf = c => CHANNEL[c?.channel] || CHANNEL.SMS

// How each channel's chat looks, after its own app (15 Nov 2026). Fixed
// colours, as the apps have: the chat is the customer's app, not Octos's page.
// tail: the first bubble of a run has its own corner, as in each app.
const THEME = {
  WHATSAPP: {
    header: { background: '#F0F2F5', borderColor: '#E9EDEF', title: '#111B21', sub: '#667781' },
    wall: doodles('#EFEAE2', '#8A7F70', 0.09),
    bubble: { customer: { background: '#FFFFFF', color: '#111B21' }, octos: { background: '#D9FDD3', color: '#111B21' }, staff: { background: '#D9FDD3', color: '#111B21' } },
    radius: { mine: '7.5px', theirs: '7.5px', mineTail: '7.5px 0 7.5px 7.5px', theirsTail: '0 7.5px 7.5px 7.5px' },
    shadow: '0 1px 0.5px rgba(11,20,26,.13)', meta: '#667781', read: '#53BDEB', who: '#667781',
    day: { background: '#FFFFFF', color: '#54656F', boxShadow: '0 1px 0.5px rgba(11,20,26,.13)' },
    composer: { background: '#F0F2F5', input: '#FFFFFF', border: '1px solid transparent', radius: 8 },
    send: '#00A884', accent: '#00A884',
  },
  TELEGRAM: {
    header: { background: '#FFFFFF', borderColor: '#E7E7E7', title: '#000000', sub: '#3390EC' },
    wall: doodles('#C9DDB4', '#4F7A36', 0.12),
    bubble: { customer: { background: '#FFFFFF', color: '#000000' }, octos: { background: '#EEFFDE', color: '#000000' }, staff: { background: '#EEFFDE', color: '#000000' } },
    radius: { mine: '16px', theirs: '16px', mineTail: '16px 16px 4px 16px', theirsTail: '16px 16px 16px 4px' },
    shadow: '0 1px 1px rgba(0,0,0,.12)', meta: '#6B8F5B', read: '#4FAE4E', who: '#3D6B2C',
    day: { background: 'rgba(0,0,0,.2)', color: '#FFFFFF' },
    composer: { background: '#FFFFFF', input: '#FFFFFF', border: '1px solid #E7E7E7', radius: 12 },
    send: '#3390EC', accent: '#3390EC',
  },
  WECHAT: {
    header: { background: '#EDEDED', borderColor: '#DADADA', title: '#191919', sub: '#7F7F7F' },
    wall: { backgroundColor: '#EDEDED' },
    bubble: { customer: { background: '#FFFFFF', color: '#191919' }, octos: { background: '#95EC69', color: '#191919' }, staff: { background: '#95EC69', color: '#191919' } },
    radius: { mine: '4px', theirs: '4px', mineTail: '4px', theirsTail: '4px' },
    shadow: 'none', meta: '#7F7F7F', read: '#07C160', who: '#7F7F7F',
    day: { background: 'transparent', color: '#9A9A9A' },
    composer: { background: '#F7F7F7', input: '#FFFFFF', border: '1px solid transparent', radius: 6 },
    send: '#07C160', accent: '#07C160',
  },
  SMS: {
    header: { background: '#FFFFFF', borderColor: '#E1E3E1', title: '#1F1F1F', sub: '#444746' },
    wall: { backgroundColor: '#FFFFFF' },
    bubble: { customer: { background: '#E9EEF6', color: '#1F1F1F' }, octos: { background: '#D3E3FD', color: '#041E49' }, staff: { background: '#D3E3FD', color: '#041E49' } },
    radius: { mine: '20px', theirs: '20px', mineTail: '20px 20px 4px 20px', theirsTail: '20px 20px 20px 4px' },
    shadow: 'none', meta: '#444746', read: '#0B57D0', who: '#444746',
    day: { background: 'transparent', color: '#444746' },
    composer: { background: '#FFFFFF', input: '#E9EEF6', border: '1px solid transparent', radius: 24 },
    send: '#0B57D0', accent: '#0B57D0',
  },
  EMAIL: {
    header: { background: '#FFFFFF', borderColor: '#E0E0E0', title: '#1F1F1F', sub: '#444746' },
    wall: { backgroundColor: '#FFFFFF' },
    bubble: { customer: { background: '#FFFFFF', color: '#1F1F1F' }, octos: { background: '#FFFFFF', color: '#1F1F1F' }, staff: { background: '#FFFFFF', color: '#1F1F1F' } },
    radius: { mine: '12px', theirs: '12px', mineTail: '12px', theirsTail: '12px' },
    shadow: 'none', meta: '#444746', read: '#0B57D0', who: '#444746',
    day: { background: 'transparent', color: '#444746' },
    composer: { background: '#FFFFFF', input: '#FFFFFF', border: '1px solid #C4C7C5', radius: 12 },
    send: '#0B57D0', accent: '#0B57D0',
  },
}
const themeOf = c => THEME[c?.channel] || THEME.SMS

// The channel's mark: the app's official logo file for WhatsApp and Telegram
// (public/brand/), a plain envelope or speech bubble for email and SMS. A
// plain coloured disc stands in for a logo file that isn't there yet.
function ChannelMark({ ch, s = 20 }) {
  const meta = CHANNEL[ch] || CHANNEL.SMS
  const [missing, setMissing] = useState(false)
  if (meta.logo && !missing) {
    return <img src={meta.logo} alt="" width={s} height={s} className="block shrink-0" onError={() => setMissing(true)} />
  }
  const Icon = meta.icon === 'mail' ? I.mail : meta.icon === 'sms' ? I.sms : null
  return (
    <span className="shrink-0 rounded-full grid place-items-center text-white font-bold" style={{ width: s, height: s, background: meta.colour, fontSize: s * 0.5 }} aria-hidden="true">
      {Icon ? <Icon size={Math.round(s * 0.6)} /> : meta.label[0]}
    </span>
  )
}

function Avatar({ c, s = 36 }) {
  return (
    <span className="shrink-0 rounded-full grid place-items-center font-bold text-white"
      style={{ width: s, height: s, fontSize: s / 2.8, background: '#080808' }}>{initialsOf(c)}</span>
  )
}

function Ticks({ msg, read = C.read }) {
  const marks = {
    QUEUED: ['🕓', 'Sending'], SENT: ['✓', 'Sent'], DELIVERED: ['✓✓', 'Delivered'], READ: ['✓✓', 'Read'],
    FAILED: ['Not delivered', msg.error || 'Not delivered'],
  }
  const mark = marks[msg.status]
  if (!mark || !['WHATSAPP', 'TELEGRAM'].includes(msg.channel)) return null
  const style = msg.status === 'READ' ? { color: read } : msg.status === 'FAILED' ? { color: C.redText, fontWeight: 700 } : {}
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
          {tag && (
            <span className="text-[10.5px] font-bold px-2 py-px rounded-full inline-flex items-center gap-1" style={tag[1]}>
              {tag[0] === 'Octos' && <OctosMark s={12} />}{tag[0]}
            </span>
          )}
          {c.job && <span className="text-[10.5px] text-[var(--text-3)] truncate">Job {c.job.ref}</span>}
          {c.unread_count > 0 && !selected && <span className="ml-auto w-2 h-2 rounded-full" style={{ background: C.red }} aria-label="Unread" />}
        </span>
      </span>
    </button>
  )
}

// ── Starting a chat: approved messages only, until the customer replies ──
function NewMessage({ onClose, onStarted, prefill = null }) {
  const [phone, setPhone] = useState(prefill?.phone || '')
  const [name, setName] = useState(prefill?.name || '')
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
        {m.media_file
          ? <span className="text-[11.5px] text-[var(--text-3)]">{fileInfo(m)}</span>
          : m.media_info?.failed ? (
            <span className="text-[11.5px] font-semibold" style={{ color: C.redText }}>
              This file couldn’t be saved. Ask the customer to send it again.
            </span>
          ) : (
            // Recorded before WhatsApp has handed the file over: it takes a few seconds.
            <span className="text-[11.5px] text-[var(--text-3)] inline-flex items-center gap-1.5" role="status">
              <span className="w-3 h-3 rounded-full border-2 border-black/15 border-t-black/60 animate-spin" aria-hidden="true" />
              Receiving the file…
            </span>
          )}
      </span>
      {m.media_file && (
        <span className="flex gap-1.5 shrink-0">
          <button type="button" onClick={() => openFile(m)} className="px-3 py-1 rounded-md bg-zinc-900 text-white text-[11.5px] font-semibold">Open</button>
        </span>
      )}
    </div>
  )
}

function Bubble({ m, who, first, initials, onReply, reports, theme = THEME.WHATSAPP }) {
  const kind = kindOf(m)
  if (kind === 'event') return <ChatEvent m={m} theme={theme} />
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
  const file = hasFile(m)
  const photo = file && isPhoto(m) && m.media_file
  const text = m.body && m.body !== m.media_name ? m.body : ''
  const q = m.reply_preview
  return (
    <div className={`group flex gap-2.5 items-end ${mine ? 'flex-row-reverse' : ''} ${first ? 'mt-3' : 'mt-0.5'}`}>
      <span className="w-[30px] shrink-0" aria-hidden="true">
        {first && (kind === 'octos'
          ? <img src="/octos-tile.svg" alt="" width={30} height={30} className="block rounded-full" />
          : <span className="w-[30px] h-[30px] rounded-full bg-[#080808] text-white text-[10.5px] font-bold grid place-items-center">{initials}</span>)}
      </span>
      <div className={`max-w-[66%] min-w-0 flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
        {first && <span className="text-[11px] font-bold px-1.5" style={{ color: theme.who }}>{who}</span>}
        <div className={`flex items-center gap-1.5 min-w-0 max-w-full ${mine ? 'flex-row-reverse' : ''}`}>
          <div className={`min-w-0 flex flex-col gap-1 ${photo ? 'p-1' : 'px-2.5 py-1.5'}`}
            style={{ ...theme.bubble[kind], boxShadow: theme.shadow,
              borderRadius: first ? (mine ? theme.radius.mineTail : theme.radius.theirsTail) : (mine ? theme.radius.mine : theme.radius.theirs) }}>
            {q && (
              <div className="flex flex-col gap-px px-2.5 py-1.5 rounded-md text-xs text-[var(--text-2)] bg-black/[0.045] max-w-[360px]"
                style={{ borderLeft: `3px solid ${q.who === 'Octos' ? '#CC0000' : '#080808'}` }}>
                <b className="text-[11.5px]" style={{ color: q.who === 'Octos' ? '#CC0000' : '#080808' }}>{q.who}</b>
                <span className="line-clamp-2">{q.body && q.body !== q.media_name ? q.body : ((q.media_mime || '').startsWith('image/') ? '📷 Photo' : q.media_name || 'A file')}</span>
              </div>
            )}
            {photo && <Photo m={m} />}
            {file && !photo && <FileCard m={m} tint="rgba(255,255,255,.75)" />}
            {text && <span className={`whitespace-pre-line leading-relaxed text-[13.5px] ${photo ? 'px-1.5' : ''}`}>{text}</span>}
            <span className={`self-end text-[10.5px] flex items-center gap-1 ${photo ? 'px-1.5 pb-0.5' : ''}`} style={{ color: theme.meta }}>
              {clock(m.created_at)} <Ticks msg={m} read={theme.read} />
            </span>
          </div>
          {onReply && (
            <button type="button" onClick={() => onReply(m)} aria-label="Reply to this message" title="Reply"
              className="w-[30px] h-[30px] shrink-0 rounded-full grid place-items-center bg-white/80 text-[var(--text-2)] shadow-sm
                opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-white hover:text-[var(--text)] transition-opacity">
              <I.reply size={15} />
            </button>
          )}
        </div>
        {reports && m.report && <Report report={m.report} />}
      </div>
    </div>
  )
}

// What happened to the chat (15 Nov 2026). Octos asking for a person sits on
// Octos's side like its report, its reason folded to two lines; taking over,
// handing back, resolving and the counter are small chips, as an app shows
// its own notices.
const HANDOVER = /^\s*Octos asked for a person:?\s*/i
function ChatEvent({ m, theme }) {
  const body = (m.body || '').trim().replace(/\.$/, '')
  if (HANDOVER.test(body)) return <HandoverNote reason={body.replace(HANDOVER, '')} at={m.created_at} />
  // Names as people write them: "kingsford future adjei took over" → "Kingsford Future Adjei took over".
  const words = body.replace(/^(.+?) (took over|handed|resolved|reopened|marked)/i, (_, who, verb) => `${titleCase(who)} ${verb}`)
  const look = theme.day.background === 'transparent' ? { background: '#F1F3F4', color: '#444746' } : theme.day
  const icon = /handed/i.test(body) ? <OctosMark s={13} />
    : /took over/i.test(body) ? <I.user size={13} />
    : /resolved/i.test(body) ? <I.check size={13} />
    : /counter/i.test(body) ? <I.pin size={13} />
    : <I.info size={13} />
  return (
    <div className="self-center my-1.5 max-w-[85%] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] leading-snug" style={look}>
      <span className="shrink-0 grid place-items-center opacity-80">{icon}</span>
      <span className="min-w-0">{words}</span>
      <span className="shrink-0 opacity-70">· {clock(m.created_at)}</span>
    </div>
  )
}

function HandoverNote({ reason, at }) {
  const [open, setOpen] = useState(false)
  const long = reason.length > 140
  return (
    <div className="self-end mr-10 mt-1 w-[340px] max-w-[85%] flex flex-col gap-1 px-2.5 py-1.5 rounded-[10px] bg-white/90 shadow-[0_1px_1px_rgba(0,0,0,.04)]"
      style={{ border: `1px solid ${C.redBorder}` }} title="Only staff see this">
      <span className="flex items-center gap-1.5 text-[11.5px]">
        <span style={{ color: C.redText }}><I.lock size={11} /></span>
        <b style={{ color: C.redText }}>Octos asked for a person</b>
        <span className="text-[var(--text-3)]">· {clock(at)}</span>
      </span>
      <span className={`text-[11.5px] leading-snug text-[var(--text-2)] ${open ? '' : 'line-clamp-2'}`}>{reason}</span>
      {long && (
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          className="self-start text-[11px] font-semibold underline text-[var(--text-2)]">{open ? 'Show less' : 'Read all'}</button>
      )}
    </div>
  )
}

// Octos's report under its message: what it did and why, for staff only.
function Report({ report }) {
  const [open, setOpen] = useState(false)
  const DOT = { ok: '#1E7A4C', warn: '#CC0000', info: '#9B9B9B' }
  return (
    <div className="w-[340px] max-w-full flex flex-col gap-1">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] bg-white/80 hover:bg-white shadow-[0_1px_1px_rgba(0,0,0,.04)] text-[11.5px] text-[var(--text-3)] text-left">
        <I.lock size={11} />
        <b className="text-[var(--text-2)] shrink-0">Octos’s report</b>
        <span className="truncate flex-1 min-w-0">{report.summary}</span>
        <span className="shrink-0 transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>⌄</span>
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 ml-1.5 px-3 py-2 rounded-r-[10px] bg-white/65" style={{ borderLeft: '2px solid rgba(8,8,8,.15)' }}>
          {report.steps.map(([tone, words], i) => (
            <span key={i} className="flex gap-2 items-start text-[11.5px] leading-snug text-[var(--text-2)]">
              <span className="w-[7px] h-[7px] rounded-full shrink-0 mt-[5px]" style={{ background: DOT[tone] || DOT.info }} />{words}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Staff link a chat to a customer they recognise (9 Nov 2026), e.g. a
// WhatsApp username chat with no number.
function LinkCustomer({ conv }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const { data: found = [] } = useQuery({
    queryKey: ['linkCustomer', q],
    queryFn: () => getCustomers({ search: q.trim(), page_size: 6 }).then(r => (Array.isArray(r.data) ? r.data : (r.data?.results || []))),
    enabled: open && q.trim().length >= 2,
  })
  const link = useMutation({
    mutationFn: id => client.post(`/api/v1/communications/${conv.id}/link-customer/`, { customer: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', conv.id] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setOpen(false)
    },
  })
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="self-start text-xs font-semibold underline text-[var(--text-2)]">Link to a customer</button>
  }
  return (
    <div className="flex flex-col gap-1.5">
      <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Name or phone number" aria-label="Find the customer"
        className="h-8 px-2.5 text-xs rounded-lg border border-black/15 bg-white outline-none focus:border-zinc-900" />
      {found.map(c => (
        <button key={c.id} type="button" onClick={() => link.mutate(c.id)} disabled={link.isPending}
          className="text-left text-xs px-2 py-1.5 rounded-md hover:bg-black/5">
          <b>{c.display_name || c.company_name || c.full_name}</b> · {c.phone}
        </button>
      ))}
      {q.trim().length >= 2 && found.length === 0 && <span className="text-[11px] text-[var(--text-3)]">No customer matches.</span>}
      <button type="button" onClick={() => setOpen(false)} className="self-start text-[11px] text-[var(--text-3)]">Cancel</button>
    </div>
  )
}

// ── Photos sent together: one album (9 Nov 2026) ──────────────────────────
// Customers often send many photos at once. In a row from the customer, with
// no words between and within three minutes of each other, they show as one
// album: a grid, +N, and Open as one PDF to print them all at once. Any photo
// opens the viewer: arrows (and the arrow keys) to move through them, and to
// open or save each on its own.
const ALBUM_GAP_MS = 3 * 60 * 1000
const plainPhoto = m => isPhoto(m) && kindOf(m) === 'customer' && !(m.body && m.body !== m.media_name) && !m.reply_preview

function groupPhotos(messages) {
  const items = []
  for (const m of messages) {
    const last = items[items.length - 1]
    const run = last?.photos
    if (plainPhoto(m) && run && new Date(m.created_at) - new Date(run[run.length - 1].created_at) <= ALBUM_GAP_MS) {
      run.push(m)
    } else {
      items.push(plainPhoto(m) ? { m, photos: [m] } : { m })
    }
  }
  return items.map(it => (it.photos && it.photos.length > 1 ? { m: it.m, album: it.photos } : { m: it.m }))
}

// Any blob, opened in its app (the desktop app) or downloaded (the browser).
async function openBlob(name, blob, id) {
  const invoke = desktopInvoke()
  if (invoke) {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    await invoke('open_file', bytes, { headers: { 'x-file-id': String(id), 'x-file-name': encodeURIComponent(name) } })
    return
  }
  saveBlob(name, blob)
}

function saveBlob(name, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function savePhoto(m) {
  client.get(fileUrl(m) + '?download=1', { responseType: 'blob' })
    .then(r => saveBlob(m.media_name || `photo-${m.id}.jpg`, r.data))
    .catch(() => window.alert('That photo could not be saved. Try again.'))
}

function usePhotoSrc(m) {
  return useQuery({
    queryKey: ['messageFile', m.id],
    queryFn: () => photoSrc(m),
    staleTime: PHOTO_FRESH,
    gcTime: PHOTO_FRESH,
    enabled: !!m.media_file,
  }).data
}

function Thumb({ m }) {
  const src = usePhotoSrc(m)
  if (!src) return <span className="absolute inset-0 bg-black/[0.06] animate-pulse" />
  return <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
}

function Album({ ms, conv, who, first, initials, theme = THEME.WHATSAPP }) {
  const [at, setAt] = useState(null)
  const [making, setMaking] = useState(false)
  const shown = ms.slice(0, 4)
  const more = ms.length - 4
  const ready = ms.filter(x => x.media_file)
  const makePdf = () => {
    if (making || !ready.length) return
    setMaking(true)
    client.post(`/api/v1/communications/${conv.id}/photos-pdf/`, { messages: ready.map(x => x.id) }, { responseType: 'blob' })
      .then(r => openBlob(`${nameOf(conv)}, ${ready.length} photos.pdf`, r.data, ready[0].id))
      .catch(() => window.alert('The PDF could not be made. Try again.'))
      .finally(() => setMaking(false))
  }
  return (
    <div className={`flex gap-2.5 items-end ${first ? 'mt-3' : 'mt-0.5'}`}>
      <span className="w-[30px] shrink-0" aria-hidden="true">
        {first && <span className="w-[30px] h-[30px] rounded-full bg-[#080808] text-white text-[10.5px] font-bold grid place-items-center">{initials}</span>}
      </span>
      <div className="flex flex-col gap-1 items-start min-w-0">
        {first && <span className="text-[11px] font-bold px-1.5" style={{ color: theme.who }}>{who}</span>}
        <div className="flex flex-col gap-1.5 p-1.5" style={{ ...theme.bubble.customer, borderRadius: first ? theme.radius.theirsTail : theme.radius.theirs, boxShadow: theme.shadow }}>
          <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden" style={{ width: 'min(344px, 60vw)' }}>
            {shown.map((m, i) => (
              <button key={m.id} type="button" onClick={() => setAt(i)} aria-label={`Photo ${i + 1} of ${ms.length}`}
                className="relative h-[150px] bg-black/[0.05]">
                <Thumb m={m} />
                {i === 3 && more > 0 && <span className="absolute inset-0 bg-black/45 text-white text-3xl font-bold grid place-items-center">+{more}</span>}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-0.5">
            <span className="flex-1 text-xs text-[var(--text-2)]">{ms.length} photos{ready.length < ms.length ? `, ${ms.length - ready.length} still arriving` : ''}</span>
            <button type="button" onClick={makePdf} disabled={making || !ready.length}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#080808] text-white text-[12.5px] font-semibold disabled:opacity-60">
              {making && <span className="w-3 h-3 rounded-full border-2 border-white/35 border-t-white animate-spin" aria-hidden="true" />}
              {making ? 'Making the PDF…' : 'Open as one PDF'}
            </button>
          </div>
          <span className="self-end text-[10.5px] px-1" style={{ color: theme.meta }}>{clock(ms[ms.length - 1].created_at)}</span>
        </div>
      </div>
      {at !== null && <PhotoViewer ms={ms} at={at} setAt={setAt} title={nameOf(conv)} onPdf={makePdf} making={making} />}
    </div>
  )
}

function PhotoViewer({ ms, at, setAt, title, onPdf, making }) {
  const m = ms[at]
  const src = usePhotoSrc(m)
  const close = () => setAt(null)
  useEffect(() => {
    const keys = e => {
      if (e.key === 'ArrowLeft') setAt(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setAt(i => Math.min(ms.length - 1, i + 1))
      if (e.key === 'Escape') setAt(null)
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [ms.length, setAt])
  const arrow = off => `w-[52px] h-[52px] shrink-0 rounded-full grid place-items-center text-[30px] leading-none text-white bg-white/15 ${off ? 'opacity-25 cursor-default' : 'hover:bg-white/25'}`
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`${title}'s photos`}
      className="fixed inset-0 z-[10000] flex flex-col bg-[rgba(8,8,8,.92)] text-white" style={{ fontFamily: 'inherit' }}>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 flex-wrap">
        <b className="text-sm">{title} · {at + 1} of {ms.length}</b>
        <span className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => openFile(m)} disabled={!m.media_file} className="h-9 px-3.5 rounded-lg bg-white text-[#080808] text-[12.5px] font-semibold disabled:opacity-50">Open this photo</button>
          <button type="button" onClick={() => savePhoto(m)} disabled={!m.media_file} className="h-9 px-3.5 rounded-lg bg-white/15 text-[12.5px] font-semibold disabled:opacity-50">Save this photo</button>
          <button type="button" onClick={onPdf} disabled={making} className="h-9 px-3.5 rounded-lg bg-[#CC0000] text-[12.5px] font-semibold disabled:opacity-60">{making ? 'Making the PDF…' : 'Open all as one PDF'}</button>
          <button type="button" onClick={close} aria-label="Close" className="h-9 w-9 rounded-lg text-xl hover:bg-white/10">×</button>
        </span>
      </div>
      {/* The arrows stay at the screen's edges whatever the photo's size (9 Nov 2026). */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-24">
        <button type="button" aria-label="Previous photo" onClick={() => setAt(i => Math.max(0, i - 1))}
          className={`absolute left-6 top-1/2 -translate-y-1/2 ${arrow(at === 0)}`}>‹</button>
        <div className="min-w-0 w-full max-w-[1100px] h-full max-h-[calc(100vh-200px)] grid place-items-center">
          {src ? <img src={src} alt={m.media_name || `Photo ${at + 1}`} className="max-w-full max-h-full object-contain rounded-lg" />
               : <span className="w-[420px] max-w-full h-[320px] rounded-lg bg-white/10 animate-pulse" />}
        </div>
        <button type="button" aria-label="Next photo" onClick={() => setAt(i => Math.min(ms.length - 1, i + 1))}
          className={`absolute right-6 top-1/2 -translate-y-1/2 ${arrow(at === ms.length - 1)}`}>›</button>
      </div>
      <div className="flex gap-1.5 justify-center px-4 py-3.5 overflow-x-auto">
        {ms.map((p, i) => (
          <button key={p.id} type="button" onClick={() => setAt(i)} aria-label={`Photo ${i + 1}`}
            className={`relative w-[54px] h-[54px] shrink-0 rounded-lg overflow-hidden border-[3px] ${i === at ? 'border-white' : 'border-transparent opacity-60 hover:opacity-90'}`}>
            <Thumb m={p} />
          </button>
        ))}
      </div>
    </div>,
    document.body
  )
}

// ── An email: a card with who, to whom and when, then the letter ─────────
// Folded to one line until opened, as mail apps fold the older ones.
function EmailMessage({ m, conv, open, onToggle, reports }) {
  const kind = kindOf(m)
  const from = kind === 'customer' ? nameOf(conv) : kind === 'octos' ? 'Octos at Farhat' : `${m.sent_by_name || 'Staff'}, Farhat`
  const address = kind === 'customer' ? conv.contact_email : 'Farhat Printing Press'
  const to = kind === 'customer' ? 'to Farhat' : `to ${nameOf(conv)}`
  const text = m.body && m.body !== m.media_name ? m.body : ''
  const when = `${dayLabel(m.created_at)}, ${clock(m.created_at)}`
  const avatar = kind === 'octos'
    ? <img src="/octos-tile.svg" alt="" width={32} height={32} className="block rounded-full shrink-0" />
    : <span className="w-8 h-8 shrink-0 rounded-full grid place-items-center text-white text-[12px] font-bold" style={{ background: kind === 'customer' ? '#E37400' : '#080808' }}>
        {kind === 'customer' ? initialsOf(conv) : initialsOf({ display_name: m.sent_by_name || 'Staff' })}
      </span>
  if (!open) {
    return (
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-2.5 px-5 py-2.5 border-b border-[#F1F3F4] text-left hover:bg-[#F8F9FA]">
        {avatar}
        <span className="flex-1 min-w-0 truncate text-[13px] text-[#444746]"><b className="text-[#1F1F1F]">{from}</b> · {(text || m.media_name || 'A file').replace(/\n+/g, ' ')}</span>
        <span className="shrink-0 text-xs text-[#444746]">{when}</span>
      </button>
    )
  }
  return (
    <article className="px-5 py-4 border-b border-[#F1F3F4] text-[#1F1F1F]">
      <div className="flex items-start gap-2.5">
        {avatar}
        <button type="button" onClick={onToggle} className="flex-1 min-w-0 text-left">
          <span className="block text-[13.5px] truncate"><b>{from}</b>{address && <span className="text-xs text-[#444746]"> &lt;{address}&gt;</span>}</span>
          <span className="block text-xs text-[#444746]">{to}</span>
        </button>
        <span className="shrink-0 text-xs text-[#444746] flex items-center gap-1">{when}</span>
      </div>
      {text && <div className="mt-3 pl-[42px] text-[13.5px] leading-relaxed whitespace-pre-line">{text}</div>}
      {hasFile(m) && <div className="mt-3 pl-[42px]">{isPhoto(m) && m.media_file ? <Photo m={m} /> : <FileCard m={m} tint="#FFFFFF" />}</div>}
      {reports && m.report && <div className="mt-2 pl-[42px]"><Report report={m.report} /></div>}
    </article>
  )
}

// ── The side panel ──────────────────────────────────────────────────────
function Panel({ conv, actions, files, onClose, reports, onToggleReports }) {
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

      {/* Octos's reports: moved here from the chat's header (15 Nov 2026). A
          setting, not something used mid-conversation. */}
      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-[12.5px] font-semibold text-[var(--text)]">Show Octos's reports</span>
          <span className="text-[11.5px] leading-snug text-[var(--text-3)]">A note under each of Octos's messages: what it looked up and why. Only staff see them.</span>
        </span>
        <button type="button" role="switch" aria-checked={reports} onClick={onToggleReports}
          className="relative shrink-0 mt-0.5 w-9 h-5 rounded-full transition-colors"
          style={{ background: reports ? '#080808' : 'var(--border-dark)' }}>
          <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: reports ? 18 : 2 }} />
        </button>
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-[10.5px] font-bold tracking-wider text-[var(--text-3)]">CUSTOMER</span>
        <span className="font-bold text-sm">{nameOf(conv)}</span>
        <span className="text-[12.5px] text-[var(--text-2)]">{conv.contact_phone || conv.contact_email || (conv.contact_username ? '@' + conv.contact_username : 'WhatsApp username, number hidden')}</span>
        {conv.customer
          ? <span className="text-xs text-[var(--text-3)]">Registered customer</span>
          : <><span className="text-xs text-[var(--text-3)]">Not linked to a customer yet</span><LinkCustomer conv={conv} /></>}
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
function Thread({ convId, onBack, panel, setPanel, onApproved }) {
  const queryClient = useQueryClient()
  const wide = useWide()
  const [reply, setReply] = useState('')
  const [asNote, setAsNote] = useState(false)
  const [chips, setChips] = useState([])
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [recording, setRecording] = useState(false)
  // Octos's reports, on or off, remembered on this computer.
  const [reports, setReports] = useState(() => { try { return localStorage.getItem('octos.reports') !== 'off' } catch { return true } })
  const toggleReports = () => setReports(on => { try { localStorage.setItem('octos.reports', on ? 'off' : 'on') } catch { /* private */ } return !on })
  const scroller = useRef(null)
  const filePick = useRef(null)
  const box = useRef(null)
  const [emojis, setEmojis] = useState(false)
  // Email: which messages are unfolded; the newest always is.
  const [unfolded, setUnfolded] = useState(() => new Set())
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
    // Only what's new since the last message we have, and the last 15 (ticks,
    // files just arrived): a few KB, not the whole chat. The live connection
    // says when to ask; every 20 seconds is only a safety net (9 Nov 2026).
    queryFn: async () => {
      const before = queryClient.getQueryData(['conversation', convId])
      const last = before?.messages?.length ? before.messages[before.messages.length - 1].id : 0
      if (!last) return getConversation(convId)
      const fresh = await client.get(`/api/v1/communications/${convId}/`, { params: { after: last } }).then(r => r.data)
      const byId = new Map(before.messages.map(m => [m.id, m]))
      for (const m of fresh.messages) byId.set(m.id, m)
      return { ...fresh, messages: [...byId.values()].sort((a, b) => a.id - b.id) }
    },
    staleTime: 1_000,
    refetchInterval: 20_000,
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
      if (!chips.length) return client.post(`/api/v1/communications/${convId}/reply/`, { body: reply, is_internal_note: asNote, reply_to: replyTo?.id || null })
      const form = new FormData()
      chips.forEach(f => form.append('attachments', f))
      form.append('body', reply)
      form.append('is_internal_note', asNote ? 'true' : 'false')
      if (replyTo) form.append('reply_to', String(replyTo.id))
      return client.post(`/api/v1/communications/${convId}/reply/`, form)
    },
    onSuccess: () => { setReply(''); setChips([]); setError(''); setAsNote(false); setReplyTo(null); refresh() },
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
  const email = conv.channel === 'EMAIL'
  const theme = themeOf(conv)
  const resolved = conv.status === 'RESOLVED'
  const closes = conv.window_closes_at
  const windowOpen = whatsapp && closes && new Date(closes) > new Date()
  const windowLine = !whatsapp ? `${channelOf(conv).label}: text only.`
    : windowOpen ? `Free replies open until ${until(closes)}.` : 'Free replies closed until the customer writes again. Use New message.'
  const taken = withPerson(conv)
  const mainButton = (
    <button type="button" onClick={() => (taken ? handBack : takeOver).mutate()} disabled={takeOver.isPending || handBack.isPending}
      className="w-full h-[34px] px-3.5 rounded-lg text-[12.5px] font-semibold disabled:opacity-40"
      style={taken ? { background: C.mintStrip, border: `1px solid ${C.mintBorder}`, color: C.mintIcon } : { background: '#FFFFFF', border: '1px solid #D1D7DB', color: theme.header.title }}>
      {taken ? 'Hand back to Octos' : 'Take over'}
    </button>
  )
  const files = messages.filter(m => hasFile(m) && m.media_file)
  // Email: the newest real message is always unfolded.
  const lastMail = [...messages].reverse().find(x => !['note', 'event'].includes(kindOf(x)))?.id
  const submit = () => { if ((reply.trim() || chips.length) && !send.isPending) send.mutate() }

  let lastWho = '', lastDay = ''
  return (
    <div className="flex-1 min-w-0 flex relative">
      <section aria-label="Conversation" className="flex-1 min-w-0 flex flex-col" style={{ background: theme.wall.backgroundColor }}
        onDragOver={e => { e.preventDefault(); if (!resolved) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); if (!resolved) addFiles(e.dataTransfer.files) }}>
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b" style={{ background: theme.header.background, borderColor: theme.header.borderColor }}>
          <button type="button" onClick={onBack} aria-label="All conversations" className="lg:hidden w-8 h-8 -ml-1 grid place-items-center rounded-lg"><I.back size={18} /></button>
          <Avatar c={conv} s={38} />
          <div className="flex-1 min-w-0 flex flex-col">
            <h2 className="m-0 text-[14.5px] font-bold truncate" style={{ color: theme.header.title }}>{email ? (conv.subject || nameOf(conv)) : nameOf(conv)}</h2>
            <span className="text-[11.5px] truncate" style={{ color: theme.header.sub }}>{email && conv.subject ? `${nameOf(conv)}, ` : `${channelOf(conv).label}, `}{conv.contact_phone || conv.contact_email || (conv.contact_username ? '@' + conv.contact_username : 'WhatsApp username, number hidden')}</span>
          </div>
          {!resolved && whatsapp && <div className="w-auto">{mainButton}</div>}
          {/* Record the job without leaving the chat (9 Nov 2026). */}
          <button type="button" onClick={() => setRecording(true)}
            className="inline-flex items-center gap-1.5 h-[34px] px-3.5 rounded-lg text-[13px] font-semibold text-white" style={{ background: theme.accent }}>
            <I.plus size={14} />Record a job
          </button>
          {recording && (
<ChatJobModal onClose={() => setRecording(false)} onSuccess={() => setRecording(false)}
              fromChat={{
                conversationId: conv.id, customerId: conv.customer || null, name: nameOf(conv),
                phone: conv.contact_phone, username: conv.contact_username,
                // This visit's files only, photos included (12 Nov 2026).
                files: messages
                  .filter(x => x.direction === 'INBOUND' && x.media_file
                    && (!conv.visit_started_at || new Date(x.created_at) >= new Date(conv.visit_started_at)))
                  .map(x => (isPhoto(x) && !x.media_name ? { ...x, media_name: 'Photo' } : x))
                  .slice(-12).reverse()
                  .map(x => ({ id: x.id, name: x.media_name || 'File', pages: x.media_pages, info: fileInfo(x) })),
              }} />
          )}
          <button type="button" onClick={() => setPanel(p => !p)} aria-label="Details" title="Details" aria-pressed={panel}
            className="w-[34px] h-[34px] rounded-lg grid place-items-center"
            style={panel ? { background: '#16181D', color: '#fff' } : { border: '1px solid var(--border)' }}><I.panel size={17} /></button>
        </div>

        <div ref={scroller} className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col relative ${email ? '' : 'px-5 py-3 gap-1'}`} style={theme.wall}>
          {dragging && <div className="absolute inset-2 z-10 rounded-xl border-2 border-dashed border-zinc-900 bg-white/80 grid place-items-center text-sm font-semibold">Drop to attach</div>}
          {messages.length === 0 && <div className="text-center text-sm text-[var(--text-3)] py-8">No messages yet</div>}
          {email && messages.map(m => (['note', 'event'].includes(kindOf(m))
            ? <div key={m.id} className="px-5 py-1 flex flex-col"><Bubble m={m} theme={theme} /></div>
            : <EmailMessage key={m.id} m={m} conv={conv} reports={reports}
                open={m.id === lastMail || unfolded.has(m.id)}
                onToggle={() => setUnfolded(s => { const n = new Set(s); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n })} />
          ))}
          {!email && groupPhotos(messages).map(({ m, album }) => {
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
                  <div className="self-center my-2 px-3 py-0.5 rounded-lg text-[11px] font-semibold" style={theme.day}>{day}</div>
                )}
                {album ? (
                  <Album ms={album} conv={conv} who={who} first={!!who && first} initials={initialsOf(conv)} theme={theme} />
                ) : (
                <Bubble m={m} who={who} first={!!who && first} reports={reports} theme={theme}
                  initials={kind === 'customer' ? initialsOf(conv) : initialsOf({ display_name: m.sent_by_name || 'Staff' })}
                  onReply={!resolved && conv.channel === 'WHATSAPP' && m.id && (kind === 'customer' || kind === 'octos' || kind === 'staff') ? setReplyTo : null} />
                )}
              </div>
            )
          })}
          {/* Octos is working on a reply (9 Nov 2026): wait, or take over deliberately. */}
          {conv.octos_writing && (
            <div className="flex flex-row-reverse items-center gap-2.5 mt-2" role="status">
              <img src="/octos-tile.svg" alt="" width={30} height={30} className="block rounded-full shrink-0" />
              <span className="inline-flex gap-1 px-3.5 py-3" style={{ ...theme.bubble.octos, borderRadius: theme.radius.mineTail, boxShadow: theme.shadow }}>
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#9B9B9B] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
              <span className="text-[11px] text-[var(--text-3)]">Octos is writing…</span>
            </div>
          )}
        </div>

        {!resolved && (
          <div className="border-t px-4 pt-2 pb-2.5 flex flex-col gap-2" style={{ background: theme.composer.background, borderColor: theme.header.borderColor }}>
            {replyTo && (
              <div className="flex items-center gap-2.5 pl-2.5 pr-1.5 py-1.5 rounded-[10px] bg-black/[0.04]">
                <span className="w-[3px] self-stretch rounded bg-[#080808] shrink-0" />
                <span className="flex-1 min-w-0 flex flex-col">
                  <b className="text-[11.5px]">Replying to {kindOf(replyTo) === 'octos' ? 'Octos' : kindOf(replyTo) === 'customer' ? nameOf(conv) : (replyTo.sent_by_name || 'Staff')}</b>
                  <span className="text-xs text-[var(--text-3)] truncate">{(replyTo.body && replyTo.body !== replyTo.media_name ? replyTo.body : (isPhoto(replyTo) ? '📷 Photo' : replyTo.media_name || 'A file')).replace(/\n+/g, ' ')}</span>
                </span>
                <button type="button" onClick={() => setReplyTo(null)} aria-label="Stop replying to this message" className="w-7 h-7 grid place-items-center rounded-full hover:bg-black/5"><I.close size={13} /></button>
              </div>
            )}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div role="tablist" aria-label="Write" className="flex gap-0.5 p-[3px] rounded-lg bg-black/[0.05]">
                {[[false, 'Reply'], [true, 'Note, staff only']].map(([note, label]) => (
                  <button key={label} type="button" role="tab" aria-selected={asNote === note} onClick={() => setAsNote(note)}
                    className={`h-7 px-3 rounded-md text-xs ${asNote === note ? 'bg-white shadow-sm font-bold' : 'font-semibold text-[var(--text-3)]'}`}>{label}</button>
                ))}
              </div>
              <span className="text-[11.5px]" style={{ color: asNote ? C.noteMeta : windowOpen ? '#1E7A4C' : theme.meta }}>
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
            {whatsapp && !windowOpen && !asNote ? (() => {
              // WhatsApp's rule, not Octos's: free messages only within 24 hours of the
              // customer's last; after that, an approved message (8 Nov 2026).
              const last = [...messages].reverse().find(x => x.direction === 'INBOUND')?.created_at
              const when = last ? `${dayLabel(last) === 'Today' ? 'today' : dayLabel(last) === 'Yesterday' ? 'yesterday' : `on ${dayLabel(last)}`} at ${clock(last)}` : 'more than a day ago'
              return (
                <div className="flex flex-wrap items-center gap-3 px-3.5 py-3 rounded-xl bg-black/[0.035]">
                  <span className="flex-1 min-w-[260px] text-[12.5px] leading-snug text-[var(--text-2)]">
                    <b className="text-[var(--text)]">{nameOf(conv)} last wrote {when}.</b>{' '}
                    WhatsApp only allows free messages within 24 hours of a customer’s last message.
                    To reach them now, send an approved message; once they reply, you can write freely again.
                  </span>
                  <button type="button" onClick={() => onApproved?.(conv)}
                    className="shrink-0 h-9 px-3.5 rounded-lg bg-[#080808] text-white text-xs font-semibold">Send an approved message</button>
                </div>
              )
            })() : (
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
                style={asNote ? { background: C.note, border: `1px dashed ${C.noteBorder}` } : { background: theme.composer.input, border: theme.composer.border, borderRadius: theme.composer.radius }} />
              <button type="button" onClick={submit} disabled={(!reply.trim() && !chips.length) || send.isPending} aria-label={asNote ? 'Save note' : 'Send'}
                className="w-[42px] h-[38px] shrink-0 rounded-lg grid place-items-center text-white disabled:opacity-40"
                style={{ background: asNote ? C.noteMeta : theme.send, borderRadius: theme.composer.radius >= 20 ? 999 : 8 }}>{asNote ? <I.check size={18} /> : <I.send size={17} />}</button>
            </div>
            )}
            {error && <p className="m-0 text-xs" style={{ color: C.redText }}>{error}</p>}
            <span className="text-[11px] text-[var(--text-3)]">Enter sends, Shift+Enter adds a line. Drop files here, or paste a screenshot.</span>
          </div>
        )}
      </section>

      {panel && (
        <div className={wide ? 'flex' : 'absolute right-0 top-0 bottom-0 z-30 flex shadow-2xl'}>
          <Panel conv={conv} files={files} onClose={wide ? null : () => setPanel(false)}
            reports={reports} onToggleReports={toggleReports} actions={{
            atCounter: () => atCounter.mutate(),
            resolve: () => resolve.mutate(),
          }} />
        </div>
      )}
    </div>
  )
}

// ── The page ────────────────────────────────────────────────────────────
// The channels, as their marks (15 Nov 2026). No "All": each carries its own
// count, so a chat on another channel is never missed.
const TABS = ['WHATSAPP', 'TELEGRAM', 'WECHAT', 'SMS', 'EMAIL']
const SOON = ['TELEGRAM', 'WECHAT']   // in the inbox, not yet connected
const Count = ({ n }) => (
  <span className="min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white grid place-items-center" style={{ background: C.red }}>{n > 99 ? '99+' : n}</span>
)
const savedChannel = () => { try { const v = localStorage.getItem('octos.inbox.channel'); return TABS.includes(v) ? v : 'WHATSAPP' } catch { return 'WHATSAPP' } }
const FILTERS = [
  { key: 'needs', label: 'Needs you', test: needsYou },
  { key: 'octos', label: 'Octos', test: c => c.handled_by === 'OCTOS' && c.channel === 'WHATSAPP' },
  { key: 'people', label: 'People', test: withPerson },
]

// Recording a job from a chat follows the same rule as the dashboard's
// New Job button: once recording has closed, the Branch Manager gives a
// reason (and the job is held if the cashier has already signed off).
// Sundays and holidays stay plain, so the server's "closed" message shows.
function ChatJobModal(props) {
  const { data: lock, isLoading } = useQuery({
    queryKey: ['lockStatus'],
    queryFn:  () => getLockStatus().then(r => r.data),
    staleTime: 0,
  })
  if (isLoading) return null
  const closedDay = lock?.is_today_sunday || lock?.is_today_holiday
  const late = !!lock && !lock.can_create_jobs && !closedDay
  return <NewJobModal {...props} late={late} held={late && !!lock.cashier_signed_off} />
}


export default function Inbox({ focus = null } = {}) {
  const queryClient = useQueryClient()
  const [channel, setChannelState] = useState(savedChannel)
  const setChannel = t => { setChannelState(t); try { localStorage.setItem('octos.inbox.channel', t) } catch { /* private */ } }
  const [filter, setFilter] = useState(null)
  const [query, setQuery] = useState('')
  // Search folds into a button and grows into a box on the same row when
  // wanted; clicking away folds it back (15 Nov 2026). What was typed keeps
  // filtering, shown by a red dot on the button; Esc clears it.
  const [searchOpen, setSearchOpen] = useState(false)
  const searchBox = useRef(null)
  const [selectedId, setSelectedId] = useState(null)
  const [panel, setPanel] = useState(() => window.matchMedia(WIDE).matches)
  const [starting, setStarting] = useState(false)
  const [prefill, setPrefill] = useState(null)
  // Opened from a notification: the chat it points at, or what needs you.
  useEffect(() => {
    if (!focus) return
    if (focus.id) setSelectedId(Number(focus.id))
    if (focus.filter) setFilter(focus.filter)
  }, [focus])

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    staleTime: 10_000,
    refetchInterval: 15_000,
    placeholderData: prev => prev,
  })

  // Opened from a notification: show the tab the chat is on.
  const focused = useRef(null)
  useEffect(() => {
    if (!focus?.id || focused.current === focus.id) return
    const c = conversations.find(x => x.id === Number(focus.id))
    if (c && TABS.includes(c.channel)) { focused.current = focus.id; setChannelState(c.channel) }
  }, [focus, conversations])

  // Per channel: chats with unread messages or waiting for a person.
  const waitingOn = t => conversations.filter(c => c.channel === t && (c.unread_count > 0 || needsYou(c))).length
  const needsCount = conversations.filter(needsYou).length
  const unread = conversations.filter(c => c.unread_count > 0).length
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const f = FILTERS.find(x => x.key === filter)
    return conversations
      .filter(c => c.channel === channel)
      .filter(c => !f || f.test(c))
      .filter(c => !q || [nameOf(c), c.contact_phone, c.last_message_preview, c.job?.ref, c.job?.what].some(v => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => (needsYou(b) - needsYou(a)) || (new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)))
  }, [conversations, channel, filter, query])

  // No chat opens by itself (9 Nov 2026): staff choose. Opening one marks it read.

  return (
    <div className="flex flex-col text-[13.5px] bg-[#F6F6F4] border border-[var(--border)] rounded-2xl overflow-hidden m-2"
      style={{ height: 'calc(100vh - 100px)', minHeight: 560 }}>
      {/* One row (15 Nov 2026): the chosen channel opens into a pill with its
          name and count; the others are their marks, with counts of their own. */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[var(--panel)] border-b border-[var(--border)] whitespace-nowrap">
        <span className="text-base font-bold shrink-0 mr-1">Inbox</span>
        <div role="tablist" aria-label="Channel" className="flex items-center gap-1 p-[3px] rounded-full bg-black/[0.05] shrink-0">
          {TABS.map(t => {
            const n = waitingOn(t)
            const meta = CHANNEL[t]
            const label = `${meta.label}${n ? `, ${n} waiting` : ''}${SOON.includes(t) ? ', not connected yet' : ''}`
            return channel === t ? (
              <button key={t} type="button" role="tab" aria-selected="true" aria-label={label}
                className="inline-flex items-center gap-1.5 h-[30px] pl-1.5 pr-3 rounded-full text-[12.5px] font-semibold"
                style={{ background: meta.tint, color: meta.text }}>
                <ChannelMark ch={t} s={20} />{meta.label}{n > 0 && <Count n={n} />}
              </button>
            ) : (
              <button key={t} type="button" role="tab" aria-selected="false" aria-label={label} title={meta.label} onClick={() => setChannel(t)}
                className="relative w-[30px] h-[30px] rounded-full grid place-items-center opacity-60 hover:opacity-100 hover:bg-white/70 transition-opacity">
                <ChannelMark ch={t} s={20} />
                {n > 0 && <span className="absolute -top-1 -right-1"><Count n={n} /></span>}
              </button>
            )
          })}
        </div>
        <span className="flex-1 text-[11.5px] text-[var(--text-2)] truncate min-w-0">
          {needsCount > 0
            ? <b style={{ color: C.redText }}>{needsCount} need{needsCount === 1 ? 's' : ''} you</b>
            : `${unread} unread. Octos is answering the rest.`}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative h-[33px] transition-[width] duration-200 ease-out" style={{ width: searchOpen ? 260 : 33 }}>
            <button type="button" aria-label={query ? `Search conversations (searching for ${query})` : 'Search conversations'} title="Search"
              onClick={() => { setSearchOpen(true); setTimeout(() => searchBox.current?.focus(), 50) }}
              className={`absolute left-0 top-0 z-[1] w-[33px] h-[33px] rounded-lg grid place-items-center text-[var(--text-2)]
                ${searchOpen ? 'pointer-events-none border border-transparent' : 'border border-[var(--border)] hover:bg-black/[0.03]'}`}>
              <I.search size={16} />
              {query && !searchOpen && <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full" style={{ background: C.red }} />}
            </button>
            <input ref={searchBox} type="search" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search conversations"
              tabIndex={searchOpen ? 0 : -1}
              onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur() } }}
              onBlur={() => setSearchOpen(false)}
              placeholder={`Search ${CHANNEL[channel].label} chats`}
              className={`absolute inset-0 w-full h-[33px] pl-8 pr-2.5 text-[12.5px] rounded-lg border border-[var(--border)] bg-[#FAFAF9] outline-none
                focus:border-zinc-900 transition-opacity duration-150 ${searchOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
          </div>
          <button type="button" onClick={() => setStarting(s => !s)}
            className="inline-flex items-center gap-1.5 h-[33px] px-3.5 rounded-lg bg-zinc-900 text-white text-[12.5px] font-semibold">
            <I.plus size={14} />New message
          </button>
        </div>
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
                  {query || filter ? 'Nothing matches. Clear the search or filter to see everything.'
                    : SOON.includes(channel) ? `No ${CHANNEL[channel].label} chats yet. They will appear here once ${CHANNEL[channel].label} is connected.`
                    : `${CHANNEL[channel].label} messages from customers will appear here.`}
                </div>
              ) : shown.map(c => <Row key={c.id} c={c} selected={c.id === selectedId} onOpen={setSelectedId} />)}
          </div>
          {starting && (
            <NewMessage prefill={prefill} onClose={() => { setStarting(false); setPrefill(null) }} onStarted={id => {
              setStarting(false)
              queryClient.invalidateQueries({ queryKey: ['conversations'] })
              setSelectedId(id)
            }} />
          )}
        </section>

        <div className={`${selectedId ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0`}>
          {selectedId
            ? <Thread key={selectedId} convId={selectedId} onBack={() => setSelectedId(null)} panel={panel} setPanel={setPanel}
                onApproved={c => { setPrefill({ name: nameOf(c), phone: c.contact_phone }); setStarting(true) }} />
            : <div className="flex-1 grid place-items-center text-sm font-semibold text-[var(--text-3)]" style={WALL}><span className="px-4 py-2 rounded-full bg-white/90 shadow-sm">Choose a chat to open it</span></div>}
        </div>
      </div>
    </div>
  )
}