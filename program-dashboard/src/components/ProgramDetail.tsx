import { useMemo, useState } from 'react'
import { GitBranch, Landmark, Lock, MessageSquarePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  canComment,
  canDeleteTask,
  canDeleteUpdate,
  canEditDomain,
  canEditUpdate,
  canSeeBudget,
  isAdmin,
  useStore,
} from '../store/useStore'
import { programPercent } from '../lib/rag'
import { deliveryRisk, resourceUtilization, RISK_META } from '../lib/metrics'
import { forecast } from '../lib/forecast'
import { CURRENCY, effectiveRolePlan, fmtMoney, programBudget } from '../lib/budget'
import { PRIORITY_LABELS } from '../types'
import { fmtDate, toIso } from '../lib/dates'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { uid } from '../lib/id'
import { Button, Field, Modal, ProgressBar, RagBadge, StatusBadge, inputClass } from './ui'
import { Gantt } from './Gantt'
import { ProgramForm, TaskForm } from './forms'
import { UpdateCard, UpdateForm } from './updates'
import { Snapshot } from './Snapshot'
import { programSummary } from '../lib/summary'
import type { Program, ScopeChange, StatusUpdate, Task } from '../types'

export function ProgramDetail({ programId }: { programId: string }) {
  const program = useStore((s) => s.programs.find((p) => p.id === programId))
  const domain = useStore((s) => s.domains.find((d) => d.id === program?.domainId))
  const allTasks = useStore((s) => s.tasks)
  const allUpdates = useStore((s) => s.updates)
  const allStatusChanges = useStore((s) => s.statusChanges)
  const user = useStore((s) => s.currentUser)
  const deleteTask = useStore((s) => s.deleteTask)
  const deleteUpdate = useStore((s) => s.deleteUpdate)
  const updateProgram = useStore((s) => s.updateProgram)
  const allComments = useStore((s) => s.comments)
  const allEdits = useStore((s) => s.updateEdits)
  const addComment = useStore((s) => s.addComment)
  const deleteComment = useStore((s) => s.deleteComment)
  const rateCard = useStore((s) => s.rateCard)
  const cardsByDomain = useStore((s) => s.rateCardsByDomain)

  const [editProgram, setEditProgram] = useState(false)
  const [taskForm, setTaskForm] = useState<{ open: boolean; task?: Task }>({ open: false })
  const [updateForm, setUpdateForm] = useState<{ open: boolean; existing?: StatusUpdate }>({
    open: false,
  })
  const [scopeFormOpen, setScopeFormOpen] = useState(false)

  // Derive in-render (not in the selector) to keep the store snapshot stable.
  const tasks = useMemo(
    () => allTasks.filter((t) => t.programId === programId),
    [allTasks, programId],
  )
  const updates = useMemo(
    () => allUpdates.filter((u) => u.programId === programId),
    [allUpdates, programId],
  )
  const sorted = useMemo(
    () => [...tasks].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [tasks],
  )
  const history = useMemo(
    () =>
      allStatusChanges
        .filter((c) => c.programId === programId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [allStatusChanges, programId],
  )

  if (!program || !domain) return <p className="text-slate-500">Program not found.</p>

  const canEdit = canEditDomain(user, program.domainId)
  const canEditU = canEditUpdate(user, program.domainId)
  const canDeleteU = canDeleteUpdate(user, program.domainId)
  const canDelete = canDeleteTask(user, program)
  const progress = programPercent(program, tasks)
  const risk = deliveryRisk(program, tasks)
  const util = resourceUtilization(program)
  const fc = forecast(program, tasks)
  const budget = programBudget(program, tasks, cardsByDomain[program.domainId] ?? rateCard)
  const staffing = effectiveRolePlan(program)

  // ---- Baseline & scope ----
  const baseline = program.baseline
  const scopeChanges = [...(program.scopeChanges ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const slipDays = baseline
    ? differenceInCalendarDays(parseISO(program.endDate), parseISO(baseline.endDate))
    : 0

  const lockBaseline = () =>
    updateProgram(program.id, {
      baseline: {
        startDate: program.startDate,
        endDate: program.endDate,
        estimatedPoints: program.estimatedPoints,
        lockedAt: new Date().toISOString(),
        lockedBy: user.name,
      },
    })
  const clearBaseline = () => updateProgram(program.id, { baseline: undefined })
  const addScopeChange = (sc: { note: string; newEndDate?: string; addedPoints?: number }) => {
    const rec: ScopeChange = { id: uid('sc'), date: toIso(new Date()), author: user.name, ...sc }
    const patch: Partial<Program> = { scopeChanges: [...(program.scopeChanges ?? []), rec] }
    if (sc.newEndDate) patch.endDate = sc.newEndDate
    updateProgram(program.id, patch)
    setScopeFormOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-10 w-1.5 rounded-full" style={{ background: domain.color }} />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{program.name}</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {domain.name} · Owner: {program.owner}
              </p>
              {program.description && (
                <p className="mt-2 max-w-2xl text-sm text-slate-600">{program.description}</p>
              )}
            </div>
          </div>
          {canEdit && (
            <Button variant="secondary" onClick={() => setEditProgram(true)}>
              <Pencil size={15} />
              Edit program
            </Button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <RagBadge rag={program.ragStatus} />
            <StatusBadge status={program.status} />
            {baseline && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                <Landmark size={12} /> Baselined
              </span>
            )}
            {scopeChanges.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                <GitBranch size={12} /> Scope changed ×{scopeChanges.length}
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500">
            {program.startDate && program.endDate ? (
              <>{fmtDate(program.startDate)} – {fmtDate(program.endDate)}</>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Backlog — not scheduled</span>
            )}
          </div>
          <div className="flex min-w-48 flex-1 items-center gap-3">
            <ProgressBar value={progress} color={domain.color} />
            <span className="text-sm font-medium text-slate-700">{progress}%</span>
          </div>
        </div>
      </div>

      <Snapshot title="Project snapshot" lines={programSummary(program, tasks, updates)} />

      {/* Delivery & resourcing */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Delivery risk
          </div>
          <div className="mt-1.5">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${RISK_META[risk.level].badge}`}
            >
              {RISK_META[risk.level].label}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{risk.message}</p>
          <p className="mt-1 text-xs text-slate-400">
            {risk.actualPct}% done vs {risk.expectedPct}% expected by today
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Resources
          </div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900">
            {program.currentResources ?? '—'}
            <span className="text-base font-normal text-slate-400">
              {' / '}
              {program.plannedResources ?? '—'} planned
            </span>
          </div>
          {util != null && <div className="mt-0.5 text-sm text-slate-500">{util}% of plan</div>}
          {risk.suggestResources && risk.understaffed && (
            <div className="mt-2 inline-block rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
              Consider adding resources
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Priority
          </div>
          <div className="mt-1.5 text-lg font-semibold text-slate-900">
            {program.priority ? PRIORITY_LABELS[program.priority] : '—'}
          </div>
          {program.deprioritized && (
            <div className="mt-2">
              <span className="inline-block rounded-lg bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">
                Deprioritized{program.deprioritizedDate ? ` · ${fmtDate(program.deprioritizedDate)}` : ''}
              </span>
              {program.deprioritizedReason && (
                <p className="mt-1.5 text-xs text-slate-500">{program.deprioritizedReason}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Forecast */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Forecast (story points)
          </h2>
          {fc.hasData && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                fc.onTime ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {fc.onTime ? 'On track to plan' : `${fc.sprintsLate} sprint${fc.sprintsLate === 1 ? '' : 's'} late`}
            </span>
          )}
        </div>
        {fc.hasData ? (
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Fc label="Story points" value={`${fc.completedSP} / ${fc.totalSP}`} sub={`${fc.remainingSP} SP remaining`} />
            <Fc label="Team velocity" value={`${fc.velocity} SP/sprint`} sub={`${fc.engineers} eng × 13`} />
            <Fc
              label="Remaining"
              value={`${fc.remainingSprints} sprint${fc.remainingSprints === 1 ? '' : 's'}`}
              sub={`≈ ${(fc.remainingSprints ?? 0) * 3} weeks`}
            />
            <Fc
              label="Forecast finish"
              value={fc.forecastEnd ? fmtDate(fc.forecastEnd) : '—'}
              sub={`planned ${fmtDate(fc.plannedEnd)}`}
            />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">
            Add story points to the tasks (or a high-level estimate + team size on the program) to
            forecast the finish date.
          </p>
        )}
      </div>

      {/* Gantt */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Detailed plan</h2>
            <p className="text-sm text-slate-500">
              Optional — break this program into tasks and milestones for a full Gantt.
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setTaskForm({ open: true })}>
              <Plus size={16} />
              Add task
            </Button>
          )}
        </div>
        <Gantt tasks={sorted} program={program} color={domain.color} statusNote={history[0]?.note} />
      </section>

      {/* Task table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Task</th>
              <th className="px-4 py-3 font-semibold">Assignee</th>
              <th className="px-4 py-3 font-semibold">Dates</th>
              <th className="px-4 py-3 font-semibold">Pts</th>
              <th className="px-4 py-3 font-semibold">Progress</th>
              {canEdit && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {t.milestone ? '◆ ' : ''}
                  {t.name}
                </td>
                <td className="px-4 py-3 text-slate-500">{t.assignee || '—'}</td>
                <td className="px-4 py-3 text-slate-500">
                  {t.milestone ? fmtDate(t.startDate) : `${fmtDate(t.startDate)} – ${fmtDate(t.endDate)}`}
                </td>
                <td className="px-4 py-3 text-slate-500">{t.storyPoints || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={t.percentComplete} color={domain.color} className="w-24" />
                    <span className="w-9 text-xs text-slate-500">{t.percentComplete}%</span>
                  </div>
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setTaskForm({ open: true, task: t })}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Edit task"
                      >
                        <Pencil size={15} />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete task "${t.name}"?`)) deleteTask(t.id)
                          }}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete task"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="px-4 py-8 text-center text-slate-400">
                  No tasks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Budget — Admin + Leadership only */}
      {canSeeBudget(user) && (
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Budget</h2>
          <p className="text-sm text-slate-500">
            What we start with vs. where we'll finish. Set the approved fund, other costs and resourcing
            in “Edit program”.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: 'Estimated', value: fmtMoney(budget.estimated) },
            { label: 'Approved', value: fmtMoney(budget.approved) },
            { label: `Spent (${budget.percentComplete}%)`, value: fmtMoney(budget.spent) },
            { label: 'Forecast', value: fmtMoney(budget.forecast), over: budget.overBudget },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">{s.label}</div>
              <div className={`mt-0.5 text-lg font-bold ${s.over ? 'text-red-600' : 'text-slate-800'}`}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className={`rounded-xl border p-3 text-sm ${budget.variance >= 0 ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800' : 'border-red-200 bg-red-50/50 text-red-800'}`}>
          {budget.variance >= 0 ? (
            <>On budget — forecast is <strong>{fmtMoney(budget.variance)}</strong> under the approved fund of {fmtMoney(budget.approved)}.</>
          ) : (
            <>Over budget — forecast exceeds the {fmtMoney(budget.approved)} fund by <strong>{fmtMoney(-budget.variance)}</strong>.</>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Cost build-up ({CURRENCY})</div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
            <span>Labour <strong className="text-slate-800">{fmtMoney(budget.labor)}</strong></span>
            <span>Other <strong className="text-slate-800">{fmtMoney(budget.other)}</strong></span>
            <span className="text-slate-400">Staffing: {staffing.length ? staffing.map((r) => `${r.count} ${r.role}`).join(' · ') : '—'}</span>
          </div>
        </div>
      </section>
      )}

      {/* Baseline & scope */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Plan baseline &amp; scope</h2>
            <p className="text-sm text-slate-500">
              Lock the agreed plan, then track scope changes against it — the original plan is always kept.
            </p>
          </div>
          {canEdit && baseline && (
            <Button variant="secondary" onClick={() => setScopeFormOpen(true)}>
              <GitBranch size={15} /> Add scope change
            </Button>
          )}
        </div>

        {!program.startDate || !program.endDate ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
            This program is in the <strong>Backlog</strong>. Set a start and end date (Edit program) to
            schedule it — then you can lock a baseline.
          </div>
        ) : !baseline ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-4">
            <div className="max-w-xl text-sm text-slate-600">
              <span className="font-medium text-slate-800">Not baselined yet.</span> Lock the current plan
              ({fmtDate(program.startDate)} – {fmtDate(program.endDate)}) once it's agreed, so slippage
              and scope changes are measured against the original.
            </div>
            {canEdit && (
              <Button onClick={lockBaseline}>
                <Lock size={15} /> Lock baseline
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-800">
                <Landmark size={15} /> Baselined {fmtDate(baseline.lockedAt.slice(0, 10))} by {baseline.lockedBy}
              </span>
              {isAdmin(user) && (
                <button
                  onClick={clearBaseline}
                  className="text-xs text-slate-400 hover:text-red-600 hover:underline"
                >
                  Clear baseline
                </button>
              )}
            </div>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <div className="text-xs text-slate-500">Originally planned</div>
                <div className="font-medium text-slate-800">
                  {fmtDate(baseline.startDate)} – {fmtDate(baseline.endDate)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Current plan</div>
                <div className="font-medium text-slate-800">
                  {fmtDate(program.startDate)} – {fmtDate(program.endDate)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Delivery vs. baseline</div>
                <div
                  className={`font-semibold ${
                    slipDays > 0 ? 'text-red-600' : slipDays < 0 ? 'text-emerald-600' : 'text-slate-600'
                  }`}
                >
                  {slipDays === 0
                    ? 'On the original date'
                    : slipDays > 0
                      ? `${slipDays} days later`
                      : `${-slipDays} days earlier`}
                </div>
              </div>
            </div>
          </div>
        )}

        {scopeChanges.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Scope changes ({scopeChanges.length})
            </div>
            <ol className="space-y-2">
              {scopeChanges.map((sc) => (
                <li key={sc.id} className="flex gap-2.5 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <GitBranch size={12} />
                  </span>
                  <div>
                    <div className="text-slate-700">{sc.note}</div>
                    <div className="text-xs text-slate-400">
                      {fmtDate(sc.date)} · {sc.author}
                      {sc.newEndDate ? ` · moved delivery to ${fmtDate(sc.newEndDate)}` : ''}
                      {sc.addedPoints ? ` · +${sc.addedPoints} SP` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {/* Status change history (audit trail) */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Status history</h2>
          <p className="text-sm text-slate-500">
            Every status change is logged with the reason given at the time.
          </p>
        </div>
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
            No status changes recorded yet.
          </div>
        ) : (
          <ol className="space-y-2">
            {history.map((c) => (
              <li
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={c.fromStatus} />
                  <span className="text-slate-400">→</span>
                  <StatusBadge status={c.toStatus} />
                  <span className="ml-auto text-xs text-slate-400">
                    {fmtDate(c.date)} · {c.author}
                  </span>
                </div>
                {c.note && <p className="mt-2 text-sm text-slate-600">{c.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Weekly updates */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Weekly updates</h2>
          {canEdit && (
            <Button onClick={() => setUpdateForm({ open: true })}>
              <MessageSquarePlus size={16} />
              Add update
            </Button>
          )}
        </div>
        {updates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-400">
            No updates yet.
          </div>
        ) : (
          <div className="space-y-2">
            {[...updates]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((u) => (
                <UpdateCard
                  key={u.id}
                  update={u}
                  program={program}
                  domain={domain}
                  comments={allComments.filter((c) => c.updateId === u.id)}
                  edits={allEdits.filter((e) => e.updateId === u.id)}
                  currentUserName={user.name}
                  currentUserRole={user.role}
                  canComment={canComment(user)}
                  onAddComment={(text) =>
                    addComment({
                      updateId: u.id,
                      author: user.name,
                      role: user.role,
                      text,
                      date: new Date().toISOString(),
                    })
                  }
                  onDeleteComment={(id) => deleteComment(id)}
                  onEdit={canEditU ? () => setUpdateForm({ open: true, existing: u }) : undefined}
                  onDelete={canDeleteU ? () => deleteUpdate(u.id) : undefined}
                />
              ))}
          </div>
        )}
      </section>

      {editProgram && (
        <ProgramForm
          open={editProgram}
          onClose={() => setEditProgram(false)}
          domainId={program.domainId}
          existing={program}
        />
      )}
      {taskForm.open && (
        <TaskForm
          open={taskForm.open}
          onClose={() => setTaskForm({ open: false })}
          programId={programId}
          existing={taskForm.task}
          siblings={tasks}
        />
      )}
      {updateForm.open && (
        <UpdateForm
          open={updateForm.open}
          onClose={() => setUpdateForm({ open: false })}
          programId={programId}
          existing={updateForm.existing}
        />
      )}
      {scopeFormOpen && (
        <ScopeChangeForm
          open={scopeFormOpen}
          onClose={() => setScopeFormOpen(false)}
          currentEnd={program.endDate}
          onSave={addScopeChange}
        />
      )}
    </div>
  )
}

/** Small form to log a mid-flight scope change (note + optional new end date / points). */
function ScopeChangeForm({
  open,
  onClose,
  currentEnd,
  onSave,
}: {
  open: boolean
  onClose: () => void
  currentEnd: string
  onSave: (sc: { note: string; newEndDate?: string; addedPoints?: number }) => void
}) {
  const [note, setNote] = useState('')
  const [newEndDate, setNewEndDate] = useState(currentEnd)
  const [addedPoints, setAddedPoints] = useState('')
  const valid = note.trim().length > 0

  const save = () => {
    if (!valid) return
    onSave({
      note: note.trim(),
      newEndDate: newEndDate && newEndDate !== currentEnd ? newEndDate : undefined,
      addedPoints: addedPoints ? Math.max(0, Number(addedPoints) || 0) : undefined,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Add scope change" maxWidth="max-w-lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Log added scope. This drops a dated marker on the timeline; if you move the delivery date,
          the bar extends while the original baseline stays put.
        </p>
        <Field label="What changed?">
          <textarea
            className={inputClass}
            rows={2}
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Added multi-currency support at business request."
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="New delivery date" hint="Blank / unchanged = same date.">
            <input
              type="date"
              className={inputClass}
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
            />
          </Field>
          <Field label="Added story points" hint="Optional.">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={addedPoints}
              onChange={(e) => setAddedPoints(e.target.value)}
              placeholder="e.g. 20"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid}>
            Log scope change
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function Fc({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}
