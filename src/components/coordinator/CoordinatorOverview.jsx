// src/components/coordinator/CoordinatorOverview.jsx
import { useQuery } from '@tanstack/react-query'
import { getProductionBoard, getVerificationQueue } from '../../api/coordinator'
import { getMachines } from '../../api/coordinator'

function clockTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('en-GH', {
    hour: 'numeric', minute: '2-digit',
  })
}

function waited(iso) {
  if (!iso) return ''
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (mins < 60)   return `${mins}m`
  if (mins < 1440) return `${Math.floor(mins / 60)}h`
  return `${Math.floor(mins / 1440)}d`
}

export default function CoordinatorOverview({ onGoToProduction }) {
  const { data: board }        = useQuery({
    queryKey: ['productionBoard'],
    queryFn:  () => getProductionBoard().then(r => r.data),
    refetchInterval: 30_000,
  })
  const { data: arrivals = [] } = useQuery({
    queryKey: ['verificationQueue'],
    queryFn:  () => getVerificationQueue().then(r => r.data),
    refetchInterval: 30_000,
  })
  const { data: machines = [] } = useQuery({
    queryKey: ['machines'],
    queryFn:  () => getMachines().then(r => r.data),
    refetchInterval: 60_000,
  })

  const counts  = board?.counts || {}
  const halted  = board?.halted || []
  const onFloor = (counts.RECEIVED || 0) + (counts.IN_PRODUCTION || 0)
                + (counts.FINISHING || 0) + (counts.QUALITY_CHECK || 0)

  const down    = machines.filter(m => !m.is_available)
  const running = machines.filter(m => m.is_available)

  // The job that has waited longest is the one at risk, so it is named
  // rather than left for someone to find by scanning.
  const allJobs = [
    ...(board?.columns?.RECEIVED      || []),
    ...(board?.columns?.IN_PRODUCTION || []),
    ...(board?.columns?.FINISHING     || []),
    ...(board?.columns?.QUALITY_CHECK || []),
  ]
  const oldest = allJobs.length
    ? allJobs.reduce((a, b) =>
        new Date(a.created_at) < new Date(b.created_at) ? a : b)
    : null

  // When the last job on the floor is predicted to finish.
  const clearsAt = allJobs
    .map(j => j.predicted?.ready_at)
    .filter(Boolean)
    .sort()
    .pop()

  const Stat = ({ label, value, sub, tone = '' }) => (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl px-4 py-3.5">
      <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
        {label}
      </div>
      <div className={`font-mono font-black text-2xl mt-1 ${tone || 'text-[var(--text)]'}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-[var(--text-3)] mt-0.5">{sub}</div>}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[var(--text)]">Overview</h2>
        <p className="text-xs text-[var(--text-3)] mt-0.5">How the floor stands right now</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button onClick={onGoToProduction} className="text-left">
          <Stat
            label="To verify"
            value={arrivals.length}
            sub={arrivals.length ? 'waiting to be checked' : 'nothing waiting'}
            tone={arrivals.length ? 'text-amber-600' : ''}
          />
        </button>
        <Stat label="On the floor" value={onFloor} sub="in production" />
        <Stat
          label="Halted"
          value={halted.length}
          sub={halted.length ? 'not moving' : 'nothing stopped'}
          tone={halted.length ? 'text-red-600' : ''}
        />
        <Stat
          label="Machines"
          value={down.length ? `${running.length}/${machines.length}` : machines.length}
          sub={down.length ? `${down.length} down` : 'all running'}
          tone={down.length ? 'text-red-600' : ''}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-4">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
            tracking-wider mb-3">Machines</div>
          {machines.length === 0 ? (
            <p className="text-xs text-[var(--text-3)]">No machines registered</p>
          ) : (
            <div className="space-y-2">
              {machines.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[var(--text)] truncate">
                      {m.name}
                    </div>
                    <div className="text-[10px] text-[var(--text-3)]">
                      {m.station_name}
                      {!m.is_available && m.unavailable_reason
                        ? ` · ${m.unavailable_reason}` : ''}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0
                    ${m.is_available
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'}`}>
                    {m.is_available ? 'Running' : `Down · ${m.halted_jobs} held`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-4">
          <div className="text-[10px] font-bold text-[var(--text-3)] uppercase
            tracking-wider mb-3">Worth knowing</div>
          <div className="space-y-3">
            {oldest ? (
              <div>
                <div className="text-[10px] text-[var(--text-3)]">Waiting longest</div>
                <div className="text-xs font-semibold text-[var(--text)] mt-0.5">
                  {oldest.job_number}
                  <span className="font-normal text-[var(--text-3)]">
                    {' · '}{waited(oldest.created_at)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-3)]">The floor is clear</p>
            )}

            {clearsAt && (
              <div>
                <div className="text-[10px] text-[var(--text-3)]">Floor clears by</div>
                <div className="text-xs font-semibold text-[var(--text)] mt-0.5">
                  {clockTime(clearsAt)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}