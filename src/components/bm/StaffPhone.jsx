// src/components/bm/StaffPhone.jsx
//
// The staff on a phone (18 Nov 2026), in the Overview's look.
//   Staff, how many, and how many are on shift now
//   Changes waiting for the Branch Manager's approval, first and in amber
//   Everyone as a row: photo with a live dot, name, role, where they are now
// A tap slides the person in: their card (Farhat, the branch, employee ID,
// joined), Call and WhatsApp, three numbers for today, the week or the month,
// and their photo, phone and email to change. The same calls as Staff.jsx.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { decideChange, getStaffCards, refusal, removeStaffPhoto, saveStaffContact, uploadStaffPhoto, shrinkPhoto } from '../../api/profile'
import StaffAvatar from '../shared/StaffAvatar'
import { PERIODS, fmtJoined } from '../shared/ProfileBits'
import PhoneHeader from './PhoneHeader'

const card = 'mx-4 rounded-[16px] bg-white border border-black/[0.04] shadow-[0_3px_12px_rgba(17,24,39,0.05)]'
const DOT = { active: '#22C55E', break: '#F59E0B', idle: '#A1A1AA', off: null }

const Svg = ({ d, size = 18, width = 2, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{d}</svg>
)
const PHONE = <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />

// 024 555 0172 -> 233245550172, for WhatsApp links.
function waNumber(phone) {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('233')) return digits
  if (digits.startsWith('0')) return '233' + digits.slice(1)
  return digits
}

function Face({ person, size = 46 }) {
  const dot = DOT[person.presence?.state]
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <StaffAvatar person={person} size={size} />
      {dot && <span className="absolute right-0 bottom-0 rounded-full" style={{ width: size * 0.28, height: size * 0.28, background: dot, boxShadow: '0 0 0 2px #FFFFFF' }} />}
    </span>
  )
}

