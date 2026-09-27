import { useMemo, useState } from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import type { Funding, MonthlyActualLine, Program, RateCardEntry } from '../types'
import { FUNDING_LABELS } from '../types'
import { useStore } from '../store/useStore'
import { CURRENCY, fmtMoney } from '../lib/budget'
import { MONTH_LABELS, actualsFor, monthKey, setMonthlyActual } from '../lib/reconcile'
import { Button, Field, Modal, inputClass } from './ui'

// Roughly 21 working days per month — used only to pre-fill a suggested actual
// from a role's day rate (the user then edits to the real number).
const WORKING_DAYS_PER_MONTH = 21

/**
 * Enter a program's ACTUAL spend for one month, broken down by resource role and
 * tagged CapEx/OpEx. Persists into the program's monthlyActuals (budget_plan jsonb).
 */
export function MonthlyActualsForm({
  open,
  onClose,
  program,
  rateCard,
  year,
  initialMonthIndex,
}: {
  open: boolean
  onClose: () => void
  program: Program
  rateCard: RateCardEntry[]
  year: number
  /** Month (0–11) to open on. Defaults to the first month of the program's plan in this year, else January. */
  initialMonthIndex?: number
}) {
  const updateProgram = useStore((s) => s.updateProgram)
  const defaultFunding: Funding = program.funding ?? 'capex'

  const firstMonth = useMemo(() => {
    if (initialMonthIndex != null) return initialMonthIndex
    if (program.startDate) {
      const d = new Date(program.startDate)
      if (d.getFullYear() === year) return d.getMonth()
    }
    return 0
  }, [initialMonthIndex, program.startDate, year])

  const [monthIdx, setMonthIdx] = useState(firstMonth)
  // Lines for the selected month. Keyed so switching months reloads from saved data.
  const [loadedKey, setLoadedKey] = useState('')
  const [lines, setLines] = useState<MonthlyActualLine[]>([])

  const key = monthKey(year, monthIdx)
  // Lazy-load the selected month's saved lines whenever the month changes.
  if (loadedKey !== key) {
    const saved = actualsFor(program, key)
    setLines(saved ? saved.lines.map((l) => ({ ...l })) : [{ role: rateCard[0]?.role ?? '', cost: 0, funding: defaultFunding }])
    setLoadedKey(key)
  }

  const setRow = (i: number, patch: Partial<MonthlyActualLine>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const addRow = () =>
    setLines((ls) => [...ls, { role: '', cost: 0, funding: defaultFunding }])
  const removeRow = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i))

  // Convenience: seed every rate-card role with a suggested monthly cost.
  const prefill = () =>
    setLines(
      rateCard.map((r) => ({
        role: r.role,
        cost: Math.round(r.dayRate * WORKING_DAYS_PER_MONTH),
        funding: defaultFunding,
      })),
    )

  const total = lines.reduce((a, l) => a + (l.cost || 0), 0)
  const capex = lines.filter((l) => l.funding === 'capex').reduce((a, l) => a + (l.cost || 0), 0)
  const opex = total - capex

  const save = () => {
    const next = setMonthlyActual(program.monthlyActuals, key, lines)
    updateProgram(program.id, { monthlyActuals: next.length ? next : undefined })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Monthly actuals · ${program.name}`} maxWidth="max-w-lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Enter what was actually spent in the month, by resource role, and tag each line CapEx or
          OpEx. This feeds the planned-vs-actual reconciliation and the CapEx/OpEx roll-ups.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Month">
            <select className={inputClass} value={monthIdx} onChange={(e) => setMonthIdx(Number(e.target.value))}>
              {MONTH_LABELS.map((m, i) => (
                <option key={m} value={i}>
                  {m} {year}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button
              onClick={prefill}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              title="Fill each rate-card role with day rate × ~21 working days"
            >
              <Sparkles size={13} /> Prefill from rate card
            </button>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            <span className="flex-1">Resource role</span>
            <span className="w-28 text-right">Actual cost</span>
            <span className="w-24 text-center">CapEx/OpEx</span>
            <span className="w-6" />
          </div>
          <div className="space-y-2">
            {lines.length === 0 && <p className="px-1 text-xs text-slate-400">No lines yet — add a role below.</p>}
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  list="recon-roles"
                  className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                  value={l.role}
                  placeholder="Role"
                  onChange={(e) => setRow(i, { role: e.target.value })}
                />
                <div className="flex w-28 items-center gap-1">
                  <span className="text-xs text-slate-400">{CURRENCY}</span>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-right text-sm"
                    value={l.cost}
                    onChange={(e) => setRow(i, { cost: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
                <select
                  className="w-24 rounded-md border border-slate-200 px-1.5 py-1.5 text-sm"
                  value={l.funding}
                  onChange={(e) => setRow(i, { funding: e.target.value as Funding })}
                >
                  {(['capex', 'opex'] as Funding[]).map((f) => (
                    <option key={f} value={f}>
                      {FUNDING_LABELS[f]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeRow(i)}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove line"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <datalist id="recon-roles">
            {rateCard.map((r) => (
              <option key={r.role} value={r.role} />
            ))}
          </datalist>
          <button
            onClick={addRow}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
          >
            <Plus size={13} /> Add role line
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-2.5 text-sm">
          <span className="font-semibold text-slate-800">
            {MONTH_LABELS[monthIdx]} {year} total: <span className="text-brand-700">{fmtMoney(total)}</span>
          </span>
          <span className="text-xs text-slate-500">
            CapEx <strong className="text-slate-700">{fmtMoney(capex)}</strong> · OpEx{' '}
            <strong className="text-slate-700">{fmtMoney(opex)}</strong>
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save month</Button>
        </div>
      </div>
    </Modal>
  )
}
