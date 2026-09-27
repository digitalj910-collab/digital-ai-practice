import { addDays, differenceInCalendarDays, parseISO, toIso } from './dates'
import type { Program, Task } from '../types'

// Team convention: 1 SP = 1 day; each engineer delivers ~13 SP per 3-week sprint
// (15 working days minus ~2 for overhead). Team velocity = engineers × 13.
export const PER_ENGINEER_VELOCITY = 13
export const SPRINT_WEEKS = 3
export const DEFAULT_BUFFER_PCT = 0.25
const WEEKS_PER_MONTH = 4.345

// T-shirt sizes for high-level planning conversations. Each maps to a story-point
// value that feeds the same velocity/buffer math — so a whiteboard "it's a Large"
// converts straight into a sprint/date estimate. Deliberately coarse (roughly
// doubling), with 1 SP = 1 day.
export interface TShirtSize {
  size: string
  points: number
  note: string
}

// The DEFAULT scale — the team can override the point values in the UI (saved to
// Supabase via app_settings). Used until a saved scale loads.
export const TSHIRT_SIZES: TShirtSize[] = [
  { size: 'XS', points: 8, note: 'Quick win' },
  { size: 'S', points: 20, note: 'Small feature' },
  { size: 'M', points: 40, note: 'Feature' },
  { size: 'L', points: 80, note: 'Epic' },
  { size: 'XL', points: 160, note: 'Initiative' },
  { size: 'XXL', points: 320, note: 'Program' },
]

export function totalPoints(program: Program, tasks: Task[]): number {
  const taskSP = tasks.reduce((a, t) => a + (t.storyPoints || 0), 0)
  return taskSP > 0 ? taskSP : program.estimatedPoints ?? 0
}

export function completedPoints(program: Program, tasks: Task[]): number {
  const taskSP = tasks.reduce((a, t) => a + (t.storyPoints || 0), 0)
  if (taskSP > 0) {
    return Math.round(
      tasks.reduce((a, t) => a + (t.storyPoints || 0) * (t.percentComplete || 0) / 100, 0),
    )
  }
  const est = program.estimatedPoints ?? 0
  return Math.round((est * (program.percentComplete ?? 0)) / 100)
}

export function teamSize(program: Program): number {
  return program.currentResources || program.plannedResources || 0
}

export interface Forecast {
  totalSP: number
  completedSP: number
  remainingSP: number
  engineers: number
  velocity: number
  remainingSprints: number | null
  forecastEnd: string | null
  plannedEnd: string
  sprintsLate: number
  onTime: boolean
  hasData: boolean
}

export function forecast(program: Program, tasks: Task[], today = new Date()): Forecast {
  const totalSP = totalPoints(program, tasks)
  const completedSP = completedPoints(program, tasks)
  const remainingSP = Math.max(0, totalSP - completedSP)
  const engineers = teamSize(program)
  const velocity = engineers * PER_ENGINEER_VELOCITY
  const plannedEnd = program.endDate
  const hasData = totalSP > 0 && engineers > 0

  if (!hasData) {
    return {
      totalSP,
      completedSP,
      remainingSP,
      engineers,
      velocity,
      remainingSprints: null,
      forecastEnd: null,
      plannedEnd,
      sprintsLate: 0,
      onTime: true,
      hasData: false,
    }
  }

  const remainingSprints = Math.ceil(remainingSP / velocity)
  const forecastEndDate = addDays(today, remainingSprints * SPRINT_WEEKS * 7)
  const overDays = plannedEnd ? differenceInCalendarDays(forecastEndDate, parseISO(plannedEnd)) : 0
  const sprintsLate = overDays > 0 ? Math.ceil(overDays / (SPRINT_WEEKS * 7)) : 0

  return {
    totalSP,
    completedSP,
    remainingSP,
    engineers,
    velocity,
    remainingSprints,
    forecastEnd: toIso(forecastEndDate),
    plannedEnd,
    sprintsLate,
    onTime: sprintsLate === 0,
    hasData: true,
  }
}

export interface CapacityEstimate {
  points: number
  bufferedPoints: number
  weeks: number
  sprints: number
  /** People needed to finish the (buffered) work within the deadline. */
  peopleNeeded: number
  haveNow?: number
  /** peopleNeeded - haveNow (positive = short). */
  gap?: number
}

/**
 * The inverse of `estimate`: given an amount of work and a deadline, how many
 * people do you need? Used by the Capacity Calculator for "can we hit this date,
 * and with how many people?" conversations.
 */
export function capacityEstimate(
  points: number,
  weeks: number,
  bufferPct = DEFAULT_BUFFER_PCT,
  haveNow?: number,
): CapacityEstimate {
  const sprints = Math.max(1, Math.round(weeks / SPRINT_WEEKS))
  const bufferedPoints = Math.round(points * (1 + bufferPct))
  // velocity needed per sprint = bufferedPoints / sprints; each person delivers
  // PER_ENGINEER_VELOCITY, so people = ceil(neededVelocity / perPerson).
  const peopleNeeded = Math.max(1, Math.ceil(bufferedPoints / (sprints * PER_ENGINEER_VELOCITY)))
  const gap = haveNow != null ? peopleNeeded - haveNow : undefined
  return { points, bufferedPoints, weeks, sprints, peopleNeeded, haveNow, gap }
}

export interface Estimate {
  points: number
  engineers: number
  velocity: number
  sprints: number
  weeks: number
  months: number
  bufferedPoints: number
  bufferedSprints: number
  bufferedWeeks: number
  bufferedMonths: number
  startDate?: string
  targetDate?: string
}

/** Early, high-level estimate for business planning (with a contingency buffer). */
export function estimate(
  points: number,
  engineers: number,
  bufferPct = DEFAULT_BUFFER_PCT,
  startDate?: string,
): Estimate {
  const velocity = Math.max(1, engineers * PER_ENGINEER_VELOCITY)
  const sprints = Math.max(1, Math.ceil(points / velocity))
  const bufferedPoints = Math.round(points * (1 + bufferPct))
  const bufferedSprints = Math.max(1, Math.ceil(bufferedPoints / velocity))
  const weeks = sprints * SPRINT_WEEKS
  const bufferedWeeks = bufferedSprints * SPRINT_WEEKS
  return {
    points,
    engineers,
    velocity,
    sprints,
    weeks,
    months: Math.round((weeks / WEEKS_PER_MONTH) * 10) / 10,
    bufferedPoints,
    bufferedSprints,
    bufferedWeeks,
    bufferedMonths: Math.round((bufferedWeeks / WEEKS_PER_MONTH) * 10) / 10,
    startDate,
    targetDate: startDate ? toIso(addDays(parseISO(startDate), bufferedWeeks * 7)) : undefined,
  }
}
