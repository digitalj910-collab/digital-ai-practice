import { useMemo, type ReactNode } from 'react'
import {
  LayoutDashboard,
  GanttChartSquare,
  RotateCcw,
  Bell,
  ClipboardList,
  Calculator,
  Users,
  Wallet,
  BarChart3,
  HelpCircle,
  X,
} from 'lucide-react'
import { canSeeBudget, managerScope, useStore, type CurrentUser } from '../store/useStore'
import { buildAlerts } from '../lib/metrics'
import type { Role } from '../types'

export type View =
  | { k: 'home' }
  | { k: 'domain'; domainId: string }
  | { k: 'program'; programId: string }
  | { k: 'portfolio' }
  | { k: 'alerts' }
  | { k: 'weekly' }
  | { k: 'capacity' }
  | { k: 'budget' }
  | { k: 'reports' }
  | { k: 'help' }

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin — full access',
  manager: 'Manager — own domain',
  viewer: 'Leadership — full access',
}

export function Sidebar({
  view,
  activeDomainId,
  onNavigate,
  onOpenEstimator,
  open = false,
  onClose,
}: {
  view: View
  activeDomainId: string | null
  onNavigate: (v: View) => void
  onOpenEstimator?: () => void
  open?: boolean
  onClose?: () => void
}) {
  const domains = useStore((s) => s.domains)
  const programs = useStore((s) => s.programs)
  const tasks = useStore((s) => s.tasks)
  const user = useStore((s) => s.currentUser)
  const scope = managerScope(user)
  const setUser = useStore((s) => s.setUser)
  const resetToSeed = useStore((s) => s.resetToSeed)

  const alertCount = useMemo(() => buildAlerts(programs, tasks).length, [programs, tasks])

  // Persona presets for the demo role switcher.
  const personas: { id: string; label: string; user: CurrentUser }[] = [
    { id: 'admin', label: 'You (Admin)', user: { role: 'admin', name: 'You (Admin)' } },
    { id: 'viewer', label: 'Leadership (Viewer)', user: { role: 'viewer', name: 'Leadership' } },
    ...domains.map((d) => ({
      id: `mgr-${d.id}`,
      label: `${d.managerName} · ${d.name}`,
      user: { role: 'manager' as Role, domainId: d.id, name: d.managerName },
    })),
  ]
  const currentPersonaId =
    user.role === 'admin'
      ? 'admin'
      : user.role === 'viewer'
        ? 'viewer'
        : `mgr-${user.domainId}`

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-[#101215] text-slate-300 transition-transform md:static md:z-auto md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
      <div className="flex items-center gap-2 px-5 py-5 text-white">
        <GanttChartSquare size={22} className="text-brand-400" />
        <div className="leading-tight">
          <div className="text-sm font-semibold">Program Pulse</div>
          <div className="text-xs text-slate-400">Portfolio reporting</div>
        </div>
        <button
          onClick={onClose}
          className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-white/10 md:hidden"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {!scope && (
          <NavItem
            active={view.k === 'home'}
            onClick={() => onNavigate({ k: 'home' })}
            icon={<LayoutDashboard size={17} />}
            label="Overview"
          />
        )}
        <NavItem
          active={view.k === 'portfolio'}
          onClick={() => onNavigate({ k: 'portfolio' })}
          icon={<GanttChartSquare size={17} />}
          label="Portfolio timeline"
        />
        <NavItem
          active={view.k === 'alerts'}
          onClick={() => onNavigate({ k: 'alerts' })}
          icon={<Bell size={17} />}
          label="Alerts"
          badge={alertCount}
        />
        <NavItem
          active={view.k === 'weekly'}
          onClick={() => onNavigate({ k: 'weekly' })}
          icon={<ClipboardList size={17} />}
          label="Weekly Updates"
        />
        <NavItem
          active={view.k === 'capacity'}
          onClick={() => onNavigate({ k: 'capacity' })}
          icon={<Users size={17} />}
          label="Capacity Planning"
        />
        {canSeeBudget(user) && (
          <NavItem
            active={view.k === 'budget'}
            onClick={() => onNavigate({ k: 'budget' })}
            icon={<Wallet size={17} />}
            label="Budget"
          />
        )}
        <NavItem
          active={view.k === 'reports'}
          onClick={() => onNavigate({ k: 'reports' })}
          icon={<BarChart3 size={17} />}
          label="Reports & KPIs"
        />
        <NavItem
          active={false}
          onClick={() => {
            onClose?.()
            onOpenEstimator?.()
          }}
          icon={<Calculator size={17} />}
          label="Estimator"
        />
        <NavItem
          active={view.k === 'help'}
          onClick={() => onNavigate({ k: 'help' })}
          icon={<HelpCircle size={17} />}
          label="Help & Guide"
        />

        <div className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Domains
        </div>
        {domains
          .filter((d) => !scope || d.id === scope)
          .map((d) => (
            <NavItem
              key={d.id}
              active={activeDomainId === d.id}
              onClick={() => onNavigate({ k: 'domain', domainId: d.id })}
              icon={<span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />}
              label={d.name}
            />
          ))}
      </nav>

      <div className="space-y-3 border-t border-slate-800 px-4 py-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Viewing as · {ROLE_LABEL[user.role]}
          </span>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-brand-400"
            value={currentPersonaId}
            onChange={(e) => {
              const p = personas.find((x) => x.id === e.target.value)
              if (p) setUser(p.user)
            }}
          >
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            if (confirm('Reset all data back to the sample content?')) resetToSeed()
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
        >
          <RotateCcw size={13} />
          Reset sample data
        </button>
      </div>
      </aside>
    </>
  )
}

function NavItem({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        active ? 'bg-white/10 font-medium text-white' : 'text-slate-300 hover:bg-white/5'
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-brand-500" />
      )}
      <span className={`flex h-4 w-4 items-center justify-center ${active ? 'text-brand-400' : ''}`}>
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  )
}
