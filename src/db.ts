import Dexie, { type EntityTable } from 'dexie'
import type {
  OrderStatus,
  PartItem,
  RestockOrder,
  SyncAction,
  SyncQueueEntry,
  TemplatePart,
  Van,
} from './types'
import {
  createId,
  localDateKey,
  partIdentity,
} from './lib/utils'

const USAGE_DATE_KEY = 'trucktap.usage-date'

class TruckTapDatabase extends Dexie {
  vans!: EntityTable<Van, 'id'>
  parts!: EntityTable<PartItem, 'id'>
  orders!: EntityTable<RestockOrder, 'id'>
  syncQueue!: EntityTable<SyncQueueEntry, 'id'>

  constructor() {
    super('trucktap')
    this.version(1).stores({
      vans: 'id, name',
      parts: 'id, vanId, category, name, sku',
      orders: 'id, vanId, status, submittedAt, restockedAt',
      syncQueue: '++id, action, entity, entityId, createdAt, status',
    })
    this.version(2).stores({
      vans: 'id, name',
      parts: 'id, vanId, category, name, sku, barcode',
      orders: 'id, vanId, status, submittedAt, restockedAt',
      syncQueue: '++id, action, entity, entityId, createdAt, status',
    })
  }
}

export const db = new TruckTapDatabase()

const DEMO_ORDER_IDS = ['TT-101-DEMO', 'TT-102-DEMO', 'TT-104-DEMO']
const DEMO_VAN_NAMES: Record<string, string> = {
  'van-101': 'Van #101 - Mike',
  'van-102': 'Van #102 - Carlos',
  'van-104': 'Van #104 - Sarah',
}
const DEMO_CLEANUP_KEY = 'trucktap.demo-cleanup-v1'

// Older builds shipped demo vans and sample orders. Remove them once on
// upgrade, but only when the database still looks untouched demo data.
async function removeLegacyDemoData(): Promise<void> {
  try {
    if (window.localStorage.getItem(DEMO_CLEANUP_KEY)) return
  } catch {
    return
  }

  try {
    const vans = await db.vans.toArray()
    const demoVans = vans.filter(
      (van) => DEMO_VAN_NAMES[van.id] === van.name,
    )

    if (demoVans.length === Object.keys(DEMO_VAN_NAMES).length) {
      const orders = await db.orders.toArray()
      const hasRealOrders = orders.some(
        (order) => !DEMO_ORDER_IDS.includes(order.id),
      )

      if (!hasRealOrders) {
        const demoIds = demoVans.map((van) => van.id)
        await db.transaction(
          'rw',
          db.vans,
          db.parts,
          db.orders,
          db.syncQueue,
          async () => {
            await db.parts.where('vanId').anyOf(demoIds).delete()
            await db.vans.bulkDelete(demoIds)
            await db.orders.bulkDelete(DEMO_ORDER_IDS)
          },
        )
      }
    }

    window.localStorage.setItem(DEMO_CLEANUP_KEY, '1')
  } catch {
    // Leave existing data untouched if cleanup cannot run.
  }
}

export async function createVan(input: {
  name: string
  techName?: string
  number?: string
  templateParts?: TemplatePart[]
  presetId?: string
}): Promise<Van> {
  const name = input.name.trim()
  if (!name) throw new Error('Enter a van name.')

  const van: Van = {
    id: createId('van'),
    name,
    techName: input.techName?.trim() ?? '',
    number: input.number?.trim() ?? '',
  }

  return db.transaction('rw', db.vans, db.parts, db.syncQueue, async () => {
    await db.vans.add(van)
    await queueSync('van:create', 'van', van.id, { van })

    const templateParts = input.templateParts ?? []
    if (templateParts.length > 0) {
      const parts: PartItem[] = templateParts.map((part) => ({
        id: createId('part'),
        vanId: van.id,
        name: part.name,
        sku: part.sku,
        category: part.category,
        parLevel: part.parLevel,
        currentUsedToday: 0,
        iconName: part.iconName,
      }))

      await db.parts.bulkAdd(parts)
      await queueSync('template:load', 'template', input.presetId ?? 'initial', {
        vanId: van.id,
        presetId: input.presetId ?? 'initial',
        parts,
        addedPartIds: parts.map((part) => part.id),
        addedCount: parts.length,
      })
    }

    return van
  })
}

let initialization: Promise<void> | null = null

