import type { Program, RagStatus, Task } from '../types'

export const RAG_COLORS: Record<RagStatus, string> = {
  green: '#16a34a',
  amber: '#f59e0b',
  red: '#dc2626',
}

export const RAG_LABELS: Record<RagStatus, string> = {
  green: 'On track',
  amber: 'At risk',
  red: 'Off track',
}

/** Tailwind classes for a soft RAG badge (bg + text). */
export const RAG_BADGE: Record<RagStatus, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
}

/**
 * Completion across a program's tasks (0-100, rounded). Story-point-weighted
 * when the tasks carry points; otherwise a simple average of task %.
 */
export function programProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0
  const totalSP = tasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0)
  if (totalSP > 0) {
    const done = tasks.reduce((acc, t) => acc + (t.storyPoints || 0) * (t.percentComplete || 0) / 100, 0)
    return Math.round((done / totalSP) * 100)
  }
  const sum = tasks.reduce((acc, t) => acc + (t.percentComplete || 0), 0)
  return Math.round(sum / tasks.length)
}

/**
 * Overall progress for a program: averaged from its tasks when it has any,
 * otherwise the manually-entered value (high-level, no-subtask programs).
 */
export function programPercent(program: Program, tasks: Task[]): number {
  if (tasks.length > 0) return programProgress(tasks)
  return Math.max(0, Math.min(100, Math.round(program.percentComplete ?? 0)))
}

/**
 * Roll a set of programs up to a single RAG for a domain: red if any red,
 * else amber if any amber, else green.
 */
export function rollupRag(programs: Program[]): RagStatus {
  if (programs.some((p) => p.ragStatus === 'red')) return 'red'
  if (programs.some((p) => p.ragStatus === 'amber')) return 'amber'
  return 'green'
}
