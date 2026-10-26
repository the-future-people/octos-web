// src/components/shared/PhoneInput.jsx
//
// A phone number, for any country, the way the attendant hears it.
//
// Ghana is chosen already, so a Ghanaian number is typed exactly as
// before (024 412 3456). A tap on the flag opens every country, searchable
// by name or code; the attendant picks one and types the number as the
// customer says it, without the code. Pasting a full +44 7911 123456 sets
// the country by itself.
//
// The number is checked as it is typed, with the same plain words the
// server uses, and handed back in its international form (+233244123456),
// the one form Octos stores. The server checks it again either way.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString,
} from 'libphonenumber-js'

const NAMES = typeof Intl !== 'undefined' && Intl.DisplayNames
  ? new Intl.DisplayNames(['en'], { type: 'region' }) : null

const flag = cc => cc.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)))

const COUNTRIES = getCountries()
  .map(cc => ({ cc, code: getCountryCallingCode(cc), name: NAMES?.of(cc) || cc }))
  .sort((a, b) => (a.cc === 'GH' ? -1 : b.cc === 'GH' ? 1 : a.name.localeCompare(b.name)))

/** The international form and a plain reason when it is not a real number. */
export function readPhone(text, country = 'GH') {
  const raw = (text || '').trim()
  if (!raw) return { number: null, problem: '' }
  const parsed = parsePhoneNumberFromString(raw.startsWith('00') ? '+' + raw.slice(2) : raw, country)
  if (parsed?.isValid()) return { number: parsed.number, problem: '' }
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 6) return { number: null, problem: 'That doesn’t look like a phone number yet.' }
  if (country === 'GH' && !raw.startsWith('+') && digits.startsWith('0')) {
    if (digits.length === 9) return { number: null, problem: 'That number looks one digit short.' }
    if (digits.length === 11) return { number: null, problem: 'A Ghanaian number has 10 digits. For a number from abroad, choose its country first.' }
  }
  if (parsed?.isPossible()) return { number: null, problem: 'That number isn’t in use in that country. Please check it.' }
  return { number: null, problem: 'That number doesn’t look right for that country. Please check it.' }
}

/**
 * value       the stored number (+233244123456) or whatever was typed
 * onChange    (number, { valid, problem, text }) — number is international when valid
 */
export default function PhoneInput({ value = '', onChange, placeholder = '024 412 3456', className = '', autoFocus }) {
  const start = useMemo(() => {
    const parsed = value ? parsePhoneNumberFromString(value, 'GH') : null
    return parsed?.isValid()
      ? { country: parsed.country || 'GH', text: parsed.country === 'GH' || !parsed.country ? parsed.formatNational() : parsed.formatNational() }
      : { country: 'GH', text: value || '' }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [country, setCountry] = useState(start.country)
  const [text, setText] = useState(start.text)
  const [open, setOpen] = useState(false)
  const [find, setFind] = useState('')
  const [touched, setTouched] = useState(false)
  const box = useRef(null)

  const reading = readPhone(text, country)

  useEffect(() => {
    onChange?.(reading.number || text.trim(), { valid: !!reading.number, problem: reading.problem, text })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, country])

  useEffect(() => {
    if (!open) return undefined
    const close = e => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function type(next) {
    // A full international number pasted or typed: its country is in it.
    const t = next.startsWith('00') ? '+' + next.slice(2) : next
    if (t.startsWith('+')) {
      const parsed = parsePhoneNumberFromString(t)
      if (parsed?.country) {
        setCountry(parsed.country)
        setText(new AsYouType(parsed.country).input(parsed.nationalNumber.startsWith('0') ? parsed.nationalNumber : (parsed.country === 'GH' ? '0' : '') + parsed.nationalNumber))
        return
      }
    }
    setText(new AsYouType(country).input(next))
  }

  const current = COUNTRIES.find(c => c.cc === country)
  const shown = find.trim()
    ? COUNTRIES.filter(c => `${c.name} +${c.code} ${c.cc}`.toLowerCase().includes(find.trim().toLowerCase().replace(/^\+/, '')))
    : COUNTRIES

  return (
    <div ref={box} className={`relative ${className}`}>
      <div className={`flex items-stretch rounded-xl border bg-[var(--bg)] overflow-hidden
                       ${touched && reading.problem ? 'border-red-300' : reading.number ? 'border-emerald-300' : 'border-[var(--border)]'}`}>
        <button type="button" onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 border-r border-[var(--border)] text-sm shrink-0"
                aria-label={`Country: ${current?.name}. Change`}>
          <span className="text-base leading-none">{flag(country)}</span>
          <span className="font-mono text-[var(--text-2)]">+{current?.code}</span>
          <span className="text-[var(--text-3)] text-xs">▾</span>
        </button>
        <input type="tel" inputMode="tel" value={text} autoFocus={autoFocus}
               onChange={e => type(e.target.value)} onBlur={() => setTouched(true)}
               placeholder={country === 'GH' ? placeholder : 'Number, as they say it'}
               className="flex-1 min-w-0 px-3 py-2.5 text-sm bg-transparent outline-none" />
        {reading.number && <span className="px-2.5 grid place-items-center text-emerald-600 text-sm" aria-label="Looks right">✓</span>}
      </div>
      {touched && reading.problem && <p className="mt-1 text-[11px] text-red-600">{reading.problem}</p>}

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-xl">
          <input autoFocus value={find} onChange={e => setFind(e.target.value)} placeholder="Country or code"
                 className="w-full px-3 py-2 text-sm bg-transparent border-b border-[var(--border)] outline-none" />
          <div className="max-h-56 overflow-y-auto">
            {shown.map(c => (
              <button key={c.cc} type="button"
                      onClick={() => { setCountry(c.cc); setOpen(false); setFind(''); setText(t => new AsYouType(c.cc).input(t.replace(/^\+\d+\s*/, ''))) }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-[var(--bg)]
                                  ${c.cc === country ? 'font-bold' : ''}`}>
                <span className="text-base leading-none">{flag(c.cc)}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="font-mono text-[var(--text-3)]">+{c.code}</span>
              </button>
            ))}
            {shown.length === 0 && <p className="px-3 py-3 text-xs text-[var(--text-3)]">No country matches that.</p>}
          </div>
        </div>
      )}
    </div>
  )
}