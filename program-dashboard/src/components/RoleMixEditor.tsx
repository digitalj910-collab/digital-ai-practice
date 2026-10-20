import { Plus, Trash2 } from 'lucide-react'
import type { RateCardEntry, RolePlanEntry } from '../types'
import { CURRENCY, fmtMoney, lineRate, teamHeadcount, teamVelocity } from '../lib/budget'

/**
 * Edits a program/estimate's team as a mix of roles with headcount per role.
 * Each role's points-per-sprint comes from the (domain) rate card, so velocity
 * reflects the real mix. Cost uses the rate locked on the line (the project's own
 * rate) when set, else the card's. With `editRates`, leadership can set each
 * line's day rate and third-party vendor for this project.
 */
export function RoleMixEditor({
  value,
  onChange,
  rateCard,
  showCost = false,
  editRates = false,
}: {
  value: RolePlanEntry[]
  onChange: (v: RolePlanEntry[]) => void
  rateCard: RateCardEntry[]
  showCost?: boolean
  editRates?: boolean
}) {
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
  const costPerDay = value.reduce((a, r) => a + r.count * lineRate(r, rateCard), 0)

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
      {value.length === 0 && (
        <p className="text-xs text-slate-400">No roles yet — add the team below.</p>
      )}
      {editRates && value.length > 0 && (
        <div className="hidden items-center gap-2 px-0.5 text-[11px] font-medium text-slate-400 sm:flex">
          <span className="flex-1">Role</span>
          <span className="w-32">Vendor</span>
          <span className="w-24 text-right">{CURRENCY}/day</span>
          <span className="w-16 text-right">People</span>
          <span className="w-[22px]" />
        </div>
      )}
      {value.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <select
            value={r.role}
            // A new role gets the card's rate on save, so drop the old line's rate.
            onChange={(e) => setRow(i, { role: e.target.value, dayRate: undefined })}
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
          >
            {!rateCard.some((rc) => rc.role === r.role) && r.role && <option value={r.role}>{r.role}</option>}
            {rateCard.map((rc) => (
              <option key={rc.role} value={rc.role}>
                {rc.role} · {rc.pointsPerSprint} SP/spr{showCost && !editRates ? ` · ${CURRENCY}${rc.dayRate}/d` : ''}
              </option>
            ))}
          </select>
          {editRates && (
            <>
              <input
                value={r.vendor ?? ''}
                onChange={(e) => setRow(i, { vendor: e.target.value || undefined })}
                placeholder="Internal"
                className="w-32 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                aria-label="Third-party vendor"
              />
              <input
                type="number"
                min={0}
                value={lineRate(r, rateCard)}
                onChange={(e) => setRow(i, { dayRate: Math.max(0, Number(e.target.value) || 0) })}
                className="w-24 rounded-md border border-slate-200 px-2 py-1.5 text-right text-sm"
                aria-label="Day rate on this project"
              />
            </>
          )}
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
