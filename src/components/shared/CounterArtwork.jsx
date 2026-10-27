// src/components/shared/CounterArtwork.jsx
//
// A customer's file, taken at the counter and checked exactly as the app
// checks it, with the same three steps shown while it happens: received,
// opened and measured, checked at the size ordered. Then it folds to one
// line. The job reaches the coordinator and the operator with its
// artwork, never by WhatsApp, email or a flash drive.

import { useEffect, useRef, useState } from 'react'
import client from '../../api/client'

const TONE = {
  fine:   { cls: 'bg-emerald-50 border-emerald-200 text-emerald-800', mark: '✓', label: 'good to print' },
  warn:   { cls: 'bg-amber-50 border-amber-200 text-amber-900',       mark: '!', label: 'worth a look first' },
  refuse: { cls: 'bg-red-50 border-red-200 text-red-800',             mark: '✕', label: 'can’t print this one' },
}

function Step({ state, children }) {
  return (
    <div className="flex items-center gap-2.5 mt-2 text-xs">
      {state === 'done' && <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center text-[10px] font-black">✓</span>}
      {state === 'now' && <span className="w-4 h-4 rounded-full border-2 border-blue-600 border-r-transparent animate-spin" />}
      {state === 'later' && <span className="w-4 h-4 rounded-full border-2 border-black/10" />}
      <span className={state === 'now' ? 'font-bold text-[var(--text)]' : 'text-[var(--text-3)]'}>{children}</span>
    </div>
  )
}

export default function CounterArtwork({ service, specifications, result, onResult, required, sizeLabel }) {
  const input = useRef(null)
  const [file, setFile] = useState(null)
  const [stage, setStage] = useState(null)        // null | sent | read | judged
  const [progress, setProgress] = useState(0)
  const [problem, setProblem] = useState('')
  const [drag, setDrag] = useState(false)

  useEffect(() => {
    if (stage !== 'read') return undefined
    const t = setTimeout(() => setStage('judged'), 700)
    return () => clearTimeout(t)
  }, [stage])

  async function send(f) {
    if (!f) return
    setFile(f); setProblem(''); setProgress(0); setStage('sent'); onResult(null)
    const form = new FormData()
    form.append('file', f)
    form.append('service', service.id)
    form.append('specifications', JSON.stringify(specifications || {}))
    try {
      const { data } = await client.post('/api/v1/storefront/check/', form, {
        // The portal's client sends JSON by default; a file goes as a form.
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => {
          if (!e.total) return
          const p = Math.round((e.loaded / e.total) * 100)
          setProgress(p)
          if (p >= 100) setStage(s => (s === 'sent' ? 'read' : s))
        },
      })
      onResult(data)
    } catch (err) {
      setProblem(err.response?.data?.detail || 'That file couldn’t be read. Try again, or another copy of it.')
    } finally { setStage(null) }
  }

  const tone = result ? TONE[result.verdict] : null
  const notes = (result?.checks || []).filter(c => c.verdict !== 'fine')
  const order = ['sent', 'read', 'judged']
  const at = order.indexOf(stage)
  const state = i => (i < at ? 'done' : i === at ? 'now' : 'later')

  return (
    <div>
      <input ref={input} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.webp"
             onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; send(f) }} />

      {stage ? (
        <div className="rounded-xl border border-[var(--border)] px-3.5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-9 rounded bg-white shadow-[0_0_0_1px_#d1d5db] grid place-items-center text-[9px] font-black text-red-600">
              {(file?.name.split('.').pop() || '').toUpperCase().slice(0, 4)}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold truncate">{file?.name}</div>
              <div className="text-[11px] text-[var(--text-3)]">{file ? `${(file.size / 1048576).toFixed(1)} MB` : ''}</div>
            </div>
          </div>
          <Step state={state(0)}>Received the file{stage === 'sent' && progress < 100 ? ` · ${progress}%` : ''}</Step>
          <Step state={state(1)}>Opened it and measured the artwork</Step>
          <Step state={state(2)}>Checking it prints well{sizeLabel ? ` at ${sizeLabel}` : ''}</Step>
          <div className="mt-2.5 h-[3px] rounded-full bg-black/5 overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-300"
                 style={{ width: `${stage === 'sent' ? Math.max(6, progress * 0.6) : stage === 'read' ? 75 : 92}%` }} />
          </div>
        </div>
      ) : result ? (
        <div className={`rounded-xl border px-3.5 py-2.5 ${tone?.cls || ''}`}>
          <div className="flex items-center gap-2.5">
            <span className="font-black">{tone?.mark}</span>
            <span className="text-sm font-bold truncate">{result.filename}</span>
            <span className="text-xs truncate">
              {result.page_count ? `${result.page_count} page${result.page_count === 1 ? '' : 's'} · ` : ''}{tone?.label}
              {sizeLabel && result.verdict !== 'refuse' ? ` at ${sizeLabel}` : ''}
            </span>
            <button type="button" onClick={() => input.current?.click()} className="ml-auto text-xs font-bold text-blue-700 shrink-0">Change</button>
            <button type="button" onClick={() => onResult(null)} className="text-xs font-bold shrink-0 opacity-60" aria-label="Remove file">✕</button>
          </div>
          {notes.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {notes.map((c, i) => <li key={i} className="text-[11.5px] leading-snug">• {c.message}</li>)}
            </ul>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()}
                onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); send(e.dataTransfer.files?.[0]) }}
                className={`w-full rounded-xl border-[1.5px] border-dashed px-4 py-3.5 text-left flex items-center gap-3 transition-colors
                            ${drag ? 'border-blue-500 bg-blue-50' : 'border-black/15 hover:border-black/35'}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
               strokeLinejoin="round" className="w-5 h-5 text-[var(--text-3)] shrink-0" aria-hidden="true">
            <path d="M7 16a4 4 0 0 1-.9-7.9 5.5 5.5 0 0 1 10.6-1.3A4.2 4.2 0 0 1 18 16h-1" /><path d="M12 12v8" /><path d="M9 15l3-3 3 3" />
          </svg>
          <span>
            <span className="block text-sm font-semibold">Choose the file <span className="font-normal text-[var(--text-3)]">or drop it here</span></span>
            <span className="block text-[11px] text-[var(--text-3)]">PDF, JPG, PNG, TIFF or WEBP</span>
          </span>
          {required && <span className="ml-auto text-[10px] font-black uppercase tracking-wider text-red-600">Needed</span>}
        </button>
      )}
      {problem && <p className="mt-1.5 text-xs text-red-600">{problem}</p>}
    </div>
  )
}