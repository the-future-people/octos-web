// src/components/bm/Staff.jsx
//
// The branch's staff as ID cards (15 Nov 2026), all from real records
// (accounts/profiles.py): photo, live status from On shift, employee ID and
// start date, three numbers for each role over today, this week or this month,
// and a call or WhatsApp straight from the card. The Branch Manager can change
// anyone's photo, phone or email here; the person is told. Changes staff ask
// for in My profile wait here for his approval (16 Nov 2026).
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  decideChange, getStaffCards, refusal, removeStaffPhoto, saveStaffContact, uploadStaffPhoto,
} from '../../api/profile'
import StaffAvatar from '../shared/StaffAvatar'
import { NumberTiles, PeriodSwitch, PhotoButtons, fmtJoined } from '../shared/ProfileBits'

const DOT = { active: '#5DCAA5', idle: '#B4B2A9' }

// 024 555 0172 -> 233245550172, for WhatsApp links.
function waNumber(phone) {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('233')) return digits
  if (digits.startsWith('0')) return '233' + digits.slice(1)
  return digits
}

function StatusChip({ presence }) {
  if (!presence) {
    return <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-black/15 text-white/80">Not in today</span>
  }
  return (
    <span className="flex items-center gap-1.5 text-[10.5px] font-semibold px-2 py-0.5 rounded-full max-w-[60%]"
      style={{ background: presence.state === 'off' ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)', color: '#fff' }}>
      {DOT[presence.state] && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: DOT[presence.state] }} />}
      <span className="truncate">{presence.label}</span>
    </span>
  )
}

function StaffCard({ member, onEdit }) {
  const wa = waNumber(member.phone)
  const action = 'flex-1 h-8 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--bg)] flex items-center justify-center gap-1.5'
  return (
    <div className="bg-[var(--panel)] rounded-2xl border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      <div className="bg-gradient-to-br from-red-600 to-red-900 px-4 pt-3 pb-10 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[9px] font-bold text-red-200 uppercase tracking-widest">Farhat Printing Press</div>
          <div className="text-[10px] text-red-300 truncate">{member.branch}</div>
        </div>
        <StatusChip presence={member.presence} />
      </div>

      <div className="relative -mt-8 mx-auto">
        <StaffAvatar person={member} size={68} ring />
        <button type="button" onClick={() => onEdit(member)} aria-label={`Change ${member.first_name}'s photo or phone`}
          className="absolute -right-1 -bottom-0.5 w-6 h-6 rounded-full bg-[var(--panel)] border border-[var(--border)] grid place-items-center text-[var(--text-3)] hover:text-[var(--text)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
      </div>

      <div className="px-4 pt-2 pb-4 flex-1 flex flex-col">
        <div className="text-center">
          <div className="text-[15px] font-bold text-[var(--text)] truncate">{member.full_name}</div>
          <div className="text-xs text-[var(--text-3)]">{member.role_label || '—'}</div>
          {member.pending?.length > 0 && (
            <div className="inline-block mt-1.5 text-[10.5px] font-semibold px-2 py-0.5 rounded-full text-[var(--text)]"
              style={{ background: 'rgba(239, 159, 39, 0.16)' }}>
              {member.pending.length} change{member.pending.length > 1 ? 's' : ''} waiting for you
            </div>
          )}
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-[10.5px]">
            <span className="font-bold text-[var(--text-3)] tracking-wider">EMPLOYEE ID</span>
            <span className="font-mono font-semibold text-[var(--text)]">{member.employee_id || '—'}</span>
          </div>
          <div className="flex justify-between text-[10.5px]">
            <span className="font-bold text-[var(--text-3)] tracking-wider">JOINED</span>
            <span className="font-semibold text-[var(--text)]">{fmtJoined(member.joined)}</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <NumberTiles numbers={member.numbers} compact />
        </div>

        <div className="mt-auto pt-3 flex gap-1.5">
          {member.phone ? (
            <>
              <a href={`tel:${member.phone.replace(/\s/g, '')}`} className={action}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Call
              </a>
              {wa && (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className={action}>
                  <img src="/brand/whatsapp.png" alt="" className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              )}
            </>
          ) : (
            <button type="button" onClick={() => onEdit(member)} className={`${action} text-[var(--text-3)]`}>Add a phone number</button>
          )}
        </div>
      </div>
    </div>
  )
}

