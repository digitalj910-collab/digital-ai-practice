import { useEffect, useMemo, useRef, useState } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { eachDayOfInterval, eachWeekOfInterval, getQuarter } from 'date-fns'
import {
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  fmtDate,
  format,
  parseISO,
  startOfMonth,
  toIso,
} from '../lib/dates'
import { programPercent } from '../lib/rag'
import { sprintsForRange } from '../lib/cadence'
import { useIsMobile } from '../lib/useIsMobile'
import {
  PROGRAM_STATUS_LABELS,
  PROJECT_TYPE_COLORS,
  PROJECT_TYPE_LABELS,
  type Program,
  type StatusChange,
  type StatusUpdate,
  type Task,
} from '../types'

// One bar per program on a shared timeline. Used for the domain view (flat,
// single color) and the portfolio view (grouped by domain, colored per domain).
export type TimelineRow =
  | { kind: 'group'; label: string; color: string; sub?: string; warn?: boolean }
  | { kind: 'program'; program: Program; color: string }

const ROW_H = 40
const GROUP_H = 34
const MONTH_BAND = 28
const SPRINT_BAND = 16

// Statuses that render the bar muted (parked / stopped work).
const MUTED_STATUSES = new Set(['cancelled', 'descoped', 'on_hold', 'postponed'])

// Statuses that place a dated symbol on the timeline (color + glyph).
const STATUS_MARKERS: Record<string, { color: string; glyph: string }> = {
  blocked: { color: '#dc2626', glyph: '!' },
  on_hold: { color: '#f59e0b', glyph: '‖' },
  cancelled: { color: '#64748b', glyph: '✕' },
  postponed: { color: '#6366f1', glyph: '»' },
  descoped: { color: '#94a3b8', glyph: '−' },
}

