import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db, ensureSchema, transaction, type DbTransaction } from './db.js'
import {
  AuthError,
  createAccessToken,
  createJoinCode,
  getAuthContext,
  hashPassword,
  normalizeEmail,
  verifyPassword,
  type AuthContext,
} from './auth.js'
import { HttpError, json, readJson } from './http.js'
import {
  joinSchema,
  loginSchema,
  memberRoleSchema,
  orderSchema,
  partSchema,
  registerSchema,
  syncPushSchema,
  vanSchema,
  workspaceImportSchema,
  type Role,
  type ServerSyncAction,
} from './schemas.js'
import {
  getOrganization,
  getSnapshot,
  importWorkspaceRows,
  listMembers,
  WorkspaceImportError,
} from './workspace.js'

interface UserRow {
  id: string
  email: string
  name: string
  password_hash: string
}

interface MembershipRow {
  org_id: string
  role: Role
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505',
  )
}

function validationError(error: z.ZodError): never {
  throw new HttpError(
    error.issues[0]?.message ?? 'Please check the details and try again.',
    400,
  )
}

async function createUniqueJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = createJoinCode(8)
    const existing = await db.one<{ id: string }>(
      'SELECT id FROM organizations WHERE join_code = $1',
      [code],
    )
    if (!existing) return code
  }
  throw new Error('Could not allocate a workspace join code.')
}

function sessionPayload(input: {
  userId: string
  name: string
  email: string
  orgId: string
  orgName: string
  joinCode: string
  plan: string
  revision: number
  role: Role
}) {
  return {
    token: createAccessToken(input.userId, input.orgId),
    user: {
      id: input.userId,
      name: input.name,
      email: input.email,
    },
    organization: {
      id: input.orgId,
      name: input.orgName,
      joinCode: input.joinCode,
      plan: input.plan,
      revision: input.revision,
      role: input.role,
    },
  }
}

export async function healthResponse(request: Request): Promise<Response> {
  return json(request, {
    ok: true,
    service: 'trucktap-web-api',
    version: '1.0.0',
    serverTime: new Date().toISOString(),
  })
}

export async function register(request: Request): Promise<Response> {
  await ensureSchema()
  const rawBody = (await readJson(request)) as {
    workspace?: unknown
    [key: string]: unknown
  }
  const parsed = registerSchema.safeParse(rawBody)
  if (!parsed.success) validationError(parsed.error)

  const workspaceResult =
    rawBody.workspace === undefined
      ? null
      : workspaceImportSchema.safeParse(rawBody.workspace)
  if (workspaceResult && !workspaceResult.success) {
    validationError(workspaceResult.error)
  }

  const { name, password, workspaceName } = parsed.data
  const email = normalizeEmail(parsed.data.email)
  const existing = await db.one('SELECT id FROM users WHERE email = $1', [email])
  if (existing) {
    throw new HttpError('An account with that email already exists.', 409)
  }

  const userId = randomUUID()
  const orgId = randomUUID()
  const joinCode = await createUniqueJoinCode()
  const createdAt = new Date().toISOString()

  try {
    await transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO organizations (id, name, join_code, plan, revision, created_at)
         VALUES ($1, $2, $3, 'team', 0, $4)`,
        [orgId, workspaceName, joinCode, createdAt],
      )
      await tx.execute(
        `INSERT INTO users (id, email, name, password_hash, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, email, name, hashPassword(password), createdAt],
      )
      await tx.execute(
        `INSERT INTO memberships (user_id, org_id, role, created_at)
         VALUES ($1, $2, 'owner', $3)`,
        [userId, orgId, createdAt],
      )
      if (workspaceResult) {
        await importWorkspaceRows(tx, orgId, workspaceResult.data)
      }
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError('That account or join code already exists.', 409)
    }
    throw error
  }

  const organization = await getOrganization(orgId)
  return json(
    request,
    sessionPayload({
      userId,
      name,
      email,
      orgId,
      orgName: workspaceName,
      joinCode,
      plan: 'team',
      revision: organization?.revision ?? 0,
      role: 'owner',
    }),
    201,
  )
}

