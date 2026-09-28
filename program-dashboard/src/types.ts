// Core domain model for the Program / Project Update Dashboard.
// Every data source (manual entry, Excel, and later Jira / MS Project) is
// normalized into these shapes, so the UI never needs to know where a row
// originated — it just renders programs and tasks.

// Org-hierarchy roles (see src/lib/org.ts). 'sandbox' is a test-only persona.
export type Role = 'contributor' | 'director' | 'senior_director' | 'vp' | 'admin' | 'sandbox'

export type RagStatus = 'green' | 'amber' | 'red'

export type Priority = 'high' | 'medium' | 'low'

/** Every project is one of three types, used for filtering and the timeline view. */
export type ProjectType = 'enhancement' | 'initiative' | 'technical'
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  enhancement: 'Enhancement',
  initiative: 'Initiative / Feature',
  technical: 'Technical',
}
export const PROJECT_TYPE_COLORS: Record<ProjectType, string> = {
  enhancement: '#0891b2',
  initiative: '#7c3aed',
  technical: '#ea580c',
}

/** Capital vs operating expenditure — set per project, used in budget reporting. */
export type Funding = 'capex' | 'opex'
export const FUNDING_LABELS: Record<Funding, string> = {
  capex: 'CapEx',
  opex: 'OpEx',
}

export type ProgramStatus =
  | 'not_started'
  | 'on_track'
  | 'at_risk'
  | 'delayed'
  | 'blocked'
  | 'on_hold'
  | 'completed'
  | 'cancelled'
  | 'postponed'
  | 'descoped'

export type DataSource = 'manual' | 'excel' | 'jira' | 'msproject'

export interface Domain {
  id: string
  name: string
  managerName: string
  /** Hex color used for the card accent and portfolio-view bars. */
  color: string
  description?: string
  /** Top-down allocated fund for this domain (currency units). Programs draw from it. */
  budget?: number
}

/** A cost role on the vendor/rate card (e.g. Developer, PM, BA, Scrum Master). */
export interface RateCardEntry {
  role: string
  /** Cost per person-day for this role (currency units). */
  dayRate: number
  /** Story points this role delivers per 3-week sprint. Delivery roles (developer,
   *  tech analyst) contribute; support roles (PM, BA, scrum master, RTE) are 0 —
   *  they still cost money and count as team members but don't burn down points. */
  pointsPerSprint: number
}

/** Staffing for a program: how many of each role. */
export interface RolePlanEntry {
  role: string
  count: number
  /** Day rate agreed for this role ON THIS PROJECT. Copied from the rate card when
   *  the project is saved, then owned by the project — later rate-card edits don't
   *  move it. Directors / VPs / Admin can change it on the project. */
  dayRate?: number
  /** Third-party vendor supplying this role (blank = internal staff). */
  vendor?: string
}

/** A non-labour cost line on a program (infrastructure, licences, etc.). */
export interface CostLine {
  label: string
  amount: number
}

/**
 * One resource-role's ACTUAL cost for a program in a given month, tagged
 * CapEx/OpEx. Entered manually for budget reconciliation (planned vs actual).
 */
export interface MonthlyActualLine {
  /** Rate-card role (Developer, PM, BA, …) or a custom label. */
  role: string
  /** Actual cost incurred that month (currency units). */
  cost: number
  /** Capital vs operating — can differ per role/month within one program. */
  funding: Funding
}

/** A program's actual spend for one calendar month, broken down by resource role. */
export interface MonthlyActual {
  /** Calendar month, 'YYYY-MM'. */
  month: string
  lines: MonthlyActualLine[]
}

/**
 * A locked baseline — the originally-agreed plan, captured when the roadmap is
 * signed off. Once set it never changes, so the "originally planned" view is
 * always preserved even as the live dates move.
 */
export interface Baseline {
  startDate: string
  endDate: string
  estimatedPoints?: number
  /** Agreed total cost at lock time (team × project rates + other costs). The
   *  Monthly Budget's "planned" line spreads THIS over the baseline months, so a
   *  later slip or rate change shows up as variance instead of moving the plan. */
  plannedCost?: number
  /** ISO datetime the baseline was locked. */
  lockedAt: string
  lockedBy: string
}

/**
 * A mid-flight scope addition. Flagged on the timeline as a dated marker; when it
 * carries a newEndDate the program's live end date moves out to it (the baseline
 * stays put, so you can compare planned vs. current delivery).
 */
export interface ScopeChange {
  id: string
  /** ISO date the scope changed. */
  date: string
  author: string
  note: string
  /** New planned end date after this scope change. */
  newEndDate?: string
  /** Extra story points added by this scope. */
  addedPoints?: number
}

export interface Task {
  id: string
  programId: string
  name: string
  /** ISO date, yyyy-MM-dd. */
  startDate: string
  /** ISO date, yyyy-MM-dd. Inclusive. */
  endDate: string
  percentComplete: number // 0-100
  /** Story points — 1 SP = 1 day in this team's convention. */
  storyPoints?: number
  assignee?: string
  /** A milestone renders as a diamond marker rather than a bar. */
  milestone: boolean
  /** Task ids this task depends on (drawn as dependency arrows). */
  predecessorIds: string[]
  source: DataSource
  /** Stable id from the source system, used to upsert on re-import/sync. */
  externalId?: string
}

export interface StatusUpdate {
  id: string
  /** Set for a project-level update. Omitted on a domain-level weekly update. */
  programId?: string
  /** Set for a DOMAIN-level weekly update (one card covering the whole team). */
  domainId?: string
  /** ISO date, yyyy-MM-dd. */
  date: string
  author: string
  // Structured weekly-report sections (all optional).
  progress?: string
  nextWeeks?: string
  nextMonths?: string
  upcomingRelease?: string
  releasedItems?: string
  concerns?: string
  blockers?: string
  risks?: string
  /** Legacy free-text summary (kept so older updates still render). */
  note?: string
}

