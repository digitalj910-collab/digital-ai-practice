import { Check, Minus, ShieldCheck } from 'lucide-react'
import { useStore, type CurrentUser } from '../store/useStore'
import { VPS, DIRECTORS, DOMAIN_DIRECTOR } from '../lib/org'
import { PageHeader } from './ui'

// Columns of the access matrix — the role tiers.
type Tier = 'contributor' | 'director' | 'vp' | 'admin'
const TIERS: { key: Tier; label: string }[] = [
  { key: 'contributor', label: 'Manager' },
  { key: 'director', label: 'Director' },
  { key: 'vp', label: 'VP' },
  { key: 'admin', label: 'Admin' },
]

const ROWS: { label: string; cells: Record<Tier, boolean | string> }[] = [
  { label: 'Teams visible', cells: { contributor: 'Own team', director: 'All 5', vp: 'All 5', admin: 'All' } },
  { label: 'Data entry (tasks, weekly updates)', cells: { contributor: true, director: false, vp: false, admin: true } },
  { label: 'Create projects', cells: { contributor: true, director: true, vp: false, admin: true } },
  { label: "Set a project's rates & vendors", cells: { contributor: false, director: true, vp: true, admin: true } },
  { label: 'Budget & cost', cells: { contributor: false, director: true, vp: true, admin: true } },
  { label: 'Monthly budget (planned vs actual)', cells: { contributor: false, director: true, vp: true, admin: true } },
  { label: 'Executive Summary', cells: { contributor: false, director: true, vp: 'Home', admin: true } },
  { label: 'Planning tools (Estimator, Capacity, Rate card)', cells: { contributor: false, director: true, vp: false, admin: true } },
  { label: 'Overview (portfolio rollup)', cells: { contributor: false, director: true, vp: false, admin: true } },
  { label: 'Budget page', cells: { contributor: false, director: true, vp: false, admin: true } },
  { label: 'Portfolio timeline', cells: { contributor: true, director: true, vp: true, admin: true } },
  { label: 'Alerts', cells: { contributor: true, director: true, vp: true, admin: true } },
  { label: 'Weekly Updates', cells: { contributor: true, director: true, vp: 'Director rollup only', admin: true } },
  { label: 'Reports & KPIs', cells: { contributor: false, director: false, vp: false, admin: true } },
  { label: 'Admin settings (add teams, default rates)', cells: { contributor: false, director: false, vp: false, admin: true } },
]

export function RolesView({ onPreview }: { onPreview: (user: CurrentUser) => void }) {
  const domains = useStore((s) => s.domains)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ShieldCheck size={22} />}
        accent="#c8102e"
        title="Roles & Access"
        subtitle="Who sees what across the org hierarchy — and a one-click preview of each role for demos."
      />

      {/* Access matrix */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className="px-4 py-2.5 font-semibold text-slate-700">Capability</th>
              {TIERS.map((t) => (
                <th key={t.key} className="px-3 py-2.5 text-center font-semibold text-slate-700">
                  {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {ROWS.map((row) => (
              <tr key={row.label}>
                <td className="px-4 py-2 text-slate-600">{row.label}</td>
                {TIERS.map((t) => {
                  const v = row.cells[t.key]
                  return (
                    <td key={t.key} className="px-3 py-2 text-center">
                      {v === true ? (
                        <Check size={16} className="mx-auto text-emerald-600" />
                      ) : v === false ? (
                        <Minus size={16} className="mx-auto text-slate-300" />
                      ) : (
                        <span className="text-xs font-medium text-slate-600">{v}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview any role: Admin → VP → Director → the five team managers. */}
      <div>
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Preview a role</h2>
        <p className="mb-3 text-sm text-slate-500">
          Click <strong>Preview</strong> to view the app exactly as that person would. Switch back any
          time with <strong>Exit preview</strong> at the bottom-left.
        </p>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-50">
            <Node
              label="You (Admin)"
              sub="Full access to everything"
              onPreview={() => onPreview({ role: 'admin', name: 'You (Admin)' })}
            />
            {VPS.map((v) => (
              <Node
                key={v.id}
                label={v.name}
                sub="VP · all teams, summary level"
                onPreview={() => onPreview({ role: 'vp', vpId: v.id, name: v.name })}
              />
            ))}
            {DIRECTORS.map((d) => (
              <Node
                key={d.id}
                label={d.name}
                sub={`Director · ${domains.filter((dom) => DOMAIN_DIRECTOR[dom.id] === d.id).length} teams`}
                onPreview={() => onPreview({ role: 'director', directorId: d.id, name: d.name })}
              />
            ))}
            {domains.map((dom) => (
              <Node
                key={dom.id}
                depth={1}
                label={dom.managerName}
                sub={`Manager · ${dom.name}`}
                onPreview={() => onPreview({ role: 'contributor', domainId: dom.id, name: dom.managerName })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Node({
  label,
  sub,
  depth = 0,
  onPreview,
}: {
  label: string
  sub: string
  depth?: number
  onPreview: () => void
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50"
      style={{ paddingLeft: 16 + depth * 22 }}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-800">{label}</span>
        <span className="block truncate text-xs text-slate-500">{sub}</span>
      </span>
      <button
        onClick={onPreview}
        className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:border-brand-300 hover:bg-brand-50"
      >
        Preview →
      </button>
    </div>
  )
}
