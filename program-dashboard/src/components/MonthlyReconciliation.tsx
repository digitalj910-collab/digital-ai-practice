import { useMemo, useState } from 'react'
import { CalendarRange, ChevronDown, ChevronRight, Landmark, Pencil, Receipt, Scale, Wallet } from 'lucide-react'
import { canSeeBudget, visibleDomainIds, useStore } from '../store/useStore'
import { CURRENCY, fmtMoney } from '../lib/budget'
import {
  MONTH_LABELS,
  type MonthCell,
  type ReconRow,
  reconYears,
  reconcileProgram,
  sumRows,
  totalsOf,
} from '../lib/reconcile'
import { MonthlyActualsForm } from './MonthlyActualsForm'
import { PageHeader, StatTile } from './ui'

/** Planned-vs-actual budget reconciliation, month by month across a calendar year. */
export function MonthlyReconciliation() {
  const allDomains = useStore((s) => s.domains)
  const allPrograms = useStore((s) => s.programs)
  const tasks = useStore((s) => s.tasks)
  const rateCard = useStore((s) => s.rateCard)
  const cardsByDomain = useStore((s) => s.rateCardsByDomain)
  const user = useStore((s) => s.currentUser)

  // Access: money screens are for Admin + Director/VP tiers, scoped to their own
  // teams. Contributors never see budget.
  const visIds = visibleDomainIds(user, allDomains.map((d) => d.id))
  const domains = visIds ? allDomains.filter((d) => visIds.includes(d.id)) : allDomains
  const domainIdSet = new Set(domains.map((d) => d.id))
  const programs = useMemo(
    () => allPrograms.filter((p) => domainIdSet.has(p.domainId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPrograms, visIds?.join(',')],
  )

  const cardFor = (id: string) => cardsByDomain[id] ?? rateCard

  const thisYear = new Date().getFullYear()
  const years = useMemo(() => reconYears(programs, thisYear), [programs, thisYear])
  const [year, setYear] = useState(thisYear)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{ programId: string; monthIndex?: number } | null>(null)

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  // Reconcile every scoped program for the selected year, then group by domain.
  const rows = useMemo(
    () => programs.map((p) => reconcileProgram(p, tasks, cardFor, year)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [programs, tasks, cardsByDomain, rateCard, year],
  )
  const portfolioMonths = useMemo(() => sumRows(rows), [rows])
  const portfolioTotals = totalsOf(portfolioMonths)

  const byDomain = useMemo(
    () =>
      domains
        .map((d) => {
          const drows = rows.filter((r) => r.domainId === d.id)
          const months = sumRows(drows)
          return { domain: d, rows: drows, months, totals: totalsOf(months) }
        })
        .filter((g) => g.rows.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [domains, rows],
  )

  if (!canSeeBudget(user)) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Monthly budget reconciliation is available to Admin and the Director / VP tiers.
      </div>
    )
  }

  const editingProgram = editing ? programs.find((p) => p.id === editing.programId) : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<CalendarRange size={22} />}
        accent="#0d9488"
        title="Monthly Budget"
        subtitle="Planned vs. actual spend, month by month — entered per resource role, split CapEx / OpEx and rolled up by team & portfolio."
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Year
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-800 outline-none focus:border-slate-900"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {programs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          No programs in your teams yet.
        </div>
      ) : (
        <>
          {/* Portfolio year totals */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile icon={<Wallet size={18} />} accent="#0f172a" label={`Planned ${year}`} value={fmtMoney(portfolioTotals.planned)} />
            <StatTile icon={<Receipt size={18} />} accent="#0d9488" label="Actual to date" value={fmtMoney(portfolioTotals.actual)} />
            <StatTile
              icon={<Scale size={18} />}
              accent={portfolioTotals.variance < 0 ? '#dc2626' : '#16a34a'}
              label="Variance (plan − actual)"
              value={fmtMoney(portfolioTotals.variance)}
            />
            <StatTile icon={<Landmark size={18} />} accent="#2563eb" label="CapEx actual" value={fmtMoney(portfolioTotals.capex)} />
            <StatTile icon={<Landmark size={18} />} accent="#7c3aed" label="OpEx actual" value={fmtMoney(portfolioTotals.opex)} />
          </div>

          {/* Portfolio month-by-month */}
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Portfolio — month by month</h2>
            <MonthTable months={portfolioMonths} totals={portfolioTotals} />
          </section>

          {/* Per-domain roll-ups */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">By team</h2>
            {byDomain.map(({ domain, rows: drows, months, totals }) => {
              const isOpen = open.has(domain.id)
              return (
                <div key={domain.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <button
                    onClick={() => toggle(domain.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    {isOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: domain.color }} />
                    <span className="flex-1 font-semibold text-slate-800">{domain.name}</span>
                    <span className="hidden gap-4 text-xs text-slate-500 sm:flex">
                      <span>Planned <strong className="text-slate-700">{fmtMoney(totals.planned)}</strong></span>
                      <span>Actual <strong className="text-slate-700">{fmtMoney(totals.actual)}</strong></span>
                      <span className={totals.variance < 0 ? 'text-red-600' : 'text-emerald-600'}>
                        Var <strong>{fmtMoney(totals.variance)}</strong>
                      </span>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                      <MonthTable months={months} totals={totals} />

                      <div>
                        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Programs</h3>
                        <div className="divide-y divide-slate-50">
                          {drows.map((r) => (
                            <ProgramRow
                              key={r.id}
                              row={r}
                              onEnter={(monthIndex) => setEditing({ programId: r.id, monthIndex })}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        </>
      )}

      {editing && editingProgram && (
        <MonthlyActualsForm
          open
          onClose={() => setEditing(null)}
          program={editingProgram}
          rateCard={cardFor(editingProgram.domainId)}
          year={year}
          initialMonthIndex={editing.monthIndex}
        />
      )}
    </div>
  )

  // Local: renders the 12-month planned/actual/variance/capex/opex table.
  function MonthTable({ months, totals }: { months: MonthCell[]; totals: ReturnType<typeof totalsOf> }) {
    const money = (n: number) => (n === 0 ? <span className="text-slate-300">—</span> : fmtMoney(n))
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-3 font-semibold">Month</th>
              <th className="px-3 py-2 text-right font-semibold">Planned</th>
              <th className="px-3 py-2 text-right font-semibold">Actual</th>
              <th className="px-3 py-2 text-right font-semibold">Variance</th>
              <th className="px-3 py-2 text-right font-semibold">CapEx</th>
              <th className="px-3 py-2 text-right font-semibold">OpEx</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {months.map((m, i) => {
              const variance = m.planned - m.actual
              const empty = m.planned === 0 && m.actual === 0
              return (
                <tr key={i} className={empty ? 'text-slate-400' : ''}>
                  <td className="py-1.5 pr-3 font-medium text-slate-600">{MONTH_LABELS[i]}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(m.planned)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(m.actual)}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${empty ? '' : variance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {empty ? <span className="text-slate-300">—</span> : fmtMoney(variance)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(m.capex)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(m.opex)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-semibold text-slate-800">
              <td className="py-2 pr-3">Year</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(totals.planned)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(totals.actual)}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${totals.variance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {fmtMoney(totals.variance)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(totals.capex)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(totals.opex)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    )
  }
}

/** One program row inside a domain group: totals + a per-month "enter actuals" strip. */
function ProgramRow({ row, onEnter }: { row: ReconRow; onEnter: (monthIndex?: number) => void }) {
  const [showMonths, setShowMonths] = useState(false)
  return (
    <div className="py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button onClick={() => setShowMonths((v) => !v)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          {showMonths ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          <span className="truncate text-sm font-medium text-slate-800">{row.name}</span>
        </button>
        <span className="text-xs text-slate-500">
          Plan <strong className="text-slate-700">{fmtMoney(row.planned)}</strong>
        </span>
        <span className="text-xs text-slate-500">
          Actual <strong className="text-slate-700">{fmtMoney(row.actual)}</strong>
        </span>
        <span className={`text-xs ${row.variance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          Var <strong>{fmtMoney(row.variance)}</strong>
        </span>
        <button
          onClick={() => onEnter(undefined)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-brand-600 hover:border-brand-300 hover:bg-brand-50"
        >
          <Pencil size={12} /> Enter actuals
        </button>
      </div>

      {showMonths && (
        <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {row.months.map((m, i) => {
            const empty = m.planned === 0 && m.actual === 0
            return (
              <button
                key={i}
                onClick={() => onEnter(i)}
                title={`${MONTH_LABELS[i]} — planned ${fmtMoney(m.planned)}, actual ${fmtMoney(m.actual)}. Click to enter actuals.`}
                className={`rounded-lg border px-1.5 py-1 text-left transition hover:border-brand-300 hover:bg-brand-50 ${
                  empty ? 'border-slate-100 bg-slate-50/50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="text-[10px] font-medium uppercase text-slate-400">{MONTH_LABELS[i]}</div>
                <div className="truncate text-xs font-semibold text-slate-700">
                  {m.actual > 0 ? fmtMoney(m.actual) : <span className="text-slate-300">{CURRENCY}0</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