export type UpdateSectionKey =
  | 'progress'
  | 'nextWeeks'
  | 'nextMonths'
  | 'upcomingRelease'
  | 'releasedItems'
  | 'concerns'
  | 'blockers'
  | 'risks'

/** Ordered sections used to render and edit a weekly update. */
export const UPDATE_SECTIONS: {
  key: UpdateSectionKey
  label: string
  placeholder: string
  tone: 'default' | 'warn' | 'release'
}[] = [
  { key: 'progress', label: 'Progress this week', placeholder: 'What did the team accomplish this week?', tone: 'default' },
  { key: 'nextWeeks', label: 'Plan — next 1–2 weeks', placeholder: 'What is planned for the next 1–2 weeks?', tone: 'default' },
  { key: 'nextMonths', label: 'Plan — next 1–3 months', placeholder: 'What is coming up in the next 1–3 months?', tone: 'default' },
  { key: 'upcomingRelease', label: 'Upcoming release', placeholder: 'What is releasing soon (sprint / UAT / go-live) + a short description?', tone: 'release' },
  { key: 'releasedItems', label: 'Released items', placeholder: 'What went live to production this cycle?', tone: 'release' },
  { key: 'concerns', label: 'Concerns', placeholder: 'Any concerns to flag?', tone: 'warn' },
  { key: 'blockers', label: 'Blockers', placeholder: 'Anything blocking progress?', tone: 'warn' },
  { key: 'risks', label: 'Risks', placeholder: 'Key risks and mitigations?', tone: 'warn' },
]

/**
 * A comment / response on a weekly update. Anyone (leadership or the project's
 * manager) can post, so an update becomes a two-way discussion thread — Vanessa
 * asks a question, the manager replies.
 */
export interface UpdateComment {
  id: string
  updateId: string
  author: string
  /** Commenter's role at post time — drives a Leadership / Manager badge. */
  role?: Role
  text: string
  /** ISO datetime. */
  date: string
}

/** One field-level change captured when an update is edited. */
export interface UpdateFieldChange {
  /** A StatusUpdate section key (or 'note'). */
  field: string
  from: string
  to: string
}

/**
 * An edit-history entry, recorded every time an update's content changes. This
 * preserves what was there before — especially the manager's original wording
 * when leadership edits it — so nothing is silently overwritten.
 */
export interface UpdateEdit {
  id: string
  updateId: string
  editor: string
  editorRole?: Role
  /** ISO datetime. */
  date: string
  changes: UpdateFieldChange[]
}

export interface Program {
  id: string
  domainId: string
  name: string
  description?: string
  owner: string
  status: ProgramStatus
  ragStatus: RagStatus
  /** Enhancement / Initiative-Feature / Technical — used for the domain-view filter and timeline grouping. */
  projectType?: ProjectType
  /** Capital vs operating expenditure — used for budget reporting. */
  funding?: Funding
  /** The locked, originally-agreed plan (set from the project page once agreed). */
  baseline?: Baseline
  /** Scope additions logged mid-flight (drive timeline markers + date extension). */
  scopeChanges?: ScopeChange[]
  startDate: string
  endDate: string
  /** Manual overall progress (0-100). Used when the program has no tasks;
   *  when tasks exist, progress is averaged from them instead. */
  percentComplete?: number
  /** High-level total story-point estimate, used for early forecasting before
   *  tasks are broken down and pointed. */
  estimatedPoints?: number
  priority?: Priority
  /** ISO date the current status was set — used to mark status changes
   *  (blocked / on-hold / cancelled …) on the timeline. */
  statusDate?: string
  /** True if this planned project was later deprioritized (feeds the
   *  planning-effectiveness metric). */
  deprioritized?: boolean
  deprioritizedReason?: string
  deprioritizedDate?: string
  /** Resource plan vs. reality — headcount / FTEs. Drives utilization and the
   *  delivery-risk signal. */
  plannedResources?: number
  currentResources?: number
  source: DataSource
  externalId?: string
  lastSyncedAt?: string
  // ---- Budget (see src/lib/budget.ts) ----
  /** Staffing by role — drives the labour-cost estimate. */
  rolePlan?: RolePlanEntry[]
  /** Non-labour cost lines (infrastructure, licences, …). */
  otherCosts?: CostLine[]
  /** Approved/allocated budget for this program (fund granted). Defaults to the estimate. */
  approvedBudget?: number
  /** Manual actual spend-to-date override; when unset, spend is derived from % complete. */
  spentOverride?: number
  /** Month-by-month actual spend, entered manually for budget reconciliation. */
  monthlyActuals?: MonthlyActual[]
}

/**
 * An audit-trail entry recorded every time a program's status changes. A
 * comment is mandatory (captured in the form before the change is allowed), so
 * every transition carries a reason for leadership review.
 */
export interface StatusChange {
  id: string
  programId: string
  /** ISO date, yyyy-MM-dd. */
  date: string
  author: string
  fromStatus: ProgramStatus
  toStatus: ProgramStatus
  /** Mandatory reason / comment for the change. */
  note: string
}

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  not_started: 'Not started',
  on_track: 'On track',
  at_risk: 'At risk',
  delayed: 'Delayed',
  blocked: 'Blocked',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  postponed: 'Postponed',
  descoped: 'Descoped',
}

/** Statuses that place a dated marker on the timeline (status change events). */
export const MARKED_STATUSES: ProgramStatus[] = [
  'blocked',
  'on_hold',
  'cancelled',
  'postponed',
  'descoped',
]

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  manual: 'Manual',
  excel: 'Excel',
  jira: 'Jira',
  msproject: 'MS Project',
}
