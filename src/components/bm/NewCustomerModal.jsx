// src/components/bm/NewCustomerModal.jsx
import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createCustomer, lookupCustomer } from '../../api/bm'

// null = idle, 'checking' = in-flight, { found: true, customer } = taken, { found: false } = clear
const usePhonenLookup = () => {
  const [status, setStatus] = useState(null)
  const timerRef  = useRef(null)
  const abortRef  = useRef(null)

  const lookup = (phone) => {
    // Cancel any pending debounce + in-flight request
    clearTimeout(timerRef.current)
    abortRef.current?.abort()

    const digits = phone.replace(/\D/g, '')
    if (digits.length < 6) { setStatus(null); return }

    setStatus('checking')
    timerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const res = await lookupCustomer({ phone, signal: controller.signal })
        setStatus({ found: true, customer: res.data })
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
        if (err.response?.status === 404) {
          setStatus({ found: false })
        } else {
          setStatus(null) // network error — fail silently
        }
      }
    }, 500)
  }

  const reset = () => {
    clearTimeout(timerRef.current)
    abortRef.current?.abort()
    setStatus(null)
  }

  // Cleanup on unmount
  useEffect(() => () => { clearTimeout(timerRef.current); abortRef.current?.abort() }, [])

  return { status, lookup, reset }
}

const LABEL_CLS = "block text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5"
const INPUT_CLS = "w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg outline-none focus:border-[var(--border-dark)] transition-colors"

