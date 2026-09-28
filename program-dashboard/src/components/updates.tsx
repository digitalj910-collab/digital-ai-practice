import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Ban,
  CalendarClock,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  History,
  MessageSquare,
  PackageCheck,
  Pencil,
  Rocket,
  Send,
  ShieldAlert,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { canEditDomain, useStore } from '../store/useStore'
import { fmtDate, toIso } from '../lib/dates'
import { Button, Field, Modal, RagBadge, inputClass } from './ui'
import {
  UPDATE_SECTIONS,
  type Domain,
  type Program,
  type Role,
  type StatusUpdate,
  type UpdateComment,
  type UpdateEdit,
  type UpdateSectionKey,
} from '../types'

const ROLE_BADGE: Record<Role, { label: string; cls: string }> = {
  contributor: { label: 'Manager', cls: 'bg-slate-100 text-slate-600' },
  director: { label: 'Director', cls: 'bg-brand-100 text-brand-700' },
  vp: { label: 'VP', cls: 'bg-purple-100 text-purple-700' },
  admin: { label: 'Admin', cls: 'bg-teal-100 text-teal-700' },
}

// Safe lookup — older data may carry a retired role value; fall back gracefully.
function roleBadge(r?: string): { label: string; cls: string } {
  return (r && ROLE_BADGE[r as Role]) || { label: 'Member', cls: 'bg-slate-100 text-slate-600' }
}

const FIELD_LABEL: Record<string, string> = {
  ...Object.fromEntries(UPDATE_SECTIONS.map((s) => [s.key, s.label])),
  note: 'Note',
}

/** Compact "24 Aug, 14:10" style stamp for comment / edit datetimes. */
function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const SECTION_ICON: Record<UpdateSectionKey, typeof TrendingUp> = {
  progress: TrendingUp,
  nextWeeks: CalendarClock,
  nextMonths: CalendarRange,
  upcomingRelease: Rocket,
  releasedItems: PackageCheck,
  concerns: AlertCircle,
  blockers: Ban,
  risks: ShieldAlert,
}

const TONE_ICON: Record<string, string> = {
  default: 'text-slate-400',
  warn: 'text-amber-500',
  release: 'text-emerald-500',
}
const TONE_LABEL: Record<string, string> = {
  default: 'text-slate-400',
  warn: 'text-amber-600',
  release: 'text-emerald-600',
}
const TONE_BORDER: Record<string, string> = {
  default: 'border-slate-200',
  warn: 'border-amber-400 bg-amber-50/40',
  release: 'border-emerald-400 bg-emerald-50/40',
}
const TONE_FOCUS: Record<string, string> = {
  default: '',
  warn: 'focus:border-amber-500 focus:ring-amber-500',
  release: 'focus:border-emerald-500 focus:ring-emerald-500',
}

// ---- Weekly update form (structured) -----------------------------------

