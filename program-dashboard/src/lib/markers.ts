import {
  MARKED_STATUSES,
  PROGRAM_STATUS_LABELS,
  type Program,
  type ProgramStatus,
  type StatusChange,
} from '../types'

/** A timeline marker a project can carry — a "marked" status, or a scope change. */
export type MarkerKey = ProgramStatus | 'scope_change'

/**
 * Every marker a program has EVER carried — from its status-change history, its
 * current status, and any scope changes. Powers "show projects ever blocked"
 * style filters, where a project counts even if it isn't in that state now.
 */
export function programMarkers(program: Program, statusChanges: StatusChange[]): Set<MarkerKey> {
  const set = new Set<MarkerKey>()
  if (MARKED_STATUSES.includes(program.status)) set.add(program.status)
  for (const c of statusChanges) {
    if (c.programId === program.id && MARKED_STATUSES.includes(c.toStatus)) set.add(c.toStatus)
  }
  if ((program.scopeChanges?.length ?? 0) > 0) set.add('scope_change')
  return set
}

/** True when a program has ever carried the given marker (or filter is 'any'). */
export function hasMarker(
  program: Program,
  statusChanges: StatusChange[],
  filter: MarkerKey | 'any',
): boolean {
  if (filter === 'any') return true
  return programMarkers(program, statusChanges).has(filter)
}

/** Options for the marker-history filter control. */
export const MARKER_FILTERS: { key: MarkerKey; label: string }[] = [
  ...MARKED_STATUSES.map((s) => ({ key: s as MarkerKey, label: PROGRAM_STATUS_LABELS[s] })),
  { key: 'scope_change', label: 'Scope changed' },
]
