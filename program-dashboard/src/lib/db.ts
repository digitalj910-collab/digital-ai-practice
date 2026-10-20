import { supabase } from './supabase'
import type {
  Domain,
  Program,
  StatusChange,
  StatusUpdate,
  Task,
  UpdateComment,
  UpdateEdit,
} from '../types'

// Maps between the app's camelCase types and the database's snake_case columns.
// One place for all Supabase reads/writes so the rest of the app stays clean.

/* eslint-disable @typescript-eslint/no-explicit-any */

// Which optional columns actually exist in the database. Detected at startup so
// writes never fail on a not-yet-migrated column; flips true automatically once
// the migration is applied.
export const SCHEMA = {
  statusDate: false,
  releaseFields: false,
  storyPoints: false,
  estimatedPoints: false,
  statusChanges: false,
  comments: false,
  updateEdits: false,
  settings: false,
  budget: false,
}

export async function detectSchema(): Promise<void> {
  if (!supabase) return
  const has = async (table: string, col: string) => {
    const { error } = await supabase!.from(table).select(col).limit(1)
    return !error
  }
  SCHEMA.statusDate = await has('programs', 'status_date')
  SCHEMA.releaseFields = await has('updates_log', 'upcoming_release')
  SCHEMA.storyPoints = await has('tasks', 'story_points')
  SCHEMA.estimatedPoints = await has('programs', 'estimated_points')
  // The status_changes audit table is optional — the app enforces the reason
  // regardless; this just controls whether the history persists across reloads.
  SCHEMA.statusChanges = await has('status_changes', 'id')
  // Optional feedback tables — updates work without them; these just control
  // whether comments and edit-history persist across reloads.
  SCHEMA.comments = await has('update_comments', 'id')
  SCHEMA.updateEdits = await has('update_edits', 'id')
  // Team-wide app settings (e.g. the custom T-shirt scale + rate card).
  SCHEMA.settings = await has('app_settings', 'key')
  // Budgeting: domains.budget (fund) + programs.budget_plan (jsonb).
  SCHEMA.budget = await has('programs', 'budget_plan')
}

/** Read an app-level setting value (jsonb). Returns null when absent or the
 *  settings table hasn't been created yet. */
export async function settingsGet(key: string): Promise<any | null> {
  if (!supabase || !SCHEMA.settings) return null
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).limit(1)
  if (error || !data || data.length === 0) return null
  return data[0].value ?? null
}

/** Persist an app-level setting (upsert by key). No-op until the table exists. */
export function settingsSet(key: string, value: any) {
  if (!supabase || !SCHEMA.settings) return undefined
  return supabase.from('app_settings').upsert({ key, value })
}

// ---- Domains ----
function domainToRow(d: Domain) {
  return {
    id: d.id,
    name: d.name,
    manager_name: d.managerName ?? null,
    color: d.color ?? null,
    description: d.description ?? null,
    ...(SCHEMA.budget ? { budget: d.budget ?? null } : {}),
  }
}
function rowToDomain(r: any): Domain {
  return {
    id: r.id,
    name: r.name,
    managerName: r.manager_name ?? '',
    color: r.color ?? '#2563eb',
    description: r.description ?? undefined,
    budget: r.budget ?? undefined,
  }
}

