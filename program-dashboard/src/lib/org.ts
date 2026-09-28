// Organisational hierarchy + strict domain isolation.
//
// The tree is deliberately simple: 5 teams (each run by a manager) → one
// director → one VP → (admin sees all). A manager only sees their own team;
// the director and VP see every team they oversee. This is sample org config
// (not user-editable yet); access is enforced everywhere via visibleDomainIds().

export type OrgLevel = 'contributor' | 'director' | 'vp' | 'admin'

export interface Vp {
  id: string
  name: string
}

export interface Director {
  id: string
  name: string
  vpId: string
}

export const VPS: Vp[] = [{ id: 'vp_dk', name: 'David Kim' }]

export const DIRECTORS: Director[] = [{ id: 'dir_ec', name: 'Emma Clark', vpId: 'vp_dk' }]

/** Which director owns each domain. */
export const DOMAIN_DIRECTOR: Record<string, string> = {
  d_customer: 'dir_ec',
  d_salesforce: 'dir_ec',
  d_ets: 'dir_ec',
  d_hrai: 'dir_ec',
  d_ndc: 'dir_ec',
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

/** A minimal user shape (avoids importing the store, which would cycle). */
export interface OrgUser {
  role: OrgLevel
  domainId?: string
  directorId?: string
  vpId?: string
}

/**
 * The exact set of domain ids a user may see. `null` means "all domains"
 * (admin). Everyone else is limited to their own subtree: a manager to their
 * one domain, the director to the domains they own, the VP to every domain
 * under their director(s).
 */
export function visibleDomainIds(user: OrgUser, allDomainIds: string[]): string[] | null {
  switch (user.role) {
    case 'admin':
      return null
    case 'contributor':
      return user.domainId ? [user.domainId] : []
    case 'director':
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
