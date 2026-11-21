import Dexie, { type EntityTable } from 'dexie'
import type {
  OrderStatus,
  PartItem,
  RestockOrder,
  RestockOrderItem,
  SyncAction,
  SyncQueueEntry,
  TemplatePart,
  Van,
} from './types'
import { DEFAULT_TEMPLATE } from './lib/templates'
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
  }
}

export const db = new TruckTapDatabase()

const VAN_SEEDS: Van[] = [
  { id: 'van-101', name: 'Van #101 - Mike', techName: 'Mike', number: '#101' },
  {
    id: 'van-102',
    name: 'Van #102 - Carlos',
    techName: 'Carlos',
    number: '#102',
  },
  {
    id: 'van-104',
    name: 'Van #104 - Sarah',
    techName: 'Sarah',
    number: '#104',
  },
]

function buildPartsForVan(vanId: string): PartItem[] {
  return DEFAULT_TEMPLATE.map((part, index) => ({
    id: `part-${vanId}-${String(index + 1).padStart(2, '0')}`,
    vanId,
    name: part.name,
    sku: part.sku,
    category: part.category,
    parLevel: part.parLevel,
    currentUsedToday: 0,
    iconName: part.iconName,
  }))
}

function seedOrderItems(
  parts: PartItem[],
  vanId: string,
  selections: Array<[name: string, qty: number, picked?: boolean]>,
): RestockOrderItem[] {
  return selections.map(([name, qty, picked = false]) => {
    const part = parts.find(
      (candidate) => candidate.vanId === vanId && candidate.name === name,
    )

    if (!part) {
      throw new Error(`Seed part not found: ${name}`)
    }

    return {
      partId: part.id,
      partName: part.name,
      sku: part.sku ?? '',
      qty,
      picked,
    }
  })
}

async function seedIfEmpty(): Promise<void> {
  await db.transaction('rw', db.vans, db.parts, db.orders, async () => {
    if ((await db.vans.count()) > 0) return

    await db.vans.bulkAdd(VAN_SEEDS)

    const parts = VAN_SEEDS.flatMap((van) => buildPartsForVan(van.id))
    await db.parts.bulkAdd(parts)

    const now = Date.now()
    const minutesAgo = (minutes: number) =>
      new Date(now - minutes * 60_000).toISOString()

    const orders: RestockOrder[] = [
      {
        id: 'TT-101-DEMO',
        vanId: 'van-101',
        vanName: 'Van #101 - Mike',
        submittedAt: minutesAgo(118),
        jobTag: 'WO-2231 · Unit 12 kitchen',
        status: 'restocked',
        restockedAt: minutesAgo(74),
        items: seedOrderItems(parts, 'van-101', [
          ['20A Single-Pole Breaker', 2, true],
          ['12/2 Romex Cable (25 ft)', 1, true],
          ['Yellow Wire Nuts (Bag/10)', 2, true],
          ['Heavy-Duty Duct Tape', 1, true],
        ]),
      },
      {
        id: 'TT-102-DEMO',
        vanId: 'van-102',
        vanName: 'Van #102 - Carlos',
        submittedAt: minutesAgo(46),
        jobTag: 'WO-2481 · Unit 4B panel swap',
        status: 'pending',
        items: seedOrderItems(parts, 'van-102', [
          ['GFCI Outlet 20A White', 4],
          ['20A Single-Pole Breaker', 2],
          ['Red Wire Nuts (Bag/10)', 3, true],
          ['1/2" EMT Compression Connector', 6],
          ['Electrical Tape (Black)', 2],
        ]),
      },
      {
        id: 'TT-104-DEMO',
        vanId: 'van-104',
        vanName: 'Van #104 - Sarah',
        submittedAt: minutesAgo(21),
        jobTag: 'WO-2493 · Building C leak call',
        status: 'pending',
        items: seedOrderItems(parts, 'van-104', [
          ['1/2" SharkBite Coupling', 4],
          ['1-1/2" P-Trap Kit', 2],
          ['Teflon Tape (3-pack)', 3, true],
          ['Wax Ring (No-Seal)', 2],
        ]),
      },
    ]

    await db.orders.bulkAdd(orders)
  })
}

let initialization: Promise<void> | null = null

async function initialize(): Promise<void> {
  await db.open()
  await seedIfEmpty()

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

export async function resetDemoData(): Promise<void> {
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

  await seedIfEmpty()

  try {
    window.localStorage.setItem(USAGE_DATE_KEY, localDateKey())
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

    await db.syncQueue.clear()
    await db.vans.clear()
    await db.parts.clear()
    await db.orders.clear()
    await db.vans.bulkPut(snapshot.vans)
    await db.parts.bulkPut(snapshot.parts)
    await db.orders.bulkPut(snapshot.orders)
  })
}
