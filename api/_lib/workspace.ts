import { db, type DbTransaction } from './db.js'
import type { AuthContext } from './auth.js'
import type {
  Role,
  ServerOrder,
  ServerPart,
  ServerVan,
  WorkspaceData,
} from './schemas.js'

interface OrganizationRow {
  id: string
  name: string
  join_code: string
  plan: string
  revision: number
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

export class WorkspaceImportError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'WorkspaceImportError'
    this.status = status
  }
}

export async function getOrganization(
  orgId: string,
): Promise<OrganizationRow | undefined> {
  return db.one<OrganizationRow>(
    'SELECT id, name, join_code, plan, revision FROM organizations WHERE id = $1',
    [orgId],
  )
}

export async function getSnapshot(auth: AuthContext): Promise<Snapshot> {
  const organization = await getOrganization(auth.orgId)
  if (!organization) throw new Error('Organization not found.')

  const [vans, parts, orders] = await Promise.all([
    db.query<VanRow>(
      'SELECT id, name, tech_name, number FROM vans WHERE org_id = $1 ORDER BY name ASC',
      [auth.orgId],
    ),
    db.query<PartRow>(
      `SELECT id, van_id, name, sku, category, par_level,
              current_used_today, icon_name
       FROM parts WHERE org_id = $1 ORDER BY name ASC`,
      [auth.orgId],
    ),
    db.query<OrderRow>(
      `SELECT id, van_id, van_name, submitted_at, job_tag, status,
              restocked_at, items_json
       FROM orders WHERE org_id = $1 ORDER BY submitted_at DESC`,
      [auth.orgId],
    ),
  ])

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

export async function listMembers(orgId: string): Promise<
  Array<{
    id: string
    name: string
    email: string
    role: Role
    joinedAt: string
  }>
> {
  const rows = await db.query<{
    id: string
    name: string
    email: string
    role: Role
    created_at: string
  }>(
    `SELECT users.id, users.name, users.email, memberships.role,
            memberships.created_at
     FROM memberships
     JOIN users ON users.id = memberships.user_id
     WHERE memberships.org_id = $1
     ORDER BY CASE memberships.role
       WHEN 'owner' THEN 0 WHEN 'shop' THEN 1 ELSE 2 END,
       users.name ASC`,
    [orgId],
  )

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    joinedAt: row.created_at,
  }))
}

export async function importWorkspaceRows(
  tx: DbTransaction,
  orgId: string,
  { vans, parts, orders }: WorkspaceData,
): Promise<void> {
  const existing = await tx.one<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM vans WHERE org_id = $1',
    [orgId],
  )
  if ((existing?.count ?? 0) > 0) {
    throw new WorkspaceImportError(
      'This workspace already has cloud data. Sync it instead of importing.',
      409,
    )
  }

  const vanIds = new Set(vans.map((van) => van.id))
  if (vanIds.size !== vans.length) {
    throw new WorkspaceImportError('Duplicate van IDs in the import.')
  }
  const partIds = new Set(parts.map((part) => part.id))
  if (partIds.size !== parts.length) {
    throw new WorkspaceImportError('Duplicate part IDs in the import.')
  }
  if (parts.some((part) => !vanIds.has(part.vanId))) {
    throw new WorkspaceImportError(
      'A part references a van that is not in the import.',
    )
  }
  if (orders.some((order) => !vanIds.has(order.vanId))) {
    throw new WorkspaceImportError(
      'An order references a van that is not in the import.',
    )
  }

  const now = new Date().toISOString()

  for (const van of vans as ServerVan[]) {
    await tx.execute(
      `INSERT INTO vans
        (id, org_id, name, tech_name, number, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        van.id,
        orgId,
        van.name,
        van.techName,
        van.number,
        now,
        now,
      ],
    )
  }

  for (const part of parts as ServerPart[]) {
    await tx.execute(
      `INSERT INTO parts
        (id, org_id, van_id, name, sku, category, par_level,
         current_used_today, icon_name, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        part.id,
        orgId,
        part.vanId,
        part.name,
        part.sku ?? '',
        part.category,
        part.parLevel,
        part.currentUsedToday,
        part.iconName,
        now,
      ],
    )
  }

  for (const order of orders as ServerOrder[]) {
    await tx.execute(
      `INSERT INTO orders
        (id, org_id, van_id, van_name, submitted_at, job_tag, status,
         restocked_at, items_json, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        order.id,
        orgId,
        order.vanId,
        order.vanName,
        order.submittedAt,
        order.jobTag ?? '',
        order.status,
        order.restockedAt ?? null,
        JSON.stringify(order.items),
        now,
      ],
    )
  }

  await tx.execute(
    'UPDATE organizations SET revision = revision + 1 WHERE id = $1',
    [orgId],
  )
}
