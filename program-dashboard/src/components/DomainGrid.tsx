import { useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowRight,
  BarChart3,
  Bell,
  Calculator,
  Download,
  Eye,
  Gauge,
  Inbox,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Plus,
  Target,
  Users,
} from 'lucide-react'
import { isAdmin, managerScope, useStore } from '../store/useStore'
import { programPercent, rollupRag, RAG_COLORS } from '../lib/rag'
import { buildAlerts, deliveryRisk, portfolioMetrics } from '../lib/metrics'
import { byPriority, isBacklog } from '../lib/stage'
import { exportPrograms } from '../lib/excel'
import { portfolioSummary } from '../lib/summary'
import { fmtDate } from '../lib/dates'
import { RagDot, ProgressBar, StatTile, PageHeader, Button, Modal } from './ui'
import { DomainForm } from './forms'
import { Snapshot } from './Snapshot'
import { Estimator } from './Estimator'
import { PRIORITY_LABELS, type Domain, type Program, type Task } from '../types'
import type { View } from './Sidebar'

const PARKED = new Set(['completed', 'cancelled', 'descoped'])

export function DomainGrid({
  onOpenDomain,
  onOpenPortfolio,
  onOpenAlerts,
  onOpenProgram,
  onNavigate,
}: {
  onOpenDomain: (domainId: string) => void
  onOpenPortfolio: () => void
  onOpenAlerts: () => void
  onOpenProgram: (programId: string) => void
  onNavigate: (v: View) => void
}) {
  const allDomains = useStore((s) => s.domains)
  const allPrograms = useStore((s) => s.programs)
  const tasks = useStore((s) => s.tasks)
  const updates = useStore((s) => s.updates)
  const user = useStore((s) => s.currentUser)
  const tshirtSizes = useStore((s) => s.tshirtSizes)
  // Managers only ever see their own domain.
  const scope = managerScope(user)
  const domains = scope ? allDomains.filter((d) => d.id === scope) : allDomains
  const programs = scope ? allPrograms.filter((p) => p.domainId === scope) : allPrograms
  const [showDomainForm, setShowDomainForm] = useState(false)
  const [showEstimator, setShowEstimator] = useState(false)
  const [tile, setTile] = useState<null | 'watch' | 'deprioritized' | 'effectiveness'>(null)

  const m = portfolioMetrics(programs, tasks)
  const alertCount = buildAlerts(programs, tasks).length

  const watchPrograms = programs.filter(
    (p) =>
      !p.deprioritized &&
      !PARKED.has(p.status) &&
      deliveryRisk(p, tasks.filter((t) => t.programId === p.id)).level === 'watch',
  )
  const deprioritizedPrograms = programs.filter((p) => p.deprioritized)
  const backlogPrograms = programs.filter(isBacklog).slice().sort(byPriority)
  const domainName = (id: string) => domains.find((d) => d.id === id)?.name ?? ''
  const domainColor = (id: string) => domains.find((d) => d.id === id)?.color ?? '#94a3b8'

  const progressFor = (p: Program) =>
    programPercent(p, tasks.filter((t) => t.programId === p.id))

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<LayoutDashboard size={22} />}
        title="Program Portfolio"
        subtitle="Select a domain to drill into its programs and timelines."
        actions={
          <>
            <button
              onClick={() => setShowEstimator(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Calculator size={16} />
              Estimator
            </button>
            <button
              onClick={() => exportPrograms(programs, domains, tasks)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Download size={16} />
              Export
            </button>
            <button
              onClick={onOpenPortfolio}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <LayoutGrid size={16} />
              Portfolio timeline
            </button>
            {isAdmin(user) && (
              <Button onClick={() => setShowDomainForm(true)}>
                <Plus size={16} />
                Add domain
              </Button>
            )}
          </>
        }
      />
      {showDomainForm && (
        <DomainForm open={showDomainForm} onClose={() => setShowDomainForm(false)} />
      )}
      {showEstimator && <Estimator open={showEstimator} onClose={() => setShowEstimator(false)} />}

      {/* Alerts banner */}
      {alertCount > 0 && (
        <button
          onClick={onOpenAlerts}
          className="flex w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left transition hover:bg-red-100/70"
        >
          <Bell size={18} className="text-red-600" />
          <span className="text-sm font-medium text-red-800">
            {alertCount} active alert{alertCount === 1 ? '' : 's'} need attention
          </span>
          <span className="ml-auto text-sm font-medium text-red-600">View →</span>
        </button>
      )}

      {/* Quick nav — the reporting/planning screens, one click from the top. */}
      <div className="flex flex-wrap gap-2">
        <QuickLink icon={<Bell size={15} />} onClick={onOpenAlerts}>Alerts</QuickLink>
        <QuickLink icon={<Gauge size={15} />} onClick={() => onNavigate({ k: 'capacity' })}>Capacity Planning</QuickLink>
        <QuickLink icon={<BarChart3 size={15} />} onClick={() => onNavigate({ k: 'reports' })}>Reports &amp; KPIs</QuickLink>
        <QuickLink icon={<LayoutGrid size={15} />} onClick={onOpenPortfolio}>Portfolio timeline</QuickLink>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile icon={<Layers size={20} />} label="Programs" value={m.total} accent="#2563eb" onClick={onOpenPortfolio} />
        <StatTile icon={<AlertTriangle size={20} />} label="At risk" value={m.atRisk} accent={RAG_COLORS.red} onClick={onOpenAlerts} />
        <StatTile icon={<Eye size={20} />} label="Watch" value={m.watch} accent={RAG_COLORS.amber} onClick={() => setTile('watch')} />
        <StatTile icon={<ArrowDownCircle size={20} />} label="Deprioritized" value={m.deprioritized} accent="#7c3aed" onClick={() => setTile('deprioritized')} />
        <StatTile icon={<Target size={20} />} label="Planning effectiveness" value={m.planningEffectiveness} suffix="%" accent="#0d9488" onClick={() => setTile('effectiveness')} />
      </div>

      {tile && (
        <TileModal
          kind={tile}
          onClose={() => setTile(null)}
          watchPrograms={watchPrograms}
          deprioritizedPrograms={deprioritizedPrograms}
          domains={domains}
          tasks={tasks}
          total={m.total}
          deprioritizedCount={m.deprioritized}
          planningEffectiveness={m.planningEffectiveness}
          onOpenProgram={(id) => {
            setTile(null)
            onOpenProgram(id)
          }}
        />
      )}

      <Snapshot title="Portfolio snapshot" lines={portfolioSummary(programs, tasks, updates, domains)} />

      {/* Domain cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {domains.map((d) => {
          const domainPrograms = programs.filter((p) => p.domainId === d.id)
          const rag = rollupRag(domainPrograms)
          const avg =
            domainPrograms.length === 0
              ? 0
              : Math.round(
                  domainPrograms.reduce((a, p) => a + progressFor(p), 0) /
                    domainPrograms.length,
                )
          const counts = {
            green: domainPrograms.filter((p) => p.ragStatus === 'green').length,
            amber: domainPrograms.filter((p) => p.ragStatus === 'amber').length,
            red: domainPrograms.filter((p) => p.ragStatus === 'red').length,
          }
          return (
            <button
              key={d.id}
              onClick={() => onOpenDomain(d.id)}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="h-1.5 w-full" style={{ background: d.color }} />
              <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-sm"
                      style={{ background: d.color }}
                    >
                      {d.name.charAt(0)}
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{d.name}</h2>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                        <Users size={14} />
                        {d.managerName}
                      </p>
                    </div>
                  </div>
                  <RagDot rag={rag} size={14} />
                </div>

                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <span>
                    <strong className="text-slate-900">{domainPrograms.length}</strong> programs
                  </span>
                  <span className="flex items-center gap-3 text-xs">
                    <Count color={RAG_COLORS.green} n={counts.green} />
                    <Count color={RAG_COLORS.amber} n={counts.amber} />
                    <Count color={RAG_COLORS.red} n={counts.red} />
                  </span>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Avg. progress</span>
                    <span className="font-medium text-slate-700">{avg}%</span>
                  </div>
                  <ProgressBar value={avg} color={d.color} />
                </div>

                <div className="mt-auto flex items-center gap-1 text-sm font-medium text-slate-400 group-hover:text-slate-700">
                  View programs
                  <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Portfolio backlog — staged programs (no dates yet) across all teams. */}
      {backlogPrograms.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Inbox size={18} className="text-slate-400" />
            Backlog
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {backlogPrograms.length}
            </span>
            <span className="text-sm font-normal text-slate-400">staged across all teams · by priority</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {backlogPrograms.map((p) => {
                const size = tshirtSizes.find((t) => t.points === p.estimatedPoints)?.size
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => onOpenProgram(p.id)}
                      className="flex w-full flex-wrap items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: domainColor(p.domainId) }} />
                      <span className="min-w-40 flex-1 truncate text-sm font-medium text-slate-800">{p.name}</span>
                      <span className="hidden w-24 shrink-0 truncate text-xs text-slate-400 sm:block">{domainName(p.domainId)}</span>
                      <span className="w-20 shrink-0 text-xs text-slate-500">
                        {size ? `${size} · ` : ''}{p.estimatedPoints ? `${p.estimatedPoints} SP` : '—'}
                      </span>
                      <span
                        className={`w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-semibold ${
                          p.priority === 'high'
                            ? 'bg-red-50 text-red-700'
                            : p.priority === 'low'
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {p.priority ? PRIORITY_LABELS[p.priority] : '—'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}

function QuickLink({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
    >
      <span className="text-slate-400">{icon}</span>
      {children}
    </button>
  )
}

function Count({ color, n }: { color: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-slate-500">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {n}
    </span>
  )
}

function TileModal({
  kind,
  onClose,
  watchPrograms,
  deprioritizedPrograms,
  domains,
  tasks,
  total,
  deprioritizedCount,
  planningEffectiveness,
  onOpenProgram,
}: {
  kind: 'watch' | 'deprioritized' | 'effectiveness'
  onClose: () => void
  watchPrograms: Program[]
  deprioritizedPrograms: Program[]
  domains: Domain[]
  tasks: Task[]
  total: number
  deprioritizedCount: number
  planningEffectiveness: number
  onOpenProgram: (id: string) => void
}) {
  const domainName = (id: string) => domains.find((d) => d.id === id)?.name ?? ''
  const domainColor = (id: string) => domains.find((d) => d.id === id)?.color ?? '#94a3b8'

  if (kind === 'effectiveness') {
    const active = total - deprioritizedCount
    return (
      <Modal open onClose={onClose} title="Planning effectiveness — what it means" maxWidth="max-w-lg">
        <div className="space-y-3 text-sm text-slate-600">
          <div className="rounded-xl bg-teal-50 p-4 text-center">
            <div className="text-3xl font-bold text-teal-700">{planningEffectiveness}%</div>
            <div className="text-xs text-slate-500">of planned programs are still active</div>
          </div>
          <p>
            It's the share of your programs you <strong>kept</strong> rather than dropped:
            <strong> {active} of {total}</strong> programs are still active, and{' '}
            <strong>{deprioritizedCount}</strong> {deprioritizedCount === 1 ? 'was' : 'were'}{' '}
            deprioritized.
          </p>
          <p>
            <strong>Higher is better.</strong> A high number means you planned well and rarely started
            work you later had to drop. A low number means a lot of planned work got deprioritized —
            a sign to tighten up planning and prioritization.
          </p>
          <p className="text-xs text-slate-400">Formula: (programs − deprioritized) ÷ programs.</p>
        </div>
      </Modal>
    )
  }

  const list = kind === 'watch' ? watchPrograms : deprioritizedPrograms
  const title =
    kind === 'watch' ? 'Watch — slightly behind plan' : 'Deprioritized programs — and why'
  return (
    <Modal open onClose={onClose} title={title} maxWidth="max-w-lg">
      {list.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Nothing here right now.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.map((p) => {
            const risk =
              kind === 'watch' ? deliveryRisk(p, tasks.filter((t) => t.programId === p.id)) : null
            return (
              <li key={p.id}>
                <button onClick={() => onOpenProgram(p.id)} className="w-full py-3 text-left hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: domainColor(p.domainId) }} />
                    <span className="font-medium text-slate-800">{p.name}</span>
                    <span className="text-xs text-slate-400">{domainName(p.domainId)}</span>
                    <span className="ml-auto shrink-0 text-xs text-brand-600">Open →</span>
                  </div>
                  {kind === 'watch' && risk && <p className="mt-1 pl-4 text-sm text-amber-700">{risk.message}</p>}
                  {kind === 'deprioritized' && (
                    <div className="mt-1 pl-4 text-sm">
                      <p className="text-slate-600">
                        <span className="font-medium text-slate-500">Reason: </span>
                        {p.deprioritizedReason || <span className="italic text-slate-400">No reason recorded</span>}
                      </p>
                      {p.deprioritizedDate && (
                        <p className="text-xs text-slate-400">Deprioritized on {fmtDate(p.deprioritizedDate)}</p>
                      )}
                    </div>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
