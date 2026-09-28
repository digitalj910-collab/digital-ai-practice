import { useMemo } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { AlertTriangle, CalendarClock, Clock, Presentation, Wallet } from 'lucide-react'
import { canSeeBudget, visibleDomainIds, useStore } from '../store/useStore'
import { fmtMoneyCompact } from '../lib/budget'
import { reconcileProgram, sumRows } from '../lib/reconcile'
import { rollupRag } from '../lib/rag'
import { isScheduled } from '../lib/stage'
import { fmtDate, toIso } from '../lib/dates'
import { PROGRAM_STATUS_LABELS, type Program, type ProgramStatus } from '../types'
import { PageHeader, RagDot, StatTile } from './ui'
import { DirectorUpdatesPanel } from './DirectorUpdates'

// Work that's finished or stopped doesn't need leadership attention.
const CLOSED: ProgramStatus[] = ['completed', 'cancelled', 'descoped']
const isActive = (p: Program) => !CLOSED.includes(p.status)
/** Days a baselined program now finishes past its agreed end (0 if on plan / no baseline). */
const slipDays = (p: Program) =>
  p.baseline ? Math.max(0, differenceInCalendarDays(parseISO(p.endDate), parseISO(p.baseline.endDate))) : 0

/**
 * The VP's one-page view: status by team, what needs attention, spend to date
 * and the milestones coming up. No task detail and no weekly manager updates.
 */
