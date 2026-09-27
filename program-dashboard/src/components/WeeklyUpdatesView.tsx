import { useMemo, useState } from 'react'
import { startOfWeek, endOfWeek, subDays } from 'date-fns'
import { CalendarCheck, CalendarDays, CheckCircle2, Clock, ClipboardCheck, ClipboardList, Download, Filter, FolderKanban, LayoutGrid, MessageSquare } from 'lucide-react'
import { canAdminister, canComment, canEditUpdate, canEditDomain, canDeleteUpdate, managerScope, useStore } from '../store/useStore'
import { fmtDate, parseISO, toIso } from '../lib/dates'
import { exportUpdates } from '../lib/excel'
import { Button, PageHeader, StatTile, inputClass } from './ui'
import { UpdateCard, UpdateForm } from './updates'
import { WeeklyCheckIn } from './WeeklyCheckIn'
import type { StatusUpdate } from '../types'

const PERIODS: { key: string; label: string; days: number }[] = [
  { key: '24h', label: 'Last 24 hours', days: 1 },
  { key: 'week', label: 'Last week', days: 7 },
  { key: '2w', label: 'Last 2 weeks', days: 14 },
  { key: 'month', label: 'Last month', days: 30 },
  { key: '3m', label: 'Last 3 months', days: 90 },
  { key: '6m', label: 'Last 6 months', days: 182 },
  { key: 'year', label: 'Last year', days: 365 },
  { key: 'all', label: 'All time', days: Infinity },
]

