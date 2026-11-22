import { Router } from 'express'
import { z } from 'zod'
import {
  bumpRevision,
  db,
  nowIso,
  transaction,
} from '../db.js'
import { getAuth, requireAuth } from '../middleware/auth.js'
import type { AuthContext } from '../middleware/auth.js'
import {
  orderSchema,
  partSchema,
  syncPushSchema,
  vanSchema,
} from '../lib/validation.js'
import type { ServerSyncAction } from '../lib/validation.js'
import { getSnapshot } from '../lib/workspace.js'

export const syncRouter = Router()

syncRouter.use(requireAuth)

const incrementPayloadSchema = z.object({
  delta: z.number().int().min(-1).max(1).optional(),
})

const vanPayloadSchema = z.object({
  van: vanSchema,
})

const templatePayloadSchema = z.object({
  vanId: z.string().min(1).max(120),
  parts: z.array(partSchema).min(1).max(500),
})

const orderSubmitPayloadSchema = z.object({
  order: orderSchema,
})

const orderPickPayloadSchema = z.object({
  partId: z.string().min(1).max(120),
  picked: z.boolean(),
})

const usageResetPayloadSchema = z.object({
  vanId: z.string().min(1).max(120).optional(),
})

interface SyncOperation {
  opId: string
  action: ServerSyncAction
  entityId: string
  payload: Record<string, unknown>
}

interface OrderRow {
  items_json: string
  status: 'pending' | 'picked' | 'restocked'
}

function parsePayload<T>(
  schema: z.ZodType<T>,
  payload: Record<string, unknown>,
): T {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? 'Sync payload is invalid.',
    )
  }
  return parsed.data
}

function ensureVan(orgId: string, vanId: string): void {
  const van = db
    .prepare('SELECT 1 FROM vans WHERE org_id = ? AND id = ?')
    .get(orgId, vanId)
  if (!van) throw new Error('Van not found in this workspace.')
}

function upsertVan(
  auth: AuthContext,
  van: z.infer<typeof vanSchema>,
): void {
  const now = nowIso()
  db.prepare(
    `INSERT INTO vans
      (id, org_id, name, tech_name, number, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(org_id, id) DO UPDATE SET
       name = excluded.name,
       tech_name = excluded.tech_name,
       number = excluded.number,
       updated_at = excluded.updated_at`,
  ).run(
    van.id,
    auth.orgId,
    van.name,
    van.techName,
    van.number,
    now,
    now,
  )
}

