import type { Program } from '../types'

/**
 * A program's stage is derived from its dates: with both a start and end date it
 * is "scheduled" (shown on the Gantt); missing either, it is "backlog" (staged,
 * not on any timeline yet).
 */
export type ProgramStage = 'backlog' | 'scheduled'

export function isScheduled(p: Pick<Program, 'startDate' | 'endDate'>): boolean {
  return Boolean(p.startDate && p.endDate)
}

export function isBacklog(p: Pick<Program, 'startDate' | 'endDate'>): boolean {
  return !isScheduled(p)
}

export function programStage(p: Pick<Program, 'startDate' | 'endDate'>): ProgramStage {
  return isScheduled(p) ? 'scheduled' : 'backlog'
}

/** Priority sort order for backlog lists (high → low, then unset). */
export const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }
export function byPriority(a: Program, b: Program): number {
  return (PRIORITY_ORDER[a.priority ?? 'z'] ?? 3) - (PRIORITY_ORDER[b.priority ?? 'z'] ?? 3)
}
