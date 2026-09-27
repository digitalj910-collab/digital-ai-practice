import { useState } from 'react'
import { capacityEstimate, PER_ENGINEER_VELOCITY, SPRINT_WEEKS } from '../lib/forecast'
import { canSeeBudget, useStore } from '../store/useStore'
import { blendedDayRate, fmtMoney } from '../lib/budget'
import { addDays, differenceInCalendarDays, fmtDate, parseISO, toIso } from '../lib/dates'
import { Button, Field, Modal, inputClass } from './ui'

/** "How many people do we need to hit this deadline?" — the inverse of the Estimator.
 *  When opened for a domain it uses that domain's own T-shirt scale and rate card. */
export function CapacityCalculator({
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
  const user = useStore((s) => s.currentUser)
  const tshirtSizes = domainId ? (sizesByDomain[domainId] ?? defaultSizes) : defaultSizes

  const [points, setPoints] = useState(80)
  const [startDate, setStartDate] = useState(() => toIso(new Date()))
  const [endDate, setEndDate] = useState(() => toIso(addDays(new Date(), 84)))
  const [bufferPct, setBufferPct] = useState(25)
  const [haveNow, setHaveNow] = useState('')

  const days = startDate && endDate ? differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) : 0
  const validRange = days > 0
  const weeks = Math.max(1, Math.round(days / 7))
  const have = haveNow === '' ? undefined : Math.max(0, Number(haveNow))
  const est = capacityEstimate(points, weeks, bufferPct / 100, have)
  const activeSize = tshirtSizes.find((t) => t.points === points)
  const defaultCard = useStore((s) => s.rateCard)
  const cardsByDomain = useStore((s) => s.rateCardsByDomain)
  const rateCard = domainId ? (cardsByDomain[domainId] ?? defaultCard) : defaultCard
  const estCost = est.bufferedPoints * blendedDayRate(rateCard)

  // With the current roster, when would we actually finish?
  const rosterSprints = have && have > 0 ? Math.ceil(est.bufferedPoints / (have * PER_ENGINEER_VELOCITY)) : null
  const rosterFinish =
    rosterSprints != null && validRange ? addDays(parseISO(startDate), rosterSprints * SPRINT_WEEKS * 7) : null
  // days early (positive) or late (negative) vs the deadline
  const slack = rosterFinish ? differenceInCalendarDays(parseISO(endDate), rosterFinish) : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={domainId ? `Capacity Calculator · ${domainName ?? 'Domain'}` : 'Capacity Calculator'}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          The flip side of the Estimator: tell it how much work and the dates, and it tells you
          <strong> how many people you need</strong> — and, if you enter your team, your
          <strong> estimated completion date</strong> (each person delivers ~{PER_ENGINEER_VELOCITY} SP
          per 3-week sprint).
        </p>

        {/* T-shirt sizing fills the work */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-medium text-slate-700">How much work?</span>
            <span className="text-xs text-slate-400">Pick a size — it fills the points below</span>
          </div>
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Story points" hint="Set by the size above — fine-tune if needed.">
            <input type="number" min={0} className={inputClass} value={points} onChange={(e) => setPoints(Math.max(0, Number(e.target.value)))} />
          </Field>
          <Field label="Contingency buffer %" hint="For early scope uncertainty.">
            <input type="number" min={0} max={100} className={inputClass} value={bufferPct} onChange={(e) => setBufferPct(Math.max(0, Math.min(100, Number(e.target.value))))} />
          </Field>
          <Field label="Start date">
            <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Finish by (date)" hint={validRange ? `${weeks} weeks · ${est.sprints} sprints` : 'End date must be after start'}>
            <input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <Field label="People you have now" hint="Optional — to see the gap & your finish date.">
            <input type="number" min={0} className={inputClass} placeholder="e.g. 4" value={haveNow} onChange={(e) => setHaveNow(e.target.value)} />
          </Field>
        </div>

        <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Res label="People needed" value={`${est.peopleNeeded}`} sub={`to hit ${fmtDate(endDate)}`} big />
            {canSeeBudget(user) && <Res label="Est. cost" value={fmtMoney(estCost)} sub="work × blended rate" />}
            {est.gap != null && (
              <Res
                label={est.gap > 0 ? 'Need to add' : 'Spare capacity'}
                value={est.gap > 0 ? `${est.gap}` : `${Math.abs(est.gap)}`}
                sub={est.gap > 0 ? 'more people' : 'people'}
                tone={est.gap > 0 ? 'bad' : 'good'}
                big
              />
            )}
            {rosterFinish && (
              <Res
                label={`Est. completion (${have} ppl)`}
                value={fmtDate(toIso(rosterFinish))}
                sub={slack != null ? (slack >= 0 ? `~${Math.round(slack / 7)} wks early` : `~${Math.round(-slack / 7)} wks late`) : undefined}
                tone={slack != null ? (slack >= 0 ? 'good' : 'bad') : 'default'}
              />
            )}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {est.gap == null ? (
              <>
                To finish <strong>{est.bufferedPoints} SP</strong> ({activeSize ? activeSize.size : 'custom'})
                by <strong>{fmtDate(endDate)}</strong>, you need about <strong>{est.peopleNeeded} people</strong>.
              </>
            ) : (
              <>
                With your <strong>{have} people</strong>, you'd finish around{' '}
                <strong>{rosterFinish ? fmtDate(toIso(rosterFinish)) : '—'}</strong>
                {slack != null && (slack >= 0 ? ' — ahead of the deadline. 👍' : ' — past the deadline.')}{' '}
                {est.gap > 0
                  ? `To hit ${fmtDate(endDate)} you'd need ${est.peopleNeeded} (add ${est.gap}).`
                  : `You have enough to hit the deadline (${Math.abs(est.gap)} to spare).`}
              </>
            )}
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  )
}

function Res({
  label,
  value,
  sub,
  big,
  tone = 'default',
}: {
  label: string
  value: string
  sub?: string
  big?: boolean
  tone?: 'default' | 'good' | 'bad'
}) {
  const color = tone === 'bad' ? 'text-red-600' : tone === 'good' ? 'text-emerald-600' : 'text-brand-700'
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 font-bold ${big ? 'text-2xl' : 'text-lg'} ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}
