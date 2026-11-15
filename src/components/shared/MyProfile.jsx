// src/components/shared/MyProfile.jsx
//
// My profile (15 Nov 2026): the same page in every portal, opened from your
// name in the top bar. Your photo and phone are yours to change; name, role,
// employee ID, email and branch are set by the business. Your own numbers,
// for today, this week or this month.
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getProfile, refusal, removePhoto, savePhone, uploadPhoto } from '../../api/profile'
import StaffAvatar from './StaffAvatar'
import { NumberTiles, PeriodSwitch, PhotoButtons, fmtJoined } from './ProfileBits'

export default function MyProfile({ onClose }) {
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState('week')
  const [phone, setPhone] = useState(null)       // null until the person edits it
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

  const done = (message) => (data) => {
    queryClient.setQueryData(['profile', period], data)
    queryClient.invalidateQueries({ queryKey: ['profile'] })
    queryClient.invalidateQueries({ queryKey: ['staffCards'] })
    setError(''); setSaved(message); setPhone(null)
  }
  const failed = (err) => { setSaved(''); setError(refusal(err)) }

  const photo = useMutation({ mutationFn: uploadPhoto, onSuccess: done('Photo saved'), onError: failed })
  const unphoto = useMutation({ mutationFn: removePhoto, onSuccess: done('Photo removed'), onError: failed })
  const number = useMutation({ mutationFn: savePhone, onSuccess: done('Phone saved'), onError: failed })
  const busy = photo.isPending || unphoto.isPending || number.isPending

  const phoneValue = phone ?? me?.phone ?? ''
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
            <div className="pt-4 border-t border-[var(--border)] space-y-2">
              <div className={label}>Yours to change</div>
              <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); number.mutate(phoneValue) }}>
                <label className="flex-1">
                  <span className="block text-xs text-[var(--text-2)] mb-1">Phone</span>
                  <input value={phoneValue} onChange={e => { setPhone(e.target.value); setSaved('') }} inputMode="tel"
                    placeholder="024 555 0172"
                    className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] outline-none focus:border-[var(--text-3)]" />
                </label>
                <button type="submit" disabled={busy || phone === null}
                  className="h-9 px-4 rounded-lg bg-[var(--text)] text-[var(--panel)] text-sm font-semibold disabled:opacity-40">Save</button>
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
                {[['Employee ID', me.employee_id, true], ['Joined', fmtJoined(me.joined)], ['Email', me.email], ['Role', me.role_label]].map(([k, v, mono]) => (
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
