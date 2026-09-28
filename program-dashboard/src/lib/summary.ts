import { isAfter } from 'date-fns'
import type { Domain, Program, StatusUpdate, Task } from '../types'
import { PROGRAM_STATUS_LABELS } from '../types'
import { programPercent } from './rag'
import { deliveryRisk, portfolioMetrics } from './metrics'
import { fmtDateShort, parseISO } from './dates'

// Deterministic, on-device summaries — a readable briefing generated from the
// data (no external calls). Can be upgraded to a real Claude-powered agent
// later via a backend function.

const CLOSED = ['cancelled', 'descoped', 'completed']

function behindList(programs: Program[], tasks: Task[], today: Date, limit = 3) {
  return programs
    .filter((p) => !p.deprioritized && !CLOSED.includes(p.status))
    .map((p) => ({ p, r: deliveryRisk(p, tasks.filter((t) => t.programId === p.id), today) }))
    .filter((x) => x.r.level !== 'on_track')
    .sort((a, b) => b.r.gap - a.r.gap)
    .slice(0, limit)
}

function upcomingMilestones(tasks: Task[], today: Date, limit = 3) {
  return tasks
    .filter((t) => t.milestone && isAfter(parseISO(t.endDate), today))
    .sort((a, b) => a.endDate.localeCompare(b.endDate))
    .slice(0, limit)
}

export function portfolioSummary(
  programs: Program[],
  tasks: Task[],
  updates: StatusUpdate[],
  domains: Domain[],
  today = new Date(),
): string[] {
  const m = portfolioMetrics(programs, tasks, today)
  const lines: string[] = []
  lines.push(
    `${programs.length} programs across ${domains.length} areas — ${m.onTrack} on plan, ${m.watch} on watch, ${m.atRisk} at risk.`,
  )
  const blocked = programs.filter((p) => p.status === 'blocked')
  if (blocked.length) lines.push(`${blocked.length} blocked: ${blocked.map((p) => p.name).join(', ')}.`)
  lines.push(`Planning effectiveness ${m.planningEffectiveness}% — ${m.deprioritized} deprioritized.`)

  const behind = behindList(programs, tasks, today)
  if (behind.length) {
    lines.push(
      `Most behind plan: ${behind
        .map((x) => `${x.p.name} (${x.r.actualPct}% vs ${x.r.expectedPct}% expected)`)
        .join('; ')}.`,
    )
  }
  const ms = upcomingMilestones(tasks, today)
  if (ms.length) {
    lines.push(`Next milestones: ${ms.map((t) => `${t.name} (${fmtDateShort(t.endDate)})`).join('; ')}.`)
  }
  const recentBlockers = [...updates]
    .filter((u) => u.blockers?.trim())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2)
  if (recentBlockers.length) {
    lines.push(`Flagged this cycle: ${recentBlockers.map((u) => u.blockers).join(' • ')}.`)
  }
  return lines
}

export function domainSummary(
  domain: Domain,
  programs: Program[],
  tasks: Task[],
  updates: StatusUpdate[],
  today = new Date(),
): string[] {
  const dp = programs.filter((p) => p.domainId === domain.id)
  const lines: string[] = []
  lines.push(`${dp.length} programs in ${domain.name}, led by ${domain.managerName}.`)
  const blocked = dp.filter((p) => p.status === 'blocked')
  if (blocked.length) lines.push(`Blocked: ${blocked.map((p) => p.name).join(', ')}.`)

  const behind = behindList(dp, tasks, today)
  if (behind.length) {
    lines.push(
      `Behind plan: ${behind.map((x) => `${x.p.name} (${x.r.actualPct}% vs ${x.r.expectedPct}%)`).join('; ')}.`,
    )
  } else {
    lines.push('All active programs are tracking to plan.')
  }
  const dpIds = new Set(dp.map((p) => p.id))
  const ms = upcomingMilestones(
    tasks.filter((t) => dpIds.has(t.programId)),
    today,
    2,
  )
  if (ms.length) {
    lines.push(`Next milestones: ${ms.map((t) => `${t.name} (${fmtDateShort(t.endDate)})`).join('; ')}.`)
  }
  const blocker = [...updates]
    .filter((u) => !!u.programId && dpIds.has(u.programId) && u.blockers?.trim())
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  if (blocker) lines.push(`Latest blocker: ${blocker.blockers}`)
  return lines
}

export function programSummary(
  program: Program,
  tasks: Task[],
  updates: StatusUpdate[],
  today = new Date(),
): string[] {
  const pt = tasks.filter((t) => t.programId === program.id)
  const prog = programPercent(program, pt)
  const r = deliveryRisk(program, pt, today)
  const lines: string[] = []
  lines.push(
    `${PROGRAM_STATUS_LABELS[program.status]} · ${prog}% complete vs ${r.expectedPct}% expected by today.`,
  )
  lines.push(r.message + (r.suggestResources && r.understaffed ? ' — consider adding resources.' : '.'))
  if (program.plannedResources) {
    lines.push(`Resourcing: ${program.currentResources ?? 0} of ${program.plannedResources} planned.`)
  }
  const nextMs = upcomingMilestones(pt, today, 1)[0]
  if (nextMs) lines.push(`Next milestone: ${nextMs.name} (${fmtDateShort(nextMs.endDate)}).`)
  const latest = [...updates]
    .filter((u) => u.programId === program.id)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  if (latest?.progress) lines.push(`Latest: ${latest.progress}`)
  if (latest?.blockers) lines.push(`Blocker: ${latest.blockers}`)
  return lines
}
