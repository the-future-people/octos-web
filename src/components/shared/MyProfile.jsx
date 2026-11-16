// src/components/shared/MyProfile.jsx
//
// My profile (15 Nov 2026): the same page in every portal, opened from your
// name in the top bar. Your phone, email and photo are yours to change, but
// (16 Nov 2026) a change waits for your Branch Manager and takes effect when
// he approves it; his own changes apply at once. Name, role, employee ID and
// branch are set by the business. Your own numbers, for today, this week or
// this month.
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getProfile, refusal, removePhoto, saveContact, uploadPhoto, withdrawChange } from '../../api/profile'
import StaffAvatar from './StaffAvatar'
import { NumberTiles, PeriodSwitch, PhotoButtons, fmtJoined } from './ProfileBits'

const input = 'w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] outline-none focus:border-[var(--text-3)]'

function Waiting({ change, onWithdraw, busy }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-3 py-2"
      style={{ background: 'rgba(239, 159, 39, 0.12)', border: '1px solid rgba(239, 159, 39, 0.45)' }}>
      {change.photo_url && <img src={change.photo_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />}
      <div className="flex-1 min-w-0 text-xs">
        <div className="font-semibold text-[var(--text)]">Waiting for your Branch Manager</div>
        <div className="text-[var(--text-2)] truncate">
          {change.removes_photo ? 'Remove your photo' : change.field === 'PHOTO' ? 'New photo' : `New ${change.what}: ${change.value || '(none)'}`}
        </div>
      </div>
      <button type="button" disabled={busy} onClick={() => onWithdraw(change.id)}
        className="text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text)] hover:underline disabled:opacity-50">Take back</button>
    </div>
  )
}

export default function MyProfile({ onClose }) {
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState('week')
  const [phone, setPhone] = useState(null)       // null until the person edits it
  const [email, setEmail] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  const { data: me, isLoading } = useQuery({
    queryKey: ['profile', period],
    queryFn: () => getProfile(period),
    placeholderData: prev => prev,
  })

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const asks = !me?.approves_own
  const done = (what) => (data) => {
    queryClient.setQueryData(['profile', period], data)
    queryClient.invalidateQueries({ queryKey: ['profile'] })
    queryClient.invalidateQueries({ queryKey: ['staffCards'] })
    setError(''); setPhone(null); setEmail(null)
    setSaved(what === 'withdrawn' ? 'Request taken back.'
      : asks ? 'Sent to your Branch Manager. It changes when he approves it.'
      : what === 'photo' ? 'Photo saved.' : 'Saved.')
  }
  const failed = (err) => { setSaved(''); setError(refusal(err)) }

  const photo = useMutation({ mutationFn: uploadPhoto, onSuccess: done('photo'), onError: failed })
  const unphoto = useMutation({ mutationFn: removePhoto, onSuccess: done('photo'), onError: failed })
  const contact = useMutation({ mutationFn: saveContact, onSuccess: done('contact'), onError: failed })
  const takeBack = useMutation({ mutationFn: withdrawChange, onSuccess: done('withdrawn'), onError: failed })
  const busy = photo.isPending || unphoto.isPending || contact.isPending || takeBack.isPending

  const phoneValue = phone ?? me?.phone ?? ''
  const emailValue = email ?? me?.email ?? ''
  const edited = phone !== null || email !== null
  const save = (e) => {
    e.preventDefault()
    const fields = {}
    if (phone !== null) fields.phone = phone
    if (email !== null) fields.email = email
    contact.mutate(fields)
  }
  const label = 'text-[10.5px] font-bold tracking-wider text-[var(--text-3)] uppercase'

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-start sm:items-center justify-center p-0 sm:p-6"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-label="My profile"
        className="w-full sm:max-w-lg max-h-full overflow-y-auto bg-[var(--panel)] sm:rounded-2xl border border-[var(--border)] shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-base font-bold text-[var(--text)]">My profile</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-lg grid place-items-center text-[var(--text-3)] hover:bg-[var(--bg)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {isLoading || !me ? (
          <div className="p-5"><div className="h-40 rounded-xl bg-[var(--bg)] animate-pulse" /></div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Who you are, and your photo */}
            <div className="flex items-center gap-4 flex-wrap">
              <StaffAvatar person={me} size={84} />
              <div className="flex-1 min-w-[180px] space-y-2">
                <div>
                  <div className="text-lg font-bold text-[var(--text)] leading-tight">{me.full_name}</div>
                  <div className="text-sm text-[var(--text-2)]">{me.role_label}{me.branch ? ` · ${me.branch}` : ''}</div>
                </div>
                <PhotoButtons busy={busy} hasPhoto={!!me.photo_url}
                  onPhoto={file => photo.mutate(file)} onRemove={() => unphoto.mutate()} />
              </div>
            </div>

            {/* Yours to change */}
            <div className="pt-4 border-t border-[var(--border)] space-y-3">
              <div>
                <div className={label}>Yours to change</div>
                {asks && <p className="text-[11.5px] text-[var(--text-3)] mt-1">Your Branch Manager approves each change before it takes effect.</p>}
              </div>

              {me.pending?.length > 0 && (
                <div className="space-y-1.5">
                  {me.pending.map(c => <Waiting key={c.id} change={c} busy={busy} onWithdraw={id => takeBack.mutate(id)} />)}
                </div>
              )}

              <form className="space-y-2.5" onSubmit={save}>
                <label className="block">
                  <span className="block text-xs text-[var(--text-2)] mb-1">Phone</span>
                  <input value={phoneValue} onChange={e => { setPhone(e.target.value); setSaved('') }} inputMode="tel"
                    placeholder="024 555 0172" className={input} />
                </label>
                <label className="block">
                  <span className="block text-xs text-[var(--text-2)] mb-1">Email <span className="text-[var(--text-3)]">· you sign in with it</span></span>
                  <input value={emailValue} onChange={e => { setEmail(e.target.value); setSaved('') }} type="email" inputMode="email"
                    placeholder="name@example.com" className={input} />
                </label>
                <div className="flex justify-end">
                  <button type="submit" disabled={busy || !edited}
                    className="h-9 px-4 rounded-lg bg-[var(--text)] text-[var(--panel)] text-sm font-semibold disabled:opacity-40">
                    {asks ? 'Send for approval' : 'Save'}
                  </button>
                </div>
              </form>
              {error && <p className="text-xs text-[var(--red-text)]">{error}</p>}
              {saved && !error && <p className="text-xs text-emerald-600">{saved}</p>}
            </div>

            {/* Set by the business */}
            <div className="pt-4 border-t border-[var(--border)] space-y-2">
              <div className={`${label} flex items-center gap-1`}>
                Set by the business
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {[['Employee ID', me.employee_id, true], ['Joined', fmtJoined(me.joined)], ['Role', me.role_label], ['Branch', me.branch]].map(([k, v, mono]) => (
                  <div key={k} className="min-w-0">
                    <div className={label}>{k}</div>
                    <div className={`text-sm font-semibold text-[var(--text)] truncate ${mono ? 'font-mono' : ''}`}>{v || '—'}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11.5px] text-[var(--text-3)]">Something wrong here? Ask your Branch Manager.</p>
            </div>

            {/* Your numbers */}
            <div className="pt-4 border-t border-[var(--border)] space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className={label}>Your numbers</div>
                <PeriodSwitch value={period} onChange={setPeriod} />
              </div>
              <NumberTiles numbers={me.numbers} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