// Timeline scale — ONE control spanning fine detail (Day) to a wide horizon (2Y).
// Each option sets the header resolution AND a matching zoom (pixels per day);
// the +/- buttons still fine-tune. Ordered so the visible span grows Day -> 2Y.
// (Restores the old 6M/1Y/18M/2Y range presets, merged with the day/week/month/
// quarter granularity toggle Vanessa asked for.)
type Granularity = 'day' | 'week' | 'month' | 'quarter'
type ScaleKey = Granularity | '6m' | '1y' | '18m' | '2y'
const SCALE: { key: ScaleKey; label: string; gran: Granularity; dayWidth: number }[] = [
  { key: 'day', label: 'Day', gran: 'day', dayWidth: 34 },
  { key: 'week', label: 'Week', gran: 'week', dayWidth: 16 },
  { key: 'month', label: 'Month', gran: 'month', dayWidth: 9.5 },
  { key: 'quarter', label: 'Quarter', gran: 'quarter', dayWidth: 6 },
  { key: '6m', label: '6M', gran: 'month', dayWidth: 5.2 },
  { key: '1y', label: '1Y', gran: 'quarter', dayWidth: 2.85 },
  { key: '18m', label: '18M', gran: 'quarter', dayWidth: 1.9 },
  { key: '2y', label: '2Y', gran: 'quarter', dayWidth: 1.4 },
]

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(
    h.slice(4, 6),
    16,
  )}, ${alpha})`
}

interface StatusInfo {
  blocked: boolean
  muted: boolean
  marker?: { color: string; glyph: string }
  tip: string
}

function statusInfo(p: Program, blocker?: string, note?: string): StatusInfo {
  const label = PROGRAM_STATUS_LABELS[p.status]
  const marker = STATUS_MARKERS[p.status]
  const parts = [`${p.name} — ${label}`]
  if (marker && p.statusDate) parts.push(`Marked ${label} on ${fmtDate(p.statusDate)}`)
  if (blocker) parts.push(`Blocker: ${blocker}`)
  const reason = note || p.deprioritizedReason
  if (reason) parts.push(`Reason: ${reason}`)
  return {
    blocked: p.status === 'blocked',
    muted: MUTED_STATUSES.has(p.status),
    marker,
    tip: parts.join('\n'),
  }
}

export function ProgramTimeline({
  rows,
  tasks,
  updates,
  statusChanges,
  today = new Date(),
  leftWidth = 260,
  colorBy = 'row',
  onOpenProgram,
}: {
  rows: TimelineRow[]
  tasks: Task[]
  updates?: StatusUpdate[]
  statusChanges?: StatusChange[]
  today?: Date
  leftWidth?: number
  /** 'row' colours each bar by its row colour (domain); 'type' colours bars by
   *  project type — used in the single-domain view so type reads at a glance. */
  colorBy?: 'row' | 'type'
  onOpenProgram?: (programId: string) => void
}) {
  const [dayWidth, setDayWidth] = useState<number | null>(null)
  const [scaleKey, setScaleKey] = useState<ScaleKey>('6m')
  const [showCadence, setShowCadence] = useState(false)
  const isMobile = useIsMobile()
  const labelWidth = isMobile ? 120 : leftWidth
  const scaleDef = SCALE.find((s) => s.key === scaleKey) ?? SCALE[2]
  const gran = scaleDef.gran
  const scrollRef = useRef<HTMLDivElement>(null)

  const programs = useMemo(
    () => rows.flatMap((r) => (r.kind === 'program' ? [r.program] : [])),
    [rows],
  )

  // Legend of only the status markers actually present in these rows, so the
  // glyphs on the bars are self-explanatory.
  const presentMarkers = useMemo(() => {
    const seen = new Set<string>(programs.map((p) => p.status))
    return Object.entries(STATUS_MARKERS)
      .filter(([status]) => seen.has(status))
      .map(([status, m]) => ({
        status,
        ...m,
        label: PROGRAM_STATUS_LABELS[status as keyof typeof PROGRAM_STATUS_LABELS],
      }))
  }, [programs])

  // Project types present in these rows, for the small legend below the header.
  const presentTypes = useMemo(() => {
    const seen = new Set(programs.map((p) => p.projectType).filter(Boolean) as string[])
    return (['enhancement', 'initiative', 'technical'] as const).filter((t) => seen.has(t))
  }, [programs])

  // Latest weekly blocker per program, surfaced on the timeline via hover.
  const blockerByProgram = useMemo(() => {
    const map = new Map<string, string>()
    const sorted = [...(updates ?? [])].sort((a, b) => a.date.localeCompare(b.date))
    for (const u of sorted) if (u.programId && u.blockers?.trim()) map.set(u.programId, u.blockers.trim())
    return map
  }, [updates])

  // Latest status-change reason per program, shown on the marker tooltip.
  const noteByProgram = useMemo(() => {
    const map = new Map<string, string>()
    const sorted = [...(statusChanges ?? [])].sort((a, b) => a.date.localeCompare(b.date))
    for (const c of sorted) if (c.note?.trim()) map.set(c.programId, c.note.trim())
    return map
  }, [statusChanges])

  const model = useMemo(() => {
    if (programs.length === 0) return null
    let min = parseISO(programs[0].startDate)
    let max = parseISO(programs[0].endDate)
    for (const p of programs) {
      const s = parseISO(p.startDate)
      const e = parseISO(p.endDate)
      if (s < min) min = s
      if (e > max) max = e
    }
    const rangeStart = startOfMonth(min)
    const rangeEnd = endOfMonth(max)
    const totalDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1
    const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd })
    return { rangeStart, rangeEnd, totalDays, months }
  }, [programs])

  // Zoom follows the granularity's default until the user fine-tunes with +/−.
  const dw = useMemo(() => {
    if (!model) return 6
    if (dayWidth != null) return dayWidth
    return scaleDef.dayWidth
  }, [model, dayWidth, scaleDef])

  // On load (and whenever the scale changes) scroll so TODAY is in view, ~a third
  // in from the left — otherwise the timeline opens parked at the far past.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !model) return
    const todayX = differenceInCalendarDays(parseISO(toIso(today)), model.rangeStart) * dw
    const totalW = model.totalDays * dw
    if (todayX < 0 || todayX > totalW) return
    el.scrollLeft = Math.max(0, todayX - el.clientWidth / 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, dw, scaleKey])

  if (!model) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
        No programs to display yet.
      </div>
    )
  }

  const { rangeStart, totalDays, months } = model
  const timelineWidth = totalDays * dw
  const headerH = MONTH_BAND + (showCadence ? SPRINT_BAND : 0)
  const sprints = showCadence ? sprintsForRange(rangeStart, model.rangeEnd) : []

  // y offsets (group headers are shorter than program rows).
  let acc = headerH
  const rowY: number[] = []
  const rowH: number[] = []
  for (const r of rows) {
    rowY.push(acc)
    const h = r.kind === 'group' ? GROUP_H : ROW_H
    rowH.push(h)
    acc += h
  }
  const svgHeight = acc + 6

  const xFor = (d: string) => differenceInCalendarDays(parseISO(d), rangeStart) * dw
  const todayX = xFor(toIso(today))
  const todayInRange = todayX >= 0 && todayX <= timelineWidth
  const zoom = (factor: number) => setDayWidth(Math.max(1.2, Math.min(60, dw * factor)))
  const applyScale = (key: ScaleKey) => {
    const def = SCALE.find((s) => s.key === key)!
    setScaleKey(key)
    setDayWidth(def.dayWidth)
  }

  // Sub-unit gridlines for the finer granularities.
  const weekTicks =
    gran === 'week' ? eachWeekOfInterval({ start: rangeStart, end: model.rangeEnd }, { weekStartsOn: 1 }) : []
  const dayTicks =
    gran === 'day' ? eachDayOfInterval({ start: rangeStart, end: model.rangeEnd }) : []

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <span className="text-xs font-medium text-slate-700">
          {format(rangeStart, 'MMM yyyy')} – {format(model.rangeEnd, 'MMM yyyy')}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCadence((v) => !v)}
            className={`rounded-md border px-2 py-1 text-xs font-medium ${
              showCadence
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title="Show PI / sprint cadence"
          >
            PI/Sprint
          </button>
          <div className="flex flex-wrap items-center gap-0.5 rounded-md border border-slate-200 p-0.5">
            {SCALE.map((o) => (
              <button
                key={o.key}
                onClick={() => applyScale(o.key)}
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  scaleKey === o.key
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title={`${o.label} view`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => zoom(1 / 1.35)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" title="Zoom out">
              <ZoomOut size={16} />
            </button>
            <button onClick={() => zoom(1.35)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" title="Zoom in">
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
      </div>

      {presentMarkers.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-1.5 text-[11px] text-slate-500">
          <span className="font-medium text-slate-400">Status markers:</span>
          {presentMarkers.map((m) => (
            <span key={m.status} className="flex items-center gap-1">
              <span
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white"
                style={{ background: m.color }}
              >
                {m.glyph}
              </span>
              {m.label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-[2px] bg-red-500" /> Today
          </span>
        </div>
      )}

      {presentTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-1.5 text-[11px] text-slate-500">
          <span className="font-medium text-slate-400">Project type:</span>
          {presentTypes.map((t) => (
            <span key={t} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: PROJECT_TYPE_COLORS[t] }} />
              {PROJECT_TYPE_LABELS[t]}
            </span>
          ))}
        </div>
      )}

      {(programs.some((p) => p.baseline) || programs.some((p) => (p.scopeChanges?.length ?? 0) > 0)) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-1.5 text-[11px] text-slate-500">
          <span className="font-medium text-slate-400">Plan:</span>
          {programs.some((p) => p.baseline) && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-[3px] w-4 rounded-sm" style={{ background: 'rgba(99,102,241,0.6)' }} />
              Originally planned
            </span>
          )}
          {programs.some((p) => (p.scopeChanges?.length ?? 0) > 0) && (
            <span className="flex items-center gap-1">
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ background: '#f59e0b' }}>
                +
              </span>
              Scope change
            </span>
          )}
        </div>
      )}

      <div className="flex">
        {/* Left labels */}
        <div className="shrink-0 border-r border-slate-200" style={{ width: labelWidth }}>
          <div style={{ height: headerH }} />
          {rows.map((r, i) =>
            r.kind === 'group' ? (
              <div
                key={`g-${r.label}`}
                className="flex items-center gap-2 px-2.5 sm:px-4"
                style={{ height: rowH[i], background: hexToRgba(r.color, 0.06) }}
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
                <span className="text-sm font-semibold text-slate-800">{r.label}</span>
                {r.sub && (
                  <span className={`truncate text-xs ${r.warn ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
                    {r.sub}
                  </span>
                )}
              </div>
            ) : (
              (() => {
                const info = statusInfo(
                  r.program,
                  blockerByProgram.get(r.program.id),
                  noteByProgram.get(r.program.id),
                )
                return (
                  <button
                    key={r.program.id}
                    onClick={onOpenProgram ? () => onOpenProgram(r.program.id) : undefined}
                    title={info.tip}
                    className={`flex w-full items-center border-t border-slate-50 px-2.5 text-left sm:px-4 ${
                      onOpenProgram ? 'hover:bg-slate-50' : ''
                    }`}
                    style={{ height: rowH[i] }}
                  >
                    <span
                      className={`flex items-center gap-1.5 truncate text-sm ${
                        info.muted ? 'text-slate-400 line-through' : 'text-slate-700'
                      }`}
                    >
                      {info.marker && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: info.marker.color }}
                        />
                      )}
                      {r.program.projectType && (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                          style={{ background: PROJECT_TYPE_COLORS[r.program.projectType] }}
                          title={PROJECT_TYPE_LABELS[r.program.projectType]}
                        />
                      )}
                      {r.program.name}
                    </span>
                  </button>
                )
              })()
            ),
          )}
        </div>

        {/* Timeline */}
        <div ref={scrollRef} className="thin-scroll flex-1 overflow-x-auto">
          <svg width={timelineWidth} height={svgHeight} className="block">
            {months.map((m, i) => {
              const x = differenceInCalendarDays(m, rangeStart) * dw
              const w = differenceInCalendarDays(endOfMonth(m), m) * dw + dw
              const isQuarterStart = m.getMonth() % 3 === 0
              return (
                <g key={m.toISOString()}>
                  <rect x={x} y={0} width={w} height={MONTH_BAND} fill="#f8fafc" />
                  <line
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={svgHeight}
                    stroke={gran === 'quarter' && !isQuarterStart ? '#f4f6f9' : '#eef2f6'}
                    strokeWidth={1}
                  />
                  {gran === 'quarter' ? (
                    (isQuarterStart || i === 0) && (
                      <text x={x + 5} y={MONTH_BAND - 9} fontSize={10} fontWeight={600} fill="#64748b">
                        Q{getQuarter(m)} {format(m, 'yyyy')}
                      </text>
                    )
                  ) : (
                    <text x={x + 5} y={MONTH_BAND - 9} fontSize={10} fontWeight={600} fill="#64748b">
                      {w > 46 ? format(m, 'MMM yyyy') : format(m, 'MMM')}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Sub-unit gridlines for finer granularities */}
            {weekTicks.map((wk) => {
              const x = differenceInCalendarDays(wk, rangeStart) * dw
              if (x <= 0) return null
              return <line key={`w${x}`} x1={x} y1={MONTH_BAND} x2={x} y2={svgHeight} stroke="#f1f5f9" strokeWidth={1} />
            })}
            {dayTicks.map((d) => {
              const x = differenceInCalendarDays(d, rangeStart) * dw
              return (
                <g key={`d${x}`}>
                  <line x1={x} y1={MONTH_BAND - 8} x2={x} y2={svgHeight} stroke="#f5f7fa" strokeWidth={1} />
                  {dw >= 13 && (
                    <text x={x + 2} y={MONTH_BAND - 1} fontSize={8} fill="#94a3b8">
                      {format(d, 'd')}
                    </text>
                  )}
                </g>
              )
            })}

            {/* PI / sprint cadence overlay */}
            {showCadence &&
              sprints.map((sp) => {
                const sx = xFor(sp.start)
                const ex = xFor(sp.end) + dw
                const isIp = sp.type === 'ip'
                return (
                  <g key={`${sp.pi}-${sp.label}`}>
                    {isIp && (
                      <rect
                        x={sx}
                        y={headerH}
                        width={ex - sx}
                        height={svgHeight - headerH}
                        fill="rgba(245,158,11,0.06)"
                      />
                    )}
                    <line
                      x1={sx}
                      y1={MONTH_BAND}
                      x2={sx}
                      y2={svgHeight}
                      stroke="#e2e8f0"
                      strokeWidth={1}
                      strokeDasharray={isIp ? '3 2' : undefined}
                    />
                    <rect
                      x={sx}
                      y={MONTH_BAND}
                      width={ex - sx}
                      height={SPRINT_BAND}
                      fill={isIp ? 'rgba(245,158,11,0.14)' : 'rgba(99,102,241,0.06)'}
                    />
                    {ex - sx > 20 && (
                      <text
                        x={(sx + ex) / 2}
                        y={MONTH_BAND + 11}
                        fontSize={9}
                        fontWeight={600}
                        fill={isIp ? '#b45309' : '#475569'}
                        textAnchor="middle"
                      >
                        {sp.label}
                      </text>
                    )}
                  </g>
                )
              })}
            {showCadence && (
              <line x1={0} y1={headerH} x2={timelineWidth} y2={headerH} stroke="#e2e8f0" strokeWidth={1} />
            )}

            {rows.map((r, i) => {
              const y = rowY[i]
              if (r.kind === 'group') {
                return (
                  <rect
                    key={`gb-${r.label}`}
                    x={0}
                    y={y}
                    width={timelineWidth}
                    height={rowH[i]}
                    fill={hexToRgba(r.color, 0.05)}
                  />
                )
              }
              const p = r.program
              const info = statusInfo(p, blockerByProgram.get(p.id))
              const typeColor = colorBy === 'type' && p.projectType ? PROJECT_TYPE_COLORS[p.projectType] : undefined
              const barColor = info.muted ? '#94a3b8' : (typeColor ?? r.color)
              const x = xFor(p.startDate)
              const w = Math.max(
                differenceInCalendarDays(parseISO(p.endDate), parseISO(p.startDate)) * dw + dw,
                6,
              )
              const barH = 18
              const by = y + (rowH[i] - barH) / 2
              const prog = programPercent(p, tasks.filter((t) => t.programId === p.id))
              // Baseline (originally-agreed plan) shown as a thin bar under the live bar.
              const bl = p.baseline
              const showBaseline = !!bl && (bl.startDate !== p.startDate || bl.endDate !== p.endDate)
              const blx = bl ? xFor(bl.startDate) : 0
              const blw = bl
                ? Math.max(differenceInCalendarDays(parseISO(bl.endDate), parseISO(bl.startDate)) * dw + dw, 6)
                : 0
              return (
                <g
                  key={p.id}
                  opacity={info.muted ? 0.6 : 1}
                  style={{ cursor: onOpenProgram ? 'pointer' : 'default' }}
                  onClick={onOpenProgram ? () => onOpenProgram(p.id) : undefined}
                >
                  <title>{`${info.tip}\n${prog}% complete · ${100 - prog}% remaining`}</title>
                  {showBaseline && (
                    <g>
                      {/* Original planned span, as a slim bar beneath the live bar. */}
                      <rect x={blx} y={by + barH + 1} width={blw} height={4} rx={2} fill="rgba(99,102,241,0.55)">
                        <title>{`Originally planned: ${fmtDate(bl!.startDate)} – ${fmtDate(bl!.endDate)}`}</title>
                      </rect>
                      {/* Dashed line at the originally-agreed end date — the live bar runs past it when late. */}
                      <line
                        x1={blx + blw}
                        y1={by - 3}
                        x2={blx + blw}
                        y2={by + barH + 7}
                        stroke="#6366f1"
                        strokeWidth={1.5}
                        strokeDasharray="2 2"
                      />
                    </g>
                  )}
                  <rect
                    x={x}
                    y={by}
                    width={w}
                    height={barH}
                    rx={4}
                    fill={hexToRgba(barColor, 0.25)}
                    stroke={info.blocked ? '#dc2626' : hexToRgba(barColor, 0.5)}
                    strokeWidth={info.blocked ? 1.5 : 1}
                  />
                  <rect x={x} y={by} width={(w * prog) / 100} height={barH} rx={4} fill={barColor} />
                  {info.marker &&
                    (() => {
                      const mx = p.statusDate ? xFor(p.statusDate) : x + 9
                      if (mx < -2) return null
                      return (
                        <g>
                          <circle cx={mx} cy={by + barH / 2} r={7} fill={info.marker.color} stroke="#fff" strokeWidth={1.5} />
                          <text x={mx} y={by + barH / 2 + 3.3} fontSize={9} fontWeight={700} fill="#fff" textAnchor="middle">
                            {info.marker.glyph}
                          </text>
                        </g>
                      )
                    })()}
                  {(p.scopeChanges ?? []).map((sc) => {
                    const sx = xFor(sc.date)
                    if (sx < -2) return null
                    return (
                      <g key={sc.id}>
                        <circle cx={sx} cy={by + barH / 2} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />
                        <text x={sx} y={by + barH / 2 + 3.3} fontSize={10} fontWeight={700} fill="#fff" textAnchor="middle">
                          +
                        </text>
                        <title>{`Scope change ${fmtDate(sc.date)}: ${sc.note}`}</title>
                      </g>
                    )
                  })}
                  {w > 40 && (
                    <text x={x + w + 5} y={by + barH - 5} fontSize={10} fill="#94a3b8">
                      {prog}%
                    </text>
                  )}
                </g>
              )
            })}

            {todayInRange && (
              <g>
                <line x1={todayX} y1={headerH} x2={todayX} y2={svgHeight} stroke="#ef4444" strokeWidth={1.5} />
                <rect x={todayX - 18} y={headerH} width={36} height={13} rx={3} fill="#ef4444" />
                <text x={todayX} y={headerH + 9} fontSize={8} fontWeight={700} fill="#fff" textAnchor="middle">
                  TODAY
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  )
}
