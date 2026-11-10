// Shared pieces for the Applications pane: stage colours, task lanes, helpers.

export const PANEL = 'bg-[var(--panel)] border border-[var(--border)] rounded-xl'
export const BTN = 'rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--panel)] px-3.5 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg)] transition-colors disabled:opacity-50'
export const INPUT = 'w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--border-dark)]'
export const LABEL = 'block text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-1'

// One colour per pipeline stage
export const STAGE = {
  screening: { solid: '#BA7517', bg: '#FAEEDA', border: '#FAC775', text: '#633806', soft: '#854F0B' },
  interview: { solid: '#534AB7', bg: '#EEEDFE', border: '#CECBF6', text: '#3C3489', soft: '#534AB7' },
  decision:  { solid: '#0F6E56', bg: '#E1F5EE', border: '#9FE1CB', text: '#085041', soft: '#0F6E56' },
  hired:     { solid: '#3B6D11', bg: '#EAF3DE', border: '#C0DD97', text: '#27500A', soft: '#3B6D11' },
  closed:    { solid: '#5F5E5A', bg: '#F1EFE8', border: '#D3D1C7', text: '#444441', soft: '#5F5E5A' },
  info:      { solid: '#185FA5', bg: '#E6F1FB', border: '#B5D4F4', text: '#0C447C', soft: '#185FA5' },
}

// The work, split into jobs. Each applicant waiting on HR is in exactly one lane.
export const LANES = [
  { key: 'screen',   label: 'To screen',            stage: 'screening',
    match: (a) => a.status === 'RECEIVED' || (a.status === 'SCREENING' && !a.screening_passed) },
  { key: 'schedule', label: 'To schedule',          stage: 'interview',
    match: (a) => a.status === 'SCREENING' && a.screening_passed },
  { key: 'score',    label: 'Interviews to score',  stage: 'interview',
    match: (a) => a.status === 'INTERVIEW_SCHEDULED' },
  { key: 'decide',   label: 'To decide',            stage: 'decision',
    match: (a) => ['INTERVIEW_DONE', 'FINAL_REVIEW', 'APPOINTED'].includes(a.status) },
  { key: 'answer',   label: 'Awaiting answer',      stage: 'hired',
    match: (a) => a.status === 'AWAITING_ACCEPTANCE' },
]
export const laneOf = (a) => LANES.find((l) => l.match(a)) || null

export const STATUS_TEXT = {
  RECEIVED: 'New application', SCREENING: 'CV screened', INTERVIEW_SCHEDULED: 'Interview booked',
  INTERVIEW_DONE: 'Interview scored', FINAL_REVIEW: 'Final review', APPOINTED: 'Appointed',
  AWAITING_ACCEPTANCE: 'Offered, awaiting answer', ACCEPTED: 'Accepted', ONBOARDING: 'Onboarding form sent',
  INFORMATION_SUBMITTED: 'Onboarding form in', INFORMATION_VERIFIED: 'Information verified',
  OFFER_ISSUED: 'Offer letter issued', HIRED: 'Hired', ACTIVE: 'Active employee',
  REJECTED: 'Rejected', WITHDRAWN: 'Withdrawn', DECLINED: 'Declined',
}

// Stage chip for any status: the lane if they're waiting on HR, else where they are
export function chipFor(a) {
  const lane = laneOf(a)
  if (lane) return { label: lane.label, s: STAGE[lane.stage] }
  if (['REJECTED', 'WITHDRAWN', 'DECLINED'].includes(a.status)) return { label: STATUS_TEXT[a.status], s: STAGE.closed }
  return { label: STATUS_TEXT[a.status] || a.status, s: STAGE.hired }
}

// Priority (recommended) first, then whoever has waited longest
export const queueOrder = (x, y) => (Number(y.is_priority) - Number(x.is_priority)) || (new Date(x.created_at) - new Date(y.created_at))

const AVATAR = [['#E6F1FB', '#185FA5'], ['#FAEEDA', '#854F0B'], ['#FBEAF0', '#993556'], ['#E1F5EE', '#0F6E56'], ['#EEEDFE', '#534AB7'], ['#EAF3DE', '#3B6D11']]
function avatarFor(name = '') {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR[h % AVATAR.length]
}
export const initials = (name = '') => name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?'

export function Avatar({ name, size = 30, solid }) {
  const [bg, fg] = solid ? [solid, '#fff'] : avatarFor(name)
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ width: size, height: size, background: bg, color: fg }}>
      {initials(name)}
    </span>
  )
}

export function waited(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000)
  if (days <= 0) return 'today'
  return days === 1 ? '1 day' : `${days} days`
}
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—')
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—')
export const channel = (c) => (c === 'EMAIL' ? 'Email' : c === 'WHATSAPP' ? 'WhatsApp' : 'SMS')

export function errorText(err, fallback) {
  const data = err?.response?.data
  if (!data || typeof data === 'string') return fallback
  if (data.detail) return data.detail
  const first = Object.values(data)[0]
  return Array.isArray(first) ? first[0] : String(first || fallback)
}

export function Notice({ tone, children }) {
  const t = tone === 'error'
    ? { bg: 'var(--red-bg, #fddde0)', fg: 'var(--red-text, #cc1a2e)', bd: 'var(--red-border, #f5a0aa)' }
    : { bg: '#EAF3DE', fg: '#27500A', bd: '#C0DD97' }
  return <p className="rounded-lg px-3 py-2 text-sm" style={{ background: t.bg, color: t.fg, border: `1px solid ${t.bd}` }}>{children}</p>
}
