import { useMemo, useState } from 'react'
import { AlertTriangle, Banknote, Landmark, Plus, Receipt, ShieldCheck, Trash2, TrendingUp, Wallet } from 'lucide-react'
import { canSeeBudget, isAdmin, useStore } from '../store/useStore'
import {
  CURRENCY,
  domainBudget,
  fmtMoney,
  portfolioBudget,
  programBudget,
} from '../lib/budget'
import type { RateCardEntry } from '../types'
import { PageHeader, StatTile } from './ui'

export function BudgetView({ onOpenProgram }: { onOpenProgram: (programId: string) => void }) {
  const domains = useStore((s) => s.domains)
  const programs = useStore((s) => s.programs)
  const tasks = useStore((s) => s.tasks)
  const rateCard = useStore((s) => s.rateCard)
  const setRateCard = useStore((s) => s.setRateCard)
  const cardsByDomain = useStore((s) => s.rateCardsByDomain)
  const user = useStore((s) => s.currentUser)

  const [editRates, setEditRates] = useState(false)
  const [draft, setDraft] = useState<RateCardEntry[]>(rateCard)
  const [domainFilter, setDomainFilter] = useState<string>('all')

  // Each program is costed with its own domain's rate card (falling back to the
  // team default), so roll-ups honour per-domain rates.
  const cardFor = useMemo(
    () => (id: string) => cardsByDomain[id] ?? rateCard,
    [cardsByDomain, rateCard],
  )

  const portfolio = useMemo(() => portfolioBudget(domains, programs, tasks, cardFor), [domains, programs, tasks, cardFor])
  const byDomain = useMemo(
    () => domains.map((d) => ({ d, b: domainBudget(d, programs, tasks, cardFor) })).filter((r) => programs.some((p) => p.domainId === r.d.id)),
    [domains, programs, tasks, cardFor],
  )
  const rows = useMemo(
    () =>
      programs
        .map((p) => ({ p, b: programBudget(p, tasks.filter((t) => t.programId === p.id), cardFor) }))
        .sort((a, b) => a.b.variance - b.b.variance),
    [programs, tasks, cardFor],
  )
  // CapEx vs OpEx roll-up for reporting.
  const byFunding = useMemo(() => {
    const base = () => ({ forecast: 0, spent: 0, approved: 0, count: 0 })
    const acc: Record<'capex' | 'opex' | 'unset', ReturnType<typeof base>> = {
      capex: base(),
      opex: base(),
      unset: base(),
    }
    for (const { p, b } of rows) {
      const k = p.funding ?? 'unset'
      acc[k].forecast += b.forecast
      acc[k].spent += b.spent
      acc[k].approved += b.approved
      acc[k].count += 1
    }
    return acc
  }, [rows])
  const domainColor = (id: string) => domains.find((d) => d.id === id)?.color ?? '#94a3b8'

  // Money is Admin + Leadership only.
  if (!canSeeBudget(user)) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Budget figures are visible to Admin and Leadership only.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Wallet size={22} />}
        accent="#0d9488"
        title="Budget"
        subtitle="What we started with vs. where we'll finish — funds, forecast and spend, rolled up from programs to domains to the portfolio."
        actions={
          isAdmin(user) && (
            <button
              onClick={() => {
                setDraft(rateCard)
                setEditRates(true)
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Receipt size={16} />
              Rate card
            </button>
          )
        }
      />

      {/* Rate card editor (admin) */}
      {editRates && (
        <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Default vendor / role rate card ({CURRENCY} per person-day)</h3>
            <span className="text-xs text-slate-500">Team default — each domain can set its own on its page</span>
          </div>
          <div className="mb-1 flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            <span className="flex-1">Role</span>
            <span className="w-28 text-right">Day rate</span>
            <span className="w-20 text-right">Pts/sprint</span>
            <span className="w-6" />
          </div>
          <div className="space-y-2">
            {draft.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
                  value={r.role}
                  onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}
                />
                <span className="text-sm text-slate-400">{CURRENCY}</span>
                <input
                  type="number"
                  min={0}
                  className="w-24 rounded-md border border-slate-200 px-2 py-1 text-right text-sm"
                  value={r.dayRate}
                  onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, dayRate: Math.max(0, Number(e.target.value) || 0) } : x)))}
                />
                <input
                  type="number"
                  min={0}
                  className="w-20 rounded-md border border-slate-200 px-2 py-1 text-right text-sm"
                  value={r.pointsPerSprint}
                  aria-label="Points per sprint"
                  onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, pointsPerSprint: Math.max(0, Number(e.target.value) || 0) } : x)))}
                />
                <button onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button onClick={() => setDraft((d) => [...d, { role: 'New role', dayRate: 500, pointsPerSprint: 0 }])} className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline">
              <Plus size={13} /> Add role
            </button>
            <div className="flex gap-2">
              <button onClick={() => setEditRates(false)} className="text-xs text-slate-500 hover:underline">Cancel</button>
              <button
                onClick={() => {
                  setRateCard(draft.filter((r) => r.role.trim()))
                  setEditRates(false)
                }}
                className="rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700"
              >
                Save rate card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio tiles — colour tells the story: blue fund → indigo plan →
          amber forecast → teal spend → green/red result. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile icon={<Landmark size={20} />} label="Allocated fund" value={fmtMoney(portfolio.allocated)} accent="#2563eb" />
        <StatTile icon={<Banknote size={20} />} label="Estimated" value={fmtMoney(portfolio.estimated)} accent="#6366f1" />
        <StatTile icon={<TrendingUp size={20} />} label="Forecast" value={fmtMoney(portfolio.forecast)} accent="#f59e0b" />
        <StatTile icon={<Receipt size={20} />} label="Spent to date" value={fmtMoney(portfolio.spent)} accent="#0d9488" />
        <StatTile
          icon={portfolio.variance >= 0 ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
          label={portfolio.variance >= 0 ? 'Under budget' : 'Over budget'}
          value={fmtMoney(Math.abs(portfolio.variance))}
          accent={portfolio.variance >= 0 ? '#16a34a' : '#dc2626'}
        />
      </div>

      {/* By domain */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Fund vs. forecast by domain</h3>
        <div className="space-y-3">
          {byDomain.map(({ d, b }) => {
            const pct = b.allocated > 0 ? Math.min(100, Math.round((b.forecast / b.allocated) * 100)) : 100
            return (
              <div key={d.id} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
                <span className="w-32 shrink-0 truncate text-sm font-medium text-slate-700">{d.name}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: b.overBudget ? '#dc2626' : pct >= 90 ? '#f59e0b' : '#16a34a' }} />
                </div>
                <span className="w-40 shrink-0 text-right text-xs text-slate-500">
                  {fmtMoney(b.forecast)} / {fmtMoney(b.allocated)}
                </span>
                <span className={`w-24 shrink-0 text-right text-xs font-medium ${b.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {b.variance >= 0 ? `${fmtMoney(b.variance)} left` : `${fmtMoney(-b.variance)} over`}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* CapEx vs OpEx */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">CapEx vs. OpEx</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ['capex', 'CapEx', 'Capital — building new assets', '#6366f1'],
            ['opex', 'OpEx', 'Operating — run & maintain', '#0d9488'],
          ] as const).map(([key, label, sub, color]) => {
            const f = byFunding[key]
            const total = byFunding.capex.forecast + byFunding.opex.forecast || 1
            const pct = Math.round((f.forecast / total) * 100)
            return (
              <div key={key} className="rounded-xl border border-slate-200 p-3" style={{ borderLeftWidth: 3, borderLeftColor: color }}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-slate-800">{label}</span>
                  <span className="text-xs text-slate-400">{f.count} project{f.count === 1 ? '' : 's'} · {pct}%</span>
                </div>
                <div className="text-[11px] text-slate-400">{sub}</div>
                <div className="mt-1 text-xl font-bold" style={{ color }}>{fmtMoney(f.forecast)}</div>
                <div className="text-xs text-slate-500">forecast · {fmtMoney(f.spent)} spent to date</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>
        {byFunding.unset.count > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            {byFunding.unset.count} project{byFunding.unset.count === 1 ? '' : 's'} not yet classified — set CapEx/OpEx on the project form.
          </p>
        )}
      </div>

      {/* Programs — clean scannable list (forecast vs. fund + variance pill).
          Full estimated/approved/spent detail lives on each Program page. */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Programs by forecast</h3>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Domain
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand-400"
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
            >
              <option value="all">All domains</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ul className="divide-y divide-slate-50">
          {rows
            .filter(({ p }) => domainFilter === 'all' || p.domainId === domainFilter)
            .map(({ p, b }) => {
              const pct = b.approved > 0 ? Math.min(100, Math.round((b.forecast / b.approved) * 100)) : 100
              const onPlan = Math.abs(b.variance) < Math.max(1000, b.approved * 0.005)
              return (
                <li key={p.id}>
                  <button
                    onClick={() => onOpenProgram(p.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: domainColor(p.domainId) }} />
                    <span className="w-44 shrink-0 truncate text-sm font-medium text-slate-800">{p.name}</span>
                    <div className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 sm:block">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: b.overBudget ? '#dc2626' : onPlan ? '#cbd5e1' : '#16a34a' }}
                      />
                    </div>
                    <span className="ml-auto shrink-0 text-sm font-medium text-slate-700 sm:ml-0 sm:w-24 sm:text-right">
                      {fmtMoney(b.forecast)}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        onPlan
                          ? 'bg-slate-100 text-slate-500'
                          : b.variance > 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {onPlan ? 'on plan' : b.variance > 0 ? `${fmtMoney(b.variance)} under` : `${fmtMoney(-b.variance)} over`}
                    </span>
                  </button>
                </li>
              )
            })}
        </ul>
      </div>
    </div>
  )
}