async function initialize(): Promise<void> {
  await db.open()
  await removeLegacyDemoData()

  try {
    const today = localDateKey()
    const lastUsageDate = window.localStorage.getItem(USAGE_DATE_KEY)

    if (lastUsageDate && lastUsageDate !== today) {
      await db.transaction('rw', db.parts, db.syncQueue, async () => {
        const usedCount = await db.parts
          .filter((part) => part.currentUsedToday > 0)
          .count()

        if (usedCount > 0) {
          await db.parts
            .toCollection()
            .modify({ currentUsedToday: 0 })
          await queueSync('usage:reset', 'usage', 'daily', {
            date: today,
            previousDate: lastUsageDate,
          })
        }
      })
    }

    window.localStorage.setItem(USAGE_DATE_KEY, today)
  } catch {
    // Storage can be unavailable in strict private browsing; offline data still works.
  }
}

export function initializeDatabase(): Promise<void> {
  if (!initialization) {
    initialization = initialize().catch((error: unknown) => {
      initialization = null
      throw error
    })
  }

  return initialization
}

async function queueSync(
  action: SyncAction,
  entity: SyncQueueEntry['entity'],
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await db.syncQueue.add({
    opId: createId('op'),
    action,
    entity,
    entityId,
    payload,
    createdAt: new Date().toISOString(),
    status: 'queued',
    attempts: 0,
  })
}

function createOrderId(): string {
  const time = Date.now().toString(36).slice(-6).toUpperCase()
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `TT-${time}-${suffix}`
}

export async function incrementPart(partId: string): Promise<void> {
  await db.transaction('rw', db.parts, db.syncQueue, async () => {
    const part = await db.parts.get(partId)
    if (!part) return

    const nextValue = part.currentUsedToday + 1
    await db.parts.update(partId, { currentUsedToday: nextValue })
    await queueSync('part:increment', 'part', partId, {
      vanId: part.vanId,
      delta: 1,
      currentUsedToday: nextValue,
    })
  })
}

export async function decrementPart(partId: string): Promise<void> {
  await db.transaction('rw', db.parts, db.syncQueue, async () => {
    const part = await db.parts.get(partId)
    if (!part || part.currentUsedToday <= 0) return

    const nextValue = part.currentUsedToday - 1
    await db.parts.update(partId, { currentUsedToday: nextValue })
    await queueSync('part:decrement', 'part', partId, {
      vanId: part.vanId,
      delta: -1,
      currentUsedToday: nextValue,
    })
  })
}

export async function resetVanUsage(vanId: string): Promise<number> {
  return db.transaction('rw', db.parts, db.syncQueue, async () => {
    const parts = await db.parts.where('vanId').equals(vanId).toArray()
    const used = parts.filter((part) => part.currentUsedToday > 0)
    if (used.length === 0) return 0

    await db.parts.bulkPut(
      used.map((part) => ({ ...part, currentUsedToday: 0 })),
    )
    await queueSync('usage:reset', 'usage', vanId, {
      vanId,
      resetParts: used.length,
    })

    return used.length
  })
}

export async function submitRestockOrder(
  vanId: string,
  jobTagInput = '',
): Promise<RestockOrder> {
  return db.transaction('rw', db.vans, db.parts, db.orders, db.syncQueue, async () => {
    const van = await db.vans.get(vanId)
    if (!van) throw new Error('Select a van before sending a restock list.')

    const parts = await db.parts.where('vanId').equals(vanId).toArray()
    const usedParts = parts.filter((part) => part.currentUsedToday > 0)

    if (usedParts.length === 0) {
      throw new Error('No parts have been marked used yet.')
    }

    const jobTag = jobTagInput.trim()
    const order: RestockOrder = {
      id: createOrderId(),
      vanId,
      vanName: van.name,
      submittedAt: new Date().toISOString(),
      ...(jobTag ? { jobTag } : {}),
      status: 'pending',
      items: usedParts.map((part) => ({
        partId: part.id,
        partName: part.name,
        sku: part.sku ?? '',
        qty: part.currentUsedToday,
        picked: false,
      })),
    }

    await db.orders.add(order)
    await db.parts.bulkPut(
      usedParts.map((part) => ({ ...part, currentUsedToday: 0 })),
    )
    await queueSync('order:submit', 'order', order.id, {
      order,
      queuedItemCount: order.items.length,
    })

    return order
  })
}

