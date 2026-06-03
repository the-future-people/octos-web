// src/components/bm/Inbox.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import client from '../../api/client'

const getConversations = (channel) =>
  client.get('/api/v1/communications/', {
    params: channel && channel !== 'ALL' ? { channel } : {}
  }).then(r => { const d = r.data; return Array.isArray(d) ? d : (d?.results || []) })

const getConversation = (id) =>
  client.get(`/api/v1/communications/${id}/`).then(r => r.data)

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (diff < 1)     return 'Just now'
  if (diff < 60)    return `${diff}m ago`
  if (diff < 1440)  return `${Math.floor(diff / 60)}h ago`
  if (diff < 10080) return `${Math.floor(diff / 1440)}d ago`
  return new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
}

function toTitleCase(str) {
  if (!str) return str
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

const CHANNEL_CONFIG = {
  WHATSAPP: { label: 'WhatsApp', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-emerald-600">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg> },
  EMAIL: { label: 'Email', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
    </svg> },
  SMS: { label: 'SMS', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg> },
  TELEGRAM: { label: 'Telegram', color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-sky-500">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg> },
}

const STATUS_CONFIG = {
  OPEN:     { label: 'Open',     bg: 'bg-amber-100',   text: 'text-amber-700'   },
  RESOLVED: { label: 'Resolved', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  ASSIGNED: { label: 'Assigned', bg: 'bg-blue-100',    text: 'text-blue-700'    },
}

// ── Conversation Detail Modal ─────────────────────────────────────────────────
function ConversationModal({ convId, onClose }) {
  const queryClient = useQueryClient()
  const [reply, setReply] = useState('')

  const { data: conv, isLoading } = useQuery({
    queryKey: ['conversation', convId],
    queryFn:  () => getConversation(convId),
    staleTime: 10_000,
  })

  const replyMut = useMutation({
    mutationFn: () => client.post(`/api/v1/communications/${convId}/reply/`, { body: reply }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', convId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setReply('')
    },
  })

  const resolveMut = useMutation({
    mutationFn: () => client.post(`/api/v1/communications/${convId}/resolve/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', convId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  const cfg    = conv ? (CHANNEL_CONFIG[conv.channel] || CHANNEL_CONFIG.SMS) : null
  const status = conv ? (STATUS_CONFIG[conv.status] || STATUS_CONFIG.OPEN) : null
  const messages = conv?.messages || []

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-end bg-black/50"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[var(--panel)] w-full max-w-lg h-full flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-full ${cfg?.bg} border ${cfg?.border}
              flex items-center justify-center shrink-0`}>
              {cfg?.icon}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm text-[var(--text)] truncate">
                {toTitleCase(conv?.contact_name) || conv?.contact_phone || '—'}
              </div>
              <div className="text-[10px] text-[var(--text-3)]">
                {conv?.contact_phone || conv?.contact_email}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {conv?.status === 'OPEN' && (
              <button onClick={() => resolveMut.mutate()} disabled={resolveMut.isPending}
                className="px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700
                  border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-40">
                Resolve
              </button>
            )}
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full
                hover:bg-[var(--bg)] text-[var(--text-3)] transition-colors">✕</button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-[var(--bg)] rounded-xl animate-pulse" />)}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-sm text-[var(--text-3)] py-8">No messages yet</div>
          ) : (
            messages.map(msg => {
              const isOutbound = msg.direction === 'OUTBOUND'
              const isNote     = msg.is_internal_note
              return (
                <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm
                    ${isNote
                      ? 'bg-amber-50 border border-amber-200 text-amber-800 w-full max-w-full'
                      : isOutbound
                        ? 'bg-[var(--text)] text-white rounded-br-sm'
                        : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] rounded-bl-sm'
                    }`}>
                    {isNote && <div className="text-[9px] font-bold text-amber-600 uppercase tracking-wider mb-1">Internal Note</div>}
                    <div className="leading-relaxed">{msg.body}</div>
                    <div className={`text-[10px] mt-1 ${isOutbound ? 'text-white/60' : 'text-[var(--text-3)]'} text-right`}>
                      {timeAgo(msg.created_at)}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Reply box */}
        {conv?.status !== 'RESOLVED' && (
          <div className="px-5 py-4 border-t border-[var(--border)] shrink-0">
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder={`Reply via ${cfg?.label || 'message'}…`}
                className="flex-1 px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)]
                  rounded-xl outline-none focus:border-[var(--border-dark)] transition-colors resize-none"
              />
              <button
                onClick={() => reply.trim() && replyMut.mutate()}
                disabled={!reply.trim() || replyMut.isPending}
                className="px-4 py-2 bg-[var(--text)] text-white text-sm font-bold
                  rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0 self-end">
                {replyMut.isPending ? '…' : 'Send'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  )
}

// ── Main Inbox ─────────────────────────────────────────────────────────────────
const CHANNELS = [
  { key: 'ALL',      label: 'All'      },
  { key: 'WHATSAPP', label: 'WhatsApp' },
  { key: 'EMAIL',    label: 'Email'    },
  { key: 'SMS',      label: 'SMS'      },
  { key: 'TELEGRAM', label: 'Telegram' },
]

export default function Inbox() {
  const [channel,    setChannel]    = useState('ALL')
  const [selectedId, setSelectedId] = useState(null)

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations', channel],
    queryFn:  () => getConversations(channel),
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: prev => prev,
  })

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0)

  return (
    <div className="p-5 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Inbox</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
            {totalUnread > 0 && <span className="text-amber-600 font-bold ml-1">· {totalUnread} unread</span>}
          </p>
        </div>
      </div>

      {/* Channel tabs */}
      <div className="flex gap-1 bg-black/5 p-1 rounded-xl overflow-x-auto">
        {CHANNELS.map(c => {
          const cfg = CHANNEL_CONFIG[c.key]
          const channelConvs = c.key === 'ALL'
            ? conversations
            : conversations.filter(cv => cv.channel === c.key)
          const channelUnread = channelConvs.reduce((s, cv) => s + (cv.unread_count || 0), 0)

          return (
            <button key={c.key} onClick={() => setChannel(c.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg
                transition-colors whitespace-nowrap flex-shrink-0
                ${channel === c.key
                  ? 'bg-[var(--panel)] text-[var(--text)] shadow-sm'
                  : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                }`}>
              {cfg && <span>{cfg.icon}</span>}
              {c.label}
              {channelUnread > 0 && (
                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-full">
                  {channelUnread}
                </span>
              )}
              {/* Telegram placeholder badge */}
              {c.key === 'TELEGRAM' && (
                <span className="px-1.5 py-0.5 bg-zinc-200 text-zinc-500 text-[9px] font-bold rounded-full">
                  Soon
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Conversation list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl
          flex flex-col items-center justify-center py-16">
          <div className="text-3xl mb-3">💬</div>
          <p className="text-sm font-semibold text-[var(--text-2)]">No conversations</p>
          <p className="text-xs text-[var(--text-3)] mt-1">
            {channel === 'TELEGRAM'
              ? 'Telegram integration coming soon'
              : 'Messages from customers will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {conversations.map(conv => {
            const cfg    = CHANNEL_CONFIG[conv.channel] || CHANNEL_CONFIG.SMS
            const status = STATUS_CONFIG[conv.status]   || STATUS_CONFIG.OPEN
            const hasUnread = (conv.unread_count || 0) > 0

            return (
              <div key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`bg-[var(--panel)] border rounded-xl px-4 py-3.5 cursor-pointer
                  hover:border-[var(--border-dark)] transition-colors
                  ${hasUnread ? 'border-amber-200' : 'border-[var(--border)]'}`}>
                <div className="flex items-center gap-3">

                  {/* Channel icon */}
                  <div className={`w-9 h-9 rounded-full ${cfg.bg} border ${cfg.border}
                    flex items-center justify-center shrink-0`}>
                    {cfg.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-sm font-bold truncate
                          ${hasUnread ? 'text-[var(--text)]' : 'text-[var(--text-2)]'}`}>
                          {toTitleCase(conv.contact_name) || conv.contact_phone || conv.contact_email || 'Unknown'}
                        </span>
                        {hasUnread && (
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--text-3)] shrink-0">
                        {timeAgo(conv.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[var(--text-3)] truncate flex-1">
                        {conv.last_message_preview || 'No messages yet'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                          ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="w-5 h-5 bg-amber-500 text-white text-[9px] font-black
                            rounded-full flex items-center justify-center">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedId && (
        <ConversationModal convId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}