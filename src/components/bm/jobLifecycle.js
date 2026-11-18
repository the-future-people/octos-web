// src/components/bm/jobLifecycle.js
//
// What a job is waiting on, in words, shared by the Jobs page on the computer
// and on the phone (moved out of Jobs.jsx, 18 Nov 2026). "tone" names the
// colour family for the phone's status dot.

/**
 * Job titles are joined and truncated at creation, so a long job can
 * lose services twice over — once to the "+N more" baked into the
 * title, again to CSS truncation. Line items are the real record, so
 * read those and collapse repeats: two of the same service is "×2",
 * not the same words printed twice.
 */
export function serviceSummary(job) {
  const items = job.line_items || []
  if (!items.length) return job.title || '—'

  const counts = new Map()
  for (const it of items) {
    const name = it.service_name || it.label || 'Service'
    counts.set(name, (counts.get(name) || 0) + 1)
  }

  return [...counts.entries()]
    .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
    .join(', ')
}

export const WORK_LABELS = {
  RECEIVED:      'Received',
  IN_PRODUCTION: 'In production',
  FINISHING:     'Finishing',
  QUALITY_CHECK: 'Quality check',
  DONE:          'Done',
}

/**
 * A job now holds three states at once. Rather than show three columns,
 * the badge answers one question — what is this job waiting on — by
 * precedence: halted beats unpaid beats unfinished beats uncollected.
 * The full picture lives in the detail view.
 */
export function lifecycleState(job) {
  if (job.status === 'CANCELLED') return { label: 'Cancelled', bg: 'bg-red-100',  text: 'text-red-600'  }
  if (job.status === 'DRAFT')     return { label: 'Draft',     bg: 'bg-zinc-100', text: 'text-zinc-600' }
  if (job.status === 'INTAKE_HELD')
    return { label: 'Intake held', bg: 'bg-amber-100', text: 'text-amber-700' }

  const settled = job.payment_state === 'SETTLED'

  if (job.is_halted) {
    return { label: 'Halted', bg: 'bg-red-100', text: 'text-red-600', sub: 'Work stopped' }
  }
  if (job.work_state === 'DONE' && job.handover_state === 'AWAITING_COLLECTION') {
    return {
      label: 'Ready for pickup',
      bg: 'bg-emerald-100', text: 'text-emerald-700',
      sub: settled ? null : 'Balance outstanding',
      subTone: settled ? null : 'text-red-600',
    }
  }
  if (job.handover_state === 'OUT_FOR_DELIVERY') {
    return { label: 'Out for delivery', bg: 'bg-blue-100', text: 'text-blue-700' }
  }
  if (job.handover_state === 'HANDED_OVER') {
    return {
      label: 'Handed over',
      bg: 'bg-zinc-100', text: 'text-zinc-600',
      sub: settled ? null : 'Balance outstanding',
      subTone: settled ? null : 'text-red-600',
    }
  }
  if (!settled) {
    return {
      label: 'Awaiting payment',
      bg: 'bg-amber-100', text: 'text-amber-700',
      sub: job.payment_state === 'DEPOSIT_PAID' ? 'Deposit paid' : null,
    }
  }
  return {
    label: 'In production',
    bg: 'bg-violet-100', text: 'text-violet-700',
    sub: WORK_LABELS[job.work_state] || null,
  }
}

// The colour family behind a state's badge, for the phone's quiet status dot.
const FAMILY = { red: 'red', amber: 'amber', emerald: 'green', blue: 'blue', violet: 'violet', zinc: 'grey' }
export function toneOf(state) {
  const m = /bg-(\w+)-/.exec(state?.bg || '')
  return FAMILY[m?.[1]] || 'grey'
}
