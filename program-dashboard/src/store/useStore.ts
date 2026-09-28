import { create } from 'zustand'
import { visibleDomainIds as orgVisibleDomainIds } from '../lib/org'
import type {
  Domain,
  Program,
  RateCardEntry,
  Role,
  StatusChange,
  StatusUpdate,
  Task,
  UpdateComment,
  UpdateEdit,
  UpdateFieldChange,
} from '../types'
import { DEFAULT_RATE_CARD, lockProgramPlan, normalizeRateCard } from '../lib/budget'
import { uid } from '../lib/id'
import { supabaseEnabled } from '../lib/supabase'
import {
  db,
  detectSchema,
  fetchAll,
  resetRemote,
  run,
  settingsGet,
  settingsSet,
  type Snapshot,
} from '../lib/db'
import { TSHIRT_SIZES, type TShirtSize } from '../lib/forecast'
import {
  seedComments,
  seedDomains,
  seedPrograms,
  seedStatusChanges,
  seedTasks,
  seedUpdateEdits,
  seedUpdates,
} from './seed'

/** Update fields whose changes are tracked in the edit history. */
const TRACKED_UPDATE_FIELDS: (keyof StatusUpdate)[] = [
  'progress',
  'nextWeeks',
  'nextMonths',
  'upcomingRelease',
  'releasedItems',
  'concerns',
  'blockers',
  'risks',
  'note',
]

/** The active persona. In this build it's a demo switcher; with real auth it
 *  comes from the logged-in user. Managers can only edit their own domain. */
export interface CurrentUser {
  role: Role
  name: string
  /** For a contributor — the one domain they own. */
  domainId?: string
  /** For a director / senior_director — which director they are. */
  directorId?: string
  /** For a VP — which VP they are. */
  vpId?: string
}

interface State {
  domains: Domain[]
  programs: Program[]
  tasks: Task[]
  updates: StatusUpdate[]
  statusChanges: StatusChange[]
  comments: UpdateComment[]
  updateEdits: UpdateEdit[]
  currentUser: CurrentUser
  loading: boolean
  initialized: boolean

  /** Team-wide default T-shirt-size → story-point scale (editable in the UI). */
  tshirtSizes: TShirtSize[]
  /** Team-wide default vendor/role rate card (currency per person-day). */
  rateCard: RateCardEntry[]
  /** Per-domain rate-card overrides — each domain/manager can set its own rates;
   *  domains without an override fall back to the team default above. */
  rateCardsByDomain: Record<string, RateCardEntry[]>
  /** Per-domain T-shirt scale overrides (Estimator / Capacity customize). */
  tshirtSizesByDomain: Record<string, TShirtSize[]>

  /** Load from Supabase (seeding it on first run). Safe to call repeatedly. */
  init: () => Promise<void>

  setUser: (user: CurrentUser) => void

  /** Save the team-default T-shirt scale (persists to Supabase app_settings). */
  setTshirtSizes: (sizes: TShirtSize[]) => void

  /** Save the team-default vendor/role rate card (persists to Supabase app_settings). */
  setRateCard: (card: RateCardEntry[]) => void

  /** Save a single domain's own rate card (persists the whole per-domain map). */
  setDomainRateCard: (domainId: string, card: RateCardEntry[]) => void

  /** Save a single domain's own T-shirt scale (persists the whole per-domain map). */
  setDomainTshirtSizes: (domainId: string, sizes: TShirtSize[]) => void

  addDomain: (d: Omit<Domain, 'id'>) => string
  updateDomain: (id: string, patch: Partial<Domain>) => void
  deleteDomain: (id: string) => void

  addProgram: (p: Omit<Program, 'id'>) => string
  updateProgram: (id: string, patch: Partial<Program>) => void
  deleteProgram: (id: string) => void

  addTask: (t: Omit<Task, 'id'>) => string
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void

  addUpdate: (u: Omit<StatusUpdate, 'id'>) => void
  updateUpdate: (id: string, patch: Partial<StatusUpdate>) => void
  deleteUpdate: (id: string) => void

  /** Post a comment / reply on an update (leadership ↔ manager discussion). */
  addComment: (c: Omit<UpdateComment, 'id'>) => void
  deleteComment: (id: string) => void

  /** Record a status change in the audit trail (reason captured in the form). */
  addStatusChange: (c: Omit<StatusChange, 'id'>) => void

  resetToSeed: () => void
}

const initialUser: CurrentUser = { role: 'admin', name: 'You (Admin)' }

function seedSnapshot(): Snapshot {
  return {
    domains: seedDomains,
    programs: seedPrograms,
    tasks: seedTasks,
    updates: seedUpdates,
    statusChanges: seedStatusChanges,
    comments: seedComments,
    updateEdits: seedUpdateEdits,
  }
}