// ---- Programs ----
function programToRow(p: Program) {
  return {
    id: p.id,
    domain_id: p.domainId,
    name: p.name,
    description: p.description ?? null,
    owner: p.owner ?? null,
    status: p.status,
    rag_status: p.ragStatus,
    // Empty dates → NULL (backlog / not scheduled yet).
    start_date: p.startDate || null,
    end_date: p.endDate || null,
    percent_complete: p.percentComplete ?? null,
    priority: p.priority ?? null,
    // Optional columns included only when the migration has been applied.
    ...(SCHEMA.statusDate ? { status_date: p.statusDate ?? null } : {}),
    ...(SCHEMA.estimatedPoints ? { estimated_points: p.estimatedPoints ?? null } : {}),
    deprioritized: p.deprioritized ?? false,
    deprioritized_reason: p.deprioritizedReason ?? null,
    deprioritized_date: p.deprioritizedDate ?? null,
    planned_resources: p.plannedResources ?? null,
    current_resources: p.currentResources ?? null,
    source: p.source,
    external_id: p.externalId ?? null,
    last_synced_at: p.lastSyncedAt ?? null,
    ...(SCHEMA.budget
      ? {
          budget_plan: {
            rolePlan: p.rolePlan ?? [],
            otherCosts: p.otherCosts ?? [],
            approvedBudget: p.approvedBudget ?? null,
            spentOverride: p.spentOverride ?? null,
            // Stored here (rather than new columns) so no extra migration is needed.
            projectType: p.projectType ?? null,
            funding: p.funding ?? null,
            baseline: p.baseline ?? null,
            scopeChanges: p.scopeChanges ?? null,
            monthlyActuals: p.monthlyActuals ?? null,
          },
        }
      : {}),
  }
}
function rowToProgram(r: any): Program {
  return {
    id: r.id,
    domainId: r.domain_id,
    name: r.name,
    description: r.description ?? undefined,
    owner: r.owner ?? '',
    status: r.status,
    ragStatus: r.rag_status,
    startDate: r.start_date ?? '',
    endDate: r.end_date ?? '',
    percentComplete: r.percent_complete ?? undefined,
    estimatedPoints: r.estimated_points ?? undefined,
    priority: r.priority ?? undefined,
    statusDate: r.status_date ?? undefined,
    deprioritized: r.deprioritized ?? undefined,
    deprioritizedReason: r.deprioritized_reason ?? undefined,
    deprioritizedDate: r.deprioritized_date ?? undefined,
    plannedResources: r.planned_resources ?? undefined,
    currentResources: r.current_resources ?? undefined,
    source: r.source ?? 'manual',
    externalId: r.external_id ?? undefined,
    lastSyncedAt: r.last_synced_at ?? undefined,
    projectType: r.budget_plan?.projectType ?? undefined,
    funding: r.budget_plan?.funding ?? undefined,
    baseline: r.budget_plan?.baseline ?? undefined,
    scopeChanges: r.budget_plan?.scopeChanges ?? undefined,
    rolePlan: r.budget_plan?.rolePlan ?? undefined,
    otherCosts: r.budget_plan?.otherCosts ?? undefined,
    approvedBudget: r.budget_plan?.approvedBudget ?? undefined,
    spentOverride: r.budget_plan?.spentOverride ?? undefined,
    monthlyActuals: r.budget_plan?.monthlyActuals ?? undefined,
  }
}

// ---- Tasks ----
function taskToRow(t: Task) {
  return {
    id: t.id,
    program_id: t.programId,
    name: t.name,
    start_date: t.startDate,
    end_date: t.endDate,
    percent_complete: t.percentComplete,
    ...(SCHEMA.storyPoints ? { story_points: t.storyPoints ?? null } : {}),
    assignee: t.assignee ?? null,
    milestone: t.milestone,
    predecessor_ids: t.predecessorIds ?? [],
    source: t.source,
    external_id: t.externalId ?? null,
  }
}
function rowToTask(r: any): Task {
  return {
    id: r.id,
    programId: r.program_id,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    percentComplete: r.percent_complete ?? 0,
    storyPoints: r.story_points ?? undefined,
    assignee: r.assignee ?? undefined,
    milestone: r.milestone ?? false,
    predecessorIds: r.predecessor_ids ?? [],
    source: r.source ?? 'manual',
    externalId: r.external_id ?? undefined,
  }
}