function Segmented({ value, onPick }) {
  return (
    <div className="p-[3px] rounded-[10px] bg-black/[0.06] flex" role="radiogroup">
      {PERIODS.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onPick(v)}
          className={`flex-1 h-[30px] rounded-[8px] text-[13.5px] font-semibold ${value === v ? 'bg-white text-[#111] shadow-[0_2px_6px_rgba(0,0,0,0.10)]' : 'text-[#3A3A3C]'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

// One change a person asked for: Approve, or Not approved with a reason.
function Waiting({ change }) {
  const queryClient = useQueryClient()
  const [refusing, setRefusing] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const decide = useMutation({
    mutationFn: ({ decision, note }) => decideChange(change.id, decision, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staffCards'] }),
    onError: err => setError(refusal(err)),
  })
  return (
    <div className="px-4 py-3">
      <div className="text-[15.5px] font-semibold">{change.full_name} <span className="font-normal text-[#8A8A8E]">· {change.role_label}</span></div>
      {change.field === 'PHOTO' ? (
        <div className="mt-2 flex items-center gap-2.5 text-[14px]">
          {change.current_photo_url ? <img src={change.current_photo_url} alt="Current" className="w-10 h-10 rounded-full object-cover" />
            : <span className="w-10 h-10 rounded-full grid place-items-center bg-[#F2F2F4] text-[11px] text-[#8A8A8E]">None</span>}
          <span className="text-[#8A8A8E]">→</span>
          {change.removes_photo ? <span className="font-semibold">Remove the photo</span>
            : <img src={change.photo_url} alt="New" className="w-12 h-12 rounded-full object-cover ring-2 ring-[#F59E0B]" />}
        </div>
      ) : (
        <div className="mt-0.5 text-[14px] text-[#3A3A3C]">
          {change.what[0].toUpperCase() + change.what.slice(1)}: <span className="line-through text-[#A1A1AA]">{change.current || '(none)'}</span>
          {' → '}<b className="text-[#111]">{change.value || '(none)'}</b>
        </div>
      )}
      {refusing ? (
        <form className="mt-2.5 flex gap-2" onSubmit={e => { e.preventDefault(); decide.mutate({ decision: 'reject', note }) }}>
          <input autoFocus value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder={`Why not? ${change.first_name} will see this`}
            className="flex-1 min-w-0 h-[40px] px-3 rounded-[12px] bg-[#F2F2F4] text-[16px] outline-none" />
          <button type="submit" disabled={decide.isPending} className="h-[40px] px-3.5 rounded-[12px] bg-[#1C1C1E] text-white text-[14.5px] font-semibold">Send</button>
        </form>
      ) : (
        <div className="mt-2.5 flex gap-2">
          <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ decision: 'approve' })}
            className="flex-1 h-[40px] rounded-[12px] bg-[#1C1C1E] text-white text-[14.5px] font-semibold disabled:opacity-50">Approve</button>
          <button type="button" disabled={decide.isPending} onClick={() => setRefusing(true)}
            className="flex-1 h-[40px] rounded-[12px] bg-[#F2F2F4] text-[#1C1C1E] text-[14.5px] font-semibold">Not approved</button>
        </div>
      )}
      {error && <p className="m-0 mt-1.5 text-[13px] text-[#B91C1C]">{error}</p>}
    </div>
  )
}

function PersonPage({ member, period, setPeriod, onClose }) {
  const queryClient = useQueryClient()
  // What was changed here, laid over the latest from the server (numbers, presence).
  const [edits, setEdits] = useState({})
  const person = { ...member, ...edits }
  const [phone, setPhone] = useState(member.phone || '')
  const [email, setEmail] = useState(member.email || '')
  const [note, setNote] = useState({ text: '', bad: false })
  useEffect(() => {
    document.body.dataset.fullscreen = '1'
    return () => { delete document.body.dataset.fullscreen }
  }, [])
  const done = text => data => { setEdits(e => ({ ...e, ...data })); queryClient.invalidateQueries({ queryKey: ['staffCards'] }); setNote({ text: `${text}. ${member.first_name} has been told.`, bad: false }) }
  const failed = err => setNote({ text: refusal(err), bad: true })
  const photo = useMutation({ mutationFn: file => uploadStaffPhoto(member.id, file), onSuccess: done('Photo saved'), onError: failed })
  const unphoto = useMutation({ mutationFn: () => removeStaffPhoto(member.id), onSuccess: done('Photo removed'), onError: failed })
  const contact = useMutation({ mutationFn: () => saveStaffContact(member.id, { phone, email }), onSuccess: done('Saved'), onError: failed })
  const busy = photo.isPending || unphoto.isPending || contact.isPending
  const changed = phone !== (person.phone || '') || email !== (person.email || '')
  const wa = waNumber(person.phone)
  const pick = async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) photo.mutate(await shrinkPhoto(f)) }

  return createPortal(
    <section aria-label={member.full_name} className="ios ios-push fixed inset-0 z-[65] flex flex-col" style={{ background: '#F6F6F8' }}>
      <div className="ios-bar shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-[50px] px-2 flex items-center">
          <button type="button" onClick={onClose} className="flex items-center text-[17px] text-[#D70015] pr-2">
            <Svg d={<path d="M15 18l-6-6 6-6" />} size={26} width={2.4} />Staff
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {/* Their card */}
        <div className={`${card} mt-4 overflow-hidden`}>
          <div className="px-4 pt-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#D70015]">Farhat Printing Press</span>
            <span className="text-[12px] text-[#8A8A8E]">{person.branch}</span>
          </div>
          <div className="px-4 pt-4 pb-4 flex flex-col items-center text-center">
            <Face person={person} size={84} />
            <div className="mt-3 text-[22px] leading-[28px] font-extrabold tracking-[-0.01em]">{person.full_name}</div>
            <div className="text-[14.5px] text-[#6E6E73]">{person.role_label}</div>
            <div className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: person.presence ? '#3A3A3C' : '#8A8A8E' }}>
              {DOT[person.presence?.state] && <span className="w-2 h-2 rounded-full" style={{ background: DOT[person.presence.state] }} />}
              {person.presence?.label || 'Not in today'}
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-black/[0.06]">
            <div className="px-4 py-2.5"><div className="text-[12px] text-[#8A8A8E]">Employee ID</div><div className="text-[15px] font-semibold tabular-nums">{person.employee_id || '—'}</div></div>
            <div className="px-4 py-2.5 border-l border-black/[0.06]"><div className="text-[12px] text-[#8A8A8E]">Joined</div><div className="text-[15px] font-semibold">{fmtJoined(person.joined)}</div></div>
          </div>
        </div>

        {person.phone && (
          <div className="mx-4 mt-3 flex gap-2.5">
            <a href={`tel:${person.phone.replace(/\s/g, '')}`} className="flex-1 h-[44px] rounded-[14px] inline-flex items-center justify-center gap-2 text-[15px] font-semibold"
              style={{ background: '#D3F2DE', color: '#15803D' }}><Svg d={PHONE} size={16} />Call</a>
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="flex-1 h-[44px] rounded-[14px] bg-white border border-black/[0.06] inline-flex items-center justify-center gap-2 text-[15px] font-semibold">
              <img src="/brand/whatsapp.png" alt="" className="w-4 h-4" />WhatsApp</a>}
          </div>
        )}

        {/* Their numbers */}
        <div className="px-5 pt-6 pb-2 flex items-center justify-between gap-3">
          <h2 className="m-0 text-[20px] font-bold">Their numbers</h2>
          <div className="w-[190px]"><Segmented value={period} onPick={setPeriod} /></div>
        </div>
        <div className={`${card} grid grid-cols-3`}>
          {(person.numbers || []).map((n, i) => (
            <div key={n.label} className={`px-3 py-3 ${i ? 'border-l border-black/[0.06]' : ''}`}>
              <div className="text-[22px] leading-[28px] font-bold tabular-nums">{n.value}</div>
              <div className="text-[12px] leading-[15px] text-[#6E6E73]">{n.label}</div>
            </div>
          ))}
        </div>

        {/* Photo, phone and email */}
        <div className="px-5 pt-6 pb-2"><h2 className="m-0 text-[20px] font-bold">Photo and contact</h2></div>
        <div className={`${card} divide-y divide-black/[0.06]`}>
          <div className="flex items-center gap-3 px-4 py-3">
            <StaffAvatar person={person} size={44} />
            <label className="h-[36px] px-3.5 rounded-full bg-[#F2F2F4] text-[14px] font-semibold grid place-items-center">
              Take or choose a photo<input type="file" accept="image/*" hidden onChange={pick} disabled={busy} />
            </label>
            {person.photo_url && <button type="button" onClick={() => unphoto.mutate()} disabled={busy} className="text-[14px] font-semibold text-[#D70015]">Remove</button>}
          </div>
          <label className="flex items-center gap-3 px-4 h-[48px]">
            <span className="w-14 text-[15px] text-[#6E6E73]">Phone</span>
            <input value={phone} onChange={e => { setPhone(e.target.value); setNote({ text: '', bad: false }) }} inputMode="tel" placeholder="024 555 0172"
              className="flex-1 min-w-0 bg-transparent text-[16px] outline-none text-right tabular-nums" />
          </label>
          <label className="flex items-center gap-3 px-4 h-[48px]">
            <span className="w-14 text-[15px] text-[#6E6E73]">Email</span>
            <input value={email} onChange={e => { setEmail(e.target.value); setNote({ text: '', bad: false }) }} type="email" placeholder="name@example.com"
              className="flex-1 min-w-0 bg-transparent text-[16px] outline-none text-right" />
          </label>
        </div>
        <p className="m-0 mx-5 mt-1.5 text-[12.5px] text-[#8A8A8E]">They sign in with their email. {member.first_name} can also change these in My profile.</p>
        {changed && (
          <button type="button" onClick={() => contact.mutate()} disabled={busy}
            className="mx-4 mt-3 w-[calc(100%-2rem)] h-[46px] rounded-[14px] bg-[#1C1C1E] text-white text-[15.5px] font-semibold disabled:opacity-50">
            {contact.isPending ? 'Saving…' : 'Save'}
          </button>
        )}
        {note.text && <p className={`m-0 mx-5 mt-2 text-[13.5px] font-medium ${note.bad ? 'text-[#B91C1C]' : 'text-[#15803D]'}`}>{note.text}</p>}
      </div>
    </section>,
    document.body,
  )
}

export default function StaffPhone() {
  const [period, setPeriod] = useState('week')
  const [openId, setOpenId] = useState(null)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['staffCards', period], queryFn: () => getStaffCards(period),
    placeholderData: prev => prev, refetchInterval: 60_000,
  })
  const staff = data?.staff || []
  const waiting = data?.waiting || []
  const active = staff.filter(s => s.is_active)
  const inactive = staff.filter(s => !s.is_active)
  const open = staff.find(s => s.id === openId)

  const row = (m, i) => (
    <button key={m.id} type="button" onClick={() => setOpenId(m.id)} className="w-full flex items-center gap-3 pl-3.5 text-left active:bg-black/[0.04]">
      <Face person={m} />
      <span className={`flex-1 min-w-0 flex items-center gap-2 py-2.5 pr-3 ${i ? 'border-t border-black/[0.07]' : ''}`}>
        <span className="flex-1 min-w-0">
          <span className="block text-[16px] leading-[21px] font-semibold truncate">{m.full_name}</span>
          <span className="block text-[13px] text-[#6E6E73] truncate">{m.role_label}{m.presence ? ` · ${m.presence.label}` : ' · Not in today'}</span>
          {m.pending?.length > 0 && <span className="block text-[12.5px] font-semibold text-[#B45309]">{m.pending.length} change{m.pending.length > 1 ? 's' : ''} waiting for you</span>}
        </span>
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="#C4C4C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 1l6 6-6 6" /></svg>
      </span>
    </button>
  )

  return (
    <div className="ios min-h-full pb-6" style={{ background: '#F6F6F8' }}>
      <PhoneHeader />
      <div className="px-4 pt-1">
        <h1 className="m-0 text-[30px] leading-[36px] font-extrabold tracking-[-0.02em] text-[#111]">Staff</h1>
        <div className="text-[14px] text-[#8A8A8E]">
          {active.length} team member{active.length === 1 ? '' : 's'} · <span className="text-[#15803D] font-medium">{data?.on ?? 0} on shift now</span>
        </div>
      </div>

      {isLoading ? <div className={`${card} mt-4 h-[300px] animate-pulse`} aria-hidden="true" />
        : isError ? <div className={`${card} mt-4 py-12 text-center text-[15px] text-[#3A3A3C]`}>Couldn’t load the staff. Try again in a moment.</div>
        : (
          <>
            {waiting.length > 0 && (
              <>
                <div className="px-5 pt-5 pb-1.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#B45309]">Waiting for your approval · {waiting.length}</div>
                <div className={`${card} divide-y divide-black/[0.06]`} style={{ boxShadow: 'inset 3px 0 0 #F59E0B, 0 3px 12px rgba(17,24,39,0.05)' }}>
                  {waiting.map(c => <Waiting key={c.id} change={c} />)}
                </div>
              </>
            )}
            <div className="px-5 pt-5 pb-1.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#8A8A8E]">Team · {active.length}</div>
            <div className={`${card} overflow-hidden`}>{active.map(row)}</div>
            {inactive.length > 0 && (
              <>
                <div className="px-5 pt-5 pb-1.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#A1A1AA]">No longer active · {inactive.length}</div>
                <div className={`${card} overflow-hidden opacity-60`}>{inactive.map(row)}</div>
              </>
            )}
          </>
        )}

      {open && <PersonPage member={open} period={period} setPeriod={setPeriod} onClose={() => setOpenId(null)} />}
    </div>
  )
}
