import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRight, GanttChartSquare, Menu } from 'lucide-react'
import { useStore } from './store/useStore'
import { Sidebar, type View } from './components/Sidebar'
import { DomainGrid } from './components/DomainGrid'
import { ProgramList } from './components/ProgramList'
import { ProgramDetail } from './components/ProgramDetail'
import { PortfolioView } from './components/PortfolioView'
import { AlertsView } from './components/AlertsView'
import { WeeklyUpdatesView } from './components/WeeklyUpdatesView'
import { CapacityPlanning } from './components/CapacityPlanning'
import { BudgetView } from './components/BudgetView'
import { MonthlyReconciliation } from './components/MonthlyReconciliation'
import { ReportsView } from './components/ReportsView'
import { RolesView } from './components/RolesView'
import { HelpView } from './components/HelpView'
import { Estimator } from './components/Estimator'

// Where a persona lands by default: a domain manager on their own team's page,
// everyone else (Admin / Leadership) on the portfolio Overview.
function defaultLanding(user: { role: string; domainId?: string }): View {
  // A manager lands on their own team; the director on the timeline (agreed vs
  // actual roadmap per manager); everyone else on the Overview.
  if (user.role === 'contributor' && user.domainId) return { k: 'domain', domainId: user.domainId }
  if (user.role === 'director') return { k: 'portfolio' }
  return { k: 'home' }
}

