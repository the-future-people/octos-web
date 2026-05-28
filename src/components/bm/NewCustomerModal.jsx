// src/components/bm/NewCustomerModal.jsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createCustomer } from '../../api/bm'



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

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

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
    if (!form.first_name.trim()) { setError('First name is required.'); return }
    if (!form.phone.trim())      { setError('Phone number is required.'); return }
    mutate(form)
  }

  const Field = ({ label, required, children }) => (
    <div>
      <label className="block text-[10px] font-bold text-[var(--text-3)] uppercase
        tracking-wider mb-1.5">
        {label}{required && <span className="text-[var(--red-text)] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )

  const Input = ({ field, ...props }) => (
    <input
      value={form[field]}
      onChange={e => set(field, e.target.value)}
      className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)]
        rounded-lg outline-none focus:border-[var(--border-dark)] transition-colors"
      {...props}
    />
  )

  const Select = ({ field, options }) => (
    <select
      value={form[field]}
      onChange={e => set(field, e.target.value)}
      className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)]
        rounded-lg outline-none focus:border-[var(--border-dark)] transition-colors">
      {options.map(([val, label]) => (
        <option key={val} value={val}>{label}</option>
      ))}
    </select>
  )

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
    <div className="fixed inset-0 z-50 flex items-center justify-center
      bg-black/40 p-4 animate-fadeIn">
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-lg
        max-h-[92vh] flex flex-col overflow-hidden animate-slideUp">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4
          border-b border-[var(--border)] shrink-0">
          <div>
            <div className="font-bold text-lg text-[var(--text)]">Register Customer</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">
              Add a new customer to the system
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
              hover:bg-[var(--bg)] text-[var(--text-3)] transition-colors">✕
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Customer Type — first thing */}
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map(t => (
              <button key={t.value} type="button"
                onClick={() => set('customer_type', t.value)}
                className={`flex flex-col items-center gap-0.5 py-3 px-2 rounded-xl
                  border-2 transition-colors text-center
                  ${form.customer_type === t.value ? t.active : t.idle}`}>
                <span className="text-xs font-black">{t.label}</span>
                <span className="text-[10px] opacity-60">{t.sub}</span>
              </button>
            ))}
          </div>

          {/* Business / Institution name — shown first for non-individuals */}
          {isBusiness && (
            <Field label="Business Name" required>
              <Input field="company_name"
                placeholder="e.g. Suma Court Hotel, J.K. Tradings" />
            </Field>
          )}

          {isInstitution && (
            <div className="space-y-3">
              <Field label="Institution Name" required>
                <Input field="company_name"
                  placeholder="e.g. University of Ghana" />
              </Field>
              <Field label="Institution Type">
                <Select field="institution_subtype" options={[
                  ['',           'Select type...'],
                  ['SCHOOL',     'School'],
                  ['UNIVERSITY', 'University'],
                  ['HOSPITAL',   'Hospital'],
                  ['GOVERNMENT', 'Government'],
                  ['NGO',        'NGO'],
                  ['CHURCH',     'Church'],
                  ['OTHER',      'Other'],
                ]} />
              </Field>
            </div>
          )}

          {/* Title + Name */}
          <div className="grid grid-cols-4 gap-3">
            <Field label="Title">
              <Select field="title" options={[
                ['MR', 'Mr'], ['MRS', 'Mrs'], ['MS', 'Ms'],
                ['DR', 'Dr'], ['PROF', 'Prof'], ['OTHER', 'Other'],
              ]} />
            </Field>
            <div className="col-span-3 grid grid-cols-2 gap-3">
              <Field label={isIndividual ? 'First Name' : 'Rep First Name'} required>
                <Input field="first_name" placeholder="First name" />
              </Field>
              <Field label={isIndividual ? 'Last Name' : 'Rep Last Name'}>
                <Input field="last_name" placeholder="Last name" />
              </Field>
            </div>
          </div>

          {/* Gender — individuals only */}
          {isIndividual && (
            <Field label="Gender">
              <Select field="gender" options={[
                ['MALE', 'Male'], ['FEMALE', 'Female'], ['OTHER', 'Other'],
              ]} />
            </Field>
          )}

          {/* Phone */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" required>
              <Input field="phone" placeholder="0244123456" type="tel" />
            </Field>
            <Field label="Alt Phone">
              <Input field="secondary_phone" placeholder="0244123456" type="tel" />
            </Field>
          </div>

          {/* Email */}
          <Field label="Email">
            <Input field="email" placeholder="email@example.com" type="email" />
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="Any additional context..."
              className="w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)]
                rounded-lg outline-none focus:border-[var(--border-dark)] transition-colors
                resize-none"
            />
          </Field>

          {error && (
            <div className="px-3 py-2.5 bg-[var(--red-bg)] border border-[var(--red-border)]
              rounded-lg text-xs text-[var(--red-text)]">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end gap-3 shrink-0
          border-t border-[var(--border)]">
          <button onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)]
              hover:text-[var(--text)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isPending}
            className="px-5 py-2.5 bg-[var(--text)] text-white text-sm font-bold
              rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
            {isPending ? 'Registering...' : 'Register Customer'}
          </button>
        </div>

      </div>
    </div>
  )
}