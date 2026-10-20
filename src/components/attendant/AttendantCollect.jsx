// src/components/attendant/AttendantCollect.jsx
//
// Handing an online order to the customer who paid for it.
//
// The customer proves it is theirs with their phone number and the
// 4-digit collection PIN they were sent (in the app, and in their ready
// SMS), or by showing the QR in the app, which carries both. Octos then
// shows exactly what to hand over, line by line; the attendant ticks each
// thing against the package before Hand over unlocks. The move goes
// through the status engine, so who handed over, to whom and when are
// recorded, and the customer's app catches up in seconds.

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import jsQR from 'jsqr'
import client from '../../api/client'

const field = `w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--panel)]
               text-sm text-[var(--text)] focus:outline-none focus:border-[var(--text)]`

const time = iso => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''

/**
 * The camera, looking for a Print Octos QR. Works on the counter tablet or
 * phone; asks for the camera only when Scan is pressed.
 */
function Scanner({ onFound, onClose }) {
  const video = useRef(null)
  const canvas = useRef(null)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    let stream
    let timer
    let live = true
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!live) return
        video.current.srcObject = stream
        await video.current.play()
        timer = setInterval(() => {
          const v = video.current
          const c = canvas.current
          if (!v || !c || !v.videoWidth) return
          c.width = v.videoWidth
          c.height = v.videoHeight
          const ctx = c.getContext('2d', { willReadFrequently: true })
          ctx.drawImage(v, 0, 0)
          const found = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height)
          if (found?.data?.startsWith('PO:')) onFound(found.data)
        }, 250)
      } catch {
        setProblem('The camera could not be opened. Type the phone number and PIN instead.')
      }
    })()
    return () => {
      live = false
      clearInterval(timer)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [onFound])

  return (
    <div className="fixed inset-0 z-40 bg-black/70 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-[var(--panel)] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="relative bg-black aspect-square">
          <video ref={video} playsInline muted className="w-full h-full object-cover" />
          <span className="absolute inset-[18%] rounded-2xl border-4 border-white/80" />
          <canvas ref={canvas} className="hidden" />
        </div>
        <div className="p-4">
          <p className="text-sm font-semibold text-[var(--text)]">Point the camera at the customer’s QR</p>
          <p className="mt-1 text-xs text-[var(--text-3)]">It’s on their order in the Print Octos app.</p>
          {problem && <p className="mt-2 text-xs text-red-600">{problem}</p>}
          <button onClick={onClose}
                  className="mt-3 w-full py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-2)]">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function Order({ o, pin, onDone }) {
  const queryClient = useQueryClient()
  const things = o.lines.flatMap((line, i) => [
    { key: `l${i}`, main: line.name, sub: line.detail },
    ...line.addons.map((a, j) => ({ key: `l${i}a${j}`, main: a.name, sub: a.detail })),
  ])
  const [ticked, setTicked] = useState(() => new Set())
  const [forSomeone, setForSomeone] = useState(false)
  const [collector, setCollector] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  const allChecked = things.every(t => ticked.has(t.key))
  const canHand = allChecked && (!forSomeone || collector.trim()) && !busy

  async function handOver() {
    setBusy(true); setProblem('')
    try {
      await client.post('/api/v1/storefront/collect/hand-over/', {
        order_number: o.order_number, pin, collected_by: forSomeone ? collector.trim() : '',
      })
      queryClient.invalidateQueries()
      onDone({ name: forSomeone ? collector.trim() : o.first_name, number: o.order_number, at: new Date().toISOString() })
    } catch (err) {
      setProblem(err.response?.data?.detail || 'That didn’t go through. Try again.')
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-[var(--panel)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base font-black text-[var(--text)]">{o.first_name} · {o.order_number}</p>
        <span className="text-xs font-bold text-emerald-700 shrink-0">✓ PIN matches · paid</span>
      </div>
      {o.ready_since && <p className="mt-0.5 text-xs text-[var(--text-3)]">Ready since {time(o.ready_since)}</p>}

      <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">
        Check each against the package
      </p>
      <div className="mt-1.5 divide-y divide-[var(--border)]">
        {things.map(t => {
          const on = ticked.has(t.key)
          return (
            <button key={t.key} type="button"
                    onClick={() => setTicked(prev => { const n = new Set(prev); on ? n.delete(t.key) : n.add(t.key); return n })}
                    className="w-full flex items-center gap-3 py-2.5 text-left">
              <span className={`w-5 h-5 rounded-md border-2 grid place-items-center shrink-0 text-white text-xs
                                ${on ? 'bg-emerald-600 border-emerald-600' : 'border-[var(--border)]'}`}>{on ? '✓' : ''}</span>
              <span className="text-sm text-[var(--text)]">
                <b>{t.main}</b>{t.sub ? <span className="text-[var(--text-2)]"> · {t.sub}</span> : null}
              </span>
            </button>
          )
        })}
      </div>

      <label className="mt-3 flex items-center gap-2.5 text-sm text-[var(--text-2)] cursor-pointer">
        <input type="checkbox" checked={forSomeone} onChange={e => setForSomeone(e.target.checked)} />
        Collected by someone else
      </label>
      {forSomeone && (
        <input value={collector} onChange={e => setCollector(e.target.value)} placeholder="Their name"
               className={`mt-2 ${field}`} />
      )}

      {problem && <p className="mt-3 text-sm text-red-600">{problem}</p>}

      <button onClick={handOver} disabled={!canHand}
              className="mt-4 w-full py-3 rounded-xl bg-[#E31E24] text-white text-sm font-black disabled:opacity-35">
        {busy ? 'Handing over…' : allChecked ? 'Hand over' : `Tick all ${things.length} to hand over`}
      </button>
    </div>
  )
}

export default function AttendantCollect() {
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [proved, setProved] = useState(null)   // { orders, pin }
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [scanning, setScanning] = useState(false)
  const [done, setDone] = useState(null)

  async function look(params, usedPin) {
    setBusy(true); setProblem(''); setProved(null)
    try {
      const { data } = await client.get('/api/v1/storefront/collect/', { params })
      setProved({ orders: data.orders, pin: usedPin })
    } catch (err) {
      setProblem(err.response?.data?.detail || 'Nothing ready for that number and PIN.')
    } finally { setBusy(false) }
  }

  const onScan = code => {
    setScanning(false)
    look({ qr: code }, code.split(':').pop())
  }

  const reset = () => { setPhone(''); setPin(''); setProved(null); setProblem(''); setDone(null) }

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <h1 className="text-xl font-black text-[var(--text)]">Collect an order</h1>
      <p className="mt-1 text-sm text-[var(--text-2)]">
        For orders paid online. Ask for the customer’s phone number and collection PIN, or scan their QR.
      </p>

      {done ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <p className="text-lg font-black text-emerald-800">Handed over</p>
          <p className="mt-1 text-sm text-emerald-900/80">{done.number} to {done.name} at {time(done.at)}</p>
          <button onClick={reset} className="mt-4 px-5 py-2.5 rounded-xl bg-[var(--text)] text-white text-sm font-bold">
            Collect another
          </button>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-[1.4fr_1fr_auto] gap-2.5 items-end">
            <label>
              <span className="block mb-1 text-xs text-[var(--text-3)]">Customer’s phone</span>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="024 000 0000" className={field} />
            </label>
            <label>
              <span className="block mb-1 text-xs text-[var(--text-3)]">Collection PIN</span>
              <input inputMode="numeric" maxLength={4} value={pin}
                     onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                     onKeyDown={e => { if (e.key === 'Enter' && phone.trim() && pin.length === 4) look({ phone, pin }, pin) }}
                     placeholder="••••" className={`${field} tracking-[0.4em] font-bold`} />
            </label>
            <button onClick={() => setScanning(true)}
                    className="h-[42px] px-4 rounded-xl bg-[var(--text)] text-white text-sm font-bold">Scan</button>
          </div>
          <button onClick={() => look({ phone, pin }, pin)} disabled={busy || !phone.trim() || pin.length !== 4}
                  className="mt-2.5 w-full py-2.5 rounded-xl border border-[var(--border)] text-sm font-bold
                             text-[var(--text)] disabled:opacity-40">
            {busy ? 'Looking…' : 'Find the order'}
          </button>

          {problem && <p className="mt-3 text-sm text-red-600">{problem}</p>}

          <div className="mt-5 space-y-3">
            {proved?.orders.map(o => (
              <Order key={o.order_number} o={o} pin={proved.pin} onDone={setDone} />
            ))}
          </div>
        </>
      )}

      {scanning && <Scanner onFound={onScan} onClose={() => setScanning(false)} />}
    </div>
  )
}