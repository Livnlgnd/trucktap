import { randomUUID } from 'node:crypto'
import { Router, type Response } from 'express'
import { db, bumpRevision, nowIso, transaction } from '../db.js'
import {
  createAccessToken,
  createJoinCode,
  hashPassword,
  normalizeEmail,
  verifyPassword,
  type Role,
} from '../lib/auth.js'
import {
  joinSchema,
  loginSchema,
  registerSchema,
  workspaceImportSchema,
} from '../lib/validation.js'
import {
  importWorkspaceRows,
  WorkspaceImportError,
} from '../lib/workspaceImport.js'
import { getMembership, getOrganization } from '../lib/workspace.js'
import { authRateLimit } from '../middleware/rateLimit.js'

export const authRouter = Router()

interface UserRow {
  id: string
  email: string
  name: string
  password_hash: string
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

function createUniqueJoinCode(): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = createJoinCode(8)
    const exists = db
      .prepare('SELECT 1 FROM organizations WHERE join_code = ?')
      .get(code)
    if (!exists) return code
  }
  throw new Error('Could not allocate a workspace join code.')
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes('unique constraint failed')
  )
}

function sendValidationError(response: Response, issues: unknown): void {
  response.status(400).json({
    error: 'Please check the details and try again.',
    issues,
  })
}

authRouter.post('/register', authRateLimit, (request, response) => {
  const parsed = registerSchema.safeParse(request.body)
  if (!parsed.success) {
    sendValidationError(response, parsed.error.issues)
    return
  }

  const { name, password, workspaceName } = parsed.data
  const email = normalizeEmail(parsed.data.email)
  const existingUser = db
    .prepare('SELECT 1 FROM users WHERE email = ?')
    .get(email)

  if (existingUser) {
    response.status(409).json({ error: 'An account with that email already exists.' })
    return
  }

  const workspaceResult =
    request.body?.workspace === undefined
      ? null
      : workspaceImportSchema.safeParse(request.body.workspace)
  if (workspaceResult && !workspaceResult.success) {
    response.status(400).json({
      error: 'The local workspace data is not valid.',
      issues: workspaceResult.error.issues,
    })
    return
  }

  const userId = randomUUID()
  const orgId = randomUUID()
  const joinCode = createUniqueJoinCode()
  const createdAt = nowIso()

  try {
    transaction(() => {
      db.prepare(
        `INSERT INTO organizations
          (id, name, join_code, plan, revision, created_at)
         VALUES (?, ?, ?, 'team', 0, ?)`,
      ).run(orgId, workspaceName, joinCode, createdAt)

      db.prepare(
        `INSERT INTO users (id, email, name, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(userId, email, name, hashPassword(password), createdAt)

      db.prepare(
        `INSERT INTO memberships (user_id, org_id, role, created_at)
         VALUES (?, ?, 'owner', ?)`,
      ).run(userId, orgId, createdAt)

      if (workspaceResult) {
        importWorkspaceRows(orgId, workspaceResult.data)
      }
    })
  } catch (error) {
    if (error instanceof WorkspaceImportError) {
      response.status(error.status).json({ error: error.message })
      return
    }
    if (isUniqueConstraint(error)) {
      response.status(409).json({ error: 'That account or join code already exists.' })
      return
    }
    throw error
  }

  const organization = getOrganization(orgId)
  response.status(201).json(
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
  )
})

authRouter.post('/login', authRateLimit, (request, response) => {
  const parsed = loginSchema.safeParse(request.body)
  if (!parsed.success) {
    sendValidationError(response, parsed.error.issues)
    return
  }

  const email = normalizeEmail(parsed.data.email)
  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email) as UserRow | undefined

  if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
    response.status(401).json({ error: 'Email or password is incorrect.' })
    return
  }

  const membership = getMembership(user.id)
  const organization = membership ? getOrganization(membership.org_id) : undefined
  if (!membership || !organization) {
    response.status(403).json({ error: 'This account is not attached to a workspace.' })
    return
  }

  response.json(
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
})

authRouter.post('/join', authRateLimit, (request, response) => {
  const parsed = joinSchema.safeParse(request.body)
  if (!parsed.success) {
    sendValidationError(response, parsed.error.issues)
    return
  }

  const { name, password, role } = parsed.data
  const email = normalizeEmail(parsed.data.email)
  const joinCode = parsed.data.joinCode.trim().toUpperCase()

  const existingUser = db
    .prepare('SELECT 1 FROM users WHERE email = ?')
    .get(email)
  if (existingUser) {
    response.status(409).json({ error: 'An account with that email already exists.' })
    return
  }

  const organization = db
    .prepare('SELECT * FROM organizations WHERE join_code = ?')
    .get(joinCode) as
    | {
        id: string
        name: string
        join_code: string
        plan: string
        revision: number
      }
    | undefined

  if (!organization) {
    response.status(404).json({ error: 'That join code is not valid.' })
    return
  }

  const userId = randomUUID()
  const createdAt = nowIso()

  try {
    transaction(() => {
      db.prepare(
        `INSERT INTO users (id, email, name, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(userId, email, name, hashPassword(password), createdAt)

      db.prepare(
        `INSERT INTO memberships (user_id, org_id, role, created_at)
         VALUES (?, ?, ?, ?)`,
      ).run(userId, organization.id, role, createdAt)

      bumpRevision(organization.id)
    })
  } catch (error) {
    if (isUniqueConstraint(error)) {
      response.status(409).json({ error: 'That account already exists.' })
      return
    }
    throw error
  }

  response.status(201).json(
    sessionPayload({
      userId,
      name,
      email,
      orgId: organization.id,
      orgName: organization.name,
      joinCode: organization.join_code,
      plan: organization.plan,
      revision: organization.revision,
      role,
    }),
  )
})
