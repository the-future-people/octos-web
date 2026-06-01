// src/components/attendant/AttendantMyJobs.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import client from '../../api/client'

function fmt(n) { return `GHS ${parseFloat(n||0).toLocaleString('en-GH',{minimumFractionDigits:2})}` }
function timeAgo(iso) {
  if (!iso) return '—'
  const d = Math.floor((Date.now()-new Date(iso))/60000)
  if (d<1) return 'Just now'; if (d<60) return `${d}m ago`
  if (d<1440) return `${Math.floor(d/60)}h ago`; return `${Math.floor(d/1440)}d ago`
}
function toTitleCase(s) { if (!s) return s; return s.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()) }

const STATUS_CONFIG = {
  PENDING_PAYMENT: { label:'Pending',    bg:'bg-amber-100',   text:'text-amber-700'   },
  PAID:            { label:'Paid',        bg:'bg-blue-100',    text:'text-blue-700'    },
  COMPLETE:        { label:'Complete',   bg:'bg-emerald-100', text:'text-emerald-700' },
  CANCELLED:       { label:'Cancelled', bg:'bg-red-100',     text:'text-red-600'     },
  IN_PROGRESS:     { label:'In Progress',bg:'bg-violet-100',  text:'text-violet-700'  },
  CONFIRMED:       { label:'Confirmed',  bg:'bg-blue-100',    text:'text-blue-700'    },
}

const PERIOD_FILTERS = [
  { value:'day',   label:'Today'     },
  { value:'week',  label:'This Week'  },
  { value:'month', label:'This Month' },
  { value:'',      label:'All Time'   },
]

const STATUS_FILTERS = [
  { value:'',                label:'All'        },
  { value:'PENDING_PAYMENT', label:'Pending'    },
  { value:'COMPLETE',        label:'Complete'   },
  { value:'CANCELLED',       label:'Cancelled'  },
]

function JobDetailModal({ job, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      style={{position:'fixed',top:0,left:0,right:0,bottom:0}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <div className="font-black text-sm text-[var(--text)]">{job.job_number}</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">{job.title}</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--bg)] text-[var(--text-3)]">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Status */}
          <div className="flex gap-2 flex-wrap">
            {(() => { const sc=STATUS_CONFIG[job.status]||{label:job.status,bg:'bg-zinc-100',text:'text-zinc-600'}
              return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span>
            })()}
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600">{job.job_type}</span>
          </div>
          {/* Key info */}
          <div className="grid grid-cols-2 gap-2">
            {[
              {label:'Customer',  value:toTitleCase(job.customer_name)||'Walk-in'},
              {label:'Channel',   value:job.intake_channel||'—'},
              {label:'Est. Cost', value:fmt(job.estimated_cost), mono:true},
              {label:'Created',   value:timeAgo(job.created_at)},
            ].map(i=>(
              <div key={i.label} className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5">
                <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-0.5">{i.label}</div>
                <div className={`text-sm font-bold text-[var(--text)] ${i.mono?'font-mono':''}`}>{i.value}</div>
              </div>
            ))}
          </div>
          {/* Line items */}
          {job.line_items?.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">Services</div>
              <div className="space-y-1.5">
                {job.line_items.map(li=>(
                  <div key={li.id} className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                    <div>
                      <div className="text-xs font-semibold text-[var(--text)]">{li.label||li.service_name}</div>
                      <div className="text-[10px] text-[var(--text-3)]">{li.quantity} × {li.pages}pp · {li.is_color?'Colour':'B&W'}</div>
                    </div>
                    <span className="font-mono text-xs font-bold text-[var(--text)]">{fmt(li.line_total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function AttendantMyJobs({ sheet }) {
  const [period, setPeriod] = useState('day')
  const [status, setStatus] = useState('')
  const [page,   setPage]   = useState(1)
  const [selected, setSelected] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['attendant-my-jobs', period, status, page],
    queryFn: () => client.get('/api/v1/jobs/', { params:{
      intake_by: 'me',
      period:    period || undefined,
      status:    status || undefined,
      page,
      page_size: 20,
    }}).then(r=>r.data),
    staleTime: 15_000,
    placeholderData: prev=>prev,
  })

  const jobs       = Array.isArray(data)?data:(data?.results||[])
  const count      = data?.count||0
  const totalPages = Math.ceil(count/20)

  return (
    <div className="p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[var(--text)]">My Jobs</h2>
        <p className="text-xs text-[var(--text-3)] mt-0.5">{count} jobs</p>
      </div>

      {/* Filters */}
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl p-3 space-y-3">
        <div className="flex gap-1 bg-[var(--bg)] p-1 rounded-xl">
          {PERIOD_FILTERS.map(f=>(
            <button key={f.value} onClick={()=>{setPeriod(f.value);setPage(1)}}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors
                ${period===f.value?'bg-[var(--text)] text-white':'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(f=>(
            <button key={f.value} onClick={()=>{setStatus(f.value);setPage(1)}}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors
                ${status===f.value?'bg-zinc-800 text-white border-transparent':'border-[var(--border)] text-[var(--text-3)] hover:border-[var(--border-dark)]'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading && !data ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="h-14 bg-[var(--panel)] border border-[var(--border)] rounded-xl animate-pulse"/>)}</div>
      ) : jobs.length === 0 ? (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl flex flex-col items-center justify-center py-16">
          <p className="text-sm font-semibold text-[var(--text-2)]">No jobs found</p>
          <p className="text-xs text-[var(--text-3)] mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            {jobs.map(job=>{
              const sc=STATUS_CONFIG[job.status]||{label:job.status,bg:'bg-zinc-100',text:'text-zinc-600'}
              return (
                <div key={job.id} onClick={()=>setSelected(job)}
                  className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3 cursor-pointer hover:border-[var(--border-dark)] transition-colors">
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
              <span className="text-xs text-[var(--text-3)]">Page {page} of {totalPages}</span>
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

      {selected && <JobDetailModal job={selected} onClose={()=>setSelected(null)} />}
    </div>
  )
}