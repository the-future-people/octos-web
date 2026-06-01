
// src/components/attendant/AttendantBranchJobs.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'

function fmt(n) { return `GHS ${parseFloat(n||0).toLocaleString('en-GH',{minimumFractionDigits:2})}` }
function timeAgo(iso) {
  if (!iso) return '—'
  const d=Math.floor((Date.now()-new Date(iso))/60000)
  if (d<1) return 'Just now'; if (d<60) return `${d}m ago`
  if (d<1440) return `${Math.floor(d/60)}h ago`; return `${Math.floor(d/1440)}d ago`
}
function toTitleCase(s) { if (!s) return s; return s.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()) }

const STATUS_CONFIG = {
  PENDING_PAYMENT:{label:'Pending',   bg:'bg-amber-100',   text:'text-amber-700'  },
  PAID:           {label:'Paid',       bg:'bg-blue-100',    text:'text-blue-700'   },
  COMPLETE:       {label:'Complete',  bg:'bg-emerald-100', text:'text-emerald-700'},
  CANCELLED:      {label:'Cancelled',bg:'bg-red-100',     text:'text-red-600'    },
  IN_PROGRESS:    {label:'In Progress',bg:'bg-violet-100', text:'text-violet-700' },
}

export default function AttendantBranchJobs({ sheet }) {
  const [period, setPeriod] = useState('day')
  const [page,   setPage]   = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['attendant-branch-jobs', period, page],
    queryFn: () => client.get('/api/v1/jobs/', { params:{
      period:    period||undefined,
      page,
      page_size: 20,
    }}).then(r=>r.data),
    staleTime: 30_000,
    placeholderData: prev=>prev,
  })

  const jobs       = Array.isArray(data)?data:(data?.results||[])
  const count      = data?.count||0
  const totalPages = Math.ceil(count/20)

  return (
    <div className="p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[var(--text)]">Branch Jobs</h2>
        <p className="text-xs text-[var(--text-3)] mt-0.5">All jobs at this branch · {count} jobs · read-only</p>
      </div>

      {/* Period filter */}
      <div className="flex gap-1 bg-black/5 p-1 rounded-xl">
        {[{value:'day',label:'Today'},{value:'week',label:'This Week'},{value:'month',label:'This Month'},{value:'',label:'All Time'}].map(f=>(
          <button key={f.value} onClick={()=>{setPeriod(f.value);setPage(1)}}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors
              ${period===f.value?'bg-[var(--panel)] text-[var(--text)] shadow-sm':'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && !data ? (
        <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-14 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse"/>)}</div>
      ) : jobs.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl flex items-center justify-center py-16">
          <p className="text-sm text-[var(--text-3)]">No jobs found</p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            {jobs.map(job=>{
              const sc=STATUS_CONFIG[job.status]||{label:job.status,bg:'bg-zinc-100',text:'text-zinc-600'}
              return (
                <div key={job.id} className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="font-mono text-xs font-bold text-[var(--text)] shrink-0">{job.job_number}</span>
                      <span className="text-xs text-[var(--text-2)] truncate">{job.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span>
                      <span className="text-[10px] text-[var(--text-3)]">{timeAgo(job.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-[var(--text-3)]">{toTitleCase(job.intake_by_name)||'—'}</span>
                    <span className="text-[var(--text-3)]">·</span>
                    <span className="text-[10px] text-[var(--text-3)]">{toTitleCase(job.customer_name)||'Walk-in'}</span>
                    <span className="text-[var(--text-3)]">·</span>
                    <span className="font-mono text-[10px] font-bold text-[var(--text)]">{fmt(job.estimated_cost)}</span>
                  </div>
                </div>
              )
            })}
          </div>
          {totalPages>1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-3)]">Page {page} of {totalPages} · {count} jobs</span>
              <div className="flex gap-2">
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)] border border-[var(--border)] rounded-lg disabled:opacity-40">← Prev</button>
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--panel)] border border-[var(--border)] rounded-lg disabled:opacity-40">Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}