export function ExecutiveSummary({
  onOpenDomain,
  onOpenProgram,
}: {
  onOpenDomain: (domainId: string) => void
  onOpenProgram: (programId: string) => void
}) {
  const allDomains = useStore((s) => s.domains)
  const allPrograms = useStore((s) => s.programs)
  const tasks = useStore((s) => s.tasks)
  const rateCard = useStore((s) => s.rateCard)
  const cardsByDomain = useStore((s) => s.rateCardsByDomain)
  const user = useStore((s) => s.currentUser)
  const showMoney = canSeeBudget(user)

  const visIds = visibleDomainIds(user, allDomains.map((d) => d.id))
  const domains = visIds ? allDomains.filter((d) => visIds.includes(d.id)) : allDomains
  const programs = allPrograms.filter((p) => domains.some((d) => d.id === p.domainId) && isScheduled(p))
  const active = programs.filter(isActive)

  const today = new Date()
  const year = today.getFullYear()
  const monthIdx = today.getMonth()

  // Spend to date: planned vs actual for Jan → this month, per team.
  const spend = useMemo(() => {
    const byDomain = new Map<string, { planned: number; actual: number }>()
    for (const d of domains) {
      const rows = programs
        .filter((p) => p.domainId === d.id)
        .map((p) => reconcileProgram(p, tasks, (id) => cardsByDomain[id] ?? rateCard, year))
      const months = sumRows(rows).slice(0, monthIdx + 1)
      byDomain.set(d.id, {
        planned: months.reduce((a, m) => a + m.planned, 0),
        actual: months.reduce((a, m) => a + m.actual, 0),
      })
    }
    return byDomain
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domains.map((d) => d.id).join(','), programs, tasks, rateCard, cardsByDomain, year, monthIdx])
  const spendTotal = [...spend.values()].reduce(
    (a, s) => ({ planned: a.planned + s.planned, actual: a.actual + s.actual }),
    { planned: 0, actual: 0 },
  )

  const late = active.filter((p) => slipDays(p) > 0)
  const attention = active
    .filter((p) => p.ragStatus === 'red' || p.status === 'blocked' || slipDays(p) > 0)
    .sort((a, b) => (a.ragStatus === 'red' ? 0 : 1) - (b.ragStatus === 'red' ? 0 : 1) || slipDays(b) - slipDays(a))
  const teamsOnPlan = domains.filter((d) => !late.some((p) => p.domainId === d.id)).length

  // Milestones in the next 60 days (task milestones + project finishes).
  const horizon = toIso(new Date(today.getTime() + 60 * 86_400_000))
  const now = toIso(today)
  const taskMilestones = tasks
    .filter((t) => t.milestone && t.endDate >= now && t.endDate <= horizon)
    .map((t) => ({ date: t.endDate, label: t.name, program: active.find((p) => p.id === t.programId) }))
    .filter((m) => m.program)
  // A project's finish only shows when it has no milestone of its own in the window.
  const milestones = [
    ...taskMilestones,
    ...active
      .filter((p) => p.endDate >= now && p.endDate <= horizon)
      .filter((p) => !taskMilestones.some((m) => m.program!.id === p.id))
      .map((p) => ({ date: p.endDate, label: 'Planned finish', program: p })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const domainName = (id: string) => domains.find((d) => d.id === id)?.name ?? ''

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Presentation size={22} />}
        accent="#7c3aed"
        title="Executive Summary"
        subtitle="Where every team stands against the agreed plan — status, what needs attention, spend and upcoming milestones."
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile icon={<Clock size={18} />} accent="#16a34a" label="Teams on agreed plan" value={`${teamsOnPlan}/${domains.length}`} />
        <StatTile icon={<CalendarClock size={18} />} accent="#d97706" label="Projects late vs plan" value={late.length} />
        <StatTile icon={<AlertTriangle size={18} />} accent="#dc2626" label="Need attention" value={attention.length} />
        {showMoney && (
          <StatTile
            icon={<Wallet size={18} />}
            accent={spendTotal.actual > spendTotal.planned ? '#dc2626' : '#0d9488'}
            label={`Spend to date (plan ${fmtMoneyCompact(spendTotal.planned)})`}
            value={fmtMoneyCompact(spendTotal.actual)}
          />
        )}
      </div>

      {/* The director's latest rollup — the VP's weekly read. */}
      <DirectorUpdatesPanel limit={1} />

      {/* Status by team */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">Status by team</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Team</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Active projects</th>
                <th className="px-3 py-2 text-right font-medium">Late vs plan</th>
                {showMoney && <th className="px-3 py-2 text-right font-medium">Spend to date</th>}
                {showMoney && <th className="px-4 py-2 text-right font-medium">vs plan</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {domains.map((d) => {
                const mine = active.filter((p) => p.domainId === d.id)
                const rag = rollupRag(mine)
                const nLate = mine.filter((p) => slipDays(p) > 0).length
                const s = spend.get(d.id) ?? { planned: 0, actual: 0 }
                const variance = s.planned - s.actual
                return (
                  <tr key={d.id} onClick={() => onOpenDomain(d.id)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{d.name}</div>
                      <div className="text-xs text-slate-400">{d.managerName}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                        <RagDot rag={rag} /> {rag === 'green' ? 'On track' : rag === 'amber' ? 'At risk' : 'Off track'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{mine.length}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${nLate ? 'font-medium text-amber-700' : 'text-slate-400'}`}>
                      {nLate || '—'}
                    </td>
                    {showMoney && (
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoneyCompact(s.actual)}</td>
                    )}
                    {showMoney && (
                      <td className={`px-4 py-2.5 text-right tabular-nums ${variance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {variance < 0 ? `${fmtMoneyCompact(-variance)} over` : `${fmtMoneyCompact(variance)} under`}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Needs attention */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
            Needs attention
          </h2>
          {attention.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Nothing flagged — all on plan.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {attention.map((p) => {
                const slip = slipDays(p)
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => onOpenProgram(p.id)}
                      className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50"
                    >
                      <span className="mt-1.5"><RagDot rag={p.ragStatus} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                        <span className="block text-xs text-slate-500">
                          {domainName(p.domainId)} · {PROGRAM_STATUS_LABELS[p.status]}
                          {slip > 0 && <> · <span className="text-amber-700">{slip} days late vs plan</span></>}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Upcoming milestones */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
            Milestones — next 60 days
          </h2>
          {milestones.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No milestones in the next 60 days.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {milestones.map((m, i) => (
                <li key={i}>
                  <button
                    onClick={() => onOpenProgram(m.program!.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                  >
                    <span className="w-20 shrink-0 text-xs font-medium tabular-nums text-slate-500">{fmtDate(m.date)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-800">{m.program!.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {domainName(m.program!.domainId)} · {m.label}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
