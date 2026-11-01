// src/components/eye/Flows.jsx
// The three lenses whose picture is a flow rather than orbits:
// money (in, centre, out), jobs (a conveyor) and the online funnel.
import { useId } from 'react'
import { C, DISPLAY, STATUS, cedis } from './theme'

function Glow({ id }) {
  return <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
}

// Money in from the left, out to the right, profit in the centre.
export function MoneyFlow({ inflows, outflows, centre, onIn }) {
  const uid = useId().replace(/:/g, '')
  const CX = 340, CY = 185, lx = 95, rx = 565
  const maxIn = Math.max(...inflows.map(i => Number(i.amount) || 0), 1)
  const pos = (i, n) => n === 1 ? CY : 40 + i * (300 / Math.max(1, n - 1))
  return (
    <svg viewBox="0 0 680 370" width="100%" role="img" aria-label="Money flowing in and out">
      <defs><Glow id={`g${uid}`} /></defs>
      <text x={lx} y="16" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={C.gold} letterSpacing=".6">MONEY IN</text>
      <text x={rx} y="16" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#ff8a98" letterSpacing=".6">MONEY OUT</text>
      {inflows.map((f, i) => {
        const y = pos(i, inflows.length), amt = Number(f.amount) || 0, th = 1 + amt / maxIn * 9
        return <g key={i} onClick={() => f.key && onIn?.(f.key)} style={{ cursor: f.key ? 'pointer' : 'default' }}>
          <path id={`i${uid}${i}`} d={`M${lx + 14} ${y} C ${lx + 130} ${y}, ${CX - 140} ${CY}, ${CX - 46} ${CY}`}
                stroke={C.gold} strokeWidth={th} opacity=".28" fill="none" />
          {amt > 0 && [0, 1].map(j => <circle key={j} r={1.5 + th / 4} fill="#f5d878">
            <animateMotion dur={`${(3.2 - amt / maxIn * 1.6).toFixed(2)}s`} begin={`${j * 1.4}s`} repeatCount="indefinite"><mpath href={`#i${uid}${i}`} /></animateMotion></circle>)}
          <circle cx={lx} cy={y} r={6 + amt / maxIn * 8} fill={C.ground} stroke={C.gold} strokeWidth="1.6" />
          <text x={lx - 20 - amt / maxIn * 8} y={y - 2} textAnchor="end" fontSize="10.5" fontWeight="700" fill={C.text}>{f.name}</text>
          <text x={lx - 20 - amt / maxIn * 8} y={y + 11} textAnchor="end" fontSize="10" fill={C.text2}>{cedis(amt)}</text>
        </g>
      })}
      {outflows.map((f, i) => {
        const y = pos(i, outflows.length), known = f.amount !== null && f.amount !== undefined
        return <g key={i}>
          <path id={`o${uid}${i}`} d={`M${CX + 46} ${CY} C ${CX + 140} ${CY}, ${rx - 130} ${y}, ${rx - 14} ${y}`}
                stroke={known ? '#ff6b7c' : C.amber} strokeWidth={known ? 3 : 1.5} opacity={known ? .25 : .7}
                strokeDasharray={known ? undefined : '4 4'} fill="none" />
          <circle cx={rx} cy={y} r="9" fill={known ? C.ground : 'none'} stroke={known ? '#ff6b7c' : C.amber}
                  strokeWidth="1.6" strokeDasharray={known ? undefined : '3 3'} />
          {!known && <text x={rx} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={C.amber}>?</text>}
          <text x={rx + 18} y={y - 2} fontSize="10.5" fontWeight="700" fill={known ? C.text : C.amber}>{f.name}</text>
          <text x={rx + 18} y={y + 11} fontSize="10" fill={known ? C.text2 : C.amber}>{known ? cedis(f.amount) : f.note}</text>
        </g>
      })}
      <circle cx={CX} cy={CY} r="46" fill={C.ground} stroke={centre.colour} strokeWidth="2" filter={`url(#g${uid})`} />
      <text x={CX} y={CY - 12} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={C.muted} letterSpacing=".5">{centre.label}</text>
      <text x={CX} y={CY + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill={C.text} style={{ fontFamily: DISPLAY }}>{centre.value}</text>
      <text x={CX} y={CY + 20} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={centre.colour}>{centre.state}</text>
    </svg>
  )
}

// Jobs on a line: sources, stages with their jobs as dots, the sink.
export function Conveyor({ sources, stages, instant, collected, selected, onStage, onJob }) {
  const uid = useId().replace(/:/g, '')
  const X = [150, 248, 346, 444, 542], Y = 170, sink = 640
  const src = Object.entries(sources).filter(([, n]) => n > 0)
  return (
    <svg viewBox="0 0 680 270" width="100%" role="img" aria-label="The job line">
      <defs><Glow id={`g${uid}`} /></defs>
      {src.map(([name, n], i) => {
        const y = src.length === 1 ? Y : 120 + i * (100 / Math.max(1, src.length - 1))
        return <g key={name}>
          <path id={`s${uid}${i}`} d={`M50 ${y} C 100 ${y}, ${X[0] - 60} ${Y}, ${X[0] - 26} ${Y}`} stroke="#6b6860" strokeWidth="1.2" fill="none" opacity=".7" />
          <circle r="2.2" fill={C.gold}><animateMotion dur={`${2.2 + i * .6}s`} repeatCount="indefinite"><mpath href={`#s${uid}${i}`} /></animateMotion></circle>
          <circle cx="40" cy={y} r="9" fill={C.ground} stroke={C.text2} strokeWidth="1.3" />
          <text x="40" y={y - 15} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={C.text}>{name}</text>
          <text x="40" y={y + 22} textAnchor="middle" fontSize="10" fill={C.text2}>{n} in</text>
        </g>
      })}
      <path id={`inst${uid}`} d={`M40 100 C 160 10, 520 10, ${sink} 152`} stroke={C.blue} strokeWidth="1" strokeDasharray="3 4" fill="none" opacity=".7" />
      {instant > 0 && [0, .8].map(b => <circle key={b} r="2" fill="#8fb0ff"><animateMotion dur="1.6s" begin={`${b}s`} repeatCount="indefinite"><mpath href={`#inst${uid}`} /></animateMotion></circle>)}
      <text x="340" y="40" textAnchor="middle" fontSize="10.5" fill="#8fb0ff">Instant jobs: {instant} done on the spot</text>
      {[...X, sink].slice(0, -1).map((x, i) => {
        const nx = i < X.length - 1 ? X[i + 1] : sink
        return <g key={i}><path id={`l${uid}${i}`} d={`M${x + 24} ${Y}L${nx - 24} ${Y}`} stroke="#6b6860" strokeWidth="1.6" fill="none" opacity=".8" />
          <circle r="2.4" fill={C.green}><animateMotion dur="1.8s" begin={`${i * .25}s`} repeatCount="indefinite"><mpath href={`#l${uid}${i}`} /></animateMotion></circle></g>
      })}
      {stages.map((s, i) => {
        const x = X[i], bad = s.jobs.some(j => j.state === 'LATE')
        return <g key={s.code}>
          {s.jobs.map((j, k) => {
            const a = k * 2.399, r = 30 + Math.sqrt(k) * 6.2, jx = x + r * Math.cos(a), jy = Y + r * Math.sin(a)
            return <g key={j.id} onClick={() => onJob(j.id)} style={{ cursor: 'pointer' }}>
              <title>{`${j.code} · ${j.title} · ${j.branch}`}</title>
              <circle cx={jx} cy={jy} r="3.6" fill={STATUS[j.state] || C.green} />
              {j.halted && <circle cx={jx} cy={jy} r="7" fill="none" stroke={C.red} strokeDasharray="2 2">
                <animate attributeName="r" values="6;9;6" dur="1.4s" repeatCount="indefinite" /></circle>}
            </g>
          })}
          <g onClick={() => onStage(i)} style={{ cursor: 'pointer' }}>
            <circle cx={x} cy={Y} r="22" fill={C.ground} stroke={selected === i ? C.gold : bad ? C.red : C.text2} strokeWidth={selected === i ? 2.6 : 1.6} />
            <text x={x} y={Y + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill={C.text} style={{ fontFamily: DISPLAY }}>{s.jobs.length}</text>
            <text x={x} y={Y + 80} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={selected === i ? C.gold : C.text}>{s.label}</text>
          </g>
        </g>
      })}
      <circle cx={sink} cy={Y} r="16" fill="#0f2a1d" stroke={C.green} strokeWidth="1.6" />
      <text x={sink} y={Y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#7fe3b4">{collected}</text>
      <text x={sink} y={Y + 80} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#7fe3b4">Collected</text>
    </svg>
  )
}

// A wire that thins from step to step, with those who left peeling away.
export function Funnel({ steps, colour = C.blue }) {
  const uid = useId().replace(/:/g, '')
  const known = steps.filter(s => s.count !== null && s.count !== undefined)
  const mx = Math.max(...known.map(s => s.count), 1)
  const X = steps.map((_, i) => 70 + i * (540 / Math.max(1, steps.length - 1))), Y = 120
  return (
    <svg viewBox="0 0 680 240" width="100%" role="img" aria-label="Funnel">
      {steps.slice(0, -1).map((s, i) => {
        const next = steps[i + 1], has = s.count != null && next.count != null
        const th = has ? 4 + next.count / mx * 26 : 2
        const left = has ? s.count - next.count : null, mid = (X[i] + X[i + 1]) / 2
        return <g key={i}>
          <path id={`f${uid}${i}`} d={`M${X[i] + 26} ${Y}L${X[i + 1] - 26} ${Y}`} stroke={colour} strokeWidth={th}
                opacity={has ? .25 : .5} strokeDasharray={has ? undefined : '4 4'} strokeLinecap="round" />
          {has && [0, .6, 1.2].map(b => <circle key={b} r="2.4" fill="#8fb0ff"><animateMotion dur="1.8s" begin={`${b}s`} repeatCount="indefinite"><mpath href={`#f${uid}${i}`} /></animateMotion></circle>)}
          {has && left > 0 && <>
            <path d={`M${mid - 20} ${Y + 6} C ${mid} ${Y + 40}, ${mid + 10} ${Y + 70}, ${mid + 18} ${Y + 96}`} stroke={C.red} strokeWidth={1 + left / mx * 10} opacity=".18" fill="none" />
            <text x={mid + 24} y={Y + 100} fontSize="10" fill="#ff8a98">{left.toLocaleString()} left ({Math.round(left / s.count * 100)}%)</text></>}
        </g>
      })}
      {steps.map((s, i) => {
        const has = s.count != null
        return <g key={i}>
          <circle cx={X[i]} cy={Y} r="24" fill={C.ground} stroke={has ? (i === steps.length - 1 ? C.green : colour) : C.faint}
                  strokeWidth="1.8" strokeDasharray={has ? undefined : '4 3'} />
          <text x={X[i]} y={Y + 4} textAnchor="middle" fontSize={has ? 12 : 11} fontWeight="700" fill={has ? C.text : C.muted} style={{ fontFamily: DISPLAY }}>
            {has ? s.count.toLocaleString() : '?'}</text>
          <text x={X[i]} y={Y - 34} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={C.text}>{s.stage}</text>
          {!has && <text x={X[i]} y={Y + 40} textAnchor="middle" fontSize="9.5" fill={C.muted}>{s.note || 'not tracked yet'}</text>}
        </g>
      })}
    </svg>
  )
}
