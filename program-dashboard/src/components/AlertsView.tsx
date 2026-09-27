import { useMemo, useState } from 'react'
import { AlertTriangle, Bell, Clock, TrendingDown, Users } from 'lucide-react'
import { visibleDomainIds, useStore } from '../store/useStore'
import { alertTypeLabel, buildAlerts, RISK_META, type Alert, type AlertType } from '../lib/metrics'
import { PageHeader, StatTile, inputClass } from './ui'

const ALERT_ICON: Record<AlertType, typeof Bell> = {
  overdue: Clock,
  behind: TrendingDown,
  ending_soon: Clock,
  resource: Users,
}

export function AlertsView({ onOpenProgram }: { onOpenProgram: (programId: string) => void }) {
  const allPrograms = useStore((s) => s.programs)
  const tasks = useStore((s) => s.tasks)
  const allDomains = useStore((s) => s.domains)
  const user = useStore((s) => s.currentUser)
  // Everyone sees alerts only for the domains in their org subtree.
  const visIds = visibleDomainIds(user, allDomains.map((d) => d.id))
  const programs = visIds ? allPrograms.filter((p) => visIds.includes(p.domainId)) : allPrograms
  const domains = visIds ? allDomains.filter((d) => visIds.includes(d.id)) : allDomains

  const alerts = useMemo(() => buildAlerts(programs, tasks), [programs, tasks])
  const domainName = (id: string) => domains.find((d) => d.id === id)?.name ?? ''
  const domainColor = (id: string) => domains.find((d) => d.id === id)?.color ?? '#64748b'

  const atRisk = alerts.filter((a) => a.level === 'at_risk').length

  const [area, setArea] = useState('all')
  const shown = useMemo(
    () => (area === 'all' ? alerts : alerts.filter((a) => a.domainId === area)),
    [alerts, area],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Bell size={22} />}
        accent="#dc2626"
        title="Alerts"
        subtitle="Projects that need attention right now — the same logic that will drive email notifications."
      />

      <div className="grid grid-cols-3 gap-4">
        <StatTile icon={<Bell size={20} />} label="Total alerts" value={alerts.length} accent="#c8102e" />
        <StatTile icon={<AlertTriangle size={20} />} label="At risk" value={atRisk} accent={RISK_META.at_risk.color} />
        <StatTile icon={<Clock size={20} />} label="Watch" value={alerts.length - atRisk} accent={RISK_META.watch.color} />
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 py-16 text-slate-400">
          <Bell size={22} />
          <p className="text-sm">No active alerts — everything is on plan.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-end">
            <label className="flex items-center gap-2 text-sm text-slate-500">
              Area
              <select
                className={`${inputClass} w-auto py-1.5`}
                value={area}
                onChange={(e) => setArea(e.target.value)}
              >
                <option value="all">All areas</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {shown.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">
              No alerts in this area.
            </div>
          ) : (
            <ul className="space-y-2">
              {shown.map((a, i) => (
                <AlertRow
                  key={`${a.programId}-${a.type}-${i}`}
                  alert={a}
                  domainName={domainName(a.domainId)}
                  domainColor={domainColor(a.domainId)}
                  onClick={() => onOpenProgram(a.programId)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function AlertRow({
  alert,
  domainName,
  domainColor,
  onClick,
}: {
  alert: Alert
  domainName: string
  domainColor: string
  onClick: () => void
}) {
  const Icon = ALERT_ICON[alert.type]
  const meta = RISK_META[alert.level]
  return (
    <li>
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${meta.color}1a`, color: meta.color }}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-slate-900">{alert.programName}</span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-sm" style={{ background: domainColor }} />
              {domainName}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-600">{alert.message}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badge}`}>
          {alertTypeLabel(alert.type)}
        </span>
      </button>
    </li>
  )
}

