import { useMemo, useState } from 'react'
import { AlertTriangle, Calculator, Gauge, TrendingUp, Users } from 'lucide-react'
import { canSeeBudget, visibleDomainIds, useStore } from '../store/useStore'
import { isScheduled } from '../lib/stage'
import { eachMonthOfInterval, endOfMonth, format, parseISO, startOfMonth } from '../lib/dates'
import { PageHeader, StatTile } from './ui'
import { CapacityCalculator } from './CapacityCalculator'

// Programs that no longer consume delivery capacity are excluded from the plan.
const PARKED = new Set(['completed', 'cancelled', 'descoped', 'on_hold', 'postponed'])

export function CapacityPlanning({ onOpenProgram }: { onOpenProgram: (programId: string) => void }) {
  const allPrograms = useStore((s) => s.programs)
  const allDomains = useStore((s) => s.domains)
  const user = useStore((s) => s.currentUser)
  const [showCalc, setShowCalc] = useState(false)

  // Scoped to the viewer's org subtree (admin-only screen, so usually all).
  const visIds = visibleDomainIds(user, allDomains.map((d) => d.id))
  const programs = visIds ? allPrograms.filter((p) => visIds.includes(p.domainId)) : allPrograms
  const domains = visIds ? allDomains.filter((d) => visIds.includes(d.id)) : allDomains

  const domainById = useMemo(() => new Map(domains.map((d) => [d.id, d])), [domains])

  // Only in-flight, prioritized, scheduled work counts toward capacity demand
  // (backlog items have no dates and can't be placed on the monthly timeline).
  const active = useMemo(
    () => programs.filter((p) => !p.deprioritized && !PARKED.has(p.status) && isScheduled(p)),
    [programs],
  )

  const planned = active.reduce((a, p) => a + (p.plannedResources ?? 0), 0)
  const assigned = active.reduce((a, p) => a + (p.currentResources ?? 0), 0)
  const gap = planned - assigned
  const coverage = planned > 0 ? Math.round((assigned / planned) * 100) : 100

  const understaffed = useMemo(
    () =>
      active
        .map((p) => ({ p, short: (p.plannedResources ?? 0) - (p.currentResources ?? 0) }))
        .filter((x) => x.short > 0)
        .sort((a, b) => b.short - a.short),
    [active],
  )

  const byDomain = useMemo(
    () =>
      domains
        .map((d) => {
          const ps = active.filter((p) => p.domainId === d.id)
          const pl = ps.reduce((a, p) => a + (p.plannedResources ?? 0), 0)
          const cu = ps.reduce((a, p) => a + (p.currentResources ?? 0), 0)
          const under = ps.filter((p) => (p.plannedResources ?? 0) > (p.currentResources ?? 0)).length
          return { d, planned: pl, current: cu, gap: pl - cu, under, count: ps.length }
        })
        .filter((r) => r.count > 0),
    [domains, active],
  )

  // FTEs demanded each month by the programs running that month (their planned
  // headcount) — the supply-vs-demand story over time.
  const demand = useMemo(() => {
    if (active.length === 0) return []
    let min = parseISO(active[0].startDate)
    let max = parseISO(active[0].endDate)
    for (const p of active) {
      const s = parseISO(p.startDate)
      const e = parseISO(p.endDate)
      if (s < min) min = s
      if (e > max) max = e
    }
    const months = eachMonthOfInterval({ start: startOfMonth(min), end: endOfMonth(max) })
    return months.map((m) => {
      const ms = m.getTime()
      const me = endOfMonth(m).getTime()
      const fte = active
        .filter((p) => parseISO(p.startDate).getTime() <= me && parseISO(p.endDate).getTime() >= ms)
        .reduce((a, p) => a + (p.plannedResources ?? 0), 0)
      return { month: m, fte }
    })
  }, [active])

  const peak = Math.max(1, ...demand.map((d) => d.fte))
  const chartMax = Math.max(peak, assigned) * 1.1
  const CH = 170 // chart plot height (px)
  const barW = 46

  if (active.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={<Users size={22} />}
          accent="#c8102e"
          title="Capacity Planning"
          subtitle="Do we have enough people for the work we've taken on?"
        />
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-400">
          No active programs with resource data yet.
        </div>
      </div>
    )
  }

  if (!canSeeBudget(user)) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Capacity Planning is available to admins and leadership.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users size={22} />}
        accent="#c8102e"
        title="Capacity Planning"
        subtitle="Do we have enough people for the work we've taken on? Compares people needed vs. people we have across active programs."
        actions={
          <button
            onClick={() => setShowCalc(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Calculator size={16} />
            Capacity calculator
          </button>
        }
      />
      <CapacityCalculator open={showCalc} onClose={() => setShowCalc(false)} />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={<TrendingUp size={20} />} label="People needed" value={planned} accent="#c8102e" />
        <StatTile icon={<Users size={20} />} label="People we have" value={assigned} accent="#0d9488" />
        <StatTile
          icon={<AlertTriangle size={20} />}
          label="Short by"
          value={gap > 0 ? `${gap}` : '0'}
          accent={gap > 0 ? '#dc2626' : '#16a34a'}
        />
        <StatTile
          icon={<Gauge size={20} />}
          label="Coverage"
          value={`${coverage}%`}
          accent={coverage >= 100 ? '#16a34a' : coverage >= 80 ? '#f59e0b' : '#dc2626'}
        />
      </div>

      {/* Demand over time */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">People needed each month</h3>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-500" /> People needed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0 w-4 border-t-2 border-dashed border-teal-600" /> People we have ({assigned})
            </span>
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-400">
          Red bars are months where you need more people than you have.
        </p>
        <div className="thin-scroll overflow-x-auto">
          <svg width={demand.length * barW + 40} height={CH + 34} className="block">
            {/* capacity line */}
            {(() => {
              const y = 8 + CH - (assigned / chartMax) * CH
              return (
                <g>
                  <line x1={30} y1={y} x2={demand.length * barW + 34} y2={y} stroke="#0d9488" strokeWidth={1.5} strokeDasharray="4 3" />
                  <text x={4} y={y + 3} fontSize={9} fill="#0d9488" fontWeight={700}>{assigned}</text>
                </g>
              )
            })()}
            {demand.map((d, i) => {
              const h = (d.fte / chartMax) * CH
              const x = 34 + i * barW
              const y = 8 + CH - h
              const over = d.fte > assigned
              return (
                <g key={i}>
                  <rect x={x} y={y} width={barW - 12} height={Math.max(h, 1)} rx={3} fill={over ? '#ef4444' : '#6366f1'} opacity={over ? 0.9 : 0.85} />
                  <text x={x + (barW - 12) / 2} y={y - 4} fontSize={9} fontWeight={600} fill={over ? '#dc2626' : '#64748b'} textAnchor="middle">{d.fte}</text>
                  <text x={x + (barW - 12) / 2} y={CH + 22} fontSize={9} fill="#94a3b8" textAnchor="middle">{format(d.month, 'MMM')}</text>
                  {d.month.getMonth() === 0 && (
                    <text x={x + (barW - 12) / 2} y={CH + 32} fontSize={8} fill="#cbd5e1" textAnchor="middle">{format(d.month, 'yyyy')}</text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* By domain */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">People by team</h3>
        <div className="space-y-3">
          {byDomain.map((r) => {
            const cov = r.planned > 0 ? Math.min(100, Math.round((r.current / r.planned) * 100)) : 100
            return (
              <div key={r.d.id} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.d.color }} />
                <span className="w-32 shrink-0 truncate text-sm font-medium text-slate-700">{r.d.name}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${cov}%`, background: cov >= 100 ? '#16a34a' : cov >= 80 ? '#f59e0b' : '#dc2626' }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-xs text-slate-500">
                  {r.current}/{r.planned} people
                </span>
                <span className={`w-20 shrink-0 text-right text-xs font-medium ${r.gap > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {r.gap > 0 ? `−${r.gap} short` : 'staffed'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Understaffed programs */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">
          Programs short on people {understaffed.length > 0 && <span className="text-slate-400">({understaffed.length})</span>}
        </h3>
        {understaffed.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Every active program is staffed to plan. 🎉</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {understaffed.map(({ p, short }) => (
              <li key={p.id}>
                <button
                  onClick={() => onOpenProgram(p.id)}
                  className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: domainById.get(p.domainId)?.color ?? '#94a3b8' }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{p.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">{domainById.get(p.domainId)?.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">{p.currentResources ?? 0}/{p.plannedResources ?? 0} people</span>
                  <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    −{short} needed
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
