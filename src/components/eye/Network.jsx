// src/components/eye/Network.jsx
//
// The Eye's one picture: the focused place in the centre, its children on
// the first orbit, theirs on the second, wired to their parents and meshed
// to their neighbours, with pulses running along the wires. Optionally
// wrapped in the Time Stone: a dial of days.
//
// ring1: [{ id, label, colour, weight, shape, onClick, sub }]
// ring2: [{ id, label, colour, parent, shape, onClick, pulse }]
//   shape: 'circle' | 'square' | 'hollow'
// centre: { value, sub, colour, onClick, title }
// dial:   { days: [{ date, value, health }], selected, onPick }

import { useId } from 'react'
import { C, DISPLAY } from './theme'

const W = 680, H = 450

export default function Network({ centre, ring1 = [], ring2 = [], dial, labelsRing2 = true }) {
  const uid = useId().replace(/:/g, '')
  const CX = W / 2, CY = H / 2 + 4
  const R1 = dial ? 92 : 108, R2 = dial ? 150 : 178, RT = 176
  const pt = (r, a) => [CX + r * Math.cos(a), CY + r * Math.sin(a)]

  // First orbit: angular share by weight.
  const total = ring1.reduce((s, n) => s + Math.max(1, Number(n.weight) || 1), 0) || 1
  let a = -Math.PI / 2
  const r1 = ring1.map(n => {
    const span = 2 * Math.PI * Math.max(1, Number(n.weight) || 1) / total
    const node = { ...n, a0: a, a1: a + span, ang: a + span / 2 }
    ;[node.x, node.y] = pt(R1, node.ang)
    a += span
    return node
  })
  const byId = Object.fromEntries(r1.map(n => [n.id, n]))

  // Second orbit: inside the parent's sector, or evenly round the centre.
  const groups = {}
  ring2.forEach(n => { (groups[n.parent ?? '_'] ||= []).push(n) })
  const r2 = []
  Object.entries(groups).forEach(([pid, kids]) => {
    const p = byId[pid]
    const a0 = p ? p.a0 : -Math.PI / 2, a1 = p ? p.a1 : 3 * Math.PI / 2
    kids.forEach((k, i) => {
      const ang = a0 + (i + 0.5) * (a1 - a0) / kids.length
      const [x, y] = pt(R2, ang)
      r2.push({ ...k, ang, x, y, p })
    })
  })

  const size = (n) => n.size || 7
  const shape = (n, x, y, r) => {
    if (n.shape === 'square') return <>
      <rect x={x - r} y={y - r} width={2 * r} height={2 * r} rx="2" fill={C.ground} stroke={n.colour} strokeWidth="1.8" />
      <rect x={x - r * .45} y={y - r * .45} width={r * .9} height={r * .9} fill={n.colour} /></>
    if (n.shape === 'hollow') return <>
      <circle cx={x} cy={y} r={r} fill={C.ground} stroke={C.faint} strokeWidth="1.4" strokeDasharray="3 3" />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={C.muted}>?</text></>
    return <>
      <circle cx={x} cy={y} r={r} fill={C.ground} stroke={n.colour} strokeWidth="1.8" />
      <circle cx={x} cy={y} r={r * .45} fill={n.colour} /></>
  }
  const label = (n, r, bold) => {
    const dx = n.x > CX + 3 ? 1 : n.x < CX - 3 ? -1 : 0
    return <text x={n.x + dx * (r + 6)} y={n.y + (dx ? 3.5 : -r - 6)}
                 textAnchor={dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle'}
                 fontSize="10.5" fill={bold ? C.text : C.text2} fontWeight={bold ? 700 : 400}
                 style={{ pointerEvents: 'none' }}>{n.label}{n.sub ? ` · ${n.sub}` : ''}</text>
  }
  const mesh = (ring, col, op) => ring.length > 1 ? ring.map((p, i) => {
    const q = ring[(i + 1) % ring.length]
    return <line key={`m${i}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={col} strokeWidth=".6" opacity={op} />
  }) : null

  // Time Stone: today at twelve, earlier days anticlockwise.
  const days = dial?.days || []
  const N = days.length
  const dayAng = (i) => -Math.PI / 2 - (N - 1 - i) * (2 * Math.PI / Math.max(N, 1))
  const vals = days.map(d => Number(d.value) || 0)
  const mx = Math.max(...vals, 1), mn = Math.min(...vals, 0)
  const sel = dial ? Math.max(0, days.findIndex(d => d.date === dial.selected)) : 0
  const healthCol = { red: C.red, amber: C.amber, green: C.green }

  const c = centre || {}
  const score = Number(c.score)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={c.title || 'The Eye'}>
      <defs>
        <filter id={`g${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <pattern id={`d${uid}`} width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#24231f" /></pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#d${uid})`} />

      {dial && <g>
        <circle cx={CX} cy={CY} r={RT} fill="none" stroke="#24231f" />
        {days.map((d, i) => {
          const len = 6 + ((vals[i] - mn) / ((mx - mn) || 1)) * 20
          const [x1, y1] = pt(RT + 2, dayAng(i)), [x2, y2] = pt(RT + 2 + len, dayAng(i))
          const on = i === sel
          return <line key={d.date} x1={x1} y1={y1} x2={x2} y2={y2} stroke={healthCol[d.health] || C.grey}
                       strokeWidth={on ? 5 : 3} strokeLinecap="round" opacity={on ? 1 : .7}
                       filter={on ? `url(#g${uid})` : undefined} style={{ cursor: 'pointer' }}
                       onClick={() => dial.onPick?.(d.date)}><title>{d.date}</title></line>
        })}
        {N > 0 && (() => {
          const [hx, hy] = pt(RT - 4, dayAng(sel))
          return <g><line x1={CX} y1={CY} x2={hx} y2={hy} stroke={C.gold} strokeWidth="1.2" strokeDasharray="3 3" opacity=".8" />
            <circle cx={hx} cy={hy} r="3.5" fill={C.gold} filter={`url(#g${uid})`} /></g>
        })()}
        {N > 0 && (() => { const [tx, ty] = pt(RT + 34, -Math.PI / 2)
          return <text x={tx} y={ty + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill={C.muted} letterSpacing=".5">TODAY</text> })()}
      </g>}

      <circle cx={CX} cy={CY} r={R1} fill="none" stroke="#2f2d29" strokeDasharray="2 5" />
      {ring2.length > 0 && <circle cx={CX} cy={CY} r={R2} fill="none" stroke="#252420" strokeDasharray="2 6" />}
      {mesh(r1, '#6b6860', .55)}
      {mesh(r2, '#4a4843', .45)}

      {r1.map((n, i) => <g key={`w1${i}`}>
        <path id={`w1${uid}${i}`} d={`M${CX} ${CY}L${n.x} ${n.y}`} stroke={n.colour} strokeWidth=".9" opacity=".55" fill="none" />
        {n.shape !== 'hollow' && <circle r="2.2" fill={n.colour} filter={`url(#g${uid})`}>
          <animateMotion dur={`${(2.2 + (i % 3) * .5).toFixed(1)}s`} repeatCount="indefinite"><mpath href={`#w1${uid}${i}`} /></animateMotion>
        </circle>}
      </g>)}
      {r2.map((n, i) => {
        const fx = n.p ? n.p.x : CX, fy = n.p ? n.p.y : CY
        return <g key={`w2${i}`}>
          <path id={`w2${uid}${i}`} d={`M${fx} ${fy}L${n.x} ${n.y}`} stroke={n.colour} strokeWidth=".8" opacity=".5" fill="none" />
          {n.pulse !== false && n.shape !== 'hollow' && <circle r="1.8" fill={n.colour}>
            <animateMotion dur={`${(2.4 + (i % 4) * .3).toFixed(1)}s`} repeatCount="indefinite"><mpath href={`#w2${uid}${i}`} /></animateMotion>
          </circle>}
        </g>
      })}

      {r2.map((n, i) => {
        const r = size(n) * .8
        return <g key={`n2${i}`} onClick={n.onClick} style={{ cursor: n.onClick ? 'pointer' : 'default' }}>
          <title>{n.title || n.label}</title>
          {n.alert && <circle cx={n.x} cy={n.y} r={r + 4} fill="none" stroke={n.colour}>
            <animate attributeName="r" values={`${r + 2};${r + 7};${r + 2}`} dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values=".8;0;.8" dur="1.6s" repeatCount="indefinite" /></circle>}
          {shape(n, n.x, n.y, r)}
          {labelsRing2 && label(n, r, false)}
        </g>
      })}
      {r1.map((n, i) => {
        const r = n.size || 11
        return <g key={`n1${i}`} onClick={n.onClick} style={{ cursor: n.onClick ? 'pointer' : 'default' }}>
          <title>{n.title || n.label}</title>
          {n.alert && <circle cx={n.x} cy={n.y} r={r + 4} fill="none" stroke={n.colour}>
            <animate attributeName="r" values={`${r + 2};${r + 8};${r + 2}`} dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values=".7;0;.7" dur="1.8s" repeatCount="indefinite" /></circle>}
          {shape(n, n.x, n.y, r)}
          {label(n, r, true)}
        </g>
      })}

      <g onClick={c.onClick} style={{ cursor: c.onClick ? 'pointer' : 'default' }}>
        <title>{c.onClick ? 'Back up a level' : (c.title || '')}</title>
        <circle cx={CX} cy={CY} r="34" fill={C.ground} stroke={c.colour || C.gold} strokeWidth="2" filter={`url(#g${uid})`} />
        {Number.isFinite(score) && <>
          <circle cx={CX} cy={CY} r="28" fill="none" stroke="#2f2d29" strokeWidth="3" />
          <circle cx={CX} cy={CY} r="28" fill="none" stroke={c.colour || C.gold} strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 28 * score / 100} 999`} transform={`rotate(-90 ${CX} ${CY})`} /></>}
        <text x={CX} y={CY + (c.sub ? 2 : 5)} textAnchor="middle" fontSize={String(c.value || '').length > 6 ? 12 : 16}
              fontWeight="700" fill={C.text} style={{ fontFamily: DISPLAY }}>{c.value}</text>
        {c.sub && <text x={CX} y={CY + 15} textAnchor="middle" fontSize="7.5" fill={C.muted}>{c.sub}</text>}
      </g>
    </svg>
  )
}
