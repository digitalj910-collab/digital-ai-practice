import {
  differenceInCalendarDays,
  parseISO,
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  isValid,
} from 'date-fns'

/** Parse an ISO yyyy-MM-dd string to a Date (local time, no TZ surprises). */
export function iso(d: string): Date {
  return parseISO(d)
}

export function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export function fmtDate(d: string): string {
  const parsed = parseISO(d)
  return isValid(parsed) ? format(parsed, 'd MMM yyyy') : d
}

export function fmtDateShort(d: string): string {
  const parsed = parseISO(d)
  return isValid(parsed) ? format(parsed, 'd MMM') : d
}

export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a))
}

/** Min & max ISO dates across a list of {startDate,endDate} items. */
export function dateSpan(
  items: { startDate: string; endDate: string }[],
): { start: Date; end: Date } | null {
  if (items.length === 0) return null
  let start = parseISO(items[0].startDate)
  let end = parseISO(items[0].endDate)
  for (const it of items) {
    const s = parseISO(it.startDate)
    const e = parseISO(it.endDate)
    if (s < start) start = s
    if (e > end) end = e
  }
  return { start, end }
}

export {
  differenceInCalendarDays,
  parseISO,
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  isValid,
}
