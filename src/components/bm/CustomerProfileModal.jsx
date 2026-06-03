// src/components/bm/CustomerProfileModal.jsx
import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCustomerDetail, getJobs } from '../../api/bm'
import client from '../../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) =>
  n == null ? '—' : `GHS ${parseFloat(n).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`

const fmtDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })
}

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }).toLowerCase(),
  }
}

const initials = (c) => {
  if (!c) return '?'
  if (c.customer_type !== 'INDIVIDUAL' && c.company_name)
    return c.company_name.slice(0, 2).toUpperCase()
  const f = c.first_name?.[0] ?? ''
  const l = c.last_name?.[0] ?? ''
  return (f + l).toUpperCase() || '?'
}

const avatarColor = (id) => {
  const colors = ['bg-blue-600','bg-violet-600','bg-emerald-600','bg-amber-600','bg-rose-600','bg-cyan-600']
  return colors[(id ?? 0) % colors.length]
}

const TIER_BADGE = {
  VIP:     'bg-amber-100 text-amber-800 border-amber-200',
  PREMIUM: 'bg-blue-100 text-blue-800 border-blue-200',
  REGULAR: 'bg-zinc-100 text-zinc-600 border-zinc-200',
}

const TYPE_BADGE = {
  INDIVIDUAL:  'bg-zinc-100 text-zinc-700',
  BUSINESS:    'bg-blue-50 text-blue-700',
  INSTITUTION: 'bg-violet-50 text-violet-700',
}

const JOB_TYPE_BADGE = {
  INSTANT:    'bg-zinc-800 text-zinc-100',
  PRODUCTION: 'bg-blue-600 text-white',
  DESIGN:     'bg-violet-600 text-white',
}

const STATUS_BADGE = {
  COMPLETE:        'bg-emerald-100 text-emerald-700',
  PENDING_PAYMENT: 'bg-amber-100 text-amber-700',
  CANCELLED:       'bg-red-100 text-red-700',
  IN_PROGRESS:     'bg-blue-100 text-blue-700',
}

const LABEL_CLS = "block text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1.5"
const INPUT_CLS = "w-full px-3 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg outline-none focus:border-[var(--border-dark)] transition-colors"

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ customer, size = 'lg' }) {
  const sz   = size === 'lg' ? 'w-16 h-16 text-xl' : 'w-10 h-10 text-sm'
  const ring = size === 'lg' ? 'ring-4 ring-offset-2' : 'ring-2 ring-offset-1'
  const tierRing = { VIP: 'ring-amber-400', PREMIUM: 'ring-blue-400', REGULAR: 'ring-zinc-300' }[customer?.tier] ?? 'ring-zinc-300'
  return (
    <div className={`${sz} ${ring} ${tierRing} ${avatarColor(customer?.id)} rounded-full flex items-center justify-center font-black text-white shrink-0`}>
      {initials(customer)}
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-semibold">{label}</span>
      <span className="text-sm font-bold text-[var(--text)] mt-0.5">{value}</span>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border)] last:border-0">
      <span className="text-xs text-[var(--text-3)]">{label}</span>
      <span className="text-xs font-semibold text-[var(--text)] text-right max-w-[60%] truncate">{value || '—'}</span>
    </div>
  )
}

