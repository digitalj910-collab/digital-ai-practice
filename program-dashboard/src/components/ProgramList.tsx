import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  Calculator,
  CalendarPlus,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FolderKanban,
  Gauge,
  Inbox,
  Pencil,
  Plus,
  Receipt,
  Users,
} from 'lucide-react'
import { canEditDomain, canSeeBudget, isAdmin, useStore } from '../store/useStore'
import { byPriority, isBacklog, isScheduled } from '../lib/stage'
import { programPercent } from '../lib/rag'
import { exportPrograms } from '../lib/excel'
import { fmtDate } from '../lib/dates'
import { parseISO, isAfter } from 'date-fns'
import { Button, ProgressBar, RagBadge, StatusBadge } from './ui'
import { ProgramForm, DomainForm } from './forms'
import { ExcelImport } from './ExcelImport'
import { ProgramTimeline, type TimelineRow } from './ProgramTimeline'
import { Snapshot } from './Snapshot'
import { Estimator } from './Estimator'
import { CapacityCalculator } from './CapacityCalculator'
import { WeeklyCheckIn } from './WeeklyCheckIn'
import { RateCardModal } from './RateCardModal'
import { domainSummary } from '../lib/summary'
import { hasMarker, MARKER_FILTERS, type MarkerKey } from '../lib/markers'
import { PRIORITY_LABELS, PROJECT_TYPE_COLORS, PROJECT_TYPE_LABELS } from '../types'
import type { Program, ProjectType, Task } from '../types'

function nextMilestone(tasks: Task[], today = new Date()): Task | null {
  const upcoming = tasks
    .filter((t) => t.milestone && isAfter(parseISO(t.endDate), today))
    .sort((a, b) => a.endDate.localeCompare(b.endDate))
  return upcoming[0] ?? null
}

