import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, Minus, ShieldCheck } from 'lucide-react'
import { useStore, type CurrentUser } from '../store/useStore'
import { VPS, DIRECTORS, DOMAIN_DIRECTOR } from '../lib/org'
import { PageHeader } from './ui'

// Columns of the access matrix — the role tiers.
type Tier = 'contributor' | 'director' | 'vp' | 'admin'
const TIERS: { key: Tier; label: string }[] = [
  { key: 'contributor', label: 'Contributor' },
  { key: 'director', label: 'Director / Sr.' },
  { key: 'vp', label: 'VP' },
  { key: 'admin', label: 'Admin' },
]

const ROWS: { label: string; cells: Record<Tier, boolean | string> }[] = [
  { label: 'Domains visible', cells: { contributor: 'Own 1', director: 'Assigned', vp: "Directors'", admin: 'All' } },
  { label: 'Data entry (tasks, weekly updates)', cells: { contributor: true, director: false, vp: false, admin: true } },
  { label: 'Create projects', cells: { contributor: true, director: true, vp: false, admin: true } },
  { label: "Set a project's rates & vendors", cells: { contributor: false, director: true, vp: true, admin: true } },
  { label: 'Budget & cost', cells: { contributor: false, director: true, vp: true, admin: true } },
  { label: 'Monthly budget (planned vs actual)', cells: { contributor: false, director: true, vp: true, admin: true } },
  { label: 'Planning tools (Estimator, Capacity, Rate card)', cells: { contributor: false, director: true, vp: true, admin: true } },
  { label: 'Overview (portfolio rollup)', cells: { contributor: false, director: true, vp: true, admin: true } },
  { label: 'Portfolio timeline', cells: { contributor: true, director: true, vp: true, admin: true } },
  { label: 'Alerts', cells: { contributor: true, director: true, vp: true, admin: true } },
  { label: 'Weekly Updates', cells: { contributor: true, director: true, vp: true, admin: true } },
  { label: 'Reports & KPIs', cells: { contributor: false, director: false, vp: false, admin: true } },
  { label: 'Admin settings (add teams, default rates)', cells: { contributor: false, director: false, vp: false, admin: true } },
]

export function RolesView({ onPreview }: { onPreview: (user: CurrentUser) => void }) {
  const domains = useStore((s) => s.domains)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

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

      {/* Org tree — preview any role. Expand a VP to see its directors, a director
          to see the contributors (managers) under them. */}
      <div>
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Preview a role</h2>
        <p className="mb-3 text-sm text-slate-500">
          Click <strong>Preview</strong> to view the app exactly as that person would. Expand a VP or
          director to drill into the people under them. Switch back any time from the "Viewing as"
          dropdown at the bottom-left.
        </p>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-50">
            {/* Admin tier */}
            <Node
              label="You (Admin)"
              sub="Full access to everything"
              onPreview={() => onPreview({ role: 'admin', name: 'You (Admin)' })}
            />
            <Node
              label="Sandbox"
              sub="All access — internal testing only"
              onPreview={() => onPreview({ role: 'sandbox', name: 'Sandbox' })}
            />

            {/* VP → Director → Contributor tree */}
            {VPS.map((v) => {
              const dirs = DIRECTORS.filter((d) => d.vpId === v.id)
              const vpOpen = open.has(v.id)
              return (
                <div key={v.id}>
                  <Node
                    depth={0}
                    label={v.name}
                    sub={`VP · oversees ${dirs.map((d) => d.unit).join(', ')}`}
                    expandable
                    open={vpOpen}
                    onToggle={() => toggle(v.id)}
                    onPreview={() => onPreview({ role: 'vp', vpId: v.id, name: v.name })}
                  />
                  {vpOpen &&
                    dirs.map((d) => {
                      const doms = domains.filter((dom) => DOMAIN_DIRECTOR[dom.id] === d.id)
                      const dOpen = open.has(d.id)
                      return (
                        <div key={d.id}>
                          <Node
                            depth={1}
                            label={`${d.name} · ${d.unit}`}
                            sub={`${d.level === 'senior_director' ? 'Sr. Director' : 'Director'} · ${doms
                              .map((x) => x.name)
                              .join(', ')}`}
                            expandable
                            open={dOpen}
                            onToggle={() => toggle(d.id)}
                            onPreview={() => onPreview({ role: d.level, directorId: d.id, name: d.name })}
                          />
                          {dOpen &&
                            doms.map((dom) => (
                              <Node
                                key={dom.id}
                                depth={2}
                                label={dom.managerName}
                                sub={`Contributor · ${dom.name}`}
                                onPreview={() =>
                                  onPreview({ role: 'contributor', domainId: dom.id, name: dom.managerName })
                                }
                              />
                            ))}
                        </div>
                      )
                    })}
                </div>
              )
            })}
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
  expandable = false,
  open = false,
  onToggle,
  onPreview,
}: {
  label: string
  sub: string
  depth?: number
  expandable?: boolean
  open?: boolean
  onToggle?: () => void
  onPreview: () => void
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50"
      style={{ paddingLeft: 12 + depth * 22 }}
    >
      {expandable ? (
        <button
          onClick={onToggle}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
      ) : (
        <span className="h-5 w-5 shrink-0" />
      )}
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