export async function toggleOrderItemPicked(
  orderId: string,
  partId: string,
): Promise<void> {
  await db.transaction('rw', db.orders, db.syncQueue, async () => {
    const order = await db.orders.get(orderId)
    if (!order || order.status === 'restocked') return

    let changed = false
    const items = order.items.map((item) => {
      if (item.partId !== partId) return item
      changed = true
      return { ...item, picked: !item.picked }
    })

    if (!changed) return

    const status: OrderStatus = items.every((item) => item.picked)
      ? 'picked'
      : 'pending'

    await db.orders.update(orderId, { items, status })
    await queueSync('order:pick', 'order', orderId, {
      orderId,
      partId,
      picked: items.find((item) => item.partId === partId)?.picked ?? false,
    })
  })
}

export async function markOrderRestocked(orderId: string): Promise<void> {
  await db.transaction('rw', db.orders, db.syncQueue, async () => {
    const order = await db.orders.get(orderId)
    if (!order || order.status === 'restocked') return

    const restockedAt = new Date().toISOString()
    await db.orders.update(orderId, {
      status: 'restocked',
      restockedAt,
      items: order.items.map((item) => ({ ...item, picked: true })),
    })
    await queueSync('order:restock', 'order', orderId, {
      orderId,
      vanId: order.vanId,
      restockedAt,
    })
  })
}

export async function savePart(part: PartItem): Promise<void> {
  await db.transaction('rw', db.parts, db.syncQueue, async () => {
    const existing = await db.parts.get(part.id)
    await db.parts.put(part)
    await queueSync(
      existing ? 'part:update' : 'part:create',
      'part',
      part.id,
      {
        vanId: part.vanId,
        name: part.name,
        sku: part.sku ?? '',
        parLevel: part.parLevel,
        part,
      },
    )
  })
}

export async function deletePart(partId: string): Promise<void> {
  await db.transaction('rw', db.parts, db.syncQueue, async () => {
    const existing = await db.parts.get(partId)
    if (!existing) return

    await db.parts.delete(partId)
    await queueSync('part:delete', 'part', partId, {
      vanId: existing.vanId,
      name: existing.name,
      sku: existing.sku ?? '',
    })
  })
}

export async function findPartByBarcode(
  vanId: string,
  barcode: string,
): Promise<PartItem | null> {
  const code = barcode.trim()
  if (!code) return null
  const part = await db.parts
    .where('vanId')
    .equals(vanId)
    .filter((item) => item.barcode === code)
    .first()
  return part ?? null
}

export async function addScannedPart(input: {
  vanId: string
  name: string
  brand?: string
  sku?: string
  barcode: string
  category: string
  parLevel?: number
  currentUsedToday?: number
  iconName?: string
  thumbnailUrl?: string
  needsDetailsSync?: boolean
}): Promise<PartItem> {
  return db.transaction('rw', db.parts, db.syncQueue, async () => {
    const part: PartItem = {
      id: createId('part'),
      vanId: input.vanId,
      name: input.name.trim(),
      sku: input.sku?.trim() || input.barcode,
      barcode: input.barcode.trim(),
      brand: input.brand?.trim() || undefined,
      category: input.category,
      parLevel: Math.max(1, input.parLevel ?? 10),
      currentUsedToday: Math.max(0, input.currentUsedToday ?? 1),
      iconName: input.iconName ?? 'Package',
      thumbnailUrl: input.thumbnailUrl,
      needsDetailsSync: input.needsDetailsSync ?? false,
    }
    await db.parts.add(part)
    await queueSync('inventory:upsert', 'part', part.id, {
      part,
      barcode: part.barcode,
      vanId: part.vanId,
    })
    return part
  })
}

export async function loadTemplate(
  vanId: string,
  templateParts: TemplatePart[],
  presetId: string,
): Promise<number> {
  return db.transaction('rw', db.parts, db.syncQueue, async () => {
    const existing = await db.parts.where('vanId').equals(vanId).toArray()
    const existingKeys = new Set(existing.map(partIdentity))
    const missing = templateParts.filter(
      (part) => !existingKeys.has(partIdentity(part)),
    )

    if (missing.length === 0) return 0

    const parts: PartItem[] = missing.map((part) => ({
      id: createId('part'),
      vanId,
      name: part.name,
      sku: part.sku,
      category: part.category,
      parLevel: part.parLevel,
      currentUsedToday: 0,
      iconName: part.iconName,
    }))

    await db.parts.bulkAdd(parts)
    await queueSync('template:load', 'template', presetId, {
      vanId,
      presetId,
      parts,
      addedPartIds: parts.map((part) => part.id),
      addedCount: parts.length,
    })

    return parts.length
  })
}