// The Branch Manager changes someone's photo or phone.
function StaffEditor({ member, period, onClose }) {
  const queryClient = useQueryClient()
  const [phone, setPhone] = useState(member.phone || '')
  const [email, setEmail] = useState(member.email || '')
  const [person, setPerson] = useState(member)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const done = (message) => (data) => {
    setPerson(p => ({ ...p, ...data }))
    queryClient.invalidateQueries({ queryKey: ['staffCards'] })
    setError(''); setSaved(message)
  }
  const failed = (err) => { setSaved(''); setError(refusal(err)) }
  const photo = useMutation({ mutationFn: file => uploadStaffPhoto(member.id, file), onSuccess: done('Photo saved'), onError: failed })
  const unphoto = useMutation({ mutationFn: () => removeStaffPhoto(member.id), onSuccess: done('Photo removed'), onError: failed })
  const number = useMutation({ mutationFn: () => saveStaffContact(member.id, { phone, email }), onSuccess: done('Saved'), onError: failed })
  const busy = photo.isPending || unphoto.isPending || number.isPending

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-label={`${member.full_name}'s photo and phone`}
        className="w-full max-w-sm bg-[var(--panel)] rounded-2xl border border-[var(--border)] shadow-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <StaffAvatar person={person} size={60} />
          <div className="min-w-0">
            <div className="font-bold text-[var(--text)] truncate">{member.full_name}</div>
            <div className="text-xs text-[var(--text-3)]">{member.role_label}</div>
          </div>
        </div>
        <PhotoButtons busy={busy} hasPhoto={!!person.photo_url}
          onPhoto={file => photo.mutate(file)} onRemove={() => unphoto.mutate()} />
        <form className="space-y-2.5" onSubmit={e => { e.preventDefault(); number.mutate() }}>
          <label className="block">
            <span className="block text-xs text-[var(--text-2)] mb-1">Phone</span>
            <input value={phone} onChange={e => { setPhone(e.target.value); setSaved('') }} inputMode="tel" placeholder="024 555 0172"
              className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] outline-none focus:border-[var(--text-3)]" />
          </label>
          <label className="block">
            <span className="block text-xs text-[var(--text-2)] mb-1">Email <span className="text-[var(--text-3)]">· they sign in with it</span></span>
            <input value={email} onChange={e => { setEmail(e.target.value); setSaved('') }} type="email" placeholder="name@example.com"
              className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] outline-none focus:border-[var(--text-3)]" />
          </label>
          <div className="flex justify-end">
            <button type="submit" disabled={busy || (phone === (person.phone || '') && email === (person.email || ''))}
              className="h-9 px-4 rounded-lg bg-[var(--text)] text-[var(--panel)] text-sm font-semibold disabled:opacity-40">Save</button>
          </div>
        </form>
        {error && <p className="text-xs text-[var(--red-text)]">{error}</p>}
        {saved && !error && <p className="text-xs text-emerald-600">{saved}. {member.first_name} has been told.</p>}
        <p className="text-[11.5px] text-[var(--text-3)]">{member.first_name} can also change these from My profile in their own portal.</p>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg text-sm font-semibold text-[var(--text-2)] hover:bg-[var(--bg)]">Done</button>
        </div>
      </div>
    </div>
  )
}

