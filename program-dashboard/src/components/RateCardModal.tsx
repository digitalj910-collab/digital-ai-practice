import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { CURRENCY } from '../lib/budget'
import type { RateCardEntry } from '../types'
import { Button, Modal } from './ui'

/**
 * Editor for a vendor / role rate card. When a `domainId` is given it edits that
 * domain's OWN rate card (each domain/manager can set their own rates); without
 * one it edits the team-wide default. Surfaced from the Domain view and Budget
 * page so budgets can be planned where the projects are.
 */
export function RateCardModal({
  open,
  onClose,
  domainId,
  domainName,
}: {
  open: boolean
  onClose: () => void
  domainId?: string
  domainName?: string
}) {
  const rateCard = useStore((s) => s.rateCard)
  const setRateCard = useStore((s) => s.setRateCard)
  const domainCards = useStore((s) => s.rateCardsByDomain)
  const setDomainRateCard = useStore((s) => s.setDomainRateCard)

  // The card in effect for this domain (its own override, else the team default).
  const current = domainId ? (domainCards[domainId] ?? rateCard) : rateCard
  const [draft, setDraft] = useState<RateCardEntry[]>(current)
  const usingDefault = !!domainId && !domainCards[domainId]

  const save = () => {
    const clean = draft.filter((r) => r.role.trim())
    if (domainId) setDomainRateCard(domainId, clean)
    else setRateCard(clean)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={domainId ? `Rate card · ${domainName ?? 'Domain'}` : 'Vendor / role rate card'}
      maxWidth="max-w-lg"
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Cost per person-day for each role ({CURRENCY}).{' '}
          {domainId ? (
            <>
              This is <strong>{domainName ?? 'this domain'}</strong>'s own rate card — it can differ
              from other teams. {usingDefault && 'It currently mirrors the team default until you save changes here.'}
            </>
          ) : (
            <>Team-wide default — used by any domain that hasn't set its own rates.</>
          )}{' '}
          These rates drive every program's labour-cost estimate on the Estimator, Budget and kickoff.
          <strong> Points/sprint</strong> is how much a role delivers each 3-week sprint — set it for
          delivery roles (developers, tech analysts) and leave it 0 for support roles (PM, BA, scrum
          master), which cost money and count as team members but don't burn down work.
        </p>
        <div className="flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          <span className="flex-1">Role</span>
          <span className="w-28 text-right">Day rate</span>
          <span className="w-20 text-right">Pts/sprint</span>
          <span className="w-6" />
        </div>
        <div className="space-y-2">
          {draft.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                value={r.role}
                onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}
              />
              <span className="text-sm text-slate-400">{CURRENCY}</span>
              <input
                type="number"
                min={0}
                className="w-24 rounded-md border border-slate-200 px-2 py-1.5 text-right text-sm"
                value={r.dayRate}
                onChange={(e) =>
                  setDraft((d) => d.map((x, j) => (j === i ? { ...x, dayRate: Math.max(0, Number(e.target.value) || 0) } : x)))
                }
              />
              <input
                type="number"
                min={0}
                className="w-20 rounded-md border border-slate-200 px-2 py-1.5 text-right text-sm"
                value={r.pointsPerSprint}
                aria-label="Points per sprint"
                onChange={(e) =>
                  setDraft((d) =>
                    d.map((x, j) => (j === i ? { ...x, pointsPerSprint: Math.max(0, Number(e.target.value) || 0) } : x)),
                  )
                }
              />
              <button
                onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Remove role"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setDraft((d) => [...d, { role: 'New role', dayRate: 500, pointsPerSprint: 0 }])}
          className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
        >
          <Plus size={13} /> Add role
        </button>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save rate card</Button>
        </div>
      </div>
    </Modal>
  )
}
