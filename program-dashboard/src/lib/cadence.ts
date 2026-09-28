import { addDays, differenceInCalendarDays, parseISO, toIso } from './dates'

// The team's SAFe cadence. Anchored to PI-4 (starts 2026-08-12). Each PI is
// 70 days: three 3-week sprints + a 1-week IP. PI-5 (2026-10-21) confirms the
// 70-day rhythm, so we generate sprint bands across any visible range.

export interface SprintPeriod {
  pi: string
  label: string
  start: string
  end: string
  type: 'sprint' | 'ip'
}

const ANCHOR = parseISO('2026-08-12')
const ANCHOR_PI = 4
const PI_DAYS = 70
const SPRINT_DAYS = 21
const IP_DAYS = 7

/** Sprint + IP periods overlapping the given date range. */
export function sprintsForRange(rangeStart: Date, rangeEnd: Date): SprintPeriod[] {
  const startI = Math.floor(differenceInCalendarDays(rangeStart, ANCHOR) / PI_DAYS) - 1
  const endI = Math.ceil(differenceInCalendarDays(rangeEnd, ANCHOR) / PI_DAYS) + 1
  const out: SprintPeriod[] = []
  for (let i = startI; i <= endI; i++) {
    const piNum = ANCHOR_PI + i
    if (piNum < 1) continue
    let d = addDays(ANCHOR, i * PI_DAYS)
    for (let s = 1; s <= 3; s++) {
      out.push({
        pi: `PI-${piNum}`,
        label: `${piNum}.${s}`,
        start: toIso(d),
        end: toIso(addDays(d, SPRINT_DAYS - 1)),
        type: 'sprint',
      })
      d = addDays(d, SPRINT_DAYS)
    }
    out.push({
      pi: `PI-${piNum}`,
      label: `IP.${piNum}`,
      start: toIso(d),
      end: toIso(addDays(d, IP_DAYS - 1)),
      type: 'ip',
    })
  }
  const rs = toIso(rangeStart)
  const re = toIso(rangeEnd)
  return out.filter((sp) => sp.end >= rs && sp.start <= re)
}

/** The sprint containing a given date (or null). */
export function currentSprint(today = new Date()): SprintPeriod | null {
  const iso = toIso(today)
  return sprintsForRange(addDays(today, -80), addDays(today, 80)).find(
    (sp) => sp.start <= iso && iso <= sp.end,
  ) ?? null
}