export function ProgramList({
  domainId,
  onOpenProgram,
}: {
  domainId: string
  onOpenProgram: (programId: string) => void
}) {
  const domain = useStore((s) => s.domains.find((d) => d.id === domainId))
  const allPrograms = useStore((s) => s.programs)
  const tasks = useStore((s) => s.tasks)
  const updates = useStore((s) => s.updates)
  const statusChanges = useStore((s) => s.statusChanges)
  const user = useStore((s) => s.currentUser)
  const tshirtSizes = useStore((s) => s.tshirtSizesByDomain[domainId] ?? s.tshirtSizes)

  const [showProgramForm, setShowProgramForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showDomainForm, setShowDomainForm] = useState(false)
  const [showEstimator, setShowEstimator] = useState(false)
  const [showCapacity, setShowCapacity] = useState(false)
  const [showRateCard, setShowRateCard] = useState(false)
  const [showCheckIn, setShowCheckIn] = useState(false)
  // A backlog item being scheduled (opens the form focused on adding dates).
  const [editProgram, setEditProgram] = useState<Program | undefined>(undefined)
  // Filter the view to a single project type at a time ('all' = show every type).
  const [typeFilter, setTypeFilter] = useState<ProjectType | 'all'>('all')
  // Filter to projects that have EVER carried a given marker (e.g. ever blocked).
  const [markerFilter, setMarkerFilter] = useState<MarkerKey | 'any'>('any')

  // Derive in-render (not in the selector) to keep the store snapshot stable.
  const programs = useMemo(
    () => allPrograms.filter((p) => p.domainId === domainId),
    [allPrograms, domainId],
  )
  // Scheduled (on a timeline) vs. backlog (no dates yet).
  const scheduledPrograms = useMemo(() => programs.filter(isScheduled), [programs])
  const backlogPrograms = useMemo(
    () => programs.filter(isBacklog).slice().sort(byPriority),
    [programs],
  )
  // Counts per project type (drives the filter chips) — over scheduled projects.
  const typeCounts = useMemo(() => {
    const c: Record<ProjectType, number> = { enhancement: 0, initiative: 0, technical: 0 }
    for (const p of scheduledPrograms) if (p.projectType) c[p.projectType]++
    return c
  }, [scheduledPrograms])
  const visiblePrograms = useMemo(
    () =>
      scheduledPrograms.filter(
        (p) =>
          (typeFilter === 'all' || p.projectType === typeFilter) &&
          hasMarker(p, statusChanges, markerFilter),
      ),
    [scheduledPrograms, typeFilter, markerFilter, statusChanges],
  )
  const timelineRows: TimelineRow[] = useMemo(
    () =>
      visiblePrograms.map((p) => ({
        kind: 'program',
        program: p,
        color: domain?.color ?? '#2563eb',
      })),
    [visiblePrograms, domain],
  )

  if (!domain) return <p className="text-slate-500">Domain not found.</p>

  const canEdit = canEditDomain(user, domainId)
  const TYPE_CHIPS: (ProjectType | 'all')[] = ['all', 'enhancement', 'initiative', 'technical']

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-sm"
            style={{ background: domain.color }}
          >
            {domain.name.charAt(0)}
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{domain.name}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
              <Users size={14} />
              {domain.managerName} · {programs.length} programs
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin(user) && (
            <Button variant="secondary" onClick={() => setShowDomainForm(true)}>
              <Pencil size={16} />
              Edit domain
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => exportPrograms(programs, [domain], tasks, `${domain.name}-programs.xlsx`)}
          >
            <Download size={16} />
            Export
          </Button>
          {canEdit && (
            <>
              <Button variant="secondary" onClick={() => setShowCheckIn(true)}>
                <ClipboardList size={16} />
                Weekly check-in
              </Button>
              <Button variant="secondary" onClick={() => setShowImport(true)}>
                <FileSpreadsheet size={16} />
                Import Excel
              </Button>
              <Button onClick={() => setShowProgramForm(true)}>
                <Plus size={16} />
                New program
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Planning tools — the same estimator, capacity and rate-card used for
          budgeting, one click away so project details can be leveraged while
          planning in this domain. Shown to anyone who can edit the domain. */}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Planning tools
          </span>
          <PlanningButton icon={<Calculator size={15} />} onClick={() => setShowEstimator(true)}>
            Delivery estimator
          </PlanningButton>
          <PlanningButton icon={<Gauge size={15} />} onClick={() => setShowCapacity(true)}>
            Capacity calculator
          </PlanningButton>
          {canSeeBudget(user) && (
            <PlanningButton icon={<Receipt size={15} />} onClick={() => setShowRateCard(true)}>
              Rate card
            </PlanningButton>
          )}
          <span className="ml-auto text-[11px] text-slate-400">
            This team's own {canSeeBudget(user) ? 'rates & plan settings' : 'plan settings'}
          </span>
        </div>
      )}

      <Snapshot title="Area snapshot" lines={domainSummary(domain, allPrograms, tasks, updates)} />

      {/* Project-type filter — one type at a time (scheduled projects only). */}
      {scheduledPrograms.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Filter by type:</span>
          {TYPE_CHIPS.map((t) => {
            const active = typeFilter === t
            const count = t === 'all' ? scheduledPrograms.length : typeCounts[t]
            const color = t === 'all' ? '#475569' : PROJECT_TYPE_COLORS[t]
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active ? 'text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
                style={
                  active
                    ? { background: color, borderColor: color }
                    : { borderColor: '#e2e8f0' }
                }
              >
                {t !== 'all' && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: active ? 'white' : color }}
                  />
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

      {visiblePrograms.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
          <ProgramTimeline
            rows={timelineRows}
            tasks={tasks}
            updates={updates}
            statusChanges={statusChanges}
            colorBy="type"
            onOpenProgram={onOpenProgram}
          />
        </section>
      )}

      {programs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 py-16 text-slate-400">
          <FolderKanban size={24} />
          <p className="text-sm">
            No programs in this domain yet.
            {canEdit && ' Add one or import from Excel to get started.'}
          </p>
        </div>
      ) : scheduledPrograms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
          No scheduled projects yet — everything is in the backlog below.
        </div>
      ) : visiblePrograms.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 py-16 text-slate-400">
          <FolderKanban size={24} />
          <p className="text-sm">
            No projects match these filters.{' '}
            <button
              onClick={() => {
                setTypeFilter('all')
                setMarkerFilter('any')
              }}
              className="font-medium text-brand-600 hover:underline"
            >
              Show all
            </button>
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visiblePrograms.map((p) => (
            <ProgramCard
              key={p.id}
              program={p}
              tasks={tasks.filter((t) => t.programId === p.id)}
              accent={domain.color}
              onClick={() => onOpenProgram(p.id)}
            />
          ))}
        </div>
      )}

      {/* Backlog — staged programs with no dates yet, sorted by priority. */}
      {backlogPrograms.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Inbox size={18} className="text-slate-400" />
            Backlog
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {backlogPrograms.length}
            </span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {backlogPrograms.map((p) => {
                const size = tshirtSizes.find((t) => t.points === p.estimatedPoints)?.size
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <button
                      onClick={() => onOpenProgram(p.id)}
                      className="min-w-40 flex-1 truncate text-left text-sm font-medium text-slate-800 hover:underline"
                    >
                      {p.name}
                    </button>
                    {p.projectType && <TypeBadge type={p.projectType} />}
                    <span className="w-16 shrink-0 text-xs text-slate-500">
                      {size ? `${size} · ` : ''}{p.estimatedPoints ? `${p.estimatedPoints} SP` : '—'}
                    </span>
                    <span
                      className={`w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-semibold ${
                        p.priority === 'high'
                          ? 'bg-red-50 text-red-700'
                          : p.priority === 'low'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {p.priority ? PRIORITY_LABELS[p.priority] : '—'}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => setEditProgram(p)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
                      >
                        <CalendarPlus size={13} />
                        Schedule
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}

      {showProgramForm && (
        <ProgramForm
          open={showProgramForm}
          onClose={() => setShowProgramForm(false)}
          domainId={domainId}
        />
      )}
      {editProgram && (
        <ProgramForm
          open={!!editProgram}
          onClose={() => setEditProgram(undefined)}
          domainId={domainId}
          existing={editProgram}
        />
      )}
      {showImport && (
        <ExcelImport open={showImport} onClose={() => setShowImport(false)} domain={domain} />
      )}
      {showDomainForm && (
        <DomainForm open={showDomainForm} onClose={() => setShowDomainForm(false)} existing={domain} />
      )}
      {showEstimator && (
        <Estimator
          open={showEstimator}
          onClose={() => setShowEstimator(false)}
          domainId={domainId}
          domainName={domain.name}
        />
      )}
      {showCapacity && (
        <CapacityCalculator
          open={showCapacity}
          onClose={() => setShowCapacity(false)}
          domainId={domainId}
          domainName={domain.name}
        />
      )}
      {showRateCard && (
        <RateCardModal
          open={showRateCard}
          onClose={() => setShowRateCard(false)}
          domainId={domainId}
          domainName={domain.name}
        />
      )}
      {showCheckIn && (
        <WeeklyCheckIn open={showCheckIn} onClose={() => setShowCheckIn(false)} domainId={domainId} />
      )}
    </div>
  )
}

function PlanningButton({
  icon,
  children,
  onClick,
}: {
  icon: ReactNode
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
    >
      <span className="text-slate-400">{icon}</span>
      {children}
    </button>
  )
}

/** A small coloured pill showing a program's project type. */
export function TypeBadge({ type }: { type: ProjectType }) {
  const color = PROJECT_TYPE_COLORS[type]
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: `${color}1a`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {PROJECT_TYPE_LABELS[type]}
    </span>
  )
}

function ProgramCard({
  program,
  tasks,
  accent,
  onClick,
}: {
  program: Program
  tasks: Task[]
  accent: string
  onClick: () => void
}) {
  const progress = programPercent(program, tasks)
  const milestone = nextMilestone(tasks)

  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{program.name}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{program.owner}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {program.projectType && <TypeBadge type={program.projectType} />}
          <RagBadge rag={program.ragStatus} />
        </div>
      </div>

      {program.description && (
        <p className="line-clamp-2 text-sm text-slate-500">{program.description}</p>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <StatusBadge status={program.status} />
          <span className="font-medium text-slate-700">{progress}%</span>
        </div>
        <ProgressBar value={progress} color={accent} />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {fmtDate(program.startDate)} – {fmtDate(program.endDate)}
        </span>
        {milestone && (
          <span className="flex items-center gap-1 text-slate-600">
            ◆ Next: {milestone.name} · {fmtDate(milestone.endDate)}
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center gap-1 text-sm font-medium text-slate-400 group-hover:text-slate-700">
        Open timeline
        <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}