export const useStore = create<State>()((set, get) => ({
  // When Supabase is on we start empty and load; offline we use the seed.
  domains: supabaseEnabled ? [] : seedDomains,
  programs: supabaseEnabled ? [] : seedPrograms,
  tasks: supabaseEnabled ? [] : seedTasks,
  updates: supabaseEnabled ? [] : seedUpdates,
  statusChanges: supabaseEnabled ? [] : seedStatusChanges,
  comments: supabaseEnabled ? [] : seedComments,
  updateEdits: supabaseEnabled ? [] : seedUpdateEdits,
  currentUser: initialUser,
  loading: supabaseEnabled,
  initialized: false,
  tshirtSizes: TSHIRT_SIZES,
  rateCard: DEFAULT_RATE_CARD,
  rateCardsByDomain: {},
  tshirtSizesByDomain: {},

  init: async () => {
    if (get().initialized) return
    set({ initialized: true })
    if (!supabaseEnabled) {
      set({ loading: false })
      return
    }
    try {
      await detectSchema()
      const savedSizes = await settingsGet('tshirt_sizes')
      if (Array.isArray(savedSizes) && savedSizes.length) set({ tshirtSizes: savedSizes })
      const savedCard = await settingsGet('rate_card')
      if (Array.isArray(savedCard) && savedCard.length) set({ rateCard: normalizeRateCard(savedCard) })
      const savedDomainCards = await settingsGet('rate_cards_by_domain')
      if (savedDomainCards && typeof savedDomainCards === 'object' && !Array.isArray(savedDomainCards)) {
        const normalized: Record<string, RateCardEntry[]> = {}
        for (const [id, c] of Object.entries(savedDomainCards))
          if (Array.isArray(c)) normalized[id] = normalizeRateCard(c)
        set({ rateCardsByDomain: normalized })
      }
      const savedDomainSizes = await settingsGet('tshirt_by_domain')
      if (savedDomainSizes && typeof savedDomainSizes === 'object' && !Array.isArray(savedDomainSizes))
        set({ tshirtSizesByDomain: savedDomainSizes })
      const data = await fetchAll()
      if (!data) {
        set({ loading: false })
        return
      }
      if (data.programs.length === 0) {
        // Empty or partially-seeded DB — wipe and seed fresh.
        const seed = seedSnapshot()
        await resetRemote(seed)
        set({ ...seed, loading: false })
      } else {
        set({
          domains: data.domains,
          programs: data.programs,
          tasks: data.tasks,
          updates: data.updates,
          statusChanges: data.statusChanges,
          comments: data.comments,
          updateEdits: data.updateEdits,
          loading: false,
        })
      }
      // Domain-level weekly updates live in app_settings (no program_id column),
      // so they need no schema change. Merge them into the updates feed.
      const savedDomainUpdates = await settingsGet('domain_updates')
      if (Array.isArray(savedDomainUpdates) && savedDomainUpdates.length)
        set((s) => ({ updates: [...savedDomainUpdates, ...s.updates] }))
    } catch (e) {
      console.error('Supabase load failed — falling back to local sample data:', e)
      set({ ...seedSnapshot(), loading: false })
    }
  },

  setUser: (user) => set({ currentUser: user }),

  setTshirtSizes: (sizes) => {
    set({ tshirtSizes: sizes })
    run(settingsSet('tshirt_sizes', sizes))
  },

  setRateCard: (card) => {
    set({ rateCard: card })
    run(settingsSet('rate_card', card))
  },

  setDomainRateCard: (domainId, card) => {
    const map = { ...get().rateCardsByDomain, [domainId]: card }
    set({ rateCardsByDomain: map })
    run(settingsSet('rate_cards_by_domain', map))
  },

  setDomainTshirtSizes: (domainId, sizes) => {
    const map = { ...get().tshirtSizesByDomain, [domainId]: sizes }
    set({ tshirtSizesByDomain: map })
    run(settingsSet('tshirt_by_domain', map))
  },

  // ---- Domains ----
  addDomain: (d) => {
    const rec: Domain = { ...d, id: uid('d') }
    set((s) => ({ domains: [...s.domains, rec] }))
    run(db.upsertDomain(rec))
    return rec.id
  },
  updateDomain: (id, patch) => {
    let updated: Domain | undefined
    set((s) => ({
      domains: s.domains.map((d) => {
        if (d.id === id) {
          updated = { ...d, ...patch }
          return updated
        }
        return d
      }),
    }))
    if (updated) run(db.upsertDomain(updated))
  },
  deleteDomain: (id) => {
    set((s) => {
      const programIds = s.programs.filter((p) => p.domainId === id).map((p) => p.id)
      return {
        domains: s.domains.filter((d) => d.id !== id),
        programs: s.programs.filter((p) => p.domainId !== id),
        tasks: s.tasks.filter((t) => !programIds.includes(t.programId)),
        updates: s.updates.filter((u) =>
          u.programId ? !programIds.includes(u.programId) : u.domainId !== id,
        ),
      }
    })
    run(db.deleteDomain(id)) // DB cascade removes programs/tasks/updates
    run(settingsSet('domain_updates', get().updates.filter((x) => x.domainId)))
  },

  // ---- Programs ----
  addProgram: (p) => {
    const rec: Program = { ...p, id: uid('p') }
    set((s) => ({ programs: [...s.programs, rec] }))
    run(db.upsertProgram(rec))
    return rec.id
  },
  updateProgram: (id, patch) => {
    let updated: Program | undefined
    set((s) => ({
      programs: s.programs.map((p) => {
        if (p.id === id) {
          updated = { ...p, ...patch }
          return updated
        }
        return p
      }),
    }))
    if (updated) run(db.upsertProgram(updated))
  },
  deleteProgram: (id) => {
    set((s) => ({
      programs: s.programs.filter((p) => p.id !== id),
      tasks: s.tasks.filter((t) => t.programId !== id),
      updates: s.updates.filter((u) => u.programId !== id),
    }))
    run(db.deleteProgram(id)) // DB cascade removes tasks/updates
  },

  // ---- Tasks ----
  addTask: (t) => {
    const rec: Task = { ...t, id: uid('t') }
    set((s) => ({ tasks: [...s.tasks, rec] }))
    run(db.upsertTask(rec))
    return rec.id
  },
  updateTask: (id, patch) => {
    let updated: Task | undefined
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id === id) {
          updated = { ...t, ...patch }
          return updated
        }
        return t
      }),
    }))
    if (updated) run(db.upsertTask(updated))
  },
  deleteTask: (id) => {
    const affected: Task[] = []
    set((s) => ({
      tasks: s.tasks
        .filter((t) => t.id !== id)
        .map((t) => {
          if (t.predecessorIds.includes(id)) {
            const nt = { ...t, predecessorIds: t.predecessorIds.filter((p) => p !== id) }
            affected.push(nt)
            return nt
          }
          return t
        }),
    }))
    run(db.deleteTask(id))
    affected.forEach((t) => run(db.upsertTask(t)))
  },

  // ---- Status updates ----
  addUpdate: (u) => {
    const rec: StatusUpdate = { ...u, id: uid('u') }
    set((s) => ({ updates: [rec, ...s.updates] }))
    // Domain-level updates persist to app_settings; project updates to updates_log.
    if (rec.domainId) run(settingsSet('domain_updates', get().updates.filter((x) => x.domainId)))
    else run(db.upsertUpdate(rec))
  },
  updateUpdate: (id, patch) => {
    const editor = get().currentUser
    let prev: StatusUpdate | undefined
    let updated: StatusUpdate | undefined
    set((s) => ({
      updates: s.updates.map((u) => {
        if (u.id === id) {
          prev = u
          updated = { ...u, ...patch }
          return updated
        }
        return u
      }),
    }))
    if (!updated || !prev) return
    const isDomainUpdate = !!updated.domainId
    if (isDomainUpdate) run(settingsSet('domain_updates', get().updates.filter((x) => x.domainId)))
    else run(db.upsertUpdate(updated))
    // Record what actually changed, preserving prior wording (esp. the
    // manager's original text when leadership edits it).
    const changes: UpdateFieldChange[] = []
    for (const f of TRACKED_UPDATE_FIELDS) {
      const from = ((prev[f] as string | undefined) ?? '').trim()
      const to = ((updated[f] as string | undefined) ?? '').trim()
      if (from !== to) changes.push({ field: f, from, to })
    }
    if (changes.length) {
      const edit: UpdateEdit = {
        id: uid('ue'),
        updateId: id,
        editor: editor.name,
        editorRole: editor.role,
        date: new Date().toISOString(),
        changes,
      }
      set((s) => ({ updateEdits: [edit, ...s.updateEdits] }))
      // Edit history for domain updates stays in-memory (no updates_log row to attach to).
      if (!isDomainUpdate) run(db.upsertEdit(edit))
    }
  },
  deleteUpdate: (id) => {
    const wasDomain = !!get().updates.find((u) => u.id === id)?.domainId
    set((s) => ({
      updates: s.updates.filter((u) => u.id !== id),
      comments: s.comments.filter((c) => c.updateId !== id),
      updateEdits: s.updateEdits.filter((e) => e.updateId !== id),
    }))
    if (wasDomain) run(settingsSet('domain_updates', get().updates.filter((x) => x.domainId)))
    else run(db.deleteUpdate(id))
  },

  // ---- Update comments (leadership ↔ manager discussion) ----
  addComment: (c) => {
    const rec: UpdateComment = { ...c, id: uid('cm') }
    set((s) => ({ comments: [...s.comments, rec] }))
    run(db.upsertComment(rec))
  },
  deleteComment: (id) => {
    set((s) => ({ comments: s.comments.filter((c) => c.id !== id) }))
    run(db.deleteComment(id))
  },

  // ---- Status-change audit trail ----
  addStatusChange: (c) => {
    const rec: StatusChange = { ...c, id: uid('sc') }
    set((s) => ({ statusChanges: [rec, ...s.statusChanges] }))
    run(db.upsertStatusChange(rec))
  },

  resetToSeed: () => {
    const seed = seedSnapshot()
    // Sample projects take their own copy of each team's CURRENT rates (and lock
    // the agreed cost on their baseline), just like a project saved in the app.
    const { rateCard, rateCardsByDomain } = get()
    seed.programs = seed.programs.map((p) => lockProgramPlan(p, rateCardsByDomain[p.domainId] ?? rateCard))
    set({ ...seed })
    if (supabaseEnabled) resetRemote(seed).catch((e) => console.error('Reset failed:', e))
  },
}))

