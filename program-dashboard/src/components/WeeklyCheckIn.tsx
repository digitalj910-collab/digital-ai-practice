import { useEffect, useMemo, useState } from 'react'
import { startOfWeek } from 'date-fns'
import { CheckCircle2 } from 'lucide-react'
import { canEditDomain, useStore } from '../store/useStore'
import { fmtDate, toIso } from '../lib/dates'
import { Button, Modal, StatusBadge, inputClass } from './ui'
import {
  MARKED_STATUSES,
  PROGRAM_STATUS_LABELS,
  UPDATE_SECTIONS,
  type ProgramStatus,
  type StatusUpdate,
  type UpdateSectionKey,
} from '../types'

type Narrative = Record<UpdateSectionKey, string>

const TONE_LABEL: Record<string, string> = {
  default: 'text-slate-500',
  warn: 'text-amber-600',
  release: 'text-emerald-600',
}

const STATUS_OPTIONS = Object.keys(PROGRAM_STATUS_LABELS) as ProgramStatus[]

function emptyNarrative(): Narrative {
  return {
    progress: '',
    nextWeeks: '',
    nextMonths: '',
    upcomingRelease: '',
    releasedItems: '',
    concerns: '',
    blockers: '',
    risks: '',
  }
}

function narrativeFrom(u: StatusUpdate): Narrative {
  return {
    progress: u.progress ?? '',
    nextWeeks: u.nextWeeks ?? '',
    nextMonths: u.nextMonths ?? '',
    upcomingRelease: u.upcomingRelease ?? '',
    releasedItems: u.releasedItems ?? '',
    concerns: u.concerns ?? '',
    blockers: u.blockers ?? '',
    risks: u.risks ?? '',
  }
}

/**
 * The domain weekly card — ONE update for the whole team (not one per project).
 * The manager writes a single narrative for the domain, and can flip any
 * project's status right on the card; on submit those status changes update the
 * projects (and the timeline markers) with a captured reason.
 */