function upsertPart(auth: AuthContext, part: z.infer<typeof partSchema>): void {
  ensureVan(auth.orgId, part.vanId)
  const now = nowIso()
  db.prepare(
    `INSERT INTO parts
      (id, org_id, van_id, name, sku, category, par_level,
       current_used_today, icon_name, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(org_id, id) DO UPDATE SET
       van_id = excluded.van_id,
       name = excluded.name,
       sku = excluded.sku,
       category = excluded.category,
       par_level = excluded.par_level,
       current_used_today = excluded.current_used_today,
       icon_name = excluded.icon_name,
       updated_at = excluded.updated_at`,
  ).run(
    part.id,
    auth.orgId,
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

function applyOperation(
  auth: AuthContext,
  operation: SyncOperation,
): void {
  switch (operation.action) {
    case 'van:create': {
      const { van } = parsePayload(vanPayloadSchema, operation.payload)
      if (van.id !== operation.entityId) {
        throw new Error('Van payload does not match the operation.')
      }
      upsertVan(auth, van)
      return
    }

    case 'van:delete': {
      db.prepare('DELETE FROM orders WHERE org_id = ? AND van_id = ?').run(
        auth.orgId,
        operation.entityId,
      )
      db.prepare('DELETE FROM parts WHERE org_id = ? AND van_id = ?').run(
        auth.orgId,
        operation.entityId,
      )
      db.prepare('DELETE FROM vans WHERE org_id = ? AND id = ?').run(
        auth.orgId,
        operation.entityId,
      )
      return
    }

    case 'part:increment':
    case 'part:decrement': {
      parsePayload(incrementPayloadSchema, operation.payload)
      const delta = operation.action === 'part:increment' ? 1 : -1
      const result = db
        .prepare(
          `UPDATE parts
           SET current_used_today = MAX(0, current_used_today + ?),
               updated_at = ?
           WHERE org_id = ? AND id = ?`,
        )
        .run(delta, nowIso(), auth.orgId, operation.entityId)

      if (Number(result.changes) === 0) throw new Error('Part not found.')
      return
    }

    case 'usage:reset': {
      const { vanId } = parsePayload(
        usageResetPayloadSchema,
        operation.payload,
      )
      const now = nowIso()

      if (vanId) {
        ensureVan(auth.orgId, vanId)
        db.prepare(
          `UPDATE parts SET current_used_today = 0, updated_at = ?
           WHERE org_id = ? AND van_id = ?`,
        ).run(now, auth.orgId, vanId)
      } else {
        db.prepare(
          'UPDATE parts SET current_used_today = 0, updated_at = ? WHERE org_id = ?',
        ).run(now, auth.orgId)
      }
      return
    }

    case 'part:create':
    case 'part:update': {
      const { part } = parsePayload(
        z.object({ part: partSchema }),
        operation.payload,
      )
      upsertPart(auth, part)
      return
    }

    case 'part:delete': {
      db.prepare('DELETE FROM parts WHERE org_id = ? AND id = ?').run(
        auth.orgId,
        operation.entityId,
      )
      return
    }

    case 'template:load': {
      const payload = parsePayload(
        templatePayloadSchema,
        operation.payload,
      )
      ensureVan(auth.orgId, payload.vanId)
      for (const part of payload.parts) {
        if (part.vanId !== payload.vanId) continue
        const now = nowIso()
        db.prepare(
          `INSERT OR IGNORE INTO parts
            (id, org_id, van_id, name, sku, category, par_level,
             current_used_today, icon_name, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          part.id,
          auth.orgId,
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
      return
    }

    case 'order:submit': {
      const { order } = parsePayload(
        orderSubmitPayloadSchema,
        operation.payload,
      )
      ensureVan(auth.orgId, order.vanId)
      const now = nowIso()

      db.prepare(
        `INSERT OR IGNORE INTO orders
          (id, org_id, van_id, van_name, submitted_at, job_tag, status,
           restocked_at, items_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        order.id,
        auth.orgId,
        order.vanId,
        order.vanName,
        order.submittedAt,
        order.jobTag ?? '',
        order.status,
        order.restockedAt ?? null,
        JSON.stringify(order.items),
        now,
      )

      for (const item of order.items) {
        db.prepare(
          `UPDATE parts SET current_used_today = 0, updated_at = ?
           WHERE org_id = ? AND id = ?`,
        ).run(now, auth.orgId, item.partId)
      }
      return
    }

    case 'order:pick': {
      const payload = parsePayload(
        orderPickPayloadSchema,
        operation.payload,
      )
      const order = db
        .prepare(
          'SELECT items_json, status FROM orders WHERE org_id = ? AND id = ?',
        )
        .get(auth.orgId, operation.entityId) as OrderRow | undefined

      if (!order) throw new Error('Order not found.')
      if (order.status === 'restocked') return

      const items = JSON.parse(order.items_json) as Array<{
        partId: string
        picked: boolean
      }>
      let changed = false
      for (const item of items) {
        if (item.partId === payload.partId) {
          item.picked = payload.picked
          changed = true
        }
      }
      if (!changed) throw new Error('Order line not found.')

      const status = items.every((item) => item.picked) ? 'picked' : 'pending'
      db.prepare(
        `UPDATE orders SET items_json = ?, status = ?, updated_at = ?
         WHERE org_id = ? AND id = ?`,
      ).run(
        JSON.stringify(items),
        status,
        nowIso(),
        auth.orgId,
        operation.entityId,
      )
      return
    }

    case 'order:restock': {
      const order = db
        .prepare(
          'SELECT items_json, status FROM orders WHERE org_id = ? AND id = ?',
        )
        .get(auth.orgId, operation.entityId) as OrderRow | undefined
      if (!order) throw new Error('Order not found.')
      if (order.status === 'restocked') return

      const items = (
        JSON.parse(order.items_json) as Array<{
          partId: string
          picked: boolean
        }>
      ).map((item) => ({ ...item, picked: true }))
      const restockedAt = nowIso()

      db.prepare(
        `UPDATE orders
         SET status = 'restocked', restocked_at = ?, items_json = ?, updated_at = ?
         WHERE org_id = ? AND id = ?`,
      ).run(
        restockedAt,
        JSON.stringify(items),
        restockedAt,
        auth.orgId,
        operation.entityId,
      )
      return
    }

    case 'demo:reset':
      return

    default: {
      const exhaustiveCheck: never = operation.action
      throw new Error(`Unsupported sync action: ${exhaustiveCheck}`)
    }
  }
}

syncRouter.get('/snapshot', (_request, response) => {
  const auth = getAuth(response)
  response.json(getSnapshot(auth))
})

syncRouter.post('/push', (request, response) => {
  const auth = getAuth(response)
  const parsed = syncPushSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({
      error: 'The sync payload is invalid.',
      issues: parsed.error.issues,
    })
    return
  }

  const acknowledged: string[] = []
  const failed: Array<{ opId: string; error: string }> = []

  transaction(() => {
    for (const operation of parsed.data.ops) {
      const duplicate = db
        .prepare(
          'SELECT 1 FROM sync_operations WHERE org_id = ? AND op_id = ?',
        )
        .get(auth.orgId, operation.opId)

      if (duplicate) {
        acknowledged.push(operation.opId)
        continue
      }

      db.exec('SAVEPOINT trucktap_op')
      try {
        applyOperation(auth, operation)
        db.prepare(
          `INSERT INTO sync_operations
            (org_id, op_id, device_id, action, applied_at)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(
          auth.orgId,
          operation.opId,
          parsed.data.deviceId,
          operation.action,
          nowIso(),
        )
        db.exec('RELEASE SAVEPOINT trucktap_op')
        acknowledged.push(operation.opId)
      } catch (error) {
        db.exec('ROLLBACK TO SAVEPOINT trucktap_op')
        db.exec('RELEASE SAVEPOINT trucktap_op')
        failed.push({
          opId: operation.opId,
          error:
            error instanceof Error ? error.message : 'Sync operation failed.',
        })
      }
    }

    if (acknowledged.length > 0) bumpRevision(auth.orgId)
  })

  const organization = db
    .prepare('SELECT revision FROM organizations WHERE id = ?')
    .get(auth.orgId) as { revision: number }

  response.json({
    acknowledged,
    failed,
    revision: organization.revision,
    serverTime: nowIso(),
  })
})