export default function App() {
  const user = useStore((s) => s.currentUser)
  const [view, setView] = useState<View>(() => defaultLanding(useStore.getState().currentUser))
  const [navOpen, setNavOpen] = useState(false)
  const [showEstimator, setShowEstimator] = useState(false)
  const domains = useStore((s) => s.domains)
  const programs = useStore((s) => s.programs)
  const init = useStore((s) => s.init)
  const setUser = useStore((s) => s.setUser)
  const loading = useStore((s) => s.loading)

  useEffect(() => {
    void init()
  }, [init])

  // When the "Viewing as" persona changes, land on that role's default page.
  const prevPersona = useRef<string | null>(null)
  useEffect(() => {
    const key = `${user.role}:${user.domainId ?? ''}`
    if (prevPersona.current === null) {
      prevPersona.current = key
      return
    }
    if (prevPersona.current !== key) {
      prevPersona.current = key
      setView(defaultLanding(user))
      setNavOpen(false)
    }
  }, [user])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          <p className="text-sm">Loading your portfolio…</p>
        </div>
      </div>
    )
  }

  // Resolve the domain context for breadcrumbs / sidebar highlight.
  const program = view.k === 'program' ? programs.find((p) => p.id === view.programId) : undefined
  const activeDomainId =
    view.k === 'domain' ? view.domainId : view.k === 'program' ? program?.domainId ?? null : null
  const activeDomain = domains.find((d) => d.id === activeDomainId)

  const navigate = (v: View) => {
    setView(v)
    setNavOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        view={view}
        activeDomainId={activeDomainId}
        onNavigate={navigate}
        onOpenEstimator={() => setShowEstimator(true)}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />
      <Estimator open={showEstimator} onClose={() => setShowEstimator(false)} />

      <main className="thin-scroll flex-1 overflow-y-auto">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button
            onClick={() => setNavOpen(true)}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <GanttChartSquare size={18} className="text-brand-500" />
          <span className="text-sm font-semibold text-slate-900">Program Pulse</span>
        </div>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {/* Breadcrumb */}
          <nav className="mb-5 flex items-center gap-1.5 text-sm text-slate-500">
            <Crumb onClick={() => setView({ k: 'home' })} active={view.k === 'home'}>
              Overview
            </Crumb>
            {view.k === 'portfolio' && (
              <>
                <ChevronRight size={14} className="text-slate-300" />
                <Crumb active>Portfolio timeline</Crumb>
              </>
            )}
            {view.k === 'alerts' && (
              <>
                <ChevronRight size={14} className="text-slate-300" />
                <Crumb active>Alerts</Crumb>
              </>
            )}
            {view.k === 'weekly' && (
              <>
                <ChevronRight size={14} className="text-slate-300" />
                <Crumb active>Weekly Updates</Crumb>
              </>
            )}
            {view.k === 'capacity' && (
              <>
                <ChevronRight size={14} className="text-slate-300" />
                <Crumb active>Capacity Planning</Crumb>
              </>
            )}
            {view.k === 'budget' && (
              <>
                <ChevronRight size={14} className="text-slate-300" />
                <Crumb active>Budget</Crumb>
              </>
            )}
            {view.k === 'reconcile' && (
              <>
                <ChevronRight size={14} className="text-slate-300" />
                <Crumb active>Monthly Budget</Crumb>
              </>
            )}
            {view.k === 'reports' && (
              <>
                <ChevronRight size={14} className="text-slate-300" />
                <Crumb active>Reports &amp; KPIs</Crumb>
              </>
            )}
            {view.k === 'roles' && (
              <>
                <ChevronRight size={14} className="text-slate-300" />
                <Crumb active>Roles &amp; Access</Crumb>
              </>
            )}
            {view.k === 'help' && (
              <>
                <ChevronRight size={14} className="text-slate-300" />
                <Crumb active>Help & Guide</Crumb>
              </>
            )}
            {activeDomain && (
              <>
                <ChevronRight size={14} className="text-slate-300" />
                <Crumb
                  onClick={() => setView({ k: 'domain', domainId: activeDomain.id })}
                  active={view.k === 'domain'}
                >
                  {activeDomain.name}
                </Crumb>
              </>
            )}
            {view.k === 'program' && program && (
              <>
                <ChevronRight size={14} className="text-slate-300" />
                <Crumb active>{program.name}</Crumb>
              </>
            )}
          </nav>

          {view.k === 'home' && (
            <DomainGrid
              onOpenDomain={(domainId) => setView({ k: 'domain', domainId })}
              onOpenPortfolio={() => setView({ k: 'portfolio' })}
              onOpenAlerts={() => setView({ k: 'alerts' })}
              onOpenProgram={(programId) => setView({ k: 'program', programId })}
              onNavigate={navigate}
            />
          )}
          {view.k === 'domain' && (
            <ProgramList
              domainId={view.domainId}
              onOpenProgram={(programId) => setView({ k: 'program', programId })}
            />
          )}
          {view.k === 'program' && <ProgramDetail programId={view.programId} />}
          {view.k === 'portfolio' && (
            <PortfolioView onOpenProgram={(programId) => setView({ k: 'program', programId })} />
          )}
          {view.k === 'alerts' && (
            <AlertsView onOpenProgram={(programId) => setView({ k: 'program', programId })} />
          )}
          {view.k === 'weekly' && (
            <WeeklyUpdatesView onOpenProgram={(programId) => setView({ k: 'program', programId })} />
          )}
          {view.k === 'capacity' && (
            <CapacityPlanning onOpenProgram={(programId) => setView({ k: 'program', programId })} />
          )}
          {view.k === 'budget' && (
            <BudgetView onOpenProgram={(programId) => setView({ k: 'program', programId })} />
          )}
          {view.k === 'reconcile' && <MonthlyReconciliation />}
          {view.k === 'reports' && (
            <ReportsView onOpenProgram={(programId) => setView({ k: 'program', programId })} />
          )}
          {view.k === 'roles' && <RolesView onPreview={(u) => setUser(u)} />}
          {view.k === 'help' && <HelpView onNavigate={navigate} />}
        </div>
      </main>
    </div>
  )
}

function Crumb({
  children,
  onClick,
  active,
}: {
  children: ReactNode
  onClick?: () => void
  active?: boolean
}) {
  if (active || !onClick) {
    return <span className={active ? 'font-medium text-slate-800' : ''}>{children}</span>
  }
  return (
    <button onClick={onClick} className="hover:text-slate-800">
      {children}
    </button>
  )
}
