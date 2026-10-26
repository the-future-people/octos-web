// src/components/bm/NewCustomerModal.jsx
//
// Registering a customer, at the counter's pace.
//
// The number comes first. It is checked as it is typed, and looked up the
// moment it is a real one: if the customer is already here, the form says
// so before anyone types a name, and "Use this customer" picks them
// instead. Then who they are; then anything optional. Light headings
// rather than boxes, so the whole form is short; the title sets the
// gender (still changeable); Enter registers; "Register another after
// this" keeps the form open for a group.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createCustomer, lookupCustomer, getCustomers } from '../../api/bm'
import JobSuccessOverlay from '../shared/JobSuccessOverlay'
import PhoneInput from '../shared/PhoneInput'
import { invalidateAfterCustomerRegistered } from '../../api/invalidations'

const LABEL = 'block text-[11px] font-semibold text-[var(--text-2)] mb-1'
const INPUT = `w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl
               outline-none focus:border-[var(--border-dark)] transition-colors`
const OPT = <span className="font-normal text-[var(--text-3)]"> (optional)</span>
const REQ = <span className="text-[var(--red-text)]"> *</span>

const TYPES = [
  { value: 'INDIVIDUAL', label: 'Individual', sub: 'A person', tint: 'bg-indigo-100 text-indigo-700',
    icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></> },
  { value: 'BUSINESS', label: 'Business', sub: 'Company / firm', tint: 'bg-sky-100 text-sky-700',
    icon: <><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" /><path d="M15 9h4a1 1 0 0 1 1 1v11M8 8h3M8 12h3M8 16h3M3 21h18" /></> },
  { value: 'INSTITUTION', label: 'Institution', sub: 'School / org', tint: 'bg-violet-100 text-violet-700',
    icon: <><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v5" /></> },
]

const GENDER_FROM_TITLE = { MR: 'MALE', MRS: 'FEMALE', MS: 'FEMALE' }

const BLANK = {
  title: 'MR', first_name: '', last_name: '', gender: 'MALE', date_of_birth: '',
  phone: '', secondary_phone: '', email: '', company_name: '', customer_type: 'INDIVIDUAL',
  institution_subtype: '', notes: '', address: '',
}

function useLookup() {
  const [status, setStatus] = useState(null)   // null | 'checking' | { found, customer }
  const timer = useRef(null)
  const abort = useRef(null)
  const lookup = phone => {
    clearTimeout(timer.current)
    abort.current?.abort()
    setStatus('checking')
    timer.current = setTimeout(async () => {
      const controller = new AbortController()
      abort.current = controller
      try {
        const res = await lookupCustomer({ phone, signal: controller.signal })
        setStatus({ found: true, customer: res.data })
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
        setStatus(err.response?.status === 404 ? { found: false } : null)
      }
    }, 350)
  }
  const reset = () => { clearTimeout(timer.current); abort.current?.abort(); setStatus(null) }
  useEffect(() => () => { clearTimeout(timer.current); abort.current?.abort() }, [])
  return { status, lookup, reset }
}

const nameOf = c => (c.customer_type === 'INDIVIDUAL'
  ? [c.title, c.first_name, c.last_name].filter(Boolean).join(' ')
  : c.company_name || [c.first_name, c.last_name].filter(Boolean).join(' '))

/**
 * onClose, onSuccess   as before
 * onUseExisting        optional (customer) => void: "Use this customer" picks
 *                      them; without it, the form only says they are here.
 */
export default function NewCustomerModal({ onClose, onSuccess, onUseExisting }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(BLANK)
  const [phoneCheck, setPhoneCheck] = useState({ valid: false, problem: '' })
  const [altCheck, setAltCheck] = useState({ valid: true, problem: '', text: '' })
  const [genderTouched, setGenderTouched] = useState(false)
  const [another, setAnother] = useState(false)
  const [justDone, setJustDone] = useState('')
  const [formKey, setFormKey] = useState(0)          // fresh phone fields after "another"
  const [error, setError] = useState('')
  const [successName, setSuccessName] = useState(null)
  const { status: phoneStatus, lookup, reset: resetLookup } = useLookup()

  const [affQuery, setAffQuery] = useState('')
  const [affResults, setAffResults] = useState([])
  const [affiliation, setAffiliation] = useState(null)
  const affTimer = useRef(null)

  const isIndividual = form.customer_type === 'INDIVIDUAL'
  const orgWord = form.customer_type === 'BUSINESS' ? 'Business' : 'Institution'

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const setTitle = title => setForm(f => ({
    ...f, title,
    // The title suggests the gender, until someone chooses it themselves.
    ...(genderTouched || !GENDER_FROM_TITLE[title] ? {} : { gender: GENDER_FROM_TITLE[title] }),
  }))

  const onPhone = (number, meta) => {
    set('phone', number)
    setPhoneCheck(meta)
    if (meta.valid) lookup(number)
    else resetLookup()
  }

  const searchAff = q => {
    setAffQuery(q)
    clearTimeout(affTimer.current)
    if (q.trim().length < 2) { setAffResults([]); return }
    affTimer.current = setTimeout(async () => {
      try {
        const res = await getCustomers({ search: q, page_size: 6 })
        const list = Array.isArray(res.data) ? res.data : (res.data?.results || [])
        setAffResults(list.filter(c => c.customer_type === 'BUSINESS' || c.customer_type === 'INSTITUTION'))
      } catch { setAffResults([]) }
    }, 350)
  }

  const { mutate, isPending } = useMutation({
    mutationFn: payload => createCustomer(payload),
    onSuccess: res => {
      invalidateAfterCustomerRegistered(queryClient)
      const name = nameOf(res.data) || 'Customer'
      if (another) {
        // Ready for the next one: same kind of customer, a clean form.
        setForm({ ...BLANK, customer_type: form.customer_type })
        setGenderTouched(false); setAffiliation(null); setAffQuery('')
        setPhoneCheck({ valid: false, problem: '' }); setAltCheck({ valid: true, problem: '', text: '' })
        resetLookup(); setFormKey(k => k + 1)
        setJustDone(name)
      } else {
        setSuccessName(name)
      }
    },
    onError: err => {
      const d = err.response?.data
      setError(d?.detail || (typeof d === 'object'
        ? Object.entries(d).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v[0] : v}`).join(' · ')
        : 'That didn’t save. Try again.'))
    },
  })

  function submit(e) {
    e?.preventDefault()
    setError('')
    if (!phoneCheck.valid) return setError(phoneCheck.problem || 'Enter their phone number.')
    if (phoneStatus === 'checking') return setError('One moment: checking the number…')
    if (phoneStatus?.found) return setError('This number is already registered.')
    if (altCheck.text?.trim() && !altCheck.valid) return setError(`Second number: ${altCheck.problem || 'check it.'}`)
    if (!isIndividual && !form.company_name.trim()) return setError(`Enter the ${orgWord.toLowerCase()}’s name.`)
    if (!isIndividual && !form.address.trim()) return setError(`Enter the ${orgWord.toLowerCase()}’s address.`)
    if (!form.first_name.trim()) return setError(isIndividual ? 'Enter their first name.' : 'Enter the contact person’s first name.')
    const payload = { ...form }
    if (!payload.date_of_birth) delete payload.date_of_birth
    if (affiliation) payload.affiliation = affiliation.id
    mutate(payload)
  }

  const close = () => { resetLookup(); onClose() }

  const modal = createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 animate-fadeIn">
      <form onSubmit={submit}
            className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-slideUp">

        <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)] shrink-0">
          <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 grid place-items-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                 strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
              <circle cx="10" cy="8" r="4" /><path d="M2 21a8 8 0 0 1 14-5.3M19 14v6M16 17h6" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="font-bold text-lg text-[var(--text)]">Register customer</div>
            <div className="text-xs text-[var(--text-3)]">Start with their number: we’ll check they’re not already here</div>
          </div>
          <button type="button" onClick={close} aria-label="Close"
                  className="ml-auto w-8 h-8 grid place-items-center rounded-full hover:bg-[var(--bg)] text-[var(--text-3)]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-2">
          {justDone && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              ✓ {justDone} registered. Ready for the next one.
            </div>
          )}

          {/* What kind of customer */}
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map(t => {
              const on = form.customer_type === t.value
              return (
                <button key={t.value} type="button" onClick={() => set('customer_type', t.value)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border-[1.5px] text-left transition-colors
                                    ${on ? 'border-indigo-500 bg-indigo-50/60' : 'border-[var(--border)] hover:border-[var(--border-dark)]'}`}>
                  <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${t.tint}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                         strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">{t.icon}</svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-[var(--text)]">{t.label}</span>
                    <span className="block text-[10.5px] text-[var(--text-3)] truncate">{t.sub}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* How to reach them: the number first */}
          <p className="mt-5 mb-2 text-[10px] font-black tracking-widest uppercase text-[var(--text-3)]">How to reach them</p>
          <label className={LABEL}>Phone{REQ}</label>
          <PhoneInput key={`p${formKey}`} value={form.phone} onChange={onPhone} autoFocus />
          {phoneStatus === 'checking' && <p className="mt-1 text-[11px] text-[var(--text-3)]">Checking whether they’re already here…</p>}
          {phoneStatus?.found === false && <p className="mt-1 text-[11px] font-semibold text-emerald-700">New number: carry on</p>}
          {phoneStatus?.found && (
            <div className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--red-bg)] border border-[var(--red-border)]">
              <div className="min-w-0">
                <p className="text-[10px] font-black tracking-wider text-[var(--red-text)] uppercase">Already registered</p>
                <p className="text-xs text-[var(--red-text)] truncate">
                  {nameOf(phoneStatus.customer)} · {{ INDIVIDUAL: 'Individual', BUSINESS: 'Business', INSTITUTION: 'Institution' }[phoneStatus.customer.customer_type] || phoneStatus.customer.customer_type}
                </p>
              </div>
              {onUseExisting ? (
                <button type="button" onClick={() => { onUseExisting(phoneStatus.customer); close() }}
                        className="ml-auto shrink-0 px-3 py-2 rounded-lg bg-[var(--text)] text-white text-xs font-bold">
                  Use this customer
                </button>
              ) : (
                <button type="button" onClick={close}
                        className="ml-auto shrink-0 px-3 py-2 rounded-lg border border-[var(--red-border)] text-[var(--red-text)] text-xs font-bold">
                  No need to register
                </button>
              )}
            </div>
          )}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Second number{OPT}</label>
              <PhoneInput key={`s${formKey}`} value={form.secondary_phone} placeholder="054 123 4567"
                          onChange={(number, meta) => { set('secondary_phone', meta.text?.trim() ? number : ''); setAltCheck(meta) }} />
            </div>
            <div>
              <label className={LABEL}>Email{OPT}</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                     placeholder="email@example.com" className={INPUT} />
            </div>
          </div>

          {/* Who they are */}
          <p className="mt-5 mb-2 text-[10px] font-black tracking-widest uppercase text-[var(--text-3)]">Who they are</p>
          {!isIndividual && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className={LABEL}>{orgWord} name{REQ}</label>
                <input value={form.company_name} onChange={e => set('company_name', e.target.value)}
                       placeholder={form.customer_type === 'BUSINESS' ? 'e.g. Piwak Construction Ltd' : 'e.g. University of Ghana'}
                       className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Address{REQ}</label>
                <input value={form.address} onChange={e => set('address', e.target.value)}
                       placeholder="e.g. 12 Osu Badu Street, Accra" className={INPUT} />
              </div>
              {form.customer_type === 'INSTITUTION' && (
                <div className="sm:col-span-2">
                  <label className={LABEL}>Kind of institution{OPT}</label>
                  <select value={form.institution_subtype} onChange={e => set('institution_subtype', e.target.value)} className={INPUT}>
                    <option value="">Choose…</option>
                    <option value="SCHOOL">School</option><option value="UNIVERSITY">University</option>
                    <option value="HOSPITAL">Hospital</option><option value="GOVERNMENT">Government</option>
                    <option value="NGO">NGO</option><option value="CHURCH">Church</option><option value="OTHER">Other</option>
                  </select>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-[88px_1fr_1fr] gap-3">
            <div>
              <label className={LABEL}>Title</label>
              <select value={form.title} onChange={e => setTitle(e.target.value)} className={INPUT}>
                <option value="MR">Mr</option><option value="MRS">Mrs</option><option value="MS">Ms</option>
                <option value="DR">Dr</option><option value="PROF">Prof</option><option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>{isIndividual ? 'First name' : 'Contact’s first name'}{REQ}</label>
              <input value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="First name" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>{isIndividual ? 'Last name' : 'Contact’s last name'}</label>
              <input value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Last name" className={INPUT} />
            </div>
          </div>
          {isIndividual && (
            <>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Gender</label>
                  <div className="flex p-0.5 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                    {[['MALE', 'Male'], ['FEMALE', 'Female']].map(([v, t]) => (
                      <button key={v} type="button" onClick={() => { set('gender', v); setGenderTouched(true) }}
                              className={`flex-1 py-2 rounded-[10px] text-sm transition-colors
                                          ${form.gender === v ? 'bg-[var(--panel)] font-bold text-[var(--text)] shadow-sm' : 'text-[var(--text-3)]'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Date of birth{OPT}</label>
                  <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}
                         max={new Date().toISOString().slice(0, 10)} className={INPUT} />
                </div>
              </div>
              <div className="mt-3">
                <label className={LABEL}>Works with or belongs to{OPT}</label>
                {affiliation ? (
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
                    <span className="text-sm font-semibold text-blue-800 truncate">{affiliation.company_name || affiliation.full_name}</span>
                    <button type="button" onClick={() => setAffiliation(null)} className="text-blue-400 hover:text-blue-700 ml-2">✕</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input value={affQuery} onChange={e => searchAff(e.target.value)}
                           placeholder="Search a business or institution…" className={INPUT} />
                    {affResults.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-lg overflow-hidden">
                        {affResults.map(c => (
                          <button key={c.id} type="button"
                                  onClick={() => { setAffiliation(c); setAffQuery(''); setAffResults([]) }}
                                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg)] border-b border-[var(--border)] last:border-0">
                            <span className="block text-sm font-semibold truncate">{c.company_name || c.full_name}</span>
                            <span className="block text-[11px] text-[var(--text-3)]">{c.customer_type} · {c.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Notes */}
          <p className="mt-5 mb-2 text-[10px] font-black tracking-widest uppercase text-[var(--text-3)]">Notes</p>
          <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
                    placeholder="Anything worth knowing: “always wants matte”…" className={`${INPUT} resize-none`} />

          {error && (
            <div className="mt-3 px-3 py-2.5 rounded-xl bg-[var(--red-bg)] border border-[var(--red-border)] text-xs text-[var(--red-text)]">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 py-3.5 border-t border-[var(--border)] shrink-0">
          <label className="flex items-center gap-2 text-xs text-[var(--text-2)] cursor-pointer select-none">
            <input type="checkbox" checked={another} onChange={e => setAnother(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
            Register another after this
          </label>
          <button type="button" onClick={close}
                  className="ml-auto px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-2)]">
            Cancel
          </button>
          <button type="submit" disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-[var(--text)] text-white text-sm font-bold disabled:opacity-40">
            {isPending ? 'Registering…' : 'Register customer ↵'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )

  return (
    <>
      {modal}
      {successName && (
        <JobSuccessOverlay jobNumber={successName} message="Customer registered"
                           onDone={() => { setSuccessName(null); onSuccess?.(); onClose() }} />
      )}
    </>
  )
}