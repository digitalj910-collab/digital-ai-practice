import { Plus, Trash2 } from 'lucide-react'
import type { RateCardEntry, RolePlanEntry } from '../types'
import { CURRENCY, fmtMoney, teamHeadcount, teamVelocity } from '../lib/budget'

/**
 * Edits a program/estimate's team as a mix of roles with headcount per role.
 * Each role's points-per-sprint and day rate come from the (domain) rate card, so
 * the velocity and cost reflect the real mix — not "everyone's a developer".
 */
export function RoleMixEditor({
  value,
  onChange,
  rateCard,
  showCost = false,
}: {
  value: RolePlanEntry[]
  onChange: (v: RolePlanEntry[]) => void
  rateCard: RateCardEntry[]
  showCost?: boolean
}) {
  const dayRate = (role: string) => rateCard.find((r) => r.role === role)?.dayRate ?? 0
  const setRow = (i: number, patch: Partial<RolePlanEntry>) =>
    onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const addRow = () => {
    const used = new Set(value.map((v) => v.role))
    const next = rateCard.find((r) => !used.has(r.role)) ?? rateCard[0]
    onChange([...value, { role: next?.role ?? '', count: 1 }])
  }
  const removeRow = (i: number) => onChange(value.filter((_, j) => j !== i))

  const headcount = teamHeadcount(value)
  const velocity = teamVelocity(value, rateCard)
  const costPerDay = value.reduce((a, r) => a + r.count * dayRate(r.role), 0)

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
      {value.length === 0 && (
        <p className="text-xs text-slate-400">No roles yet — add the team below.</p>
      )}
      {value.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={r.role}
            onChange={(e) => setRow(i, { role: e.target.value })}
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
          >
            {rateCard.map((rc) => (
              <option key={rc.role} value={rc.role}>
                {rc.role} · {rc.pointsPerSprint} SP/spr{showCost ? ` · ${CURRENCY}${rc.dayRate}/d` : ''}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={r.count}
            onChange={(e) => setRow(i, { count: Math.max(0, Number(e.target.value) || 0) })}
            className="w-16 rounded-md border border-slate-200 px-2 py-1.5 text-right text-sm"
            aria-label="Headcount"
          />
          <button
            onClick={() => removeRow(i)}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Remove role"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={addRow}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
        >
          <Plus size={13} /> Add role
        </button>
        <span className="text-xs text-slate-500">
          {headcount} {headcount === 1 ? 'person' : 'people'} · velocity{' '}
          <strong className="text-slate-700">{velocity}</strong> SP/sprint
          {showCost ? ` · ${fmtMoney(costPerDay)}/day` : ''}
        </span>
      </div>
    </div>
  )
}
