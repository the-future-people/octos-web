// src/components/attendant/Confetti.jsx
//
// A short shower of confetti for reaching the day's target (16 Nov 2026).
// Plain divs and one CSS animation (today-fall in index.css): nothing to
// install, and hidden entirely for anyone who asked for reduced motion.
import { useEffect, useState } from 'react'

const COLOURS = ['#CC0000', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#111111']

// Where each piece starts, how it falls and spins: made once per shower.
function makeBits(pieces) {
  return Array.from({ length: pieces }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    fall: 2.2 + Math.random() * 1.6,
    drift: (Math.random() - 0.5) * 240,
    spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    round: Math.random() > 0.7,
    colour: COLOURS[i % COLOURS.length],
  }))
}

export default function Confetti({ onDone, pieces = 90 }) {
  const [bits] = useState(() => makeBits(pieces))

  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 4200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none overflow-hidden z-[60]">
      {bits.map(b => (
        <span key={b.id} className="today-fall absolute top-0"
          style={{
            left: `${b.left}%`, width: b.w, height: b.round ? b.w : b.h,
            background: b.colour, borderRadius: b.round ? '50%' : 2,
            animationDelay: `${b.delay}s`,
            '--fall': `${b.fall}s`, '--drift': `${b.drift}px`, '--spin': `${b.spin}deg`,
          }} />
      ))}
    </div>
  )
}