// ---- Status updates ----
function updateToRow(u: StatusUpdate) {
  return {
    id: u.id,
    program_id: u.programId,
    date: u.date,
    author: u.author,
    progress: u.progress ?? null,
    next_weeks: u.nextWeeks ?? null,
    next_months: u.nextMonths ?? null,
    ...(SCHEMA.releaseFields
      ? { upcoming_release: u.upcomingRelease ?? null, released_items: u.releasedItems ?? null }
      : {}),
    concerns: u.concerns ?? null,
    blockers: u.blockers ?? null,
    risks: u.risks ?? null,
    note: u.note ?? null,
  }
}
function rowToUpdate(r: any): StatusUpdate {
  return {
    id: r.id,
    programId: r.program_id,
    date: r.date,
    author: r.author ?? '',
    progress: r.progress ?? undefined,
    nextWeeks: r.next_weeks ?? undefined,
    nextMonths: r.next_months ?? undefined,
    upcomingRelease: r.upcoming_release ?? undefined,
    releasedItems: r.released_items ?? undefined,
    concerns: r.concerns ?? undefined,
    blockers: r.blockers ?? undefined,
    risks: r.risks ?? undefined,
    note: r.note ?? undefined,
  }
}

// ---- Status changes (audit trail) ----
function statusChangeToRow(c: StatusChange) {
  return {
    id: c.id,
    program_id: c.programId,
    date: c.date,
    author: c.author ?? null,
    from_status: c.fromStatus,
    to_status: c.toStatus,
    note: c.note ?? null,
  }
}
function rowToStatusChange(r: any): StatusChange {
  return {
    id: r.id,
    programId: r.program_id,
    date: r.date,
    author: r.author ?? '',
    fromStatus: r.from_status,
    toStatus: r.to_status,
    note: r.note ?? '',
  }
}

// ---- Update comments ----
function commentToRow(c: UpdateComment) {
  return {
    id: c.id,
    update_id: c.updateId,
    author: c.author ?? null,
    role: c.role ?? null,
    text: c.text,
    date: c.date,
  }
}
function rowToComment(r: any): UpdateComment {
  return {
    id: r.id,
    updateId: r.update_id,
    author: r.author ?? '',
    role: r.role ?? undefined,
    text: r.text ?? '',
    date: r.date,
  }
}

// ---- Update edit-history ----
function editToRow(e: UpdateEdit) {
  return {
    id: e.id,
    update_id: e.updateId,
    editor: e.editor ?? null,
    editor_role: e.editorRole ?? null,
    date: e.date,
    changes: e.changes, // jsonb
  }
}
function rowToEdit(r: any): UpdateEdit {
  return {
    id: r.id,
    updateId: r.update_id,
    editor: r.editor ?? '',
    editorRole: r.editor_role ?? undefined,
    date: r.date,
    changes: Array.isArray(r.changes) ? r.changes : [],
  }
}

export interface Snapshot {
  domains: Domain[]
  programs: Program[]
  tasks: Task[]
  updates: StatusUpdate[]
  statusChanges: StatusChange[]
  comments: UpdateComment[]
  updateEdits: UpdateEdit[]
}

/** Load the entire dataset from Supabase. Returns null if Supabase is off. */
export async function fetchAll(): Promise<Snapshot | null> {
  if (!supabase) return null
  const [d, p, t, u] = await Promise.all([
    supabase.from('domains').select('*'),
    supabase.from('programs').select('*'),
    supabase.from('tasks').select('*'),
    supabase.from('updates_log').select('*'),
  ])
  const err = d.error || p.error || t.error || u.error
  if (err) throw err
  // The audit table is only queried when it exists (detected at startup).
  let statusChanges: StatusChange[] = []
  if (SCHEMA.statusChanges) {
    const c = await supabase.from('status_changes').select('*')
    if (!c.error) statusChanges = (c.data ?? []).map(rowToStatusChange)
  }
  let comments: UpdateComment[] = []
  if (SCHEMA.comments) {
    const c = await supabase.from('update_comments').select('*')
    if (!c.error) comments = (c.data ?? []).map(rowToComment)
  }
  let updateEdits: UpdateEdit[] = []
  if (SCHEMA.updateEdits) {
    const e = await supabase.from('update_edits').select('*')
    if (!e.error) updateEdits = (e.data ?? []).map(rowToEdit)
  }
  return {
    domains: (d.data ?? []).map(rowToDomain),
    programs: (p.data ?? []).map(rowToProgram),
    tasks: (t.data ?? []).map(rowToTask),
    updates: (u.data ?? []).map(rowToUpdate),
    statusChanges,
    comments,
    updateEdits,
  }
}

