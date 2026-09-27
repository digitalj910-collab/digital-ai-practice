import { useState } from 'react'
import { Rocket, Trash2 } from 'lucide-react'
import type { Domain, Funding, Priority, Program, ProgramStatus, ProjectType, RagStatus, RolePlanEntry, Task } from '../types'
import { PROGRAM_STATUS_LABELS, PRIORITY_LABELS, PROJECT_TYPE_LABELS, FUNDING_LABELS, MARKED_STATUSES } from '../types'
import { canDeleteProgram, canSeeBudget, useStore } from '../store/useStore'
import { fmtDate, toIso } from '../lib/dates'
import { CURRENCY, effectiveRolePlan, fmtMoney, laborCost, otherTotal, teamHeadcount, teamVelocity } from '../lib/budget'
import { estimate } from '../lib/forecast'
import { RoleMixEditor } from './RoleMixEditor'
import { Button, Field, Modal, inputClass } from './ui'

const STATUS_OPTIONS = Object.keys(PROGRAM_STATUS_LABELS) as ProgramStatus[]
const RAG_OPTIONS: RagStatus[] = ['green', 'amber', 'red']
const RAG_TEXT: Record<RagStatus, string> = {
  green: 'Green — on track',
  amber: 'Amber — at risk',
  red: 'Red — off track',
}

// ---- Program form -------------------------------------------------------