function JobCard({ job }) {
  const { date, time } = fmtDateTime(job.created_at)
  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[var(--text)]">
        <span className="text-xs font-black text-white tracking-wide">{job.job_number}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${JOB_TYPE_BADGE[job.job_type] ?? 'bg-zinc-600 text-white'}`}>
            {job.job_type}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[job.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
            {job.status?.replace(/_/g, ' ')}
          </span>
        </div>
      </div>
      <div className="px-3.5 py-2.5 bg-[var(--panel)]">
        <p className="text-xs text-[var(--text)] font-medium leading-snug mb-2">{job.title || '—'}</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wide font-semibold">Date & Time</p>
            <p className="text-[11px] text-[var(--text)] font-medium">{date}</p>
            <p className="text-[10px] text-[var(--text-3)]">{time}</p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wide font-semibold">Attendant</p>
            <p className="text-[11px] text-[var(--text)] font-medium">{job.intake_by_name ?? job.assigned_to_name ?? '—'}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wide font-semibold">Amount</p>
            <p className="text-[11px] font-bold text-[var(--text)]">{fmt(job.amount_paid)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function NotesPanel({ customerId, initialNotes }) {
  const [notes, setNotes]   = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const timerRef            = useRef(null)

  const save = async (value) => {
    setSaving(true); setSaved(false)
    try {
      await client.patch(`/api/v1/customers/${customerId}/edit/`, { notes: value })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* non-critical */ } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Branch Manager Notes</span>
        {saving && <span className="text-[10px] text-[var(--text-3)]">Saving…</span>}
        {saved  && <span className="text-[10px] text-emerald-500 font-semibold">Saved</span>}
      </div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        onBlur={() => { clearTimeout(timerRef.current); save(notes) }}
        rows={3}
        placeholder="Add notes about this customer…"
        className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg outline-none focus:border-[var(--border-dark)] transition-colors resize-none"
      />
      <p className="text-[10px] text-[var(--text-3)] mt-1">Auto-saves when you click away</p>
    </div>
  )
}

function CreditPanel({ data }) {
  if (!data) return null
  const usedPct  = Math.min(data.utilisation_pct ?? 0, 100)
  const barColor = usedPct > 80 ? 'bg-red-500' : usedPct > 50 ? 'bg-amber-400' : 'bg-emerald-500'
  const statusClr = data.status === 'ACTIVE' ? 'text-emerald-600' : 'text-amber-600'
  return (
    <div className="rounded-xl border border-[var(--border)] p-4">
      <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-3">Credit Account</p>
      <Row label="Limit"     value={fmt(data.credit_limit)} />
      <Row label="Balance"   value={<span className="text-red-500 font-bold">{fmt(data.current_balance)}</span>} />
      <Row label="Available" value={<span className="text-emerald-500 font-bold">{fmt(data.available_credit)}</span>} />
      <Row label="Terms"     value={`${data.payment_terms} days`} />
      <Row label="Status"    value={<span className={`font-bold ${statusClr}`}>{data.status}</span>} />
      <div className="mt-3">
        <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${usedPct}%` }} />
        </div>
        <p className="text-[10px] text-[var(--text-3)] mt-1 text-right">{usedPct.toFixed(0)}% utilised</p>
      </div>
    </div>
  )
}

// ── Edit form ─────────────────────────────────────────────────────────────────