// One change a staff member asked for, with Approve and Not approved.
function WaitingRow({ change }) {
  const queryClient = useQueryClient()
  const [refusing, setRefusing] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const decide = useMutation({
    mutationFn: ({ decision, note }) => decideChange(change.id, decision, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staffCards'] }),
    onError: err => setError(refusal(err)),
  })
  const was = change.field === 'PHOTO' ? null : (change.current || '(none)')
  const btn = 'h-8 px-3 rounded-lg text-xs font-semibold disabled:opacity-50'
  return (
    <div className="px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="text-sm font-semibold text-[var(--text)]">
            {change.full_name} <span className="font-normal text-[var(--text-3)]">· {change.role_label}</span>
          </div>
          {change.field === 'PHOTO' ? (
            <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--text-2)]">
              {change.current_photo_url
                ? <img src={change.current_photo_url} alt="Current" className="w-9 h-9 rounded-full object-cover" />
                : <span className="w-9 h-9 rounded-full grid place-items-center bg-[var(--bg)] border border-[var(--border)] text-[10px] text-[var(--text-3)]">None</span>}
              <span>→</span>
              {change.removes_photo
                ? <span className="font-semibold">Remove the photo</span>
                : <img src={change.photo_url} alt="New" className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-400" />}
            </div>
          ) : (
            <div className="text-xs text-[var(--text-2)] mt-0.5">
              {change.what[0].toUpperCase() + change.what.slice(1)}: <span className="line-through text-[var(--text-3)]">{was}</span>
              {' → '}<span className="font-semibold text-[var(--text)]">{change.value || '(none)'}</span>
              {change.field === 'EMAIL' && <span className="text-[var(--text-3)]"> · they'll sign in with it</span>}
            </div>
          )}
        </div>
        {!refusing && (
          <div className="flex gap-1.5">
            <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ decision: 'approve' })}
              className={`${btn} bg-[var(--text)] text-[var(--panel)]`}>Approve</button>
            <button type="button" disabled={decide.isPending} onClick={() => setRefusing(true)}
              className={`${btn} border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--bg)]`}>Not approved</button>
          </div>
        )}
      </div>
      {refusing && (
        <form className="flex gap-1.5" onSubmit={e => { e.preventDefault(); decide.mutate({ decision: 'reject', note }) }}>
          <input autoFocus value={note} onChange={e => setNote(e.target.value)} maxLength={300}
            placeholder={`Why not? ${change.first_name} will see this`}
            className="flex-1 h-8 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)] outline-none focus:border-[var(--text-3)]" />
          <button type="submit" disabled={decide.isPending} className={`${btn} bg-[var(--text)] text-[var(--panel)]`}>Send</button>
          <button type="button" onClick={() => setRefusing(false)} className={`${btn} text-[var(--text-3)]`}>Cancel</button>
        </form>
      )}
      {error && <p className="text-xs text-[var(--red-text)]">{error}</p>}
    </div>
  )
}

function Section({ title, count, muted, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-1 h-5 rounded-full ${muted ? 'bg-slate-300' : 'bg-red-600'}`} />
        <span className={`text-sm font-bold ${muted ? 'text-[var(--text-3)]' : 'text-[var(--text)]'}`}>{title}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-[var(--bg)] text-[var(--text-3)] rounded-full border border-[var(--border)]">{count}</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>
      {children}
    </div>
  )
}

export default function Staff() {
  const [period, setPeriod] = useState('week')
  const [editing, setEditing] = useState(null)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['staffCards', period],
    queryFn: () => getStaffCards(period),
    placeholderData: prev => prev,
    refetchInterval: 60_000,
  })

  const staff = data?.staff || []
  const waiting = data?.waiting || []
  const active = staff.filter(s => s.is_active)
  const inactive = staff.filter(s => !s.is_active)
  const counts = Object.entries(data?.counts || {})
  const grid = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'

  return (
    <div className="p-5 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Staff</h2>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {active.length} team member{active.length !== 1 ? 's' : ''} · {data?.on ?? 0} on shift now
          </p>
          {counts.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-2">
              {counts.map(([role, n]) => (
                <span key={role} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text-2)]">
                  {n} {role}{n !== 1 ? 's' : ''}
                </span>
              ))}
            </div>
          )}
        </div>
        <PeriodSwitch value={period} onChange={setPeriod} />
      </div>

      {isLoading ? (
        <div className={grid}>
          {[1, 2, 3].map(i => <div key={i} className="h-80 bg-[var(--panel)] border border-[var(--border)] rounded-2xl animate-pulse" />)}
        </div>
      ) : isError ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl py-16 text-center text-sm text-[var(--text-2)]">
          Couldn't load the staff. Try again in a moment.
        </div>
      ) : staff.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl flex flex-col items-center justify-center py-16">
          <p className="text-sm font-semibold text-[var(--text-2)]">No staff found</p>
          <p className="text-xs text-[var(--text-3)] mt-1">Staff are assigned through HQ</p>
        </div>
      ) : (
        <>
          {waiting.length > 0 && (
            <Section title="Waiting for your approval" count={waiting.length}>
              <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)]">
                {waiting.map(c => <WaitingRow key={c.id} change={c} />)}
              </div>
            </Section>
          )}
          <Section title="Active" count={active.length}>
            <div className={grid}>{active.map(m => <StaffCard key={m.id} member={m} onEdit={setEditing} />)}</div>
          </Section>
          {inactive.length > 0 && (
            <Section title="Inactive" count={inactive.length} muted>
              <div className={`${grid} opacity-50`}>{inactive.map(m => <StaffCard key={m.id} member={m} onEdit={setEditing} />)}</div>
            </Section>
          )}
        </>
      )}

      {editing && <StaffEditor member={editing} period={period} onClose={() => setEditing(null)} />}
    </div>
  )
}
