// src/components/shared/CounterArtwork.jsx
//
// A customer's file, taken at the counter and checked exactly as the app
// checks it: pages, sharpness at the size ordered, a signed verdict. The
// job then reaches the coordinator and the operator with its artwork,
// the way an online order does; never by WhatsApp, email or a flash
// drive passed across the room.

import { useRef, useState } from 'react'
import client from '../../api/client'

const TONE = {
  fine:   { cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Good to print' },
  warn:   { cls: 'text-amber-800 bg-amber-50 border-amber-200',       label: 'Worth a look first' },
  refuse: { cls: 'text-red-700 bg-red-50 border-red-200',             label: 'Can’t print this one' },
}

/**
 * service, specifications   what the file is checked against
 * result, onResult          the verdict (with its token), or null
 * required                  whether this service needs a file
 */
export default function CounterArtwork({ service, specifications, result, onResult, required }) {
  const input = useRef(null)
  const [progress, setProgress] = useState(null)
  const [problem, setProblem] = useState('')

  async function send(file) {
    if (!file) return
    setProblem(''); setProgress(0); onResult(null)
    const form = new FormData()
    form.append('file', file)
    form.append('service', service.id)
    form.append('specifications', JSON.stringify(specifications || {}))
    try {
      const { data } = await client.post('/api/v1/storefront/check/', form, {
        // The portal's client sends JSON by default; a file goes as a form.
        // Axios fills in the boundary itself when it sees FormData.
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      })
      onResult(data)
    } catch (err) {
      setProblem(err.response?.data?.detail || 'That file couldn’t be read. Try again, or another copy of it.')
    } finally { setProgress(null) }
  }

  const tone = result ? TONE[result.verdict] : null
  const notes = (result?.checks || []).filter(c => c.verdict !== 'fine')

  return (
    <div className="mb-2">
      <input ref={input} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.webp"
             onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; send(f) }} />

      {progress !== null ? (
        <div className="px-3 py-2 rounded-lg border border-black/10 bg-white/70">
          <div className="text-xs text-[var(--text-2)]">
            {progress < 100 ? `Sending · ${progress}%` : 'Checking it prints well…'}
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-black/10 overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress < 100 ? Math.max(6, progress * 0.8) : 90}%` }} />
          </div>
        </div>
      ) : result ? (
        <div className={`px-3 py-2 rounded-lg border ${tone?.cls || ''}`}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold truncate flex-1 min-w-0">
              {result.filename}
              <span className="font-normal">
                {result.page_count ? ` · ${result.page_count} page${result.page_count === 1 ? '' : 's'}` : ''} · {tone?.label}
              </span>
            </span>
            <button type="button" onClick={() => input.current?.click()} className="text-[11px] font-bold underline shrink-0">Change</button>
            <button type="button" onClick={() => onResult(null)} className="text-[11px] font-bold shrink-0" aria-label="Remove file">✕</button>
          </div>
          {notes.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {notes.map((c, i) => <li key={i} className="text-[11px] leading-snug">• {c.message}</li>)}
            </ul>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()}
                className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-dashed border-black/20 bg-white/60
                           text-xs font-bold text-[var(--text-2)] hover:border-black/40 text-left flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
               strokeLinejoin="round" className="w-4 h-4 shrink-0" aria-hidden="true">
            <path d="M7 16a4 4 0 0 1-.9-7.9 5.5 5.5 0 0 1 10.6-1.3A4.2 4.2 0 0 1 18 16h-1" /><path d="M12 12v8" /><path d="M9 15l3-3 3 3" />
          </svg>
          Attach the customer’s file
          {required && <span className="ml-auto text-[10px] font-black uppercase tracking-wider text-red-600">Needed</span>}
        </button>
      )}
      {problem && <p className="mt-1 text-[11px] text-red-600">{problem}</p>}
    </div>
  )
}