export function UpdateForm({
  open,
  onClose,
  programId,
  existing,
}: {
  open: boolean
  onClose: () => void
  /** Fixed program (from a program page). Omit to let the user pick. */
  programId?: string
  existing?: StatusUpdate
}) {
  const programs = useStore((s) => s.programs)
  const domains = useStore((s) => s.domains)
  const user = useStore((s) => s.currentUser)
  const addUpdate = useStore((s) => s.addUpdate)
  const updateUpdate = useStore((s) => s.updateUpdate)

  const domainById = useMemo(() => new Map(domains.map((d) => [d.id, d])), [domains])
  const editablePrograms = useMemo(
    () => programs.filter((p) => canEditDomain(user, p.domainId)),
    [programs, user],
  )

  const fixedProgramId = programId ?? existing?.programId
  const [selectedProgram, setSelectedProgram] = useState(
    fixedProgramId ?? editablePrograms[0]?.id ?? '',
  )
  const [form, setForm] = useState<Record<UpdateSectionKey, string>>(() => ({
    progress: existing?.progress ?? '',
    nextWeeks: existing?.nextWeeks ?? '',
    nextMonths: existing?.nextMonths ?? '',
    upcomingRelease: existing?.upcomingRelease ?? '',
    releasedItems: existing?.releasedItems ?? '',
    concerns: existing?.concerns ?? '',
    blockers: existing?.blockers ?? '',
    risks: existing?.risks ?? '',
  }))

  const targetProgram = fixedProgramId ?? selectedProgram
  const hasContent = UPDATE_SECTIONS.some((s) => form[s.key].trim())
  const valid = Boolean(targetProgram) && hasContent

  const save = () => {
    if (!valid) return
    const patch: Partial<StatusUpdate> = {}
    for (const s of UPDATE_SECTIONS) patch[s.key] = form[s.key].trim() || undefined
    if (existing) {
      updateUpdate(existing.id, patch)
    } else {
      addUpdate({ programId: targetProgram, date: toIso(new Date()), author: user.name, ...patch })
    }
    onClose()
  }

  const fixed = programs.find((p) => p.id === fixedProgramId)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit weekly update' : 'New weekly update'}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {fixed ? (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {domainById.get(fixed.domainId)?.name} · <strong>{fixed.name}</strong>
          </div>
        ) : (
          <Field label="Project">
            <select
              className={inputClass}
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
            >
              {editablePrograms.map((p) => (
                <option key={p.id} value={p.id}>
                  {domainById.get(p.domainId)?.name} · {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {UPDATE_SECTIONS.map((s) => {
            const Icon = SECTION_ICON[s.key]
            return (
              <Field
                key={s.key}
                label={
                  <span className="flex items-center gap-1.5">
                    <Icon size={14} className={TONE_ICON[s.tone]} />
                    {s.label}
                  </span>
                }
              >
                <textarea
                  className={`${inputClass} min-h-[70px] ${TONE_FOCUS[s.tone]}`}
                  rows={2}
                  placeholder={s.placeholder}
                  value={form[s.key]}
                  onChange={(e) => setForm((f) => ({ ...f, [s.key]: e.target.value }))}
                />
              </Field>
            )
          })}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid}>
            {existing ? 'Save update' : 'Post update'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ---- Weekly update card (display) --------------------------------------

export function UpdateCard({
  update,
  program,
  domain,
  onOpenProgram,
  onEdit,
  onDelete,
  comments = [],
  edits = [],
  currentUserName,
  currentUserRole,
  canComment = false,
  onAddComment,
  onDeleteComment,
  commentsMode = 'full',
}: {
  update: StatusUpdate
  program?: Program
  domain?: Domain
  onOpenProgram?: () => void
  onEdit?: () => void
  onDelete?: () => void
  comments?: UpdateComment[]
  edits?: UpdateEdit[]
  currentUserName?: string
  currentUserRole?: Role
  canComment?: boolean
  onAddComment?: (text: string) => void
  onDeleteComment?: (id: string) => void
  /** 'full' = whole thread + composer (project view); 'latest' = only the most
   *  recent comment with a link into the project (compact weekly list). */
  commentsMode?: 'full' | 'latest'
}) {
  const sections = UPDATE_SECTIONS.filter((s) => update[s.key]?.trim())
  // A domain-level weekly update has no program — title it as the team's update.
  const isDomainUpdate = !program && !!update.domainId
  const title = program?.name ?? (isDomainUpdate ? 'Team weekly update' : 'Unknown project')
  const sortedComments = [...comments].sort((a, b) => a.date.localeCompare(b.date))
  const sortedEdits = [...edits].sort((a, b) => b.date.localeCompare(a.date))
  const [showHistory, setShowHistory] = useState(false)
  const [draft, setDraft] = useState('')

  const postComment = () => {
    const text = draft.trim()
    if (!text || !onAddComment) return
    onAddComment(text)
    setDraft('')
  }

  const isLatestMode = commentsMode === 'latest'
  // Weekly list shows only the most recent comment; the full thread + composer
  // live in the project view.
  const visibleComments = isLatestMode ? sortedComments.slice(-1) : sortedComments
  const showCommentsBlock = isLatestMode
    ? sortedComments.length > 0
    : canComment || sortedComments.length > 0

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: domain?.color ?? '#94a3b8' }}
          />
          {onOpenProgram ? (
            <button onClick={onOpenProgram} className="truncate font-medium text-slate-900 hover:underline">
              {title}
            </button>
          ) : (
            <span className="truncate font-medium text-slate-900">{title}</span>
          )}
          {domain && <span className="shrink-0 text-xs text-slate-400">{domain.name}</span>}
          {program && <RagBadge rag={program.ragStatus} />}
          {isDomainUpdate && (
            <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
              Team
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1 text-xs text-slate-400">
            {update.author} · {fmtDate(update.date)}
          </span>
          {onEdit && (
            <button
              onClick={onEdit}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Edit update"
            >
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              title="Delete update"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {sections.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sections.map((s) => {
            const Icon = SECTION_ICON[s.key]
            return (
              <div key={s.key} className={`rounded-lg border-l-2 pl-3 ${TONE_BORDER[s.tone]}`}>
                <div
                  className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${TONE_LABEL[s.tone]}`}
                >
                  <Icon size={13} />
                  {s.label}
                </div>
                <p className="mt-0.5 text-sm text-slate-700">{update[s.key]}</p>
              </div>
            )
          })}
        </div>
      ) : (
        update.note && <p className="mt-2 text-sm text-slate-600">{update.note}</p>
      )}

      {/* Edit history — preserves what was changed (and by whom). */}
      {sortedEdits.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {showHistory ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <History size={13} />
            Edited {sortedEdits.length} time{sortedEdits.length === 1 ? '' : 's'} · last by{' '}
            {sortedEdits[0].editor}
          </button>
          {showHistory && (
            <div className="mt-2 space-y-2">
              {sortedEdits.map((e) => (
                <div key={e.id} className="rounded-lg bg-slate-50 p-2.5 text-xs">
                  <div className="mb-1 flex items-center gap-1.5 text-slate-500">
                    <span className="font-medium text-slate-700">{e.editor}</span>
                    {e.editorRole && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${roleBadge(e.editorRole).cls}`}>
                        {roleBadge(e.editorRole).label}
                      </span>
                    )}
                    <span>· {fmtDateTime(e.date)}</span>
                  </div>
                  <div className="space-y-1">
                    {e.changes.map((c, i) => (
                      <div key={i} className="text-slate-600">
                        <span className="font-semibold text-slate-500">{FIELD_LABEL[c.field] ?? c.field}:</span>{' '}
                        <span className="text-rose-500 line-through">{c.from || '(empty)'}</span>{' '}
                        <span className="text-slate-400">→</span>{' '}
                        <span className="text-emerald-600">{c.to || '(empty)'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comments — a leadership ↔ manager discussion thread. */}
      {showCommentsBlock && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <MessageSquare size={13} />
            {sortedComments.length > 0
              ? `${sortedComments.length} comment${sortedComments.length === 1 ? '' : 's'}`
              : 'Comments'}
            {isLatestMode && sortedComments.length > 1 && (
              <span className="font-normal normal-case tracking-normal text-slate-400">· latest</span>
            )}
          </div>

          {visibleComments.length > 0 && (
            <div className="mb-2 space-y-2">
              {visibleComments.map((c) => (
                <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{c.author}</span>
                    {c.role && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${roleBadge(c.role).cls}`}>
                        {roleBadge(c.role).label}
                      </span>
                    )}
                    <span>· {fmtDateTime(c.date)}</span>
                    {!isLatestMode && onDeleteComment && c.author === currentUserName && (
                      <button
                        onClick={() => onDeleteComment(c.id)}
                        className="ml-auto rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-600"
                        title="Delete comment"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{c.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Compact weekly list: link into the project for the full thread. */}
          {isLatestMode && onOpenProgram && (
            <button
              onClick={onOpenProgram}
              className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"
            >
              {sortedComments.length > 1
                ? `View all ${sortedComments.length} comments in project`
                : 'Open thread in project'}
              <ChevronRight size={13} />
            </button>
          )}

          {/* Full thread (project view): composer. */}
          {!isLatestMode && canComment && onAddComment && (
            <div className="flex items-center gap-2">
              {currentUserRole && (
                <span className={`hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold sm:inline ${roleBadge(currentUserRole).cls}`}>
                  {roleBadge(currentUserRole).label}
                </span>
              )}
              <input
                className={`${inputClass} py-1.5 text-sm`}
                placeholder="Add a comment or reply…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    postComment()
                  }
                }}
              />
              <Button variant="secondary" onClick={postComment} disabled={!draft.trim()}>
                <Send size={14} />
                Post
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
