import { useState } from 'react'
import { estimate, type TShirtSize } from '../lib/forecast'
import { canAdminister, canEditDomain, canSeeBudget, useStore } from '../store/useStore'
import { fmtMoney, teamVelocity } from '../lib/budget'
import { fmtDate, toIso } from '../lib/dates'
import type { RolePlanEntry } from '../types'
import { RoleMixEditor } from './RoleMixEditor'
import { Button, Field, Modal, inputClass } from './ui'

/** Early, high-level delivery estimate for the "business wants a date" conversation.
 *  When opened for a domain it uses that domain's own T-shirt scale and rate card. */
export function Estimator({
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
  const defaultSizes = useStore((s) => s.tshirtSizes)
  const sizesByDomain = useStore((s) => s.tshirtSizesByDomain)
  const setTshirtSizes = useStore((s) => s.setTshirtSizes)
  const setDomainTshirtSizes = useStore((s) => s.setDomainTshirtSizes)
  const user = useStore((s) => s.currentUser)
  const defaultCard = useStore((s) => s.rateCard)
  const cardsByDomain = useStore((s) => s.rateCardsByDomain)

  // This domain's own scale/rates, falling back to the team default.
  const tshirtSizes = domainId ? (sizesByDomain[domainId] ?? defaultSizes) : defaultSizes
  const rateCard = domainId ? (cardsByDomain[domainId] ?? defaultCard) : defaultCard
  const canCustomize = domainId ? canEditDomain(user, domainId) : canAdminister(user)

  const [points, setPoints] = useState(100)
  // Seed the team with a few of the fastest delivery role on the card.
  const [roleMix, setRoleMix] = useState<RolePlanEntry[]>(() => {
    const lead = [...rateCard].sort((a, b) => b.pointsPerSprint - a.pointsPerSprint)[0]
    return lead ? [{ role: lead.role, count: 3 }] : []
  })
  const [bufferPct, setBufferPct] = useState(25)
  const [startDate, setStartDate] = useState(() => toIso(new Date()))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<TShirtSize[]>(tshirtSizes)

  const velocity = teamVelocity(roleMix, rateCard)
  const est = estimate(points, velocity, bufferPct / 100, startDate || undefined)
  const activeSize = tshirtSizes.find((t) => t.points === points)
  // Role-aware cost: each role's own day rate × headcount × working days over the run.
  const costPerDay = roleMix.reduce(
    (a, r) => a + r.count * (rateCard.find((c) => c.role === r.role)?.dayRate ?? 0),
    0,
  )
  const estCost = Math.round(costPerDay * est.bufferedWeeks * 5)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={domainId ? `Delivery Estimator · ${domainName ?? 'Domain'}` : 'Delivery Estimator Calculator'}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          A rough, early estimate for planning. Build the team below — each role delivers points per
          the rate card (developers move the date; PMs, BAs and scrum masters cost money and count as
          people but deliver 0 points). 1 SP = 1 day.
        </p>

        {/* T-shirt sizing — for high-level planning conversations. Picking a size
            fills the story points below. Admins can edit the point values (saved
            team-wide to Supabase). */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-medium text-slate-700">T-shirt size</span>
            {canCustomize && !editing ? (
              <button
                onClick={() => {
                  setDraft(tshirtSizes)
                  setEditing(true)
                }}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Customize points
              </button>
            ) : (
              <span className="text-xs text-slate-400">Pick a size — it fills the story points below</span>
            )}
          </div>

          {editing ? (
            <div className="space-y-2 rounded-lg border border-brand-100 bg-brand-50/40 p-2.5">
              <div className="grid grid-cols-6 gap-1.5">
                {draft.map((t, i) => (
                  <div key={t.size} className="rounded-lg border border-slate-200 bg-white p-1.5 text-center">
                    <div className="text-sm font-bold text-slate-700">{t.size}</div>
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full rounded border border-slate-200 px-1 py-0.5 text-center text-xs outline-none focus:border-brand-400"
                      value={t.points}
                      onChange={(e) =>
                        setDraft((d) =>
                          d.map((x, j) =>
                            j === i ? { ...x, points: Math.max(1, Number(e.target.value) || 0) } : x,
                          ),
                        )
                      }
                    />
                    <div className="mt-0.5 text-[10px] text-slate-400">SP</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {domainId ? `Saved for ${domainName ?? 'this domain'}.` : 'Saved for the whole team.'}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:underline">
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (domainId) setDomainTshirtSizes(domainId, draft)
                      else setTshirtSizes(draft)
                      setEditing(false)
                    }}
                    className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    Save scale
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-1.5">
              {tshirtSizes.map((t) => {
                const active = points === t.points
                return (
                  <button
                    key={t.size}
                    onClick={() => setPoints(t.points)}
                    title={`${t.note} · ${t.points} SP`}
                    className={`flex flex-col items-center rounded-lg border px-1 py-2 transition ${
                      active
                        ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm font-bold">{t.size}</span>
                    <span className="text-[11px] text-slate-400">{t.points} SP</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Story points" hint="Set by the size above — fine-tune if needed.">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={points}
              onChange={(e) => setPoints(Math.max(0, Number(e.target.value)))}
            />
          </Field>
          <Field label="Contingency buffer %" hint="For early scope uncertainty.">
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={bufferPct}
              onChange={(e) => setBufferPct(Math.max(0, Math.min(100, Number(e.target.value))))}
            />
          </Field>
          <Field label="Start date">
            <input
              type="date"
              className={inputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Team composition" hint="Add any mix of roles — only delivery roles speed up the date.">
          <RoleMixEditor
            value={roleMix}
            onChange={setRoleMix}
            rateCard={rateCard}
            showCost={canSeeBudget(user)}
          />
        </Field>

        <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Res label="Team velocity" value={`${velocity}`} sub="SP / sprint" />
            <Res label="Likely" value={`${est.sprints} sprint${est.sprints === 1 ? '' : 's'}`} sub={`≈ ${est.weeks} wks · ${est.months} mo`} />
            <Res
              label={`Buffered (+${bufferPct}%)`}
              value={`${est.bufferedSprints} sprint${est.bufferedSprints === 1 ? '' : 's'}`}
              sub={`≈ ${est.bufferedWeeks} wks · ${est.bufferedMonths} mo`}
            />
            {est.targetDate && <Res label="Est. completion" value={fmtDate(est.targetDate)} sub="based on your selection" />}
            {canSeeBudget(user) && <Res label="Est. cost" value={fmtMoney(estCost)} sub="team × buffered duration" />}
          </div>
          {velocity === 0 ? (
            <p className="mt-3 text-sm font-medium text-amber-700">
              This team has no delivery capacity — add a role that carries points/sprint (e.g. a
              Developer) to get a date.
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              {activeSize && (
                <span className="mr-1 rounded bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
                  {activeSize.size} = {activeSize.points} SP
                </span>
              )}
              Tell business: <strong>likely {est.sprints} sprints</strong>, and{' '}
              <strong>commit to ~{est.bufferedSprints} sprints</strong> (≈ {est.bufferedMonths} months)
              given it's early.
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  )
}

function Res({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-brand-700">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}
