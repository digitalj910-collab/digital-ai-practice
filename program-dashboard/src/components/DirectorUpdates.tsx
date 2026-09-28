import { useState } from 'react'
import { subDays } from 'date-fns'
import { Pencil, Send, Trash2 } from 'lucide-react'
import { canAdminister, visibleDomainIds, useStore } from '../store/useStore'
import { directorById } from '../lib/org'
import { fmtDate, toIso } from '../lib/dates'
import type { DirectorUpdate, StatusUpdate } from '../types'
import { Button, Field, Modal, inputClass } from './ui'

/** One director → VP update, rendered as a card. */
export function DirectorUpdateCard({
  update,
  onEdit,
  onDelete,
}: {
  update: DirectorUpdate
  onEdit?: () => void
  onDelete?: () => void
}) {
  const sections: [string, string | undefined, string][] = [
    ['Summary', update.summary, 'text-slate-700'],
    ['Risks & escalations', update.risks, 'text-amber-800'],
    ['Asks of the VP', update.asks, 'text-brand-700'],
  ]
  return (
    <article className="rounded-xl border border-purple-200 bg-white p-4 shadow-sm">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
          Director → VP
        </span>
        <span className="text-sm font-semibold text-slate-800">{update.author}</span>
        <span className="text-xs text-slate-400">{fmtDate(update.date)}</span>
        <span className="ml-auto flex gap-1">
          {onEdit && (
            <button onClick={onEdit} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit">
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete">
              <Trash2 size={14} />
            </button>
          )}
        </span>
      </header>
      <div className="space-y-2">
        {sections
          .filter(([, text]) => text?.trim())
          .map(([label, text, cls]) => (
            <div key={label}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
              <p className={`whitespace-pre-line text-sm ${cls}`}>{text}</p>
            </div>
          ))}
      </div>
    </article>
  )
}

/** Build a starting draft from the managers' team check-ins of the last 7 days. */
function draftFromCheckIns(updates: StatusUpdate[], domainName: (id: string) => string) {
  const since = toIso(subDays(new Date(), 7))
  // Latest check-in per team.
  const latest = new Map<string, StatusUpdate>()
  for (const u of updates)
    if (u.domainId && u.date >= since && (!latest.get(u.domainId) || u.date > latest.get(u.domainId)!.date))
      latest.set(u.domainId, u)
  const teams = [...latest.values()]
  const line = (u: StatusUpdate, text?: string) => (text?.trim() ? `• ${domainName(u.domainId!)}: ${text.trim()}` : '')
  return {
    summary: teams.map((u) => line(u, u.progress ?? u.note)).filter(Boolean).join('\n'),
    risks: teams
      .map((u) => line(u, [u.blockers, u.concerns, u.risks].filter((x) => x?.trim()).join(' ')))
      .filter(Boolean)
      .join('\n'),
  }
}

/** Write or edit the director's weekly update to the VP. */
export function DirectorUpdateForm({ onClose, existing }: { onClose: () => void; existing?: DirectorUpdate }) {
  const user = useStore((s) => s.currentUser)
  const allDomains = useStore((s) => s.domains)
  const updates = useStore((s) => s.updates)
  const add = useStore((s) => s.addDirectorUpdate)
  const update = useStore((s) => s.updateDirectorUpdate)

  const visIds = visibleDomainIds(user, allDomains.map((d) => d.id))
  const mine = updates.filter((u) => u.domainId && (!visIds || visIds.includes(u.domainId)))
  const draft = existing ? undefined : draftFromCheckIns(mine, (id) => allDomains.find((d) => d.id === id)?.name ?? id)

  const [form, setForm] = useState({
    summary: existing?.summary ?? draft?.summary ?? '',
    risks: existing?.risks ?? draft?.risks ?? '',
    asks: existing?.asks ?? '',
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.summary.trim()) return
    const body = { summary: form.summary.trim(), risks: form.risks.trim() || undefined, asks: form.asks.trim() || undefined }
    if (existing) update(existing.id, body)
    else add({ ...body, directorId: user.directorId ?? 'dir_ec', author: user.name, date: toIso(new Date()) })
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={existing ? 'Edit update to the VP' : "This week's update to the VP"} maxWidth="max-w-2xl">
      <div className="space-y-4">
        {!existing && (
          <p className="rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-800">
            Pre-filled from your managers' check-ins this week — trim it to what the VP needs to know.
          </p>
        )}
        <Field label="Summary" hint="The overall picture across your teams.">
          <textarea className={inputClass} rows={6} value={form.summary} onChange={(e) => set('summary', e.target.value)} />
        </Field>
        <Field label="Risks & escalations">
          <textarea className={inputClass} rows={4} value={form.risks} onChange={(e) => set('risks', e.target.value)} />
        </Field>
        <Field label="Asks of the VP" hint="Decisions or help you need.">
          <textarea className={inputClass} rows={2} value={form.asks} onChange={(e) => set('asks', e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>
            <Send size={15} /> {existing ? 'Save' : 'Send to VP'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** The director → VP updates section: the director writes, the VP reads. */
export function DirectorUpdatesPanel({ limit }: { limit?: number }) {
  const user = useStore((s) => s.currentUser)
  const all = useStore((s) => s.directorUpdates)
  const remove = useStore((s) => s.deleteDirectorUpdate)
  const [form, setForm] = useState<{ open: boolean; existing?: DirectorUpdate }>({ open: false })

  // Directors see their own; the VP sees their directors'; admin sees all.
  const visible = all
    .filter((u) => {
      if (user.role === 'director') return u.directorId === user.directorId
      if (user.role === 'vp') return directorById(u.directorId)?.vpId === user.vpId
      return true
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
  const canWrite = user.role === 'director'
  const canManage = (u: DirectorUpdate) => canAdminister(user) || (canWrite && u.directorId === user.directorId)

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Director updates to the VP</h2>
          <p className="text-sm text-slate-500">
            {canWrite
              ? 'Your weekly rollup for the VP — pre-filled from your managers’ check-ins.'
              : 'The weekly rollup from the director across all teams.'}
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setForm({ open: true })}>
            <Send size={15} /> Write this week's update
          </Button>
        )}
      </div>
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
          No director updates yet.
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((u) => (
            <DirectorUpdateCard
              key={u.id}
              update={u}
              onEdit={canManage(u) ? () => setForm({ open: true, existing: u }) : undefined}
              onDelete={
                canManage(u)
                  ? () => {
                      if (confirm('Delete this update?')) remove(u.id)
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
      {form.open && <DirectorUpdateForm existing={form.existing} onClose={() => setForm({ open: false })} />}
    </section>
  )
}
