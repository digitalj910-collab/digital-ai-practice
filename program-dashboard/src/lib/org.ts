// Organisational hierarchy + strict domain isolation.
//
// The tree is: domain → director/senior_director → VP → (admin sees all).
// Each domain is owned by exactly one director; each director reports to exactly
// one VP. A user only ever sees their own subtree. This is sample org config
// (not user-editable yet); access is enforced everywhere via visibleDomainIds().

export type OrgLevel =
  | 'contributor'
  | 'director'
  | 'senior_director'
  | 'vp'
  | 'admin'
  | 'sandbox'

export interface Vp {
  id: string
  name: string
}

export interface Director {
  id: string
  name: string
  /** Org-unit label shown in the UI (e.g. DBASS, EIP, TSS). */
  unit: string
  level: 'director' | 'senior_director'
  vpId: string
}

export const VPS: Vp[] = [
  { id: 'vp_dk', name: 'David Kim' },
  { id: 'vp_lc', name: 'Laura Chen' },
]

export const DIRECTORS: Director[] = [
  { id: 'dir_dbass', name: 'Emma Clark', unit: 'DBASS', level: 'senior_director', vpId: 'vp_dk' },
  { id: 'dir_eip', name: 'Michael Ross', unit: 'EIP', level: 'director', vpId: 'vp_dk' },
  { id: 'dir_tss', name: 'Sarah Bennett', unit: 'TSS', level: 'director', vpId: 'vp_lc' },
]

/** Which director owns each domain. */
export const DOMAIN_DIRECTOR: Record<string, string> = {
  d_customer: 'dir_dbass',
  d_salesforce: 'dir_dbass',
  d_ets: 'dir_eip',
  d_hrai: 'dir_tss',
  d_ndc: 'dir_tss',
}

export function directorById(id?: string): Director | undefined {
  return DIRECTORS.find((d) => d.id === id)
}
export function vpById(id?: string): Vp | undefined {
  return VPS.find((v) => v.id === id)
}
export function directorsForVp(vpId?: string): Director[] {
  return DIRECTORS.filter((d) => d.vpId === vpId)
}

export interface DirectorGroup<T> {
  director: Director | undefined
  domains: T[]
}

/**
 * Group a set of domains under the director that owns each, ordered by the org
 * chart (DBASS → EIP → TSS). Used to render the hierarchy (VP → director →
 * domain) in the nav and overview instead of a flat list. Domains with no known
 * director fall into a trailing undefined-director group.
 */
export function groupByDirector<T extends { id: string }>(domains: T[]): DirectorGroup<T>[] {
  const groups: DirectorGroup<T>[] = []
  for (const dir of DIRECTORS) {
    const mine = domains.filter((d) => DOMAIN_DIRECTOR[d.id] === dir.id)
    if (mine.length) groups.push({ director: dir, domains: mine })
  }
  const orphans = domains.filter((d) => !directorById(DOMAIN_DIRECTOR[d.id]))
  if (orphans.length) groups.push({ director: undefined, domains: orphans })
  return groups
}

/** A minimal user shape (avoids importing the store, which would cycle). */
export interface OrgUser {
  role: OrgLevel
  domainId?: string
  directorId?: string
  vpId?: string
}

/**
 * The exact set of domain ids a user may see. `null` means "all domains"
 * (admin / sandbox). Everyone else is strictly limited to their own subtree:
 * a contributor to their one domain, a director to the domains they own, a VP
 * to every domain under their directors. Peers never overlap.
 */
export function visibleDomainIds(user: OrgUser, allDomainIds: string[]): string[] | null {
  switch (user.role) {
    case 'admin':
    case 'sandbox':
      return null
    case 'contributor':
      return user.domainId ? [user.domainId] : []
    case 'director':
    case 'senior_director':
      return allDomainIds.filter((id) => DOMAIN_DIRECTOR[id] === user.directorId)
    case 'vp': {
      const dirIds = directorsForVp(user.vpId).map((d) => d.id)
      return allDomainIds.filter((id) => dirIds.includes(DOMAIN_DIRECTOR[id]))
    }
    default:
      return []
  }
}

/** True when the user is allowed to see the given domain's data. */
export function canSeeDomain(user: OrgUser, domainId: string, allDomainIds: string[]): boolean {
  const vis = visibleDomainIds(user, allDomainIds)
  return vis === null || vis.includes(domainId)
}