// ---- Permission helpers ----
// Org-hierarchy roles (see src/lib/org.ts):
//  - contributor: data entry, scoped to their own domain. No money.
//  - director / senior_director: oversee their assigned domains (view + budget +
//    comment), and may create projects / edit a project's plan & rates there.
//    No task/update data entry, no admin settings.
//  - vp: oversee their directors' domains (view + budget + comment + a
//    project's plan & rates).
//  - admin / sandbox: full access to everything.

/** Data-entry capability anywhere (create/edit programs, tasks, updates). */
export function canEdit(user: CurrentUser): boolean {
  return user.role === 'admin' || user.role === 'sandbox' || user.role === 'contributor'
}

/** Can this user do data entry in a specific domain? Contributors: own domain only. */
export function canEditDomain(user: CurrentUser, domainId: string): boolean {
  if (user.role === 'admin' || user.role === 'sandbox') return true
  if (user.role === 'contributor') return user.domainId === domainId
  return false
}

/**
 * Admin-level actions that aren't scoped to a single domain — add/edit domains,
 * the vendor rate card, the T-shirt scale, the planning tools. Admin / sandbox only.
 */
export function canAdminister(user: CurrentUser): boolean {
  return user.role === 'admin' || user.role === 'sandbox'
}

/**
 * Who may see money — budget amounts, project costs, rate cards, estimated cost.
 * Admin/sandbox and the leadership tiers (director / senior_director / VP), scoped
 * to their own domains. Contributors never see money.
 */
