import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { CostLine, Domain, Program, RateCardEntry, RolePlanEntry, Task } from '../types'
import { programPercent } from './rag'

// Currency + working-time conventions. 1 SP = 1 person-day elsewhere in the app,
// so labour cost = headcount × day-rate × working days. ~5 working days per 7.
export const CURRENCY = 'CA$'
const WORKING_RATIO = 5 / 7

/** Default vendor/role rate card (currency units per person-day). Editable by admins. */
export const DEFAULT_RATE_CARD: RateCardEntry[] = [
  { role: 'Project Manager', dayRate: 800 },
  { role: 'Architect', dayRate: 950 },
  { role: 'Developer', dayRate: 600 },
  { role: 'Engineer', dayRate: 550 },
]

/** Format a currency amount compactly (e.g. £1.2m, £850k, £4,500). */
export function fmtMoney(n: number): string {
  const v = Math.round(n)
  if (Math.abs(v) >= 1_000_000) return `${CURRENCY}${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}m`
  if (Math.abs(v) >= 10_000) return `${CURRENCY}${Math.round(v / 1000)}k`
  return `${CURRENCY}${v.toLocaleString()}`
}

/** Working days across a program's calendar span (min 0). 0 when unscheduled. */
export function workingDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0
  const cal = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1
  return Math.max(0, Math.round(cal * WORKING_RATIO))
}

/** Average day-rate across the card — used for quick cost estimates (estimator/calculator). */
export function blendedDayRate(rateCard: RateCardEntry[]): number {
  if (rateCard.length === 0) return 0
  return Math.round(rateCard.reduce((a, r) => a + r.dayRate, 0) / rateCard.length)
}

function rateFor(role: string, rateCard: RateCardEntry[]): number {
  return rateCard.find((r) => r.role === role)?.dayRate ?? blendedDayRate(rateCard)
}

/**
 * A rate card, or a resolver that returns the right card for a given domain id.
 * Passing a resolver lets a roll-up use each domain's own rate card.
 */
export type RateCardSource = RateCardEntry[] | ((domainId: string) => RateCardEntry[])
function resolveCard(src: RateCardSource, domainId: string | undefined): RateCardEntry[] {
  return typeof src === 'function' ? src(domainId ?? '') : src
}

/**
 * The staffing plan used for costing: the program's explicit rolePlan if set,
 * otherwise a sensible mix synthesized from its planned headcount — so budgets
 * stay tied to the capacity plan without needing per-program data entry.
 */
export function effectiveRolePlan(program: Program): RolePlanEntry[] {
  if (program.rolePlan && program.rolePlan.length) return program.rolePlan
  const n = program.plannedResources ?? 0
  if (n <= 0) return []
  const pm = n >= 3 ? 1 : 0
  const architect = n >= 5 ? 1 : 0
  const rest = Math.max(0, n - pm - architect)
  const developer = Math.ceil(rest * 0.6)
  const engineer = rest - developer
  return [
    ...(pm ? [{ role: 'Project Manager', count: pm }] : []),
    ...(architect ? [{ role: 'Architect', count: architect }] : []),
    ...(developer ? [{ role: 'Developer', count: developer }] : []),
    ...(engineer ? [{ role: 'Engineer', count: engineer }] : []),
  ]
}

export function laborCost(program: Program, src: RateCardSource): number {
  const rateCard = resolveCard(src, program.domainId)
  const days = workingDays(program.startDate, program.endDate)
  const plan = effectiveRolePlan(program)
  return Math.round(plan.reduce((a, r) => a + r.count * rateFor(r.role, rateCard) * days, 0))
}

export function otherTotal(program: Program): number {
  const lines: CostLine[] = program.otherCosts ?? []
  return Math.round(lines.reduce((a, l) => a + (l.amount || 0), 0))
}

export interface ProgramBudget {
  estimated: number // labour + other (bottom-up "what we start with")
  labor: number
  other: number
  approved: number // fund granted (defaults to estimate)
  spent: number // actuals (override) or derived from % complete
  forecast: number // projected cost at completion (burn-rate)
  variance: number // approved − forecast (positive = under budget)
  percentComplete: number
  overBudget: boolean
  hasPlan: boolean
}

/** Full budget picture for one program. */
export function programBudget(program: Program, tasks: Task[], rateCard: RateCardSource): ProgramBudget {
  const labor = laborCost(program, rateCard)
  const other = otherTotal(program)
  const estimated = labor + other
  const approved = program.approvedBudget ?? estimated
  const pct = programPercent(program, tasks)
  const spent = program.spentOverride ?? Math.round((estimated * pct) / 100)
  const forecast = pct > 0 ? Math.round(spent / (pct / 100)) : estimated
  const variance = approved - forecast
  return {
    estimated,
    labor,
    other,
    approved,
    spent,
    forecast,
    variance,
    percentComplete: pct,
    overBudget: forecast > approved + 0.5,
    hasPlan: (program.rolePlan?.length ?? 0) > 0 || other > 0 || program.approvedBudget != null,
  }
}

export interface BudgetRollup {
  allocated: number // top-down fund (domain.budget, or Σ domain funds at portfolio level)
  estimated: number
  approved: number
  spent: number
  forecast: number
  variance: number // allocated − forecast
  overBudget: boolean
}

function sumPrograms(programs: Program[], tasks: Task[], rateCard: RateCardSource) {
  return programs.reduce(
    (acc, p) => {
      const b = programBudget(p, tasks.filter((t) => t.programId === p.id), rateCard)
      acc.estimated += b.estimated
      acc.approved += b.approved
      acc.spent += b.spent
      acc.forecast += b.forecast
      return acc
    },
    { estimated: 0, approved: 0, spent: 0, forecast: 0 },
  )
}

/** Budget roll-up for one domain (its fund vs its programs). */
export function domainBudget(
  domain: Domain,
  programs: Program[],
  tasks: Task[],
  rateCard: RateCardSource,
): BudgetRollup {
  const mine = programs.filter((p) => p.domainId === domain.id)
  const s = sumPrograms(mine, tasks, rateCard)
  const allocated = domain.budget ?? s.approved
  return {
    allocated,
    ...s,
    variance: allocated - s.forecast,
    overBudget: s.forecast > allocated + 0.5,
  }
}

/** Portfolio roll-up across all domains (Vanessa's view). */
export function portfolioBudget(
  domains: Domain[],
  programs: Program[],
  tasks: Task[],
  rateCard: RateCardSource,
): BudgetRollup {
  const s = sumPrograms(programs, tasks, rateCard)
  const allocated = domains.reduce((a, d) => a + (d.budget ?? 0), 0) || s.approved
  return {
    allocated,
    ...s,
    variance: allocated - s.forecast,
    overBudget: s.forecast > allocated + 0.5,
  }
}
