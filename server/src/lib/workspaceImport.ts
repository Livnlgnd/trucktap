import { bumpRevision, db, nowIso } from '../db.js'
import type {
  ServerOrder,
  ServerPart,
  ServerVan,
} from './validation.js'

export interface WorkspaceData {
  vans: ServerVan[]
  parts: ServerPart[]
  orders: ServerOrder[]
}

export class WorkspaceImportError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'WorkspaceImportError'
    this.status = status
  }
}

/**
 * Inserts a client's local workspace into an organization. The caller must run
 * this inside a transaction so partial imports cannot escape.
 */
export function importWorkspaceRows(
  orgId: string,
  { vans, parts, orders }: WorkspaceData,
): void {
  const existing = db
    .prepare('SELECT COUNT(*) AS count FROM vans WHERE org_id = ?')
    .get(orgId) as { count: number }

  if (existing.count > 0) {
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

  const now = nowIso()

  for (const van of vans) {
    db.prepare(
      `INSERT INTO vans
        (id, org_id, name, tech_name, number, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(van.id, orgId, van.name, van.techName, van.number, now, now)
  }

  for (const part of parts) {
    db.prepare(
      `INSERT INTO parts
        (id, org_id, van_id, name, sku, category, par_level,
         current_used_today, icon_name, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
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
    )
  }

  for (const order of orders) {
    db.prepare(
      `INSERT INTO orders
        (id, org_id, van_id, van_name, submitted_at, job_tag, status,
         restocked_at, items_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
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
    )
  }

  bumpRevision(orgId)
}