export function canSeeBudget(user: CurrentUser): boolean {
  return (
    user.role === 'admin' ||
    user.role === 'sandbox' ||
    user.role === 'director' ||
    user.role === 'senior_director' ||
    user.role === 'vp'
  )
}

/** Re-export the org-tree domain visibility so components import it from one place. */
export function visibleDomainIds(user: CurrentUser, allDomainIds: string[]): string[] | null {
  return orgVisibleDomainIds(user, allDomainIds)
}

/** Who may create a project in a domain: its manager, plus directors over it. */
export function canCreateProgram(user: CurrentUser, domainId: string): boolean {
  if (canEditDomain(user, domainId)) return true
  const leads = user.role === 'director' || user.role === 'senior_director'
  return leads && (visibleDomainIds(user, [domainId]) ?? []).includes(domainId)
}

/** Who may edit a project's plan (Edit program — team, project rates, vendors) and
 *  lock its baseline: whoever can create it, plus the VP over it. */
export function canEditProgramPlan(user: CurrentUser, domainId: string): boolean {
  if (canCreateProgram(user, domainId)) return true
  return user.role === 'vp' && (visibleDomainIds(user, [domainId]) ?? []).includes(domainId)
}

/** Who may EDIT a weekly update — the same data-entry rule as editing the domain. */
export function canEditUpdate(user: CurrentUser, domainId: string): boolean {
  return canEditDomain(user, domainId)
}

/** Who may DELETE a weekly update. */
export function canDeleteUpdate(user: CurrentUser, domainId: string): boolean {
  return canEditDomain(user, domainId)
}

/** Anyone with a persona can comment — enables the leadership ↔ contributor thread. */
export function canComment(_user: CurrentUser): boolean {
  return true
}

/** Admin-level UI gate (add/edit domains, rate card, T-shirt scale). */
export function isAdmin(user: CurrentUser): boolean {
  return canAdminister(user)
}

/** Deletion: admin/sandbox anywhere; contributors within their own domain. */
export function canDeleteProgram(user: CurrentUser, program: Program): boolean {
  return canEditDomain(user, program.domainId)
}

export function canDeleteTask(user: CurrentUser, program: Program): boolean {
  return canDeleteProgram(user, program)
}