function EditForm({ customer, onCancel, onSaved }) {
  const [form, setForm]   = useState({
    title:               customer.title          ?? 'MR',
    first_name:          customer.first_name     ?? '',
    last_name:           customer.last_name      ?? '',
    gender:              customer.gender         ?? 'MALE',
    phone:               customer.phone          ?? '',
    secondary_phone:     customer.secondary_phone ?? '',
    email:               customer.email          ?? '',
    company_name:        customer.company_name   ?? '',
    address:             customer.address        ?? '',
    institution_subtype: customer.institution_subtype ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setError('')
    if (!form.first_name.trim()) { setError('First name is required.'); return }
    if (!form.phone.trim())      { setError('Phone is required.'); return }
    setSaving(true)
    try {
      const res = await client.patch(`/api/v1/customers/${customer.id}/edit/`, form)
      onSaved(res.data)
    } catch (err) {
      const data = err.response?.data
      const msg  = typeof data === 'object'
        ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(' · ')
        : 'Update failed.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const isIndividual  = customer.customer_type === 'INDIVIDUAL'
  const isBusiness    = customer.customer_type === 'BUSINESS'
  const isInstitution = customer.customer_type === 'INSTITUTION'

  return (
    <div className="px-6 py-5 space-y-4">

      {/* Business / Institution name */}
      {isBusiness && (
        <div>
          <label className={LABEL_CLS}>Business Name</label>
          <input value={form.company_name} onChange={e => set('company_name', e.target.value)}
            placeholder="e.g. Suma Court Hotel" className={INPUT_CLS} />
        </div>
      )}

      {isInstitution && (
        <div className="space-y-3">
          <div>
            <label className={LABEL_CLS}>Institution Name</label>
            <input value={form.company_name} onChange={e => set('company_name', e.target.value)}
              placeholder="e.g. University of Ghana" className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Institution Type</label>
            <select value={form.institution_subtype} onChange={e => set('institution_subtype', e.target.value)} className={INPUT_CLS}>
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
          <select value={form.title} onChange={e => set('title', e.target.value)} className={INPUT_CLS}>
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
            <label className={LABEL_CLS}>{isIndividual ? 'First Name' : 'Rep First Name'} *</label>
            <input value={form.first_name} onChange={e => set('first_name', e.target.value)}
              placeholder="First name" className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>{isIndividual ? 'Last Name' : 'Rep Last Name'}</label>
            <input value={form.last_name} onChange={e => set('last_name', e.target.value)}
              placeholder="Last name" className={INPUT_CLS} />
          </div>
        </div>
      </div>

      {/* Gender — individuals only */}
      {isIndividual && (
        <div>
          <label className={LABEL_CLS}>Gender</label>
          <select value={form.gender} onChange={e => set('gender', e.target.value)} className={INPUT_CLS}>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      )}

      {/* Phone */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLS}>Phone *</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)}
            placeholder="0244123456" type="tel" className={INPUT_CLS} />
        </div>
        <div>
          <label className={LABEL_CLS}>Alt Phone</label>
          <input value={form.secondary_phone} onChange={e => set('secondary_phone', e.target.value)}
            placeholder="0244123456" type="tel" className={INPUT_CLS} />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className={LABEL_CLS}>Email</label>
        <input value={form.email} onChange={e => set('email', e.target.value)}
          placeholder="email@example.com" type="email" className={INPUT_CLS} />
      </div>

      {/* Address */}
      <div>
        <label className={LABEL_CLS}>Address</label>
        <input value={form.address} onChange={e => set('address', e.target.value)}
          placeholder="Street address" className={INPUT_CLS} />
      </div>

      {error && (
        <div className="px-3 py-2.5 bg-[var(--red-bg)] border border-[var(--red-border)] rounded-lg text-xs text-[var(--red-text)]">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button onClick={onCancel}
          className="px-4 py-2.5 text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2.5 bg-[var(--text)] text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = ['Profile', 'Job History']

// ── Main modal ────────────────────────────────────────────────────────────────

export default function CustomerProfileModal({ customerId, onClose }) {
  const queryClient         = useQueryClient()
  const [tab, setTab]       = useState('Profile')
  const [editing, setEditing] = useState(false)

  const { data: creditData } = useQuery({
    queryKey: ['credit', customerId],
    queryFn:  () => client.get(`/api/v1/customers/credit/?customer=${customerId}`).then(r => r.data),
    select:   (data) => data.results?.[0] ?? data?.[0] ?? null,
    enabled:  !!customerId,
  })

  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn:  () => getCustomerDetail(customerId).then(r => r.data),
    enabled:  !!customerId,
  })

  const { data: jobsData, isLoading: loadingJobs } = useQuery({
    queryKey: ['customer-jobs', customerId],
    queryFn:  () => getJobs({ customer: customerId, page_size: 100 }).then(r => r.data),
    enabled:  !!customerId && tab === 'Job History',
  })

  const jobs = jobsData?.results ?? []

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') editing ? setEditing(false) : onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, editing])

  const handleSaved = (updatedCustomer) => {
    // Update the cache directly so the profile refreshes instantly
    queryClient.setQueryData(['customer', customerId], updatedCustomer)
    queryClient.invalidateQueries({ queryKey: ['customers'] })
    setEditing(false)
  }

  const isIndividual  = customer?.customer_type === 'INDIVIDUAL'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fadeIn">

      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-slideUp">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="font-bold text-lg text-[var(--text)]">
            {editing ? 'Edit Profile' : 'Customer Profile'}
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <button onClick={() => setEditing(true)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[var(--border)]
                  text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-dark)] transition-colors">
                Edit Profile
              </button>
            )}
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--bg)] text-[var(--text-3)] transition-colors">
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {loadingCustomer ? (
            <div className="p-6 space-y-4">
              {[1,2,3,4].map(i => <div key={i} className="h-12 bg-[var(--bg)] rounded-xl animate-pulse" />)}
            </div>
          ) : customer ? (
            <>
              {/* Hero — always visible */}
              <div className="px-6 pt-6 pb-4 bg-[var(--bg)]">
                <div className="flex items-start gap-4">
                  <Avatar customer={customer} size="lg" />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-black text-[var(--text)] leading-tight">
                      {isIndividual ? customer.full_name : (customer.company_name || customer.full_name)}
                    </h2>
                    {!isIndividual && customer.full_name && (
                      <p className="text-xs text-[var(--text-3)] mt-0.5">{customer.titled_name}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TIER_BADGE[customer.tier] ?? TIER_BADGE.REGULAR}`}>
                        {customer.tier}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[customer.customer_type] ?? ''}`}>
                        {customer.customer_type === 'INDIVIDUAL' ? 'Individual' : customer.customer_type === 'BUSINESS' ? 'Business' : 'Institution'}
                      </span>
                      {creditData && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ⬡ Credit Account
                        </span>
                      )}
                      {customer.is_priority && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">
                          Priority
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 mt-5 pt-4 border-t border-[var(--border)]">
                  <StatCard label="Customer since" value={fmtDate(customer.created_at)} />
                  <StatCard label="Total visits"   value={customer.visit_count ?? '—'} />
                  <StatCard label="Jobs on record" value={jobsData?.count ?? '—'} />
                  <StatCard label="Lifetime Spend" value={customer.lifetime_spend != null ? `GHS ${parseFloat(customer.lifetime_spend).toLocaleString('en-GH', { minimumFractionDigits: 2 })}` : '—'} />
                </div>
              </div>

              {/* Edit form OR tabbed profile */}
              {editing ? (
                <EditForm
                  customer={customer}
                  onCancel={() => setEditing(false)}
                  onSaved={handleSaved}
                />
              ) : (
                <>
                  <div className="flex border-b border-[var(--border)] px-6 shrink-0">
                    {TABS.map(t => (
                      <button key={t} onClick={() => setTab(t)}
                        className={`py-3 mr-6 text-xs font-bold border-b-2 transition-colors ${
                          tab === t
                            ? 'border-[var(--text)] text-[var(--text)]'
                            : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]'
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="px-6 py-5 space-y-5">
                    {tab === 'Profile' && (
                      <>
                        <div className="rounded-xl border border-[var(--border)] p-4">
                          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">Contact Details</p>
                          <Row label="Phone"     value={customer.phone} />
                          {customer.secondary_phone && <Row label="Alt Phone" value={customer.secondary_phone} />}
                          <Row label="Email"     value={customer.email} />
                          <Row label="Address"   value={customer.address} />
                        </div>
                        <CreditPanel data={creditData} />
                        <NotesPanel customerId={customer.id} initialNotes={customer.notes} />
                      </>
                    )}

                    {tab === 'Job History' && (
                      <>
                        <p className="text-sm font-black text-[var(--text)]">
                          Job History
                          {jobsData?.count != null && (
                            <span className="text-[var(--text-3)] font-normal ml-1.5">{jobsData.count} jobs on record</span>
                          )}
                        </p>
                        {loadingJobs ? (
                          <div className="space-y-3">
                            {[1,2,3].map(i => <div key={i} className="h-24 bg-[var(--bg)] rounded-xl animate-pulse" />)}
                          </div>
                        ) : jobs.length === 0 ? (
                          <div className="py-12 text-center">
                            <p className="text-sm text-[var(--text-3)]">No jobs on record</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {jobs.map(job => <JobCard key={job.id} job={job} />)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="p-6 text-center">
              <p className="text-sm text-[var(--text-3)]">Customer not found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}