import type { NextFunction, Request, Response } from 'express'
import { db } from '../db.js'
import {
  verifyAccessToken,
  type Role,
} from '../lib/auth.js'

export interface AuthContext {
  userId: string
  orgId: string
  role: Role
}

declare global {
  namespace Express {
    interface Locals {
      auth?: AuthContext
    }
  }
}

interface MembershipRow {
  id: string
  name: string
  email: string
  role: Role
  org_id: string
}

export function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    response.status(401).json({ error: 'Sign in to use Team Sync.' })
    return
  }

  const payload = verifyAccessToken(authorization.slice(7).trim())
  if (!payload) {
    response.status(401).json({ error: 'Your session has expired. Sign in again.' })
    return
  }

  const membership = db
    .prepare(
      `SELECT users.id, users.name, users.email, memberships.role,
              memberships.org_id
       FROM users
       JOIN memberships ON memberships.user_id = users.id
       WHERE users.id = ? AND memberships.org_id = ?`,
    )
    .get(payload.sub, payload.org) as MembershipRow | undefined

  if (!membership) {
    response.status(401).json({ error: 'This account no longer has workspace access.' })
    return
  }

  response.locals.auth = {
    userId: membership.id,
    orgId: membership.org_id,
    role: membership.role,
  }
  next()
}

export function requireOwner(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (response.locals.auth?.role !== 'owner') {
    response.status(403).json({ error: 'Only the workspace owner can do that.' })
    return
  }
  next()
}

export function getAuth(response: Response): AuthContext {
  const auth = response.locals.auth
  if (!auth) throw new Error('Authentication middleware was not applied.')
  return auth
}