export async function deleteVan(vanId: string): Promise<void> {
  await db.transaction(
    'rw',
    db.vans,
    db.parts,
    db.orders,
    db.syncQueue,
    async () => {
      const van = await db.vans.get(vanId)
      if (!van) return

      await db.parts.where('vanId').equals(vanId).delete()
      await db.orders.where('vanId').equals(vanId).delete()
      await db.vans.delete(vanId)
      await queueSync('van:delete', 'van', vanId, { name: van.name })
    },
  )
}

export async function resetAllData(): Promise<void> {
  await db.transaction(
    'rw',
    db.vans,
    db.parts,
    db.orders,
    db.syncQueue,
    async () => {
      await Promise.all([
        db.vans.clear(),
        db.parts.clear(),
        db.orders.clear(),
        db.syncQueue.clear(),
      ])
    },
  )

  try {
    window.localStorage.setItem(USAGE_DATE_KEY, localDateKey())
    window.localStorage.removeItem('trucktap.active-van')
  } catch {
    // Optional nicety; ignore storage errors.
  }
}

export async function getQueuedSyncCount(): Promise<number> {
  return db.syncQueue.count()
}

export async function getQueuedSyncOperations(
  limit = 100,
): Promise<SyncQueueEntry[]> {
  const entries = await db.syncQueue.orderBy('id').limit(limit).toArray()

  for (const entry of entries) {
    if (!entry.opId) {
      const opId = createId('op')
      entry.opId = opId
      if (entry.id !== undefined) {
        await db.syncQueue.update(entry.id, { opId })
      }
    }
  }

  return entries
}

export async function finishSyncPush(
  acknowledged: string[],
  failed: Array<{ opId: string; error: string }>,
): Promise<void> {
  const acknowledgedSet = new Set(acknowledged)
  const failureMap = new Map(failed.map((entry) => [entry.opId, entry.error]))

  await db.transaction('rw', db.syncQueue, async () => {
    const entries = await db.syncQueue.toArray()

    for (const entry of entries) {
      if (!entry.opId) continue

      if (acknowledgedSet.has(entry.opId)) {
        if (entry.id !== undefined) await db.syncQueue.delete(entry.id)
        continue
      }

      const failure = failureMap.get(entry.opId)
      if (failure) {
        await db.syncQueue.update(entry.id!, {
          attempts: entry.attempts + 1,
          lastError: failure,
          status: 'queued',
        })
      }
    }
  })
}

export async function clearSyncQueue(): Promise<void> {
  await db.syncQueue.clear()
}

export async function exportLocalSnapshot(): Promise<{
  vans: Van[]
  parts: PartItem[]
  orders: RestockOrder[]
}> {
  const [vans, parts, orders] = await Promise.all([
    db.vans.toArray(),
    db.parts.toArray(),
    db.orders.toArray(),
  ])

  return { vans, parts, orders }
}

export async function applyServerSnapshot(
  snapshot: {
    vans: Van[]
    parts: PartItem[]
    orders: RestockOrder[]
  },
  options: { clearQueue?: boolean } = {},
): Promise<void> {
  await db.transaction('rw', db.vans, db.parts, db.orders, db.syncQueue, async () => {
    if (!options.clearQueue && (await db.syncQueue.count()) > 0) {
      throw new Error('Refusing to replace local data while sync changes are pending.')
    }

    const localParts = await db.parts.toArray()
    const localByBarcode = new Map(
      localParts
        .filter((part) => part.barcode)
        .map((part) => [part.id, part]),
    )
    const mergedParts = snapshot.parts.map((part) => {
      const local = localByBarcode.get(part.id)
      if (!local) return part
      return {
        ...part,
        barcode: part.barcode ?? local.barcode,
        brand: part.brand ?? local.brand,
        thumbnailUrl: part.thumbnailUrl ?? local.thumbnailUrl,
        needsDetailsSync: part.needsDetailsSync ?? local.needsDetailsSync,
      }
    })

    await db.syncQueue.clear()
    await db.vans.clear()
    await db.parts.clear()
    await db.orders.clear()
    await db.vans.bulkPut(snapshot.vans)
    await db.parts.bulkPut(mergedParts)
    await db.orders.bulkPut(snapshot.orders)
  })
}