export function ProgramForm({
  open,
  onClose,
  domainId,
  existing,
}: {
  open: boolean
  onClose: () => void
  domainId: string
  existing?: Program
}) {
  const addProgram = useStore((s) => s.addProgram)
  const updateProgram = useStore((s) => s.updateProgram)
  const deleteProgram = useStore((s) => s.deleteProgram)
  const addStatusChange = useStore((s) => s.addStatusChange)
  const user = useStore((s) => s.currentUser)
  const defaultCard = useStore((s) => s.rateCard)
  const cardsByDomain = useStore((s) => s.rateCardsByDomain)
  // Cost the kickoff estimate with this domain's own rate card when it has one.
  const rateCard = cardsByDomain[domainId] ?? defaultCard
  const defaultSizes = useStore((s) => s.tshirtSizes)
  const sizesByDomain = useStore((s) => s.tshirtSizesByDomain)
  const tshirtSizes = sizesByDomain[domainId] ?? defaultSizes
  const showMoney = canSeeBudget(user)
  const allowDelete = existing ? canDeleteProgram(user, existing) : false

  // A reason is mandatory before an existing program's status can change.
  const [statusNote, setStatusNote] = useState('')

  const remove = () => {
    if (existing && confirm(`Delete program “${existing.name}”? This cannot be undone.`)) {
      deleteProgram(existing.id)
      onClose()
    }
  }

  const [form, setForm] = useState(() => ({
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    owner: existing?.owner ?? '',
    status: existing?.status ?? ('on_track' as ProgramStatus),
    ragStatus: existing?.ragStatus ?? ('green' as RagStatus),
    projectType: existing?.projectType ?? ('initiative' as ProjectType),
    funding: existing?.funding ?? ('capex' as Funding),
    startDate: existing?.startDate ?? '',
    endDate: existing?.endDate ?? '',
    percentComplete: existing?.percentComplete ?? 0,
    estimatedPoints: existing?.estimatedPoints ?? 0,
    priority: existing?.priority ?? ('medium' as Priority),
    plannedResources: existing?.plannedResources ?? 0,
    currentResources: existing?.currentResources ?? 0,
    rolePlan: (existing?.rolePlan ?? []) as RolePlanEntry[],
    deprioritized: existing?.deprioritized ?? false,
    deprioritizedReason: existing?.deprioritizedReason ?? '',
    approvedBudget: existing?.approvedBudget != null ? String(existing.approvedBudget) : '',
    otherCostsTotal: existing?.otherCosts?.length ? String(otherTotal(existing)) : '',
  }))

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  // Live kickoff estimate — computed from the fields above using the same
  // budget/estimation engine as the Budget & Estimator screens.
  const otherNum = form.otherCostsTotal === '' ? 0 : Math.max(0, Number(form.otherCostsTotal) || 0)
  const datesValid = !!form.startDate && !!form.endDate && form.endDate >= form.startDate
  // The team drives both cost and delivery date. Use the explicit role mix when set;
  // otherwise synthesize a plausible mix from the planned headcount (back-compat).
  const hasRolePlan = form.rolePlan.length > 0
  const headcount = hasRolePlan ? teamHeadcount(form.rolePlan) : form.plannedResources
  const effPlan = hasRolePlan
    ? form.rolePlan
    : effectiveRolePlan({ plannedResources: form.plannedResources } as Program)
  const velocity = teamVelocity(effPlan, rateCard)
  const draftProgram = {
    startDate: form.startDate,
    endDate: form.endDate,
    plannedResources: form.plannedResources,
    rolePlan: hasRolePlan ? form.rolePlan : undefined,
  } as Program
  const estBudget = datesValid ? laborCost(draftProgram, rateCard) + otherNum : 0
  const estCompletion =
    form.estimatedPoints > 0 && velocity > 0 && form.startDate
      ? estimate(form.estimatedPoints, velocity, 0.25, form.startDate).targetDate
      : undefined
  const estLate = !!(estCompletion && form.endDate && estCompletion > form.endDate)

  // Did the status actually change on an existing program? If so, a reason
  // must be captured before the change is allowed to save.
  const statusChanged = !!existing && form.status !== existing.status
  const noteMissing = statusChanged && !statusNote.trim()

  // Dates are optional: a program with no start/end date is a Backlog item and is
  // not placed on any timeline until both dates are set.
  const valid = form.name.trim() && !noteMissing

  const save = () => {
    if (!valid) return
    const marked = MARKED_STATUSES.includes(form.status)
    const statusDate = marked
      ? existing && existing.status === form.status
        ? (existing.statusDate ?? toIso(new Date()))
        : toIso(new Date())
      : undefined
    const { approvedBudget: abRaw, otherCostsTotal: ocRaw, rolePlan: rp, ...rest } = form
    const cleanPlan = rp.filter((r) => r.role.trim() && r.count > 0)
    const payload = {
      ...rest,
      // The role mix is the source of truth for headcount when it's set.
      rolePlan: cleanPlan.length ? cleanPlan : undefined,
      plannedResources: cleanPlan.length ? teamHeadcount(cleanPlan) : form.plannedResources,
      statusDate,
      deprioritizedDate: form.deprioritized
        ? (existing?.deprioritizedDate ?? toIso(new Date()))
        : undefined,
      approvedBudget: abRaw === '' ? undefined : Math.max(0, Number(abRaw) || 0),
      otherCosts:
        ocRaw === '' || Number(ocRaw) <= 0
          ? undefined
          : [{ label: 'Other costs', amount: Math.max(0, Number(ocRaw)) }],
    }
    if (existing) {
      // Record the audit-trail entry first, then apply the change.
      if (statusChanged) {
        addStatusChange({
          programId: existing.id,
          date: toIso(new Date()),
          author: user.name,
          fromStatus: existing.status,
          toStatus: form.status,
          note: statusNote.trim(),
        })
      }
      updateProgram(existing.id, payload)
    } else {
      addProgram({ ...payload, domainId, source: 'manual' })
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit program' : 'New program'}>
      <div className="space-y-4">
        <Field label="Program name">
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Cloud Migration Wave 2"
            autoFocus
          />
        </Field>
        <Field label="Description">
          <textarea
            className={inputClass}
            rows={2}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Owner">
            <input
              className={inputClass}
              value={form.owner}
              onChange={(e) => set('owner', e.target.value)}
            />
          </Field>
          <Field label="Project type" hint="Enhancement, Initiative/Feature, or Technical.">
            <select
              className={inputClass}
              value={form.projectType}
              onChange={(e) => set('projectType', e.target.value as ProjectType)}
            >
              {(['enhancement', 'initiative', 'technical'] as ProjectType[]).map((pt) => (
                <option key={pt} value={pt}>
                  {PROJECT_TYPE_LABELS[pt]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Funding type" hint="CapEx (capital) or OpEx (operating) — used in budget reports.">
            <select
              className={inputClass}
              value={form.funding}
              onChange={(e) => set('funding', e.target.value as Funding)}
            >
              {(['capex', 'opex'] as Funding[]).map((f) => (
                <option key={f} value={f}>
                  {FUNDING_LABELS[f]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="RAG status">
            <select
              className={inputClass}
              value={form.ragStatus}
              onChange={(e) => set('ragStatus', e.target.value as RagStatus)}
            >
              {RAG_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {RAG_TEXT[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => set('status', e.target.value as ProgramStatus)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {PROGRAM_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="% complete" hint="Used when the program has no detailed tasks.">
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={form.percentComplete}
              onChange={(e) =>
                set('percentComplete', Math.max(0, Math.min(100, Number(e.target.value))))
              }
            />
          </Field>
          <Field label="Size (T-shirt)" hint="Pick a size or enter points — either one.">
            <select
              className={inputClass}
              value={tshirtSizes.find((t) => t.points === form.estimatedPoints)?.size ?? ''}
              onChange={(e) => {
                const s = tshirtSizes.find((t) => t.size === e.target.value)
                if (s) set('estimatedPoints', s.points)
              }}
            >
              <option value="">— choose a size —</option>
              {tshirtSizes.map((t) => (
                <option key={t.size} value={t.size}>
                  {t.size} · {t.points} SP
                </option>
              ))}
            </select>
          </Field>
          <Field label="Est. story points" hint="Or enter points directly.">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.estimatedPoints}
              onChange={(e) => set('estimatedPoints', Math.max(0, Number(e.target.value)))}
            />
          </Field>
          <Field label="Priority">
            <select
              className={inputClass}
              value={form.priority}
              onChange={(e) => set('priority', e.target.value as Priority)}
            >
              {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Planned resources"
            hint={hasRolePlan ? 'Set by the team composition below.' : 'Headcount / FTEs planned — or build the team below.'}
          >
            <input
              type="number"
              min={0}
              className={inputClass}
              value={hasRolePlan ? headcount : form.plannedResources}
              disabled={hasRolePlan}
              onChange={(e) => set('plannedResources', Math.max(0, Number(e.target.value)))}
            />
          </Field>
          <Field label="Current resources" hint="Actual headcount right now.">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.currentResources}
              onChange={(e) => set('currentResources', Math.max(0, Number(e.target.value)))}
            />
          </Field>
          {showMoney && (
            <>
              <Field label={`Approved budget (${CURRENCY})`} hint="Fund granted. Blank = use the estimate.">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  placeholder="e.g. 800000"
                  value={form.approvedBudget}
                  onChange={(e) => set('approvedBudget', e.target.value)}
                />
              </Field>
              <Field label={`Other costs (${CURRENCY})`} hint="Non-labour: infrastructure, licences…">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  placeholder="e.g. 120000"
                  value={form.otherCostsTotal}
                  onChange={(e) => set('otherCostsTotal', e.target.value)}
                />
              </Field>
            </>
          )}
          <Field label="Start date" hint="Leave blank to keep it in the Backlog.">
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </Field>
          <Field label="End date" hint="Set both dates to schedule it onto the timeline.">
            <input
              type="date"
              className={inputClass}
              value={form.endDate}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Team composition"
          hint="Add any mix of roles (PM, BA, developers…). Delivery roles drive the date; all roles count toward cost & headcount."
        >
          <RoleMixEditor
            value={form.rolePlan}
            onChange={(v) => set('rolePlan', v)}
            rateCard={rateCard}
            showCost={showMoney}
          />
        </Field>

        {(!form.startDate || !form.endDate) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            No start/end date yet — this will be saved to the <strong>Backlog</strong> and won't appear
            on any timeline until both dates are set.
          </div>
        )}

        {/* Live kickoff estimate — capture scope/team/dates/costs early and see
            the budget & delivery date immediately. Reads the fields above. */}
        <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-x-2 text-sm font-semibold text-slate-800">
            <Rocket size={15} className="text-brand-500" />
            Kickoff estimate
            <span className="text-xs font-normal text-slate-400">
              live — from scope, team &amp; dates above{showMoney ? ' & costs' : ''}
            </span>
          </div>
          <div className={`grid ${showMoney ? 'grid-cols-3' : 'grid-cols-2'} gap-2 text-center`}>
            {showMoney && (
              <div className="rounded-lg border border-slate-200 bg-white py-2">
                <div className="text-[11px] text-slate-500">Estimated budget</div>
                <div className="text-lg font-bold text-brand-700">{datesValid ? fmtMoney(estBudget) : '—'}</div>
                <div className="text-[10px] text-slate-400">staffing × rates + costs</div>
              </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-white py-2">
              <div className="text-[11px] text-slate-500">Est. completion</div>
              <div className={`text-lg font-bold ${estLate ? 'text-red-600' : 'text-emerald-600'}`}>
                {estCompletion ? fmtDate(estCompletion) : '—'}
              </div>
              <div className="text-[10px] text-slate-400">
                {estCompletion ? (estLate ? 'later than target end' : 'within target') : 'from scope + team'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white py-2">
              <div className="text-[11px] text-slate-500">Team</div>
              <div className="text-lg font-bold text-slate-700">
                {headcount} <span className="text-xs font-normal text-slate-400">ppl</span>
              </div>
              <div className="text-[10px] text-slate-400">
                {velocity > 0 ? `${velocity} SP/sprint` : 'planned'}
              </div>
            </div>
          </div>
        </div>

        {statusChanged && existing && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-amber-900">
              Changing status:
              <span className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-600">
                {PROGRAM_STATUS_LABELS[existing.status]}
              </span>
              <span className="text-amber-500">→</span>
              <span className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-900">
                {PROGRAM_STATUS_LABELS[form.status]}
              </span>
            </div>
            <label className="mt-2 block text-xs font-medium text-amber-800">
              Reason for the change <span className="text-red-600">*</span> (required — added to the
              audit trail)
            </label>
            <textarea
              className={`${inputClass} mt-1 border-amber-300 bg-white`}
              rows={2}
              autoFocus
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Why is the status changing? e.g. Blocked — vendor sandbox down; awaiting fix."
            />
            {noteMissing && (
              <p className="mt-1 text-xs text-red-600">
                A reason is required before the status can be updated.
              </p>
            )}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 p-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.deprioritized}
              onChange={(e) => set('deprioritized', e.target.checked)}
            />
            Mark as deprioritized (counts toward the planning-effectiveness metric)
          </label>
          {form.deprioritized && (
            <input
              className={`${inputClass} mt-2`}
              placeholder="Reason (optional) — why was it deprioritized?"
              value={form.deprioritizedReason}
              onChange={(e) => set('deprioritizedReason', e.target.value)}
            />
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            {existing && allowDelete ? (
              <Button variant="danger" onClick={remove}>
                <Trash2 size={15} />
                Delete
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!valid}>
              {existing ? 'Save changes' : 'Create program'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ---- Domain form --------------------------------------------------------

const PRESET_COLORS = [
  '#2563eb', '#7c3aed', '#0d9488', '#db2777', '#ea580c',
  '#0891b2', '#16a34a', '#f59e0b', '#6366f1', '#e11d48',
]

export function DomainForm({
  open,
  onClose,
  existing,
}: {
  open: boolean
  onClose: () => void
  existing?: Domain
}) {
  const addDomain = useStore((s) => s.addDomain)
  const updateDomain = useStore((s) => s.updateDomain)
  const deleteDomain = useStore((s) => s.deleteDomain)

  const [form, setForm] = useState(() => ({
    name: existing?.name ?? '',
    managerName: existing?.managerName ?? '',
    color: existing?.color ?? PRESET_COLORS[0],
    description: existing?.description ?? '',
    budget: existing?.budget != null ? String(existing.budget) : '',
  }))

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const valid = form.name.trim() && form.managerName.trim()

  const save = () => {
    if (!valid) return
    const { budget: bRaw, ...rest } = form
    const payload = { ...rest, budget: bRaw === '' ? undefined : Math.max(0, Number(bRaw) || 0) }
    if (existing) updateDomain(existing.id, payload)
    else addDomain(payload)
    onClose()
  }

  const remove = () => {
    if (
      existing &&
      confirm(`Delete domain “${existing.name}” and ALL its programs? This cannot be undone.`)
    ) {
      deleteDomain(existing.id)
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit domain' : 'New domain'}>
      <div className="space-y-4">
        <Field label="Domain name">
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Customer"
            autoFocus
          />
        </Field>
        <Field label="Manager">
          <input
            className={inputClass}
            value={form.managerName}
            onChange={(e) => set('managerName', e.target.value)}
            placeholder="e.g. Lambert Nshimyumukiza"
          />
        </Field>
        <Field label={`Allocated fund (${CURRENCY})`} hint="Top-down budget for this domain; its programs draw from it.">
          <input
            type="number"
            min={0}
            className={inputClass}
            placeholder="e.g. 3000000"
            value={form.budget}
            onChange={(e) => set('budget', e.target.value)}
          />
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set('color', c)}
                className={`h-8 w-8 rounded-lg transition ${
                  form.color === c ? 'ring-2 ring-slate-900 ring-offset-2' : ''
                }`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>
        <Field label="Description">
          <textarea
            className={inputClass}
            rows={2}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>

        <div className="flex items-center justify-between pt-2">
          <div>
            {existing && (
              <Button variant="danger" onClick={remove}>
                <Trash2 size={15} />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!valid}>
              {existing ? 'Save changes' : 'Create domain'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ---- Task form ----------------------------------------------------------

export function TaskForm({
  open,
  onClose,
  programId,
  existing,
  siblings,
}: {
  open: boolean
  onClose: () => void
  programId: string
  existing?: Task
  /** Other tasks in the program, offered as possible predecessors. */
  siblings: Task[]
}) {
  const addTask = useStore((s) => s.addTask)
  const updateTask = useStore((s) => s.updateTask)

  const [form, setForm] = useState(() => ({
    name: existing?.name ?? '',
    assignee: existing?.assignee ?? '',
    startDate: existing?.startDate ?? '',
    endDate: existing?.endDate ?? '',
    percentComplete: existing?.percentComplete ?? 0,
    storyPoints: existing?.storyPoints ?? 0,
    milestone: existing?.milestone ?? false,
    predecessorIds: existing?.predecessorIds ?? [],
  }))

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const options = siblings.filter((t) => t.id !== existing?.id)
  const valid = form.name.trim() && form.startDate && (form.milestone || form.endDate)

  const togglePred = (id: string) =>
    setForm((f) => ({
      ...f,
      predecessorIds: f.predecessorIds.includes(id)
        ? f.predecessorIds.filter((p) => p !== id)
        : [...f.predecessorIds, id],
    }))

  const save = () => {
    if (!valid) return
    const payload = {
      ...form,
      endDate: form.milestone ? form.startDate : form.endDate,
      percentComplete: form.milestone ? form.percentComplete : form.percentComplete,
    }
    if (existing) {
      updateTask(existing.id, payload)
    } else {
      addTask({ ...payload, programId, source: 'manual' })
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit task' : 'New task'}>
      <div className="space-y-4">
        <Field label="Task name">
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Assignee">
            <input
              className={inputClass}
              value={form.assignee}
              onChange={(e) => set('assignee', e.target.value)}
            />
          </Field>
          <Field label="% complete">
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={form.percentComplete}
              onChange={(e) =>
                set('percentComplete', Math.max(0, Math.min(100, Number(e.target.value))))
              }
            />
          </Field>
          <Field label="Story points" hint="1 SP = 1 day">
            <select
              className={inputClass}
              value={form.storyPoints}
              onChange={(e) => set('storyPoints', Number(e.target.value))}
            >
              <option value={0}>—</option>
              {[1, 2, 3, 5, 8, 13].map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start date">
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </Field>
          <Field label={form.milestone ? 'Date' : 'End date'}>
            <input
              type="date"
              className={inputClass}
              value={form.milestone ? form.startDate : form.endDate}
              disabled={form.milestone}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.milestone}
            onChange={(e) => set('milestone', e.target.checked)}
          />
          This is a milestone (single date, shown as a diamond)
        </label>

        {options.length > 0 && (
          <Field label="Depends on" hint="Draws a dependency arrow from these tasks.">
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {options.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.predecessorIds.includes(t.id)}
                    onChange={() => togglePred(t.id)}
                  />
                  {t.name}
                </label>
              ))}
            </div>
          </Field>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid}>
            {existing ? 'Save changes' : 'Add task'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
