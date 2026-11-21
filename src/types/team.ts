import type { PartItem, RestockOrder, Van } from '../types'

export type TeamRole = 'owner' | 'shop' | 'tech'

export interface TeamUser {
  id: string
  name: string
  email: string
}

export interface TeamOrganization {
  id: string
  name: string
  joinCode: string
  plan: string
  revision: number
  role: TeamRole
}

export interface TeamSession {
  token: string
  user: TeamUser
  organization: TeamOrganization
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: TeamRole
  joinedAt: string
}

export interface TeamOrganizationResponse {
  organization: TeamOrganization
  members: TeamMember[]
}

export interface ServerSnapshot {
  organization: TeamOrganization
  vans: Van[]
  parts: PartItem[]
  orders: RestockOrder[]
  serverTime: string
}

export interface SyncPushResponse {
  acknowledged: string[]
  failed: Array<{ opId: string; error: string }>
  revision: number
  serverTime: string
}