export async function login(request: Request): Promise<Response> {
  await ensureSchema()
  const parsed = loginSchema.safeParse(await readJson(request))
  if (!parsed.success) validationError(parsed.error)
  const email = normalizeEmail(parsed.data.email)

  const user = await db.one<UserRow>(
    'SELECT id, email, name, password_hash FROM users WHERE email = $1',
    [email],
  )
  if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
    throw new HttpError('Email or password is incorrect.', 401)
  }

  const membership = await db.one<MembershipRow>(
    'SELECT org_id, role FROM memberships WHERE user_id = $1',
    [user.id],
  )
  const organization = membership
    ? await getOrganization(membership.org_id)
    : undefined
  if (!membership || !organization) {
    throw new HttpError('This account is not attached to a workspace.', 403)
  }

  return json(
    request,
    sessionPayload({
      userId: user.id,
      name: user.name,
      email: user.email,
      orgId: organization.id,
      orgName: organization.name,
      joinCode: organization.join_code,
      plan: organization.plan,
      revision: organization.revision,
      role: membership.role,
    }),
  )
}

export async function join(request: Request): Promise<Response> {
  await ensureSchema()
  const parsed = joinSchema.safeParse(await readJson(request))
  if (!parsed.success) validationError(parsed.error)

  const { name, password, role } = parsed.data
  const email = normalizeEmail(parsed.data.email)
  const joinCode = parsed.data.joinCode.trim().toUpperCase()

  const existing = await db.one('SELECT id FROM users WHERE email = $1', [email])
  if (existing) {
    throw new HttpError('An account with that email already exists.', 409)
  }

  const organization = await db.one<{
    id: string
    name: string
    join_code: string
    plan: string
    revision: number
  }>(
    'SELECT id, name, join_code, plan, revision FROM organizations WHERE join_code = $1',
    [joinCode],
  )
  if (!organization) {
    throw new HttpError('That join code is not valid.', 404)
  }

  const userId = randomUUID()
  const createdAt = new Date().toISOString()
  try {
    await transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO users (id, email, name, password_hash, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, email, name, hashPassword(password), createdAt],
      )
      await tx.execute(
        `INSERT INTO memberships (user_id, org_id, role, created_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, organization.id, role, createdAt],
      )
      await tx.execute(
        'UPDATE organizations SET revision = revision + 1 WHERE id = $1',
        [organization.id],
      )
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError('That account already exists.', 409)
    }
    throw error
  }

  return json(
    request,
    sessionPayload({
      userId,
      name,
      email,
      orgId: organization.id,
      orgName: organization.name,
      joinCode: organization.join_code,
      plan: organization.plan,
      revision: organization.revision + 1,
      role,
    }),
    201,
  )
}

export async function getOrg(request: Request): Promise<Response> {
  await ensureSchema()
  const auth = await getAuthContext(request)
  const organization = await getOrganization(auth.orgId)
  if (!organization) throw new HttpError('Workspace not found.', 404)
  return json(request, {
    organization: {
      id: organization.id,
      name: organization.name,
      joinCode: organization.join_code,
      plan: organization.plan,
      revision: organization.revision,
      role: auth.role,
    },
    members: await listMembers(auth.orgId),
  })
}

function targetUserId(request: Request): string {
  const userId = new URL(request.url).searchParams.get('userId')
  if (!userId) throw new HttpError('Member ID is required.', 400)
  return userId
}

export async function updateMemberRole(request: Request): Promise<Response> {
  await ensureSchema()
  const auth = await getAuthContext(request)
  if (auth.role !== 'owner') {
    throw new HttpError('Only the workspace owner can do that.', 403)
  }
  const parsed = memberRoleSchema.safeParse(await readJson(request))
  if (!parsed.success) validationError(parsed.error)
  const userId = targetUserId(request)
  if (userId === auth.userId) {
    throw new HttpError('Change your own role from another owner account.')
  }

  const membership = await db.one<{ role: Role }>(
    'SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2',
    [auth.orgId, userId],
  )
  if (!membership) throw new HttpError('Member not found.', 404)
  if (membership.role === 'owner') {
    throw new HttpError('The workspace owner role cannot be changed.')
  }

  await transaction(async (tx) => {
    await tx.execute(
      'UPDATE memberships SET role = $1 WHERE org_id = $2 AND user_id = $3',
      [parsed.data.role, auth.orgId, userId],
    )
    await tx.execute(
      'UPDATE organizations SET revision = revision + 1 WHERE id = $1',
      [auth.orgId],
    )
  })

  return json(request, { members: await listMembers(auth.orgId) })
}

export async function removeMember(request: Request): Promise<Response> {
  await ensureSchema()
  const auth = await getAuthContext(request)
  if (auth.role !== 'owner') {
    throw new HttpError('Only the workspace owner can remove members.', 403)
  }
  const userId = targetUserId(request)
  if (userId === auth.userId) {
    throw new HttpError('You cannot remove yourself from the workspace.')
  }
  const membership = await db.one<{ role: Role }>(
    'SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2',
    [auth.orgId, userId],
  )
  if (!membership) throw new HttpError('Member not found.', 404)
  if (membership.role === 'owner') {
    throw new HttpError('The workspace owner cannot be removed.')
  }

  await transaction(async (tx) => {
    await tx.execute(
      'DELETE FROM memberships WHERE org_id = $1 AND user_id = $2',
      [auth.orgId, userId],
    )
    await tx.execute(
      'UPDATE organizations SET revision = revision + 1 WHERE id = $1',
      [auth.orgId],
    )
  })
  return json(request, { members: await listMembers(auth.orgId) })
}

export async function importWorkspace(request: Request): Promise<Response> {
  await ensureSchema()
  const auth = await getAuthContext(request)
  if (auth.role !== 'owner') {
    throw new HttpError('Only the workspace owner can do that.', 403)
  }
  const parsed = workspaceImportSchema.safeParse(await readJson(request))
  if (!parsed.success) validationError(parsed.error)

  await transaction(async (tx) => {
    await importWorkspaceRows(tx, auth.orgId, parsed.data)
  })
  return json(request, { snapshot: await getSnapshot(auth) }, 201)
}

export async function snapshot(request: Request): Promise<Response> {
  await ensureSchema()
  const auth = await getAuthContext(request)
  return json(request, await getSnapshot(auth))
}

interface SyncOperation {
  opId: string
  action: ServerSyncAction
  entityId: string
  payload: Record<string, unknown>
}

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

async function ensureVan(
  tx: DbTransaction,
  orgId: string,
  vanId: string,
): Promise<void> {
  const van = await tx.one('SELECT 1 FROM vans WHERE org_id = $1 AND id = $2', [
    orgId,
    vanId,
  ])
  if (!van) throw new Error('Van not found in this workspace.')
}

async function upsertVan(
  tx: DbTransaction,
  auth: AuthContext,
  van: z.infer<typeof vanSchema>,
): Promise<void> {
  const now = new Date().toISOString()
  await tx.execute(
    `INSERT INTO vans
      (id, org_id, name, tech_name, number, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (org_id, id) DO UPDATE SET
       name = EXCLUDED.name,
       tech_name = EXCLUDED.tech_name,
       number = EXCLUDED.number,
       updated_at = EXCLUDED.updated_at`,
    [van.id, auth.orgId, van.name, van.techName, van.number, now, now],
  )
}

async function upsertPart(
  tx: DbTransaction,
  auth: AuthContext,
  part: z.infer<typeof partSchema>,
): Promise<void> {
  await ensureVan(tx, auth.orgId, part.vanId)
  const now = new Date().toISOString()
  await tx.execute(
    `INSERT INTO parts
      (id, org_id, van_id, name, sku, category, par_level,
       current_used_today, icon_name, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (org_id, id) DO UPDATE SET
       van_id = EXCLUDED.van_id,
       name = EXCLUDED.name,
       sku = EXCLUDED.sku,
       category = EXCLUDED.category,
       par_level = EXCLUDED.par_level,
       current_used_today = EXCLUDED.current_used_today,
       icon_name = EXCLUDED.icon_name,
       updated_at = EXCLUDED.updated_at`,
    [
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
    ],
  )
}

async function applyOperation(
  tx: DbTransaction,
  auth: AuthContext,
  operation: SyncOperation,
): Promise<void> {
  switch (operation.action) {
    case 'van:create': {
      const { van } = parsePayload(vanPayloadSchema, operation.payload)
      if (van.id !== operation.entityId) {
        throw new Error('Van payload does not match the operation.')
      }
      await upsertVan(tx, auth, van)
      return
    }
    case 'van:delete': {
      await tx.execute('DELETE FROM orders WHERE org_id = $1 AND van_id = $2', [
        auth.orgId,
        operation.entityId,
      ])
      await tx.execute('DELETE FROM parts WHERE org_id = $1 AND van_id = $2', [
        auth.orgId,
        operation.entityId,
      ])
      await tx.execute('DELETE FROM vans WHERE org_id = $1 AND id = $2', [
        auth.orgId,
        operation.entityId,
      ])
      return
    }
    case 'part:increment':
    case 'part:decrement': {
      parsePayload(incrementPayloadSchema, operation.payload)
      const delta = operation.action === 'part:increment' ? 1 : -1
      const changes = await tx.execute(
        `UPDATE parts
         SET current_used_today = GREATEST(0, current_used_today + $1),
             updated_at = $2
         WHERE org_id = $3 AND id = $4`,
        [delta, new Date().toISOString(), auth.orgId, operation.entityId],
      )
      if (changes === 0) throw new Error('Part not found.')
      return
    }
    case 'usage:reset': {
      const { vanId } = parsePayload(usageResetPayloadSchema, operation.payload)
      const now = new Date().toISOString()
      if (vanId) {
        await ensureVan(tx, auth.orgId, vanId)
        await tx.execute(
          `UPDATE parts SET current_used_today = 0, updated_at = $1
           WHERE org_id = $2 AND van_id = $3`,
          [now, auth.orgId, vanId],
        )
      } else {
        await tx.execute(
          'UPDATE parts SET current_used_today = 0, updated_at = $1 WHERE org_id = $2',
          [now, auth.orgId],
        )
      }
      return
    }
    case 'part:create':
    case 'part:update':
    case 'inventory:upsert': {
      const { part } = parsePayload(
        z.object({ part: partSchema }),
        operation.payload,
      )
      await upsertPart(tx, auth, part)
      return
    }
    case 'part:delete':
      await tx.execute('DELETE FROM parts WHERE org_id = $1 AND id = $2', [
        auth.orgId,
        operation.entityId,
      ])
      return
    case 'template:load': {
      const payload = parsePayload(templatePayloadSchema, operation.payload)
      await ensureVan(tx, auth.orgId, payload.vanId)
      for (const part of payload.parts) {
        if (part.vanId !== payload.vanId) continue
        await tx.execute(
          `INSERT INTO parts
            (id, org_id, van_id, name, sku, category, par_level,
             current_used_today, icon_name, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (org_id, id) DO NOTHING`,
          [
            part.id,
            auth.orgId,
            part.vanId,
            part.name,
            part.sku ?? '',
            part.category,
            part.parLevel,
            part.currentUsedToday,
            part.iconName,
            new Date().toISOString(),
          ],
        )
      }
      return
    }
    case 'order:submit': {
      const { order } = parsePayload(
        orderSubmitPayloadSchema,
        operation.payload,
      )
      await ensureVan(tx, auth.orgId, order.vanId)
      const now = new Date().toISOString()
      await tx.execute(
        `INSERT INTO orders
          (id, org_id, van_id, van_name, submitted_at, job_tag, status,
           restocked_at, items_json, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (org_id, id) DO NOTHING`,
        [
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
        ],
      )
      for (const item of order.items) {
        await tx.execute(
          `UPDATE parts SET current_used_today = 0, updated_at = $1
           WHERE org_id = $2 AND id = $3`,
          [now, auth.orgId, item.partId],
        )
      }
      return
    }
    case 'order:pick': {
      const payload = parsePayload(orderPickPayloadSchema, operation.payload)
      const order = await tx.one<{
        items_json: string
        status: 'pending' | 'picked' | 'restocked'
      }>(
        'SELECT items_json, status FROM orders WHERE org_id = $1 AND id = $2',
        [auth.orgId, operation.entityId],
      )
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
      await tx.execute(
        `UPDATE orders SET items_json = $1, status = $2, updated_at = $3
         WHERE org_id = $4 AND id = $5`,
        [
          JSON.stringify(items),
          status,
          new Date().toISOString(),
          auth.orgId,
          operation.entityId,
        ],
      )
      return
    }
    case 'order:restock': {
      const order = await tx.one<{
        items_json: string
        status: 'pending' | 'picked' | 'restocked'
      }>(
        'SELECT items_json, status FROM orders WHERE org_id = $1 AND id = $2',
        [auth.orgId, operation.entityId],
      )
      if (!order) throw new Error('Order not found.')
      if (order.status === 'restocked') return
      const items = (
        JSON.parse(order.items_json) as Array<{ picked: boolean }>
      ).map((item) => ({ ...item, picked: true }))
      const restockedAt = new Date().toISOString()
      await tx.execute(
        `UPDATE orders
         SET status = 'restocked', restocked_at = $1, items_json = $2, updated_at = $3
         WHERE org_id = $4 AND id = $5`,
        [
          restockedAt,
          JSON.stringify(items),
          restockedAt,
          auth.orgId,
          operation.entityId,
        ],
      )
      return
    }
    case 'demo:reset':
      return
    default: {
      const exhaustive: never = operation.action
      throw new Error(`Unsupported sync action: ${exhaustive}`)
    }
  }
}

export async function pushSync(request: Request): Promise<Response> {
  await ensureSchema()
  const auth = await getAuthContext(request)
  const parsed = syncPushSchema.safeParse(await readJson(request))
  if (!parsed.success) validationError(parsed.error)

  const acknowledged: string[] = []
  const failed: Array<{ opId: string; error: string }> = []

  await transaction(async (tx) => {
    for (const operation of parsed.data.ops) {
      const duplicate = await tx.one(
        'SELECT 1 FROM sync_operations WHERE org_id = $1 AND op_id = $2',
        [auth.orgId, operation.opId],
      )
      if (duplicate) {
        acknowledged.push(operation.opId)
        continue
      }

      await tx.execute('SAVEPOINT trucktap_op')
      try {
        await applyOperation(tx, auth, operation)
        await tx.execute(
          `INSERT INTO sync_operations
            (org_id, op_id, device_id, action, applied_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            auth.orgId,
            operation.opId,
            parsed.data.deviceId,
            operation.action,
            new Date().toISOString(),
          ],
        )
        await tx.execute('RELEASE SAVEPOINT trucktap_op')
        acknowledged.push(operation.opId)
      } catch (error) {
        await tx.execute('ROLLBACK TO SAVEPOINT trucktap_op')
        await tx.execute('RELEASE SAVEPOINT trucktap_op')
        failed.push({
          opId: operation.opId,
          error:
            error instanceof Error ? error.message : 'Sync operation failed.',
        })
      }
    }
    if (acknowledged.length > 0) {
      await tx.execute(
        'UPDATE organizations SET revision = revision + 1 WHERE id = $1',
        [auth.orgId],
      )
    }
  })

  const organization = await db.one<{ revision: number }>(
    'SELECT revision FROM organizations WHERE id = $1',
    [auth.orgId],
  )
  return json(request, {
    acknowledged,
    failed,
    revision: organization?.revision ?? 0,
    serverTime: new Date().toISOString(),
  })
}

export { AuthError, WorkspaceImportError }