export default function NewCustomerModal({ onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    title:               'MR',
    first_name:          '',
    last_name:           '',
    gender:              'MALE',
    phone:               '',
    secondary_phone:     '',
    email:               '',
    company_name:        '',
    customer_type:       'INDIVIDUAL',
    institution_subtype: '',
    notes:               '',
  })
  const [error, setError] = useState('')
  const { status: phoneStatus, lookup: lookupPhone, reset: resetLookup } = usePhonenLookup()

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }))
    if (key === 'phone') lookupPhone(val)
  }

  const { mutate, isPending } = useMutation({
    mutationFn: (payload) => createCustomer(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      onSuccess?.(res.data)
      onClose()
    },
    onError: (err) => {
      const data = err.response?.data
      const msg  = typeof data === 'object'
        ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(' · ')
        : 'Registration failed.'
      setError(msg)
    },
  })

  const handleSubmit = () => {
    setError('')
    console.log('Submitting form:', form)
    if (!form.first_name.trim())                { setError('First name is required.'); return }
    if (!form.phone.trim())                     { setError('Phone number is required.'); return }
    if ((isBusiness || isInstitution) && !form.company_name.trim()) { setError('Organisation name is required.'); return }
    if ((isBusiness || isInstitution) && !form.address.trim())      { setError('Address is required.'); return }
    if (phoneStatus?.found === true)            { setError('This phone number is already registered.'); return }
    if (phoneStatus === 'checking')             { setError('Please wait — checking phone number...'); return }
    mutate(form)
  }

  const TYPE_OPTIONS = [
    {
      value:  'INDIVIDUAL',
      label:  'Individual',
      sub:    'Single person',
      active: 'bg-zinc-100 border-zinc-300 text-zinc-800',
      idle:   'bg-zinc-50 border-zinc-100 text-zinc-500',
    },
    {
      value:  'BUSINESS',
      label:  'Business',
      sub:    'Company / firm',
      active: 'bg-blue-50 border-blue-300 text-blue-800',
      idle:   'bg-blue-50/40 border-blue-100 text-blue-400',
    },
    {
      value:  'INSTITUTION',
      label:  'Institution',
      sub:    'School / org',
      active: 'bg-violet-50 border-violet-300 text-violet-800',
      idle:   'bg-violet-50/40 border-violet-100 text-violet-400',
    },
  ]

  const isIndividual  = form.customer_type === 'INDIVIDUAL'
  const isBusiness    = form.customer_type === 'BUSINESS'
  const isInstitution = form.customer_type === 'INSTITUTION'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fadeIn">
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-slideUp">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <div className="font-bold text-lg text-[var(--text)]">Register Customer</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">Add a new customer to the system</div>
          </div>
          <button onClick={() => { resetLookup(); onClose() }}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--bg)] text-[var(--text-3)] transition-colors">
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Customer Type */}
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map(t => (
              <button key={t.value} type="button"
                onClick={() => set('customer_type', t.value)}
                className={`flex flex-col items-center gap-0.5 py-3 px-2 rounded-xl border-2 transition-colors text-center ${form.customer_type === t.value ? t.active : t.idle}`}>
                <span className="text-xs font-black">{t.label}</span>
                <span className="text-[10px] opacity-60">{t.sub}</span>
              </button>
            ))}
          </div>

          {/* Business Name + Address */}
          {isBusiness && (
            <div className="space-y-3">
              <div>
                <label className={LABEL_CLS}>
                  Business Name<span className="text-[var(--red-text)] ml-0.5">*</span>
                </label>
                <input
                  value={form.company_name}
                  onChange={e => set('company_name', e.target.value)}
                  placeholder="e.g. Suma Court Hotel, J.K. Tradings"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>
                  Business Address<span className="text-[var(--red-text)] ml-0.5">*</span>
                </label>
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={e => set('address', e.target.value)}
                  placeholder="e.g. 12 Osu Badu Street, Accra"
                  className={`${INPUT_CLS} resize-none`}
                />
              </div>
            </div>
          )}

          {/* Institution Name + Type */}
          {isInstitution && (
            <div className="space-y-3">
              <div>
                <label className={LABEL_CLS}>
                  Institution Name<span className="text-[var(--red-text)] ml-0.5">*</span>
                </label>
                <input
                  value={form.company_name}
                  onChange={e => set('company_name', e.target.value)}
                  placeholder="e.g. University of Ghana"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>
                  Institution Address<span className="text-[var(--red-text)] ml-0.5">*</span>
                </label>
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={e => set('address', e.target.value)}
                  placeholder="e.g. Legon Campus, Accra"
                  className={`${INPUT_CLS} resize-none`}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Institution Type</label>
                <select
                  value={form.institution_subtype}
                  onChange={e => set('institution_subtype', e.target.value)}
                  className={INPUT_CLS}>
                  <option value="">Select type...</option>
                  <option value="SCHOOL">School</option>
                  <option value="UNIVERSITY">University</option>
                  <option value="HOSPITAL">Hospital</option>
                  <option value="GOVERNMENT">Government</option>
                  <option value="NGO">NGO</option>
                  <option value="CHURCH">Church</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* Title + Name */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={LABEL_CLS}>Title</label>
              <select
                value={form.title}
                onChange={e => set('title', e.target.value)}
                className={INPUT_CLS}>
                <option value="MR">Mr</option>
                <option value="MRS">Mrs</option>
                <option value="MS">Ms</option>
                <option value="DR">Dr</option>
                <option value="PROF">Prof</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="col-span-3 grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>
                  {isIndividual ? 'First Name' : 'Rep First Name'}
                  <span className="text-[var(--red-text)] ml-0.5">*</span>
                </label>
                <input
                  value={form.first_name}
                  onChange={e => set('first_name', e.target.value)}
                  placeholder="First name"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>
                  {isIndividual ? 'Last Name' : 'Rep Last Name'}
                </label>
                <input
                  value={form.last_name}
                  onChange={e => set('last_name', e.target.value)}
                  placeholder="Last name"
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>

          {/* Gender — individuals only */}
          {isIndividual && (
            <div>
              <label className={LABEL_CLS}>Gender</label>
              <select
                value={form.gender}
                onChange={e => set('gender', e.target.value)}
                className={INPUT_CLS}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          )}

          {/* Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>
                Phone<span className="text-[var(--red-text)] ml-0.5">*</span>
              </label>
              <div className="relative">
                <input
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="0244123456"
                  type="tel"
                  className={`${INPUT_CLS} pr-8 ${
                    phoneStatus?.found === true  ? 'border-[var(--red-border)] focus:border-[var(--red-border)]' :
                    phoneStatus?.found === false ? 'border-green-400 focus:border-green-400' : ''
                  }`}
                />
                {/* Status icon */}
                {phoneStatus === 'checking' && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <svg className="w-3.5 h-3.5 animate-spin text-[var(--text-3)]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  </span>
                )}
                {phoneStatus?.found === false && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500 text-sm font-bold">✓</span>
                )}
                {phoneStatus?.found === true && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--red-text)] text-sm font-bold">✕</span>
                )}
              </div>
              {/* Taken warning */}
              {phoneStatus?.found === true && (() => {
                const c = phoneStatus.customer
                const name = c.customer_type === 'INDIVIDUAL'
                  ? [c.title, c.first_name, c.last_name].filter(Boolean).join(' ')
                  : c.company_name || [c.first_name, c.last_name].filter(Boolean).join(' ')
                const typeLabel = { INDIVIDUAL: 'Individual', BUSINESS: 'Business', INSTITUTION: 'Institution' }[c.customer_type] ?? c.customer_type
                return (
                  <div className="mt-1.5 px-2.5 py-1.5 bg-[var(--red-bg)] border border-[var(--red-border)] rounded-lg">
                    <p className="text-[10px] font-bold text-[var(--red-text)] uppercase tracking-wide">Already registered</p>
                    <p className="text-xs text-[var(--red-text)] mt-0.5">{name} · {typeLabel}</p>
                  </div>
                )
              })()}
              {/* Clear confirmation */}
              {phoneStatus?.found === false && (
                <p className="mt-1 text-[10px] text-green-600 font-semibold">Number is available</p>
              )}
            </div>
            <div>
              <label className={LABEL_CLS}>Alt Phone</label>
              <input
                value={form.secondary_phone}
                onChange={e => set('secondary_phone', e.target.value)}
                placeholder="0244123456"
                type="tel"
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={LABEL_CLS}>Email</label>
            <input
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="email@example.com"
              type="email"
              className={INPUT_CLS}
            />
          </div>

          {/* Notes */}
          <div>
            <label className={LABEL_CLS}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="Any additional context..."
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          {error && (
            <div className="px-3 py-2.5 bg-[var(--red-bg)] border border-[var(--red-border)] rounded-lg text-xs text-[var(--red-text)]">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end gap-3 shrink-0 border-t border-[var(--border)]">
          <button onClick={() => { resetLookup(); onClose() }}
            className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isPending}
            className="px-5 py-2.5 bg-[var(--text)] text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
            {isPending ? 'Registering...' : 'Register Customer'}
          </button>
        </div>

      </div>
    </div>
  )
}