export function WeeklyUpdatesView({
  onOpenProgram,
}: {
  onOpenProgram: (programId: string) => void
}) {
  const updates = useStore((s) => s.updates)
  const programs = useStore((s) => s.programs)
  const domains = useStore((s) => s.domains)
  const user = useStore((s) => s.currentUser)
  const scope = managerScope(user)
  const deleteUpdate = useStore((s) => s.deleteUpdate)
  const comments = useStore((s) => s.comments)
  const updateEdits = useStore((s) => s.updateEdits)
  const addComment = useStore((s) => s.addComment)
  const deleteComment = useStore((s) => s.deleteComment)

  const programById = useMemo(() => new Map(programs.map((p) => [p.id, p])), [programs])
  const domainById = useMemo(() => new Map(domains.map((d) => [d.id, d])), [domains])
  const canPost = useMemo(
    () => programs.some((p) => canEditDomain(user, p.domainId)),
    [programs, user],
  )

  const [form, setForm] = useState<{ open: boolean; existing?: StatusUpdate }>({ open: false })
  const [checkIn, setCheckIn] = useState<{ open: boolean; domainId?: string }>({ open: false })

  // The domain a given update belongs to (project update → its program's domain;
  // domain-level weekly update → its own domainId).
  const domainOf = (u: StatusUpdate) =>
    u.programId ? programById.get(u.programId)?.domainId : u.domainId
  const [period, setPeriod] = useState('all')
  const [domainFilter, setDomainFilter] = useState('all')
  const [groupBy, setGroupBy] = useState<'week' | 'domain'>('week')

  const filteredUpdates = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period)?.days ?? Infinity
    const cutoff = isFinite(days) ? toIso(subDays(new Date(), days)) : null
    return updates.filter((u) => {
      if (cutoff && u.date < cutoff) return false
      if (scope && domainOf(u) !== scope) return false // managers: own domain only
      if (domainFilter !== 'all' && domainOf(u) !== domainFilter) return false
      return true
    })
  }, [updates, period, domainFilter, programById, scope])

  // Group updates by domain (for the leadership-friendly "by area" view).
  const byDomain = useMemo(() => {
    const map = new Map<string, StatusUpdate[]>()
    for (const u of filteredUpdates) {
      const key = domainOf(u) ?? 'unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(u)
    }
    return domains
      .filter((d) => map.has(d.id))
      .map((d) => ({
        domain: d,
        items: (map.get(d.id) ?? []).sort((a, b) => b.date.localeCompare(a.date)),
      }))
  }, [filteredUpdates, programById, domains])

  const renderCard = (u: StatusUpdate) => {
    const p = u.programId ? programById.get(u.programId) : undefined
    const dId = p?.domainId ?? u.domainId
    const d = dId ? domainById.get(dId) : undefined
    const editable = dId ? canEditUpdate(user, dId) : false
    const deletable = dId ? canDeleteUpdate(user, dId) : false
    // A domain-level update is edited via its Weekly check-in card; a project
    // update via the single-project form.
    const onEdit = editable
      ? u.domainId
        ? () => setCheckIn({ open: true, domainId: u.domainId })
        : () => setForm({ open: true, existing: u })
      : undefined
    return (
      <UpdateCard
        key={u.id}
        update={u}
        program={p}
        domain={d}
        comments={comments.filter((c) => c.updateId === u.id)}
        edits={updateEdits.filter((e) => e.updateId === u.id)}
        currentUserName={user.name}
        currentUserRole={user.role}
        canComment={canComment(user)}
        commentsMode="latest"
        onAddComment={(text) =>
          addComment({ updateId: u.id, author: user.name, role: user.role, text, date: new Date().toISOString() })
        }
        onDeleteComment={(id) => deleteComment(id)}
        onOpenProgram={p ? () => onOpenProgram(p.id) : undefined}
        onEdit={onEdit}
        onDelete={deletable ? () => deleteUpdate(u.id) : undefined}
      />
    )
  }

  // Group updates into weeks (Mon-start), most recent week first.
  const weeks = useMemo(() => {
    const map = new Map<string, StatusUpdate[]>()
    for (const u of filteredUpdates) {
      const key = toIso(startOfWeek(parseISO(u.date), { weekStartsOn: 1 }))
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(u)
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([weekStart, items]) => ({
        weekStart,
        items: items.sort((a, b) => b.date.localeCompare(a.date)),
      }))
  }, [filteredUpdates])

  const thisWeekStart = toIso(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const thisWeek = weeks.find((w) => w.weekStart === thisWeekStart)
  const thisWeekCount = thisWeek?.items.length ?? 0
  const thisWeekPrograms = new Set((thisWeek?.items ?? []).map((u) => u.programId).filter(Boolean)).size

  // For admin / leadership: which teams have filed this week's check-in and which
  // are still pending. A team's check-in is the domain-level update this week.
  const teamCheckIns = useMemo(
    () =>
      domains.map((d) => ({
        domain: d,
        posted: updates.find((u) => u.domainId === d.id && u.date >= thisWeekStart),
      })),
    [domains, updates, thisWeekStart],
  )
  const checkedInCount = teamCheckIns.filter((t) => t.posted).length
  const showCheckInStatus = canAdminister(user) && domains.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ClipboardList size={22} />}
        accent="#0d9488"
        title="Weekly Updates"
        subtitle="Every project's status updates in one place — your weekly team view & report."
        actions={
          <>
            <Button variant="secondary" onClick={() => exportUpdates(updates, programs, domains)}>
              <Download size={16} />
              Export report
            </Button>
            {canPost && (
              <Button onClick={() => setCheckIn({ open: true })}>
                <ClipboardCheck size={16} />
                Weekly check-in
              </Button>
            )}
          </>
        }
      />

      {/* This-week summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile icon={<CalendarCheck size={20} />} label="Updates this week" value={thisWeekCount} accent="#0d9488" />
        <StatTile icon={<FolderKanban size={20} />} label="Projects updated" value={thisWeekPrograms} accent="#2563eb" />
        <StatTile icon={<MessageSquare size={20} />} label="Total updates" value={scope ? updates.filter((u) => domainOf(u) === scope).length : updates.length} accent="#7c3aed" />
      </div>

      {/* Team check-in status (admin / leadership) — who's done this week, who's pending. */}
      {showCheckInStatus && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">
              Team check-ins · week of {fmtDate(thisWeekStart)}
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                checkedInCount === teamCheckIns.length
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {checkedInCount} of {teamCheckIns.length} checked in
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {teamCheckIns.map(({ domain, posted }) => (
              <button
                key={domain.id}
                onClick={() => setCheckIn({ open: true, domainId: domain.id })}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: domain.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{domain.name}</span>
                  <span className="block truncate text-xs text-slate-400">{domain.managerName}</span>
                </span>
                {posted ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={13} />
                    Checked in · {fmtDate(posted.date)}
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    <Clock size={13} />
                    Pending
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {updates.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
            <Filter size={15} /> Filter
          </span>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            Period
            <select
              className={`${inputClass} w-auto py-1.5`}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            Domain
            <select
              className={`${inputClass} w-auto py-1.5`}
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
            >
              <option value="all">All domains</option>
              {domains
                .filter((d) => !scope || d.id === scope)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-slate-500 sm:inline">Group by</span>
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5">
              {([
                ['week', 'Week', CalendarDays],
                ['domain', 'Domain', LayoutGrid],
              ] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setGroupBy(key)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                    groupBy === key ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Updates */}
      {filteredUpdates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 py-16 text-slate-400">
          <ClipboardList size={24} />
          <p className="text-sm">
            {updates.length === 0
              ? `No updates yet.${canPost ? ' Click “Weekly check-in” to post your first team check-in.' : ''}`
              : 'No updates match these filters.'}
          </p>
        </div>
      ) : groupBy === 'week' ? (
        <div className="space-y-6">
          {weeks.map((w) => {
            const weekEnd = toIso(endOfWeek(parseISO(w.weekStart), { weekStartsOn: 1 }))
            const isThisWeek = w.weekStart === thisWeekStart
            return (
              <section key={w.weekStart}>
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-700">
                    Week of {fmtDate(w.weekStart)}
                  </h2>
                  <span className="text-xs text-slate-400">
                    {fmtDate(w.weekStart)} – {fmtDate(weekEnd)}
                  </span>
                  {isThisWeek && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      This week
                    </span>
                  )}
                </div>
                <div className="space-y-2">{w.items.map(renderCard)}</div>
              </section>
            )
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {byDomain.map(({ domain, items }) => (
            <section key={domain.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: domain.color }} />
                <h2 className="text-sm font-semibold text-slate-700">{domain.name}</h2>
                <span className="text-xs text-slate-400">{domain.managerName}</span>
                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  {items.length} update{items.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="space-y-2">{items.map(renderCard)}</div>
            </section>
          ))}
        </div>
      )}

      {form.open && (
        <UpdateForm
          open={form.open}
          onClose={() => setForm({ open: false })}
          existing={form.existing}
        />
      )}
      {checkIn.open && (
        <WeeklyCheckIn
          open
          onClose={() => setCheckIn({ open: false })}
          domainId={checkIn.domainId}
        />
      )}
    </div>
  )
}

