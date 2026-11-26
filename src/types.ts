export type AppView = 'tech' | 'shop' | 'manage' | 'team' | 'license'

export type OrderStatus = 'pending' | 'picked' | 'restocked'

export interface Van {
  id: string
  name: string
  techName: string
  number: string
}

export interface PartItem {
  id: string
  vanId: string
  name: string
  sku?: string
  category: string
  parLevel: number
  currentUsedToday: number
  iconName: string
  barcode?: string
  brand?: string
  thumbnailUrl?: string
  needsDetailsSync?: boolean
}

export interface RestockOrderItem {
  partId: string
  partName: string
  sku: string
  qty: number
  picked: boolean
}

export interface RestockOrder {
  id: string
  vanId: string
  vanName: string
  submittedAt: string
  jobTag?: string
  status: OrderStatus
  items: RestockOrderItem[]
  restockedAt?: string
}

export type SyncAction =
  | 'van:create'
  | 'van:delete'
  | 'part:increment'
  | 'part:decrement'
  | 'part:create'
  | 'part:update'
  | 'part:delete'
  | 'inventory:upsert'
  | 'template:load'
  | 'order:submit'
  | 'order:pick'
  | 'order:restock'
  | 'usage:reset'
  | 'demo:reset'

export interface SyncQueueEntry {
  id?: number
  opId?: string
  action: SyncAction
  entity: 'part' | 'order' | 'van' | 'template' | 'usage' | 'demo'
  entityId: string
  payload: Record<string, unknown>
  createdAt: string
  status: 'queued' | 'syncing'
  attempts: number
  lastError?: string
}

export interface TemplatePart {
  name: string
  sku?: string
  category: string
  parLevel: number
  iconName: string
}

export interface TradePreset {
  id: string
  name: string
  description: string
  iconName: string
  parts: TemplatePart[]
}
