import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import { db } from './db.js'
import type { Role } from './schemas.js'

interface TokenPayload {
  sub: string
  org: string
  iat: number
  exp: number
}

export interface AuthContext {
  userId: string
  orgId: string
  role: Role
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not configured.')
  return secret
}

function encodeBase64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, saltValue, hashValue] = encoded.split('$')
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false

  try {
    const salt = Buffer.from(saltValue, 'base64url')
    const expected = Buffer.from(hashValue, 'base64url')
    const actual = scryptSync(password, salt, expected.length)
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    )
  } catch {
    return false
  }
}

export function createAccessToken(userId: string, orgId: string): string {
  const issuedAt = Math.floor(Date.now() / 1000)
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = encodeBase64Url(
    JSON.stringify({
      sub: userId,
      org: orgId,
      iat: issuedAt,
      exp: issuedAt + 60 * 60 * 24 * 30,
    } satisfies TokenPayload),
  )
  const signature = createHmac('sha256', jwtSecret())
    .update(`${header}.${payload}`)
    .digest('base64url')

  return `${header}.${payload}.${signature}`
}

export function verifyAccessToken(token: string): TokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, payload, signature] = parts

  const expected = createHmac('sha256', jwtSecret())
    .update(`${header}.${payload}`)
    .digest()
  let actual: Buffer
  try {
    actual = Buffer.from(signature, 'base64url')
  } catch {
    return null
  }

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as Partial<TokenPayload>
    if (
      typeof parsed.sub !== 'string' ||
      typeof parsed.org !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null
    }
    return parsed as TokenPayload
  } catch {
    return null
  }
}

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function createJoinCode(length = 8): string {
  const bytes = randomBytes(length)
  return [...bytes]
    .map((byte) => JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length])
    .join('')
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function getAuthContext(
  request: Request,
): Promise<AuthContext> {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    throw new AuthError('Sign in to use Team Sync.', 401)
  }

  const payload = verifyAccessToken(authorization.slice(7).trim())
  if (!payload) {
    throw new AuthError('Your session has expired. Sign in again.', 401)
  }

  const membership = await db.one<{
    id: string
    org_id: string
    role: Role
  }>(
    `SELECT users.id, memberships.org_id, memberships.role
     FROM users
     JOIN memberships ON memberships.user_id = users.id
     WHERE users.id = $1 AND memberships.org_id = $2`,
    [payload.sub, payload.org],
  )

  if (!membership) {
    throw new AuthError(
      'This account no longer has workspace access.',
      401,
    )
  }

  return {
    userId: membership.id,
    orgId: membership.org_id,
    role: membership.role,
  }
}

export class AuthError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}
