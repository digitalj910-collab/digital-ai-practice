import { useMemo, type ReactNode } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  GitBranch,
  Landmark,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { canAdminister, canSeeBudget, visibleDomainIds, useStore } from '../store/useStore'
import {
  CURRENCY,
  fmtMoney,
  portfolioBudget,
  programBudget,
  type RateCardSource,
} from '../lib/budget'
import { portfolioMetrics } from '../lib/metrics'
import { programMarkers } from '../lib/markers'
import { differenceInCalendarDays, fmtDate, parseISO } from '../lib/dates'
import { PageHeader, StatTile } from './ui'

export function ReportsView({ onOpenProgram }: { onOpenProgram: (programId: string) => void }) {
  const allDomains = useStore((s) => s.domains)
  const allPrograms = useStore((s) => s.programs)
  const tasks = useStore((s) => s.tasks)
  const statusChanges = useStore((s) => s.statusChanges)
  const rateCard = useStore((s) => s.rateCard)
  const cardsByDomain = useStore((s) => s.rateCardsByDomain)
  const user = useStore((s) => s.currentUser)
  // Scoped to the viewer's org subtree.
  const visIds = visibleDomainIds(user, allDomains.map((d) => d.id))
  const domains = visIds ? allDomains.filter((d) => visIds.includes(d.id)) : allDomains
  const programs = visIds ? allPrograms.filter((p) => visIds.includes(p.domainId)) : allPrograms

  const cardFor: RateCardSource = useMemo(
    () => (id: string) => cardsByDomain[id] ?? rateCard,
    [cardsByDomain, rateCard],
  )
  const domainName = (id: string) => domains.find((d) => d.id === id)?.name ?? ''
  const domainColor = (id: string) => domains.find((d) => d.id === id)?.color ?? '#94a3b8'

  // ---- Schedule health (baseline vs. current) ----
  const schedule = useMemo(() => {
    const baselined = programs.filter((p) => p.baseline)
    const rows = baselined
      .map((p) => ({
        p,
        days: differenceInCalendarDays(parseISO(p.endDate), parseISO(p.baseline!.endDate)),
      }))
      .sort((a, b) => b.days - a.days)
    const slipped = rows.filter((r) => r.days > 0)
    const onTime = rows.filter((r) => r.days <= 0)
    const onTimePct = baselined.length ? Math.round((onTime.length / baselined.length) * 100) : 100
    const avgLate = slipped.length
      ? Math.round(slipped.reduce((a, r) => a + r.days, 0) / slipped.length)
      : 0
    return { baselined, rows, slipped, onTimePct, avgLate }
  }, [programs])

  // ---- Budget health ----
  const budget = useMemo(() => {
    const portfolio = portfolioBudget(domains, programs, tasks, cardFor)
    const rows = programs
      .map((p) => ({ p, b: programBudget(p, tasks.filter((t) => t.programId === p.id), cardFor) }))
      .sort((a, b) => a.b.variance - b.b.variance)
    const over = rows.filter((r) => r.b.overBudget)
    const fund = (k: 'capex' | 'opex') =>
      rows.filter((r) => r.p.funding === k).reduce((a, r) => a + r.b.forecast, 0)
    return { portfolio, rows, over, capex: fund('capex'), opex: fund('opex') }
  }, [domains, programs, tasks, cardFor])

  // ---- Scope & change control ----
  const scope = useMemo(() => {
    const changes = programs
      .flatMap((p) => (p.scopeChanges ?? []).map((sc) => ({ p, sc })))
      .sort((a, b) => b.sc.date.localeCompare(a.sc.date))
    const deprioritized = programs.filter((p) => p.deprioritized)
    const everBlocked = programs.filter((p) => programMarkers(p, statusChanges).has('blocked'))
    return { changes, deprioritized, everBlocked }
  }, [programs, statusChanges])

  // ---- Resource & capacity ----
  const resource = useMemo(() => {
    const active = programs.filter((p) => p.status !== 'completed' && p.status !== 'cancelled')
    const planned = active.reduce((a, p) => a + (p.plannedResources ?? 0), 0)
    const current = active.reduce((a, p) => a + (p.currentResources ?? 0), 0)
    const coverage = planned ? Math.round((current / planned) * 100) : 100
    const understaffed = active
      .filter((p) => (p.currentResources ?? 0) < (p.plannedResources ?? 0))
      .map((p) => ({ p, gap: (p.plannedResources ?? 0) - (p.currentResources ?? 0) }))
      .sort((a, b) => b.gap - a.gap)
    return { planned, current, coverage, understaffed }
  }, [programs])

  const pm = useMemo(() => portfolioMetrics(programs, tasks), [programs, tasks])
  const money = canSeeBudget(user)

  if (!canAdminister(user)) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Reports &amp; KPIs are available to admins only.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<BarChart3 size={22} />}
        accent="#c8102e"
        title="Reports & KPIs"
        subtitle="Portfolio health across schedule, budget, scope and resourcing — for leadership reporting."
      />

      {/* KPI band */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile icon={<CalendarClock size={20} />} label="On-time vs. baseline" value={`${schedule.onTimePct}%`} accent="#16a34a" />
        <StatTile icon={<AlertTriangle size={20} />} label="Slipped projects" value={schedule.slipped.length} accent="#dc2626" />
        {money && (
          <StatTile
            icon={budget.portfolio.variance >= 0 ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
            label={budget.portfolio.variance >= 0 ? 'Under budget' : 'Over budget'}
            value={fmtMoney(Math.abs(budget.portfolio.variance))}
            accent={budget.portfolio.variance >= 0 ? '#16a34a' : '#dc2626'}
          />
        )}
        <StatTile icon={<Users size={20} />} label="Resource coverage" value={`${resource.coverage}%`} accent={resource.coverage >= 100 ? '#16a34a' : '#f59e0b'} />
        <StatTile icon={<GitBranch size={20} />} label="Scope changes" value={scope.changes.length} accent="#c8102e" />
      </div>

      {/* Schedule health */}
      <Card title="Schedule health" icon={<CalendarClock size={16} />} sub={`${schedule.baselined.length} baselined · ${schedule.slipped.length} slipped · avg ${schedule.avgLate} days late`}>
        {schedule.slipped.length === 0 ? (
          <Empty>Everything is on or ahead of its baseline. 🎉</Empty>
        ) : (
          <ul className="divide-y divide-slate-50">
            {schedule.slipped.map(({ p, days }) => (
              <Row key={p.id} color={domainColor(p.domainId)} name={p.name} domain={domainName(p.domainId)} onClick={() => onOpenProgram(p.id)}>
                <span className="text-xs text-slate-400">
                  {fmtDate(p.baseline!.endDate)} → {fmtDate(p.endDate)}
                </span>
                <span className="w-20 shrink-0 text-right text-xs font-semibold text-red-600">{days}d late</span>
              </Row>
            ))}
          </ul>
        )}
      </Card>

      {/* Budget health */}
      {money && (
        <Card title="Budget health" icon={<Wallet size={16} />} sub={`Fund ${fmtMoney(budget.portfolio.allocated)} · Forecast ${fmtMoney(budget.portfolio.forecast)} · Spent ${fmtMoney(budget.portfolio.spent)}`}>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="Allocated fund" value={fmtMoney(budget.portfolio.allocated)} color="#2563eb" icon={<Landmark size={14} />} />
            <Mini label="Forecast" value={fmtMoney(budget.portfolio.forecast)} color="#f59e0b" icon={<TrendingUp size={14} />} />
            <Mini label={`CapEx (${CURRENCY})`} value={fmtMoney(budget.capex)} color="#6366f1" />
            <Mini label={`OpEx (${CURRENCY})`} value={fmtMoney(budget.opex)} color="#0d9488" />
          </div>
          {budget.over.length === 0 ? (
            <Empty>No projects are forecast over budget.</Empty>
          ) : (
            <ul className="divide-y divide-slate-50">
              {budget.over.map(({ p, b }) => (
                <Row key={p.id} color={domainColor(p.domainId)} name={p.name} domain={domainName(p.domainId)} onClick={() => onOpenProgram(p.id)}>
                  <span className="w-24 shrink-0 text-right text-xs text-slate-500">{fmtMoney(b.forecast)}</span>
                  <span className="w-24 shrink-0 text-right text-xs font-semibold text-red-600">{fmtMoney(-b.variance)} over</span>
                </Row>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Scope & change control */}
      <Card title="Scope & change control" icon={<GitBranch size={16} />} sub={`${scope.changes.length} scope changes · ${scope.deprioritized.length} deprioritized · ${scope.everBlocked.length} ever blocked · ${pm.planningEffectiveness}% planning effectiveness`}>
        {scope.changes.length === 0 ? (
          <Empty>No scope changes logged.</Empty>
        ) : (
          <ul className="divide-y divide-slate-50">
            {scope.changes.map(({ p, sc }) => (
              <Row key={sc.id} color={domainColor(p.domainId)} name={p.name} domain={domainName(p.domainId)} onClick={() => onOpenProgram(p.id)}>
                <span className="hidden max-w-xs flex-1 truncate text-xs text-slate-500 sm:block">{sc.note}</span>
                <span className="w-24 shrink-0 text-right text-xs text-slate-400">{fmtDate(sc.date)}</span>
              </Row>
            ))}
          </ul>
        )}
      </Card>

      {/* Resource & capacity */}
      <Card title="Resource & capacity" icon={<Users size={16} />} sub={`${resource.current}/${resource.planned} people · ${resource.coverage}% coverage · ${resource.understaffed.length} understaffed`}>
        {resource.understaffed.length === 0 ? (
          <Empty>Every active project is fully staffed.</Empty>
        ) : (
          <ul className="divide-y divide-slate-50">
            {resource.understaffed.map(({ p, gap }) => (
              <Row key={p.id} color={domainColor(p.domainId)} name={p.name} domain={domainName(p.domainId)} onClick={() => onOpenProgram(p.id)}>
                <span className="text-xs text-slate-400">{p.currentResources ?? 0}/{p.plannedResources ?? 0} staffed</span>
                <span className="w-20 shrink-0 text-right text-xs font-semibold text-amber-600">-{gap} people</span>
              </Row>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Card({ title, icon, sub, children }: { title: string; icon: ReactNode; sub?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="text-slate-400">{icon}</span>
          {title}
        </h3>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function Row({
  color,
  name,
  domain,
  children,
  onClick,
}: {
  color: string
  name: string
  domain: string
  children: ReactNode
  onClick: () => void
}) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 py-2 text-left hover:bg-slate-50">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="w-40 shrink-0 truncate text-sm font-medium text-slate-800">{name}</span>
        <span className="hidden w-24 shrink-0 truncate text-xs text-slate-400 sm:block">{domain}</span>
        <span className="ml-auto flex items-center gap-3">{children}</span>
      </button>
    </li>
  )
}

function Mini({ label, value, color, icon }: { label: string; value: string; color: string; icon?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-2.5" style={{ borderLeftWidth: 3, borderLeftColor: color }}>
      <div className="flex items-center gap-1 text-[11px] text-slate-500">
        {icon && <span style={{ color }}>{icon}</span>}
        {label}
      </div>
      <div className="mt-0.5 text-base font-bold" style={{ color }}>{value}</div>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-3 text-center text-sm text-slate-400">{children}</p>
}
