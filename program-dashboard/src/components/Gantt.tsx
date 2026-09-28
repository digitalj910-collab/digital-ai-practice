import { useMemo, useState, type ReactNode } from 'react'
import { eachWeekOfInterval } from 'date-fns'
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
import { PROGRAM_STATUS_LABELS, type Program, type Task } from '../types'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { useIsMobile } from '../lib/useIsMobile'

interface GanttProps {
  tasks: Task[]
  /** The program — used to draw a status-change marker on the timeline. */
  program?: Program
  /** Latest status-change reason, shown in the marker tooltip. */
  statusNote?: string
  /** Accent color (usually the domain color) for bars and milestones. */
  color?: string
  today?: Date
}

const LEFT_WIDTH = 260
const ROW_H = 44
const BAR_H = 22
const MONTH_BAND = 26
const WEEK_BAND = 26
const HEADER_H = MONTH_BAND + WEEK_BAND

const RANGE_PRESETS: { label: string; days: number }[] = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 182 },
  { label: '1Y', days: 365 },
  { label: '18M', days: 550 },
  { label: '2Y', days: 730 },
]

// Program-status event markers (blocked / on-hold / cancelled / …).
const STATUS_MARKERS: Record<string, { color: string; glyph: string }> = {
  blocked: { color: '#dc2626', glyph: '!' },
  on_hold: { color: '#f59e0b', glyph: '‖' },
  cancelled: { color: '#64748b', glyph: '✕' },
  postponed: { color: '#6366f1', glyph: '»' },
  descoped: { color: '#94a3b8', glyph: '−' },
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function Gantt({ tasks, program, statusNote, color = '#2563eb', today = new Date() }: GanttProps) {
  const [dayWidth, setDayWidth] = useState<number | null>(null)
  const isMobile = useIsMobile()
  const labelWidth = isMobile ? 120 : LEFT_WIDTH

  const model = useMemo(() => {
    if (tasks.length === 0) return null

    // Timeline range padded to whole months.
    let min = parseISO(tasks[0].startDate)
    let max = parseISO(tasks[0].endDate)
    for (const t of tasks) {
      const s = parseISO(t.startDate)
      const e = parseISO(t.endDate)
      if (s < min) min = s
      if (e > max) max = e
    }
    const rangeStart = startOfMonth(min)
    const rangeEnd = endOfMonth(max)
    const totalDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1

    const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd })
    const weeks = eachWeekOfInterval(
      { start: rangeStart, end: rangeEnd },
      { weekStartsOn: 1 },
    )
    return { rangeStart, rangeEnd, totalDays, months, weeks }
  }, [tasks])

  // Default day width fits the timeline to a comfortable width.
  const effectiveDayWidth = useMemo(() => {
    if (!model) return 12
    if (dayWidth != null) return dayWidth
    const fitted = 1080 / model.totalDays
    return Math.max(5, Math.min(28, fitted))
  }, [model, dayWidth])

  if (!model) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
        No tasks yet — add tasks or import from Excel to see the timeline.
      </div>
    )
  }

  const { rangeStart, totalDays, months, weeks } = model
  const dw = effectiveDayWidth
  const timelineWidth = totalDays * dw
  const bodyHeight = tasks.length * ROW_H
  const svgHeight = HEADER_H + bodyHeight + 8

  const xFor = (dateStr: string) =>
    differenceInCalendarDays(parseISO(dateStr), rangeStart) * dw

  const todayIso = toIso(today)
  const todayX = xFor(todayIso)
  const todayInRange = todayX >= 0 && todayX <= timelineWidth

  const rowY = (i: number) => HEADER_H + i * ROW_H
  const taskIndex = new Map(tasks.map((t, i) => [t.id, i]))

  const zoom = (factor: number) =>
    setDayWidth(Math.max(4, Math.min(64, dw * factor)))
  const applyPreset = (days: number) =>
    setDayWidth(Math.max(2, Math.min(64, 1040 / days)))

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="font-medium text-slate-700">
            {format(rangeStart, 'MMM yyyy')} – {format(model.rangeEnd, 'MMM yyyy')}
          </span>
          <LegendItem swatch={<span className="h-2.5 w-4 rounded" style={{ background: color }} />} label="Task" />
          <LegendItem
            swatch={
              <span
                className="inline-block h-2.5 w-2.5 rotate-45"
                style={{ background: color }}
              />
            }
            label="Milestone"
          />
          <LegendItem swatch={<span className="h-3 w-0.5 bg-red-500" />} label="Today" />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.days)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                title={`Fit about ${p.label} across the view`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => zoom(1 / 1.35)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              title="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={() => zoom(1.35)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              title="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Fixed task-name column */}
        <div className="shrink-0 border-r border-slate-200" style={{ width: labelWidth }}>
          <div
            className="flex items-end px-2.5 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:px-4"
            style={{ height: HEADER_H }}
          >
            Task
          </div>
          {tasks.map((t) => (
            <div
              key={t.id}
              className="flex flex-col justify-center border-t border-slate-100 px-2.5 sm:px-4"
              style={{ height: ROW_H }}
            >
              <span className="truncate text-sm font-medium text-slate-800" title={t.name}>
                {t.milestone ? '◆ ' : ''}
                {t.name}
              </span>
              {t.assignee && (
                <span className="truncate text-xs text-slate-400">{t.assignee}</span>
              )}
            </div>
          ))}
        </div>

        {/* Scrollable timeline */}
        <div className="thin-scroll flex-1 overflow-x-auto">
          <svg width={timelineWidth} height={svgHeight} className="block">
            <defs>
              <marker
                id="dep-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
            </defs>

            {/* Month + week header */}
            {months.map((m) => {
              const x = differenceInCalendarDays(m, rangeStart) * dw
              const w = differenceInCalendarDays(endOfMonth(m), m) * dw + dw
              return (
                <g key={m.toISOString()}>
                  <rect x={x} y={0} width={w} height={MONTH_BAND} fill="#f8fafc" />
                  <line x1={x} y1={0} x2={x} y2={svgHeight} stroke="#e2e8f0" strokeWidth={1} />
                  <text
                    x={x + 6}
                    y={MONTH_BAND - 8}
                    fontSize={11}
                    fontWeight={600}
                    fill="#475569"
                  >
                    {w > 60 ? format(m, 'MMMM yyyy') : format(m, 'MMM')}
                  </text>
                </g>
              )
            })}

            {weeks.map((wk) => {
              const x = differenceInCalendarDays(wk, rangeStart) * dw
              if (x < 0) return null
              return (
                <g key={wk.toISOString()}>
                  <line
                    x1={x}
                    y1={MONTH_BAND}
                    x2={x}
                    y2={svgHeight}
                    stroke="#f1f5f9"
                    strokeWidth={1}
                  />
                  {dw >= 12 && (
                    <text x={x + 3} y={HEADER_H - 8} fontSize={10} fill="#94a3b8">
                      {format(wk, 'd')}
                    </text>
                  )}
                </g>
              )
            })}

            <line
              x1={0}
              y1={HEADER_H}
              x2={timelineWidth}
              y2={HEADER_H}
              stroke="#e2e8f0"
              strokeWidth={1}
            />

            {/* Row separators */}
            {tasks.map((_, i) => (
              <line
                key={i}
                x1={0}
                y1={rowY(i)}
                x2={timelineWidth}
                y2={rowY(i)}
                stroke="#f1f5f9"
                strokeWidth={1}
              />
            ))}

            {/* Dependency connectors (drawn under bars) */}
            {tasks.map((t, i) =>
              t.predecessorIds.map((pid) => {
                const pi = taskIndex.get(pid)
                if (pi == null) return null
                const pred = tasks[pi]
                const fromX = xFor(pred.endDate) + dw
                const fromY = rowY(pi) + ROW_H / 2
                const toX = xFor(t.startDate)
                const toY = rowY(i) + ROW_H / 2
                const midX = Math.max(fromX + 8, toX - 8)
                const path = `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX - 2}`
                return (
                  <path
                    key={`${pid}-${t.id}`}
                    d={path}
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth={1.5}
                    markerEnd="url(#dep-arrow)"
                  />
                )
              }),
            )}

            {/* Bars & milestones */}
            {tasks.map((t, i) => {
              const cy = rowY(i) + ROW_H / 2
              if (t.milestone) {
                const x = xFor(t.startDate)
                const s = 9
                return (
                  <g key={t.id}>
                    <rect
                      x={x - s}
                      y={cy - s}
                      width={s * 2}
                      height={s * 2}
                      transform={`rotate(45 ${x} ${cy})`}
                      fill={color}
                      stroke="#fff"
                      strokeWidth={1.5}
                    />
                  </g>
                )
              }
              const x = xFor(t.startDate)
              const w = Math.max(differenceInCalendarDays(parseISO(t.endDate), parseISO(t.startDate)) * dw + dw, 6)
              const y = cy - BAR_H / 2
              const progW = (w * t.percentComplete) / 100
              return (
                <g key={t.id}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={BAR_H}
                    rx={5}
                    fill={hexToRgba(color, 0.22)}
                    stroke={hexToRgba(color, 0.5)}
                    strokeWidth={1}
                  />
                  <rect x={x} y={y} width={progW} height={BAR_H} rx={5} fill={color} />
                  {w > 42 && (
                    <text
                      x={x + w + 6}
                      y={cy + 4}
                      fontSize={11}
                      fill="#64748b"
                    >
                      {t.percentComplete}%
                    </text>
                  )}
                </g>
              )
            })}

            {/* Program status-change marker */}
            {program &&
              STATUS_MARKERS[program.status] &&
              program.statusDate &&
              (() => {
                const marker = STATUS_MARKERS[program.status]
                const smx = xFor(program.statusDate)
                if (smx < 0 || smx > timelineWidth) return null
                const reason = statusNote || program.deprioritizedReason
                const tip =
                  `Marked ${PROGRAM_STATUS_LABELS[program.status]} on ${fmtDate(program.statusDate)}` +
                  (reason ? `\nReason: ${reason}` : '')
                return (
                  <g>
                    <title>{tip}</title>
                    <line x1={smx} y1={HEADER_H} x2={smx} y2={svgHeight} stroke={marker.color} strokeWidth={1.5} strokeDasharray="4 2" />
                    <circle cx={smx} cy={HEADER_H} r={8} fill={marker.color} stroke="#fff" strokeWidth={1.5} />
                    <text x={smx} y={HEADER_H + 3.5} fontSize={10} fontWeight={700} fill="#fff" textAnchor="middle">
                      {marker.glyph}
                    </text>
                  </g>
                )
              })()}

            {/* Today line (drawn last, on top) */}
            {todayInRange && (
              <g>
                <line
                  x1={todayX}
                  y1={MONTH_BAND}
                  x2={todayX}
                  y2={svgHeight}
                  stroke="#ef4444"
                  strokeWidth={1.5}
                />
                <rect x={todayX - 18} y={MONTH_BAND} width={36} height={14} rx={3} fill="#ef4444" />
                <text
                  x={todayX}
                  y={MONTH_BAND + 10}
                  fontSize={9}
                  fontWeight={700}
                  fill="#fff"
                  textAnchor="middle"
                >
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

function LegendItem({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch}
      {label}
    </span>
  )
}
