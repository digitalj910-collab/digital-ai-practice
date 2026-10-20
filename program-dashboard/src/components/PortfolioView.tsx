import { useMemo, useState } from 'react'
import { Download, GanttChartSquare } from 'lucide-react'
import { visibleDomainIds, useStore } from '../store/useStore'
import { exportPrograms } from '../lib/excel'
import { ProgramTimeline, type TimelineRow } from './ProgramTimeline'
import { hasMarker, MARKER_FILTERS, type MarkerKey } from '../lib/markers'
import { isScheduled } from '../lib/stage'
import { PROJECT_TYPE_COLORS, PROJECT_TYPE_LABELS, type ProjectType } from '../types'

export function PortfolioView({
  onOpenProgram,
}: {
  onOpenProgram?: (programId: string) => void
}) {
  const allDomains = useStore((s) => s.domains)
  const programs = useStore((s) => s.programs)
  const tasks = useStore((s) => s.tasks)
  const updates = useStore((s) => s.updates)
  const statusChanges = useStore((s) => s.statusChanges)
  const user = useStore((s) => s.currentUser)
  // Everyone sees only their own org subtree across the portfolio.
  const visIds = visibleDomainIds(user, allDomains.map((d) => d.id))
  const domains = visIds ? allDomains.filter((d) => visIds.includes(d.id)) : allDomains
  // Scoped to the subtree, and only scheduled work (backlog isn't on any timeline).
  const scopedPrograms = (
    visIds ? programs.filter((p) => visIds.includes(p.domainId)) : programs
  ).filter(isScheduled)

  // Filter the whole portfolio to a single project type at a time.
  const [typeFilter, setTypeFilter] = useState<ProjectType | 'all'>('all')
  // Filter to projects that have EVER carried a given marker (e.g. ever blocked).
  const [markerFilter, setMarkerFilter] = useState<MarkerKey | 'any'>('any')
  const typeCounts = useMemo(() => {
    const c: Record<ProjectType, number> = { enhancement: 0, initiative: 0, technical: 0 }
    for (const p of scopedPrograms) if (p.projectType) c[p.projectType]++
    return c
  }, [scopedPrograms])
  const TYPE_CHIPS: (ProjectType | 'all')[] = ['all', 'enhancement', 'initiative', 'technical']

  // Group rows: a domain header followed by its (type-filtered) programs. Domains
  // with no matching program for the active filter are skipped.
  const rows: TimelineRow[] = useMemo(() => {
    const out: TimelineRow[] = []
    for (const domain of domains) {
      const domainPrograms = programs.filter(
        (p) =>
          p.domainId === domain.id &&
          isScheduled(p) &&
          (typeFilter === 'all' || p.projectType === typeFilter) &&
          hasMarker(p, statusChanges, markerFilter),
      )
      if (domainPrograms.length === 0) continue
      // Agreed vs actual per manager: how many baselined projects now finish later
      // than the end date that was agreed.
      const baselined = domainPrograms.filter((p) => p.baseline)
      const behind = baselined.filter((p) => p.endDate > p.baseline!.endDate).length
      out.push({
        kind: 'group',
        label: domain.name,
        color: domain.color,
        sub: `${domain.managerName} · ${
          baselined.length === 0
            ? 'no agreed plan'
            : behind === 0
              ? 'all on plan'
              : `${behind} of ${baselined.length} late`
        }`,
        warn: behind > 0,
      })
      for (const program of domainPrograms) {
        out.push({ kind: 'program', program, color: domain.color })
      }
    }
    return out
  }, [domains, programs, typeFilter, markerFilter, statusChanges])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: '#c8102e14', color: '#c8102e' }}
          >
            <GanttChartSquare size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Portfolio Timeline</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Each manager's roadmap — the thin bar is the originally agreed plan, the solid bar is
              where it stands now.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {domains.map((d) => (
            <span key={d.id} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
              {d.name}
            </span>
          ))}
          <button
            onClick={() => exportPrograms(scopedPrograms, domains, tasks, 'portfolio-timeline.xlsx')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Project-type filter — one type at a time (same as the domain view). */}
      {scopedPrograms.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Filter by type:</span>
          {TYPE_CHIPS.map((t) => {
            const active = typeFilter === t
            const count = t === 'all' ? scopedPrograms.length : typeCounts[t]
            const color = t === 'all' ? '#475569' : PROJECT_TYPE_COLORS[t]
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active ? 'text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
                style={active ? { background: color, borderColor: color } : { borderColor: '#e2e8f0' }}
              >
                {t !== 'all' && (
                  <span className="h-2 w-2 rounded-full" style={{ background: active ? 'white' : color }} />
                )}
                {t === 'all' ? 'All' : PROJECT_TYPE_LABELS[t]}
                <span className={active ? 'opacity-80' : 'text-slate-400'}>{count}</span>
              </button>
            )
          })}
          <label className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            Ever flagged
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand-400"
              value={markerFilter}
              onChange={(e) => setMarkerFilter(e.target.value as MarkerKey | 'any')}
            >
              <option value="any">Any / all</option>
              {MARKER_FILTERS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <ProgramTimeline
        rows={rows}
        tasks={tasks}
        updates={updates}
        statusChanges={statusChanges}
        onOpenProgram={onOpenProgram}
        leftWidth={280}
      />
    </div>
  )
}