export function WeeklyCheckIn({
  open,
  onClose,
  domainId,
}: {
  open: boolean
  onClose: () => void
  /** Fixed domain (from the Domain view). Omit to let the user pick their team. */
  domainId?: string
}) {
  const programs = useStore((s) => s.programs)
  const domains = useStore((s) => s.domains)
  const updates = useStore((s) => s.updates)
  const user = useStore((s) => s.currentUser)
  const addUpdate = useStore((s) => s.addUpdate)
  const updateUpdate = useStore((s) => s.updateUpdate)
  const updateProgram = useStore((s) => s.updateProgram)
  const addStatusChange = useStore((s) => s.addStatusChange)

  const editableDomains = useMemo(
    () => domains.filter((d) => canEditDomain(user, d.id)),
    [domains, user],
  )
  const defaultDomain =
    domainId ??
    (user.domainId && editableDomains.some((d) => d.id === user.domainId)
      ? user.domainId
      : editableDomains[0]?.id) ??
    ''
  const [selected, setSelected] = useState(defaultDomain)
  const targetDomainId = domainId ?? selected
  const domain = domains.find((d) => d.id === targetDomainId)

  const thisWeekStart = toIso(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const domainPrograms = useMemo(
    () => programs.filter((p) => p.domainId === targetDomainId),
    [programs, targetDomainId],
  )

  // The domain's own weekly update already posted this week (so we amend it).
  const existing = useMemo(() => {
    let latest: StatusUpdate | undefined
    for (const u of updates) {
      if (u.domainId === targetDomainId && u.date >= thisWeekStart) {
        if (!latest || u.date > latest.date) latest = u
      }
    }
    return latest
  }, [updates, targetDomainId, thisWeekStart])

  const [narrative, setNarrative] = useState<Narrative>(() =>
    existing ? narrativeFrom(existing) : emptyNarrative(),
  )
  // Draft status + reason per project (reason required only when the status changes).
  const [statusDraft, setStatusDraft] = useState<Record<string, ProgramStatus>>({})
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({})

  // Re-seed the drafts whenever the target domain (or its existing update) changes.
  useEffect(() => {
    setNarrative(existing ? narrativeFrom(existing) : emptyNarrative())
    setStatusDraft(Object.fromEntries(domainPrograms.map((p) => [p.id, p.status])))
    setReasonDraft({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDomainId, existing?.id])

  const setField = (key: UpdateSectionKey, val: string) =>
    setNarrative((n) => ({ ...n, [key]: val }))

  const hasNarrative = UPDATE_SECTIONS.some((s) => narrative[s.key]?.trim())
  const changed = domainPrograms.filter((p) => statusDraft[p.id] && statusDraft[p.id] !== p.status)
  const missingReason = changed.some((p) => !reasonDraft[p.id]?.trim())
  const valid = (hasNarrative || changed.length > 0) && !missingReason

  const save = () => {
    if (!valid) return
    const today = toIso(new Date())

    // 1) The single domain-level narrative update (create or amend this week's).
    if (hasNarrative) {
      const patch: Partial<StatusUpdate> = {}
      for (const s of UPDATE_SECTIONS) patch[s.key] = narrative[s.key].trim() || undefined
      if (existing) updateUpdate(existing.id, { author: user.name, ...patch })
      else addUpdate({ domainId: targetDomainId, date: today, author: user.name, ...patch })
    }

    // 2) Per-project status changes → update the project + audit trail + timeline.
    for (const p of changed) {
      const toStatus = statusDraft[p.id]
      const marked = MARKED_STATUSES.includes(toStatus)
      updateProgram(p.id, { status: toStatus, statusDate: marked ? today : undefined })
      addStatusChange({
        programId: p.id,
        date: today,
        author: user.name,
        fromStatus: p.status,
        toStatus,
        note: reasonDraft[p.id].trim(),
      })
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Weekly check-in${domain ? ` · ${domain.name}` : ''} · week of ${fmtDate(thisWeekStart)}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          One update for the whole team this week. Write the domain narrative below, and set any
          project's status on the right — changing a status updates that project and its timeline
          marker once you post.
        </p>

        {/* Team picker — only when opened without a fixed domain (admin / leadership). */}
        {!domainId && editableDomains.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium">Team</span>
            <select
              className={`${inputClass} max-w-xs`}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {editableDomains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {!domain ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
            You don't have a team to check in for.
          </div>
        ) : (
          <>
            {existing && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <CheckCircle2 size={14} />
                Amending this week's update — posted {fmtDate(existing.date)} by {existing.author}.
              </div>
            )}

            {/* 1) The one domain narrative */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">This week — {domain.name}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {UPDATE_SECTIONS.map((s) => (
                  <label key={s.key} className="block">
                    <span
                      className={`mb-1 block text-xs font-semibold uppercase tracking-wide ${TONE_LABEL[s.tone]}`}
                    >
                      {s.label}
                    </span>
                    <textarea
                      className={`${inputClass} min-h-[58px]`}
                      rows={2}
                      placeholder={s.placeholder}
                      value={narrative[s.key]}
                      onChange={(e) => setField(s.key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* 2) Per-project status capture */}
            {domainPrograms.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-slate-800">
                  Project statuses
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    change only what moved — a reason is required and goes on the timeline
                  </span>
                </h3>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {domainPrograms.map((p) => {
                    const to = statusDraft[p.id] ?? p.status
                    const didChange = to !== p.status
                    return (
                      <div key={p.id} className="p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                            {p.name}
                          </span>
                          <StatusBadge status={p.status} />
                          <span className="text-slate-300">→</span>
                          <select
                            className={`${inputClass} max-w-[10rem] py-1 text-sm`}
                            value={to}
                            onChange={(e) =>
                              setStatusDraft((d) => ({ ...d, [p.id]: e.target.value as ProgramStatus }))
                            }
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {PROGRAM_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                        {didChange && (
                          <input
                            className={`${inputClass} mt-2 border-amber-300 bg-amber-50/40 py-1.5 text-sm`}
                            placeholder={`Reason for ${PROGRAM_STATUS_LABELS[to]} (required) — added to the audit trail`}
                            value={reasonDraft[p.id] ?? ''}
                            onChange={(e) => setReasonDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs text-slate-500">
                {changed.length > 0
                  ? `${changed.length} status change${changed.length === 1 ? '' : 's'}${hasNarrative ? ' + update' : ''}`
                  : hasNarrative
                    ? 'Weekly update ready'
                    : 'Add a note or change a status to post'}
                {missingReason && <span className="ml-2 text-red-600">· add a reason for each status change</span>}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={!valid}>
                  {existing ? 'Save check-in' : 'Post check-in'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
