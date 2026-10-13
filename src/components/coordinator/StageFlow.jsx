// src/components/coordinator/StageFlow.jsx
//
// The path every job travels, as one line: Arrived → In press → Finishing
// → Ready. Each stage is a dot carrying how many jobs are in it; the one
// being looked at rolls out into a pill with its name. Only that stage's
// jobs are shown below, so the floor is read one stage at a time rather
// than all at once.
//
// Held sits apart, off the line, because a held job has stepped out of
// the flow and is waiting on somebody else.

const DOT_TONE = {
  late:  'bg-red-50 border-red-400 text-red-700',
  risk:  'bg-amber-50 border-amber-400 text-amber-700',
  some:  'bg-[var(--panel)] border-[var(--text-3)] text-[var(--text)]',
  empty: 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-3)]',
}

function toneOf(stage) {
  if (stage.tone === 'late') return 'late'
  if (stage.tone === 'risk') return 'risk'
  return stage.count > 0 ? 'some' : 'empty'
}

function describe(stage) {
  const jobs = `${stage.count} ${stage.count === 1 ? 'job' : 'jobs'}`
  if (stage.tone === 'late') return `${stage.label}, ${jobs}, something is late`
  if (stage.tone === 'risk') return `${stage.label}, ${jobs}, something is at risk`
  return `${stage.label}, ${jobs}`
}

function Step({ stage, selected, onSelect }) {
  const tone = toneOf(stage)

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <button
        onClick={() => onSelect(stage.id)}
        aria-pressed={selected}
        aria-label={describe(stage)}
        className={`flex items-center rounded-full transition-all duration-300
          ease-out min-h-[44px]
          ${selected
            ? 'bg-[var(--text)] pl-1.5 pr-4'
            : 'px-1.5 hover:bg-[var(--bg)]'}`}>
        <span className={`w-8 h-8 rounded-full border flex items-center
          justify-center text-xs font-bold transition-colors
          ${selected
            ? 'bg-white border-transparent text-[var(--text)]'
            : DOT_TONE[tone]}`}>
          {stage.count}
        </span>
        <span className={`overflow-hidden whitespace-nowrap text-sm font-semibold
          text-white transition-all duration-300 ease-out
          ${selected ? 'max-w-[120px] ml-2.5 opacity-100' : 'max-w-0 ml-0 opacity-0'}`}>
          {stage.label}
        </span>
      </button>
      {/* The name sits under every dot except the selected one, whose
          name is already in the pill. Kept as an invisible spacer there
          so the line does not jump when the selection moves. */}
      <span className={`text-[11px] font-medium leading-none
        ${selected ? 'invisible' : ''}
        ${tone === 'late' ? 'text-red-700'
          : tone === 'risk' ? 'text-amber-700'
          : 'text-[var(--text-3)]'}`}>
        {stage.label}
      </span>
    </div>
  )
}

/**
 * stages: [{ id, label, count, tone }] in flow order, tone being 'late',
 *         'risk' or null.
 * held:   { count } — shown apart from the flow.
 */
export default function StageFlow({ stages, held, current, onSelect }) {
  const heldOn = current === 'held'

  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="flex items-start min-w-0 overflow-x-auto pb-1">
        {stages.map((stage, i) => (
          <div key={stage.id} className="flex items-start">
            {i > 0 && (
              <span aria-hidden="true"
                className="w-6 sm:w-10 h-px bg-[var(--border-dark)] mt-[22px] shrink-0" />
            )}
            <Step stage={stage} selected={current === stage.id} onSelect={onSelect} />
          </div>
        ))}
      </div>

      {held && (
        <button
          onClick={() => onSelect('held')}
          aria-pressed={heldOn}
          aria-label={`Held, ${held.count} ${held.count === 1 ? 'job' : 'jobs'}`}
          className={`ml-auto shrink-0 min-h-[44px] px-4 rounded-full text-sm
            font-semibold transition-colors
            ${heldOn
              ? 'bg-amber-100 text-amber-800 border border-amber-300'
              : 'border border-dashed border-[var(--border-dark)] text-[var(--text-2)] hover:bg-[var(--bg)]'}`}>
          {held.count} held
        </button>
      )}
    </div>
  )
}