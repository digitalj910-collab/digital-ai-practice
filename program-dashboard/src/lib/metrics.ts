import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Program, Task } from '../types'
import { programPercent } from './rag'

// Statuses that are "parked"/closed — excluded from risk tallies and alerts.
const PARKED_STATUSES = new Set(['completed', 'cancelled', 'descoped'])

// Delivery-risk model: compares how far along a program *should* be (by elapsed
// time) against how far it actually is, factoring end-date proximity and whether
// it's staffed to the plan. This is what powers the "at risk — consider adding
// resources" signal and the Alerts feed.

export type RiskLevel = 'on_track' | 'watch' | 'at_risk'

export interface DeliveryRisk {
  level: RiskLevel
  expectedPct: number
  actualPct: number
  gap: number // expected - actual (positive = behind plan)
  overdue: boolean
  daysToEnd: number
  understaffed: boolean
  suggestResources: boolean
  message: string
}

export const RISK_META: Record<RiskLevel, { label: string; color: string; badge: string }> = {
  on_track: { label: 'On plan', color: '#16a34a', badge: 'bg-emerald-100 text-emerald-700' },
  watch: { label: 'Watch', color: '#f59e0b', badge: 'bg-amber-100 text-amber-700' },
  at_risk: { label: 'At risk', color: '#dc2626', badge: 'bg-red-100 text-red-700' },
}

/** Where the program should be, as a %, based purely on elapsed calendar time. */
export function expectedPct(program: Program, today: Date): number {
  const start = parseISO(program.startDate).getTime()
  const end = parseISO(program.endDate).getTime()
  const now = today.getTime()
  if (end <= start) return now >= end ? 100 : 0
  if (now <= start) return 0
  if (now >= end) return 100
  return Math.round(((now - start) / (end - start)) * 100)
}

export function resourceUtilization(program: Program): number | null {
  if (!program.plannedResources || program.currentResources == null) return null
  return Math.round((program.currentResources / program.plannedResources) * 100)
}

export function deliveryRisk(program: Program, tasks: Task[], today = new Date()): DeliveryRisk {
  // Unscheduled (backlog) programs have no dates — they can't be behind or overdue.
  if (!program.startDate || !program.endDate) {
    return {
      level: 'on_track',
      expectedPct: 0,
      actualPct: programPercent(program, tasks),
      gap: 0,
      overdue: false,
      daysToEnd: 0,
      understaffed: false,
      suggestResources: false,
      message: 'Backlog — not scheduled',
    }
  }
  const actualPct = programPercent(program, tasks)
  const expected = expectedPct(program, today)
  const gap = expected - actualPct
  const daysToEnd = differenceInCalendarDays(parseISO(program.endDate), today)
  const done = program.status === 'completed' || actualPct >= 100
  const overdue = !done && daysToEnd < 0
  const understaffed =
    program.plannedResources != null &&
    program.currentResources != null &&
    program.currentResources < program.plannedResources

  let level: RiskLevel = 'on_track'
  let message = 'On plan'
  let suggestResources = false

  if (done) {
    level = 'on_track'
    message = 'Complete'
  } else if (overdue) {
    level = 'at_risk'
    message = `Overdue by ${Math.abs(daysToEnd)}d at ${actualPct}% complete`
    suggestResources = understaffed
  } else if (gap >= 25) {
    level = 'at_risk'
    message = `Behind plan — ${actualPct}% done vs ${expected}% expected`
    suggestResources = true
  } else if (gap >= 10) {
    level = 'watch'
    message = `Slightly behind — ${actualPct}% vs ${expected}% expected`
    suggestResources = understaffed
  }

  return {
    level,
    expectedPct: expected,
    actualPct,
    gap,
    overdue,
    daysToEnd,
    understaffed,
    suggestResources,
    message,
  }
}

// ---- Portfolio-level roll-ups -------------------------------------------

export interface PortfolioMetrics {
  total: number
  deprioritized: number
  /** % of planned programs NOT deprioritized — the planning-effectiveness story. */
  planningEffectiveness: number
  atRisk: number
  watch: number
  onTrack: number
}

export function portfolioMetrics(
  programs: Program[],
  tasks: Task[],
  today = new Date(),
): PortfolioMetrics {
  const total = programs.length
  const deprioritized = programs.filter((p) => p.deprioritized).length
  let atRisk = 0
  let watch = 0
  let onTrack = 0
  for (const p of programs) {
    if (p.deprioritized || PARKED_STATUSES.has(p.status)) continue
    if (!p.startDate || !p.endDate) continue // backlog — not counted in risk tallies
    const r = deliveryRisk(p, tasks.filter((t) => t.programId === p.id), today).level
    if (r === 'at_risk') atRisk++
    else if (r === 'watch') watch++
    else onTrack++
  }
  const planningEffectiveness = total === 0 ? 100 : Math.round(((total - deprioritized) / total) * 100)
  return { total, deprioritized, planningEffectiveness, atRisk, watch, onTrack }
}

// ---- Alerts feed (the in-app precursor to email notifications) ----------

export type AlertType = 'overdue' | 'behind' | 'ending_soon' | 'resource'

export interface Alert {
  programId: string
  programName: string
  domainId: string
  type: AlertType
  level: RiskLevel
  message: string
}

const ALERT_LABELS: Record<AlertType, string> = {
  overdue: 'Overdue',
  behind: 'Behind plan',
  ending_soon: 'Ending soon',
  resource: 'Resourcing',
}

export function alertTypeLabel(t: AlertType): string {
  return ALERT_LABELS[t]
}

export function buildAlerts(
  programs: Program[],
  tasks: Task[],
  today = new Date(),
): Alert[] {
  const alerts: Alert[] = []
  for (const p of programs) {
    if (p.deprioritized || PARKED_STATUSES.has(p.status)) continue
    if (!p.startDate || !p.endDate) continue // backlog — nothing to alert on yet
    const pt = tasks.filter((t) => t.programId === p.id)
    const risk = deliveryRisk(p, pt, today)
    // Only surface genuinely at-risk or overdue work — keeps the view uncluttered.
    if (risk.level !== 'at_risk' && !risk.overdue) continue

    let message = risk.message
    if (risk.understaffed) {
      message += ` · understaffed ${p.currentResources}/${p.plannedResources}`
    }
    alerts.push({
      programId: p.id,
      programName: p.name,
      domainId: p.domainId,
      type: risk.overdue ? 'overdue' : 'behind',
      level: 'at_risk',
      message,
    })
  }
  return alerts
}