/** Write a full dataset into an empty database (first run). */
export async function seedRemote(s: Snapshot): Promise<void> {
  if (!supabase) return
  await supabase.from('domains').insert(s.domains.map(domainToRow))
  await supabase.from('programs').insert(s.programs.map(programToRow))
  if (s.tasks.length) await supabase.from('tasks').insert(s.tasks.map(taskToRow))
  if (s.updates.length) await supabase.from('updates_log').insert(s.updates.map(updateToRow))
  if (SCHEMA.statusChanges && s.statusChanges.length)
    await supabase.from('status_changes').insert(s.statusChanges.map(statusChangeToRow))
  if (SCHEMA.comments && s.comments.length)
    await supabase.from('update_comments').insert(s.comments.map(commentToRow))
  if (SCHEMA.updateEdits && s.updateEdits.length)
    await supabase.from('update_edits').insert(s.updateEdits.map(editToRow))
}

/** Wipe and re-seed (used by "Reset sample data"). */
export async function resetRemote(s: Snapshot): Promise<void> {
  if (!supabase) return
  if (SCHEMA.comments) await supabase.from('update_comments').delete().neq('id', '')
  if (SCHEMA.updateEdits) await supabase.from('update_edits').delete().neq('id', '')
  if (SCHEMA.statusChanges) await supabase.from('status_changes').delete().neq('id', '')
  await supabase.from('updates_log').delete().neq('id', '')
  await supabase.from('tasks').delete().neq('id', '')
  await supabase.from('programs').delete().neq('id', '')
  await supabase.from('domains').delete().neq('id', '')
  await seedRemote(s)
}

// Single-record writes. Each returns a thenable (or undefined when Supabase off).
export const db = {
  upsertDomain: (d: Domain) => supabase?.from('domains').upsert(domainToRow(d)),
  deleteDomain: (id: string) => supabase?.from('domains').delete().eq('id', id),
  upsertProgram: (p: Program) => supabase?.from('programs').upsert(programToRow(p)),
  deleteProgram: (id: string) => supabase?.from('programs').delete().eq('id', id),
  upsertTask: (t: Task) => supabase?.from('tasks').upsert(taskToRow(t)),
  upsertTasks: (ts: Task[]) => supabase?.from('tasks').upsert(ts.map(taskToRow)),
  deleteTask: (id: string) => supabase?.from('tasks').delete().eq('id', id),
  upsertUpdate: (u: StatusUpdate) => supabase?.from('updates_log').upsert(updateToRow(u)),
  deleteUpdate: (id: string) => supabase?.from('updates_log').delete().eq('id', id),
  upsertStatusChange: (c: StatusChange) =>
    SCHEMA.statusChanges ? supabase?.from('status_changes').upsert(statusChangeToRow(c)) : undefined,
  upsertComment: (c: UpdateComment) =>
    SCHEMA.comments ? supabase?.from('update_comments').upsert(commentToRow(c)) : undefined,
  deleteComment: (id: string) =>
    SCHEMA.comments ? supabase?.from('update_comments').delete().eq('id', id) : undefined,
  upsertEdit: (e: UpdateEdit) =>
    SCHEMA.updateEdits ? supabase?.from('update_edits').upsert(editToRow(e)) : undefined,
}

/** Fire-and-forget a Supabase write, logging any error. */
export function run(p: any): void {
  if (!p) return
  Promise.resolve(p)
    .then((res: any) => {
      if (res?.error) console.error('Supabase write error:', res.error)
    })
    .catch((e: any) => console.error('Supabase write error:', e))
}
