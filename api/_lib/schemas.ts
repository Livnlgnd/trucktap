import { z } from 'zod'

export const emailSchema = z.string().trim().email().max(254)
export const passwordSchema = z.string().min(8).max(128)
export const roleSchema = z.enum(['tech', 'shop'])

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: emailSchema,
  password: passwordSchema,
  workspaceName: z.string().trim().min(1).max(80),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
})

export const joinSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: emailSchema,
  password: passwordSchema,
  joinCode: z.string().trim().min(4).max(16),
  role: roleSchema.default('tech'),
})

export const memberRoleSchema = z.object({
  role: roleSchema,
})

export const vanSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  techName: z.string().max(80).default(''),
  number: z.string().max(32).default(''),
})

export const partSchema = z.object({
  id: z.string().min(1).max(120),
  vanId: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  sku: z.string().max(80).optional().default(''),
  category: z.string().min(1).max(80),
  parLevel: z.number().int().min(0).max(10000),
  currentUsedToday: z.number().int().min(0).max(100000).default(0),
  iconName: z.string().min(1).max(80).default('Package'),
})

export const orderItemSchema = z.object({
  partId: z.string().min(1).max(120),
  partName: z.string().min(1).max(200),
  sku: z.string().max(80).optional().default(''),
  qty: z.number().int().min(1).max(100000),
  picked: z.boolean().default(false),
})

export const orderSchema = z.object({
  id: z.string().min(1).max(120),
  vanId: z.string().min(1).max(120),
  vanName: z.string().min(1).max(160),
  submittedAt: z.string().min(1).max(64),
  jobTag: z.string().max(160).optional().default(''),
  status: z.enum(['pending', 'picked', 'restocked']),
  items: z.array(orderItemSchema).min(1).max(500),
  restockedAt: z.string().max(64).optional(),
})

export const workspaceImportSchema = z.object({
  vans: z.array(vanSchema).max(100),
  parts: z.array(partSchema).max(2000),
  orders: z.array(orderSchema).max(2000),
})

export const syncActionSchema = z.enum([
  'part:increment',
  'part:decrement',
  'part:create',
  'part:update',
  'part:delete',
  'template:load',
  'order:submit',
  'order:pick',
  'order:restock',
  'usage:reset',
  'demo:reset',
])

export const syncPushSchema = z.object({
  deviceId: z.string().min(1).max(120),
  ops: z
    .array(
      z.object({
        opId: z.string().min(1).max(120),
        action: syncActionSchema,
        entityId: z.string().min(1).max(120),
        payload: z.record(z.string(), z.unknown()).default({}),
        createdAt: z.string().max(64).optional(),
      }),
    )
    .max(100),
})

export type Role = 'owner' | 'shop' | 'tech'
export type ServerSyncAction = z.infer<typeof syncActionSchema>
export type ServerOrder = z.infer<typeof orderSchema>
export type ServerPart = z.infer<typeof partSchema>
export type ServerVan = z.infer<typeof vanSchema>
export type WorkspaceData = z.infer<typeof workspaceImportSchema>
