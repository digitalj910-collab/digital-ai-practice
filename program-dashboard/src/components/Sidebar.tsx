import { useMemo, type ReactNode } from 'react'
import {
  LayoutDashboard,
  GanttChartSquare,
  RotateCcw,
  Bell,
  ClipboardList,
  Calculator,
  CalendarRange,
  Users,
  Wallet,
  BarChart3,
  ShieldCheck,
  HelpCircle,
  LogOut,
  X,
} from 'lucide-react'
import { canAdminister, canSeeBudget, visibleDomainIds, useStore, type CurrentUser } from '../store/useStore'
import { buildAlerts } from '../lib/metrics'
import { VPS, DIRECTORS } from '../lib/org'
import type { Domain, Role } from '../types'

export type View =
  | { k: 'home' }
  | { k: 'domain'; domainId: string }
  | { k: 'program'; programId: string }
  | { k: 'portfolio' }
  | { k: 'alerts' }
  | { k: 'weekly' }
  | { k: 'capacity' }
  | { k: 'budget' }
  | { k: 'reconcile' }
  | { k: 'reports' }
  | { k: 'roles' }
  | { k: 'help' }

const ROLE_LABEL: Record<Role, string> = {
  contributor: 'Manager — own team',
  director: 'Director — all teams',
  vp: 'VP',
  admin: 'Admin — full access',
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
  const visIds = visibleDomainIds(user, domains.map((d) => d.id))
  const setUser = useStore((s) => s.setUser)
  const resetToSeed = useStore((s) => s.resetToSeed)

  // Alert badge counts only the domains the viewer can see.
  const alertCount = useMemo(() => {
    const scoped = visIds ? programs.filter((p) => visIds.includes(p.domainId)) : programs
    return buildAlerts(scoped, tasks).length
  }, [programs, tasks, visIds])

  // Persona presets for the demo role switcher — the full org hierarchy.
  const personas: { id: string; label: string; user: CurrentUser }[] = [
    { id: 'admin', label: 'You (Admin)', user: { role: 'admin', name: 'You (Admin)' } },
    ...VPS.map((v) => ({
      id: `vp-${v.id}`,
      label: `${v.name} · VP`,
      user: { role: 'vp' as Role, vpId: v.id, name: v.name },
    })),
    ...DIRECTORS.map((d) => ({
      id: `dir-${d.id}`,
      label: `${d.name} · Director`,
      user: { role: 'director' as Role, directorId: d.id, name: d.name },
    })),
    ...domains.map((d) => ({
      id: `con-${d.id}`,
      label: `${d.managerName} · ${d.name} (Manager)`,
      user: { role: 'contributor' as Role, domainId: d.id, name: d.managerName },
    })),
  ]
  const currentPersonaId =
    user.role === 'admin'
      ? 'admin'
      : user.role === 'vp'
        ? `vp-${user.vpId}`
        : user.role === 'director'
          ? `dir-${user.directorId}`
          : `con-${user.domainId}`

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
        {user.role !== 'contributor' && (
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
        {canSeeBudget(user) && (
          <NavItem
            active={view.k === 'budget'}
            onClick={() => onNavigate({ k: 'budget' })}
            icon={<Wallet size={17} />}
            label="Budget"
          />
        )}
        {canSeeBudget(user) && (
          <NavItem
            active={view.k === 'reconcile'}
            onClick={() => onNavigate({ k: 'reconcile' })}
            icon={<CalendarRange size={17} />}
            label="Monthly Budget"
          />
        )}
        {/* Capacity & Estimator: admin + leadership (director/VP). Reports: admin only. */}
        {canSeeBudget(user) && (
          <NavItem
            active={view.k === 'capacity'}
            onClick={() => onNavigate({ k: 'capacity' })}
            icon={<Users size={17} />}
            label="Capacity Planning"
          />
        )}
        {canAdminister(user) && (
          <NavItem
            active={view.k === 'reports'}
            onClick={() => onNavigate({ k: 'reports' })}
            icon={<BarChart3 size={17} />}
            label="Reports & KPIs"
          />
        )}
        {canAdminister(user) && (
          <NavItem
            active={view.k === 'roles'}
            onClick={() => onNavigate({ k: 'roles' })}
            icon={<ShieldCheck size={17} />}
            label="Roles & Access"
          />
        )}
        {canSeeBudget(user) && (
          <NavItem
            active={false}
            onClick={() => {
              onClose?.()
              onOpenEstimator?.()
            }}
            icon={<Calculator size={17} />}
            label="Estimator"
          />
        )}
        <NavItem
          active={view.k === 'help'}
          onClick={() => onNavigate({ k: 'help' })}
          icon={<HelpCircle size={17} />}
          label="Help & Guide"
        />

        <DomainNav
          domains={domains.filter((d) => !visIds || visIds.includes(d.id))}
          user={user}
          activeDomainId={activeDomainId}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="space-y-3 border-t border-slate-800 px-4 py-4">
        {/* The persona switcher is a DEMO control — only Admin can drive it,
            so a previewed (restricted) role can't escalate back up to admin. */}
        {canAdminister(user) ? (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">
                Demo · view the app as any role
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
          </>
        ) : (
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Previewing as
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-slate-100">{user.name}</div>
            <div className="text-xs text-slate-400">{ROLE_LABEL[user.role]}</div>
            <button
              onClick={() => setUser({ role: 'admin', name: 'You (Admin)' })}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-brand-300 hover:bg-slate-800"
            >
              <LogOut size={13} /> Exit preview
            </button>
          </div>
        )}
      </div>
      </aside>
    </>
  )
}

/** The "Teams" section of the sidebar: the teams the viewer can see (a manager
 *  sees just their own). */
function DomainNav({
  domains,
  user,
  activeDomainId,
  onNavigate,
}: {
  domains: Domain[]
  user: CurrentUser
  activeDomainId: string | null
  onNavigate: (v: View) => void
}) {
  return (
    <>
      <SectionLabel>{user.role === 'contributor' ? 'Your team' : 'Teams'}</SectionLabel>
      {domains.map((d) => (
        <NavItem
          key={d.id}
          active={activeDomainId === d.id}
          onClick={() => onNavigate({ k: 'domain', domainId: d.id })}
          icon={<span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />}
          label={d.name}
        />
      ))}
    </>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </div>
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
      className={`relative flex w-full items-center gap-2.5 rounded-lg py-2 pl-3 pr-3 text-left text-sm transition-colors ${active ? 'bg-white/10 font-medium text-white' : 'text-slate-300 hover:bg-white/5'}`}
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
