import { eachMonthOfInterval, format, parseISO } from './dates'
import type { MonthlyActual, MonthlyActualLine, Program, Task } from '../types'
import { programBudget, type RateCardSource } from './budget'

// Monthly budget reconciliation: planned vs. actual spend per program per month,
// on a CALENDAR fiscal year (Jan–Dec), split CapEx/OpEx and rolled up by domain
// and portfolio. Planned is the program's estimate spread evenly across the
// months its plan spans; actuals are entered manually per resource role.

export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** 'YYYY-MM' for a (year, monthIndex 0–11). */
export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

/** The 'YYYY-MM' keys a program's plan spans (inclusive), across all years. */
function programMonths(program: Program): string[] {
  if (!program.startDate || !program.endDate) return []
  const s = parseISO(program.startDate)
  const e = parseISO(program.endDate)
  if (e < s) return []
  return eachMonthOfInterval({ start: s, end: e }).map((d) => format(d, 'yyyy-MM'))
}

export interface MonthCell {
  planned: number
  actual: number
  capex: number
  opex: number
}
const emptyCell = (): MonthCell => ({ planned: 0, actual: 0, capex: 0, opex: 0 })

/** A fresh 12-slot Jan–Dec array. */
export function emptyMonths(): MonthCell[] {
  return Array.from({ length: 12 }, emptyCell)
}

export interface ReconTotals {
  planned: number
  actual: number
  variance: number
  capex: number
  opex: number
}

/** Sum a 12-month array into year totals (variance = planned − actual). */
export function totalsOf(months: MonthCell[]): ReconTotals {
  const t = months.reduce(
    (a, m) => {
      a.planned += m.planned
      a.actual += m.actual
      a.capex += m.capex
      a.opex += m.opex
      return a
    },
    { planned: 0, actual: 0, capex: 0, opex: 0 },
  )
  return { ...t, variance: t.planned - t.actual }
}

export interface ReconRow extends ReconTotals {
  id: string
  name: string
  domainId: string
  /** Jan–Dec cells for the report year. */
  months: MonthCell[]
}

/** Build a program's 12-month planned/actual row for a calendar year. */
export function reconcileProgram(
  program: Program,
  tasks: Task[],
  rateCard: RateCardSource,
  year: number,
): ReconRow {
  const months = emptyMonths()

  // Planned: spread the program's estimated cost evenly across every month its
  // plan spans (over its whole life), then keep the months that fall in `year`.
  const span = programMonths(program)
  if (span.length > 0) {
    const est = programBudget(program, tasks.filter((t) => t.programId === program.id), rateCard).estimated
    const per = est / span.length
    for (const key of span) {
      const [yy, mm] = key.split('-').map(Number)
      if (yy === year) months[mm - 1].planned += per
    }
  }

  // Actual: manually-entered resource-role lines for each month of this year.
  for (const ma of program.monthlyActuals ?? []) {
    const [yy, mm] = ma.month.split('-').map(Number)
    if (yy !== year || mm < 1 || mm > 12) continue
    const cell = months[mm - 1]
    for (const line of ma.lines) {
      cell.actual += line.cost
      if (line.funding === 'capex') cell.capex += line.cost
      else cell.opex += line.cost
    }
  }

  return { id: program.id, name: program.name, domainId: program.domainId, months, ...totalsOf(months) }
}

/** Add two 12-month arrays cell-by-cell (for roll-ups). */
export function addMonths(a: MonthCell[], b: MonthCell[]): MonthCell[] {
  return a.map((m, i) => ({
    planned: m.planned + b[i].planned,
    actual: m.actual + b[i].actual,
    capex: m.capex + b[i].capex,
    opex: m.opex + b[i].opex,
  }))
}

/** Roll up several rows into one 12-month array. */
export function sumRows(rows: ReconRow[]): MonthCell[] {
  return rows.reduce((acc, r) => addMonths(acc, r.months), emptyMonths())
}

/** Years that have data (a program span or entered actuals), for the year picker. */
export function reconYears(programs: Program[], currentYear: number): number[] {
  const set = new Set<number>([currentYear])
  for (const p of programs) {
    for (const key of programMonths(p)) set.add(Number(key.split('-')[0]))
    for (const ma of p.monthlyActuals ?? []) set.add(Number(ma.month.split('-')[0]))
  }
  return [...set].sort((a, b) => a - b)
}

/** The actual entry for a program+month (undefined if none entered yet). */
export function actualsFor(program: Program, month: string): MonthlyActual | undefined {
  return (program.monthlyActuals ?? []).find((m) => m.month === month)
}

/**
 * Upsert a month's actual lines into a program's list, dropping empty rows (and
 * the whole month when it ends up empty). Returns a new, month-sorted list.
 */
export function setMonthlyActual(
  list: MonthlyActual[] | undefined,
  month: string,
  lines: MonthlyActualLine[],
): MonthlyActual[] {
  const rest = (list ?? []).filter((m) => m.month !== month)
  const clean = lines.filter((l) => l.role.trim() && l.cost !== 0)
  const next = clean.length ? [...rest, { month, lines: clean }] : rest
  return next.sort((a, b) => a.month.localeCompare(b.month))
}
