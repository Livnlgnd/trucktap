import { db } from '../db.js'
import type { AuthContext } from '../middleware/auth.js'
import type { Role } from './auth.js'

interface OrganizationRow {
  id: string
  name: string
  join_code: string
  plan: string
  revision: number
  created_at: string
}

interface VanRow {
  id: string
  name: string
  tech_name: string
  number: string
}

interface PartRow {
  id: string
  van_id: string
  name: string
  sku: string
  category: string
  par_level: number
  current_used_today: number
  icon_name: string
}

interface OrderRow {
  id: string
  van_id: string
  van_name: string
  submitted_at: string
  job_tag: string
  status: 'pending' | 'picked' | 'restocked'
  restocked_at: string | null
  items_json: string
}

export interface Snapshot {
  organization: {
    id: string
    name: string
    joinCode: string
    plan: string
    revision: number
    role: Role
  }
  vans: Array<{
    id: string
    name: string
    techName: string
    number: string
  }>
  parts: Array<{
    id: string
    vanId: string
    name: string
    sku?: string
    category: string
    parLevel: number
    currentUsedToday: number
    iconName: string
  }>
  orders: Array<{
    id: string
    vanId: string
    vanName: string
    submittedAt: string
    jobTag?: string
    status: 'pending' | 'picked' | 'restocked'
    items: Array<{
      partId: string
      partName: string
      sku: string
      qty: number
      picked: boolean
    }>
    restockedAt?: string
  }>
  serverTime: string
}

export function getOrganization(orgId: string): OrganizationRow | undefined {
  return db
    .prepare('SELECT * FROM organizations WHERE id = ?')
    .get(orgId) as OrganizationRow | undefined
}

export function getMembership(userId: string):
  | {
      user_id: string
      org_id: string
      role: Role
      created_at: string
    }
  | undefined {
  return db
    .prepare('SELECT * FROM memberships WHERE user_id = ?')
    .get(userId) as
    | {
        user_id: string
        org_id: string
        role: Role
        created_at: string
      }
    | undefined
}

export function getSnapshot(auth: AuthContext): Snapshot {
  const organization = getOrganization(auth.orgId)
  if (!organization) throw new Error('Organization not found.')

  const vans = db
    .prepare(
      'SELECT id, name, tech_name, number FROM vans WHERE org_id = ? ORDER BY name ASC',
    )
    .all(auth.orgId) as unknown as VanRow[]

  const parts = db
    .prepare(
      `SELECT id, van_id, name, sku, category, par_level,
              current_used_today, icon_name
       FROM parts WHERE org_id = ? ORDER BY name ASC`,
    )
    .all(auth.orgId) as unknown as PartRow[]

  const orders = db
    .prepare(
      `SELECT id, van_id, van_name, submitted_at, job_tag, status,
              restocked_at, items_json
       FROM orders WHERE org_id = ? ORDER BY submitted_at DESC`,
    )
    .all(auth.orgId) as unknown as OrderRow[]

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      joinCode: organization.join_code,
      plan: organization.plan,
      revision: organization.revision,
      role: auth.role,
    },
    vans: vans.map((van) => ({
      id: van.id,
      name: van.name,
      techName: van.tech_name,
      number: van.number,
    })),
    parts: parts.map((part) => ({
      id: part.id,
      vanId: part.van_id,
      name: part.name,
      sku: part.sku || undefined,
      category: part.category,
      parLevel: part.par_level,
      currentUsedToday: part.current_used_today,
      iconName: part.icon_name,
    })),
    orders: orders.map((order) => ({
      id: order.id,
      vanId: order.van_id,
      vanName: order.van_name,
      submittedAt: order.submitted_at,
      ...(order.job_tag ? { jobTag: order.job_tag } : {}),
      status: order.status,
      items: JSON.parse(order.items_json) as Snapshot['orders'][number]['items'],
      ...(order.restocked_at ? { restockedAt: order.restocked_at } : {}),
    })),
    serverTime: new Date().toISOString(),
  }
}

export function listMembers(orgId: string): Array<{
  id: string
  name: string
  email: string
  role: Role
  joinedAt: string
}> {
  const rows = db
    .prepare(
      `SELECT users.id, users.name, users.email, memberships.role,
              memberships.created_at
       FROM memberships
       JOIN users ON users.id = memberships.user_id
       WHERE memberships.org_id = ?
       ORDER BY CASE memberships.role
         WHEN 'owner' THEN 0 WHEN 'shop' THEN 1 ELSE 2 END,
         users.name ASC`,
    )
    .all(orgId) as Array<{
    id: string
    name: string
    email: string
    role: Role
    created_at: string
  }>

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    joinedAt: row.created_at,
  }))
}
