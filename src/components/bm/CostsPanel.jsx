// src/components/bm/CostsPanel.jsx
//
// "What things cost" (17 Nov 2026): toner, paper and machine wear, set once
// by the Branch Manager or the owner. From them Octos works out what a page
// costs, and so how low a price can go before the owner must approve.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCosts, saveCosts } from '../../api/discounts'

const FIELDS = [
  { group: 'Toner', items: [
    { key: 'toner_black_price', label: 'Black toner', unit: 'GHS', help: 'One cartridge' },
    { key: 'toner_black_pages', label: 'Pages a black toner prints', unit: 'pages', help: 'Canon rates it at 5% cover' },
    { key: 'toner_colour_price', label: 'Each colour toner', unit: 'GHS', help: 'Cyan, magenta or yellow' },
    { key: 'toner_colour_pages', label: 'Pages a colour toner prints', unit: 'pages', help: 'At 5% cover' },
  ] },
  { group: 'Paper', items: [
    { key: 'paper_box_price', label: 'A box of paper', unit: 'GHS', help: 'Double A, A4' },
    { key: 'paper_box_sheets', label: 'Sheets in a box', unit: 'sheets', help: '5 reams of 500' },
  ] },
  { group: 'The rest', items: [
    { key: 'coverage', label: 'Toner on a typical page', unit: '×', help: 'Times the 5% cover: 3 for charts and pictures' },
    { key: 'wear_percent', label: 'Machine wear', unit: '%', help: 'Drum, fuser, servicing and power' },
    { key: 'floor_multiple', label: "Branch Manager's floor", unit: '× cost', help: 'Lower than this needs the owner' },
    { key: 'unknown_cost_limit', label: 'Most off when a cost is unknown', unit: '%', help: 'Without the owner' },
  ] },
]

export default function CostsPanel({ onClose }) {
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: ['costs'], queryFn: getCosts })
  // Only what has been typed is kept; the rest shows what is saved.
  const [edits, setEdits] = useState({})
  const [said, setSaid] = useState({ text: '', bad: false })
  const form = data ? { ...data, ...edits } : null
  const setForm = next => setEdits(Object.fromEntries(Object.entries(next).filter(([k, v]) => data?.[k] !== v)))

  const save = useMutation({
    mutationFn: () => saveCosts(Object.fromEntries(FIELDS.flatMap(g => g.items).map(f => [f.key, form[f.key]]))),
    onSuccess: fresh => {
      queryClient.setQueryData(['costs'], fresh)
      queryClient.invalidateQueries({ queryKey: ['services'] })
      setEdits({})
      setSaid({ text: 'Saved. Every cost and limit uses these now.', bad: false })
    },
    onError: err => setSaid({ text: err?.response?.data?.detail || 'Could not save. Try again.', bad: true }),
  })

  const page = (save.data || data)?.page

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label="What things cost" onClick={e => e.stopPropagation()}
        className="w-full max-w-xl bg-[var(--panel)] rounded-2xl shadow-2xl overflow-hidden animate-slideUp">
        <div className="flex items-center px-5 py-4 border-b border-[var(--border)]">
          <div>
            <div className="text-[15px] font-black text-[var(--text)]">What things cost</div>
            <div className="text-[12px] text-[var(--text-3)]">Octos works out every job's cost from these.</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-auto w-8 h-8 rounded-full grid place-items-center text-[var(--text-3)] hover:bg-[var(--bg)]">✕</button>
        </div>
        {!form ? (
          <div className="p-6 text-sm text-[var(--text-3)]">Loading…</div>
        ) : (
          <div className="px-5 py-4 space-y-4 max-h-[72vh] overflow-y-auto">
            {page && (
              <div className="rounded-xl bg-blue-50 text-blue-900 px-3 py-2.5 text-[12.5px] leading-relaxed">
                An A4 colour page costs about <b>GHS {page.colour}</b> (paper {page.paper}, toner {page.colour_toner}, plus wear);
                black and white about <b>GHS {page.black}</b>. The Branch Manager can go down to <b>GHS {page.colour_floor}</b> a colour
                page and <b>GHS {page.black_floor}</b> black and white before the owner decides.
              </div>
            )}
            {FIELDS.map(g => (
              <div key={g.group}>
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-[var(--text-3)] mb-1.5">{g.group}</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {g.items.map(f => (
                    <label key={f.key} className="rounded-xl border border-[var(--border)] px-3 py-2 block">
                      <span className="block text-[12px] font-semibold text-[var(--text)]">{f.label}</span>
                      <span className="flex items-center gap-1.5 mt-1">
                        <input value={form[f.key] ?? ''} inputMode="decimal"
                          onChange={e => setForm({ ...form, [f.key]: e.target.value.replace(/[^\d.]/g, '') })}
                          className="w-full h-8 px-2 rounded-lg bg-[var(--bg)] text-[14px] font-bold tabular-nums outline-none" />
                        <span className="text-[11px] text-[var(--text-3)] shrink-0">{f.unit}</span>
                      </span>
                      <span className="block text-[10.5px] text-[var(--text-3)] mt-1">{f.help}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-[var(--text-3)]">
              The truest figure: note the copier's counter when a new toner goes in and again when it runs out. Pages printed is what a toner really prints.
            </p>
            <button onClick={() => save.mutate()} disabled={save.isPending}
              className="w-full h-11 rounded-xl bg-[var(--text)] text-white text-sm font-bold disabled:opacity-50">
              {save.isPending ? 'Saving…' : 'Save costs'}
            </button>
            {said.text && <p className={`text-[12.5px] ${said.bad ? 'text-red-600' : 'text-emerald-700'}`}>{said.text}</p>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
