import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import { config } from '../config.js'

export type Role = 'owner' | 'shop' | 'tech'

interface TokenPayload {
  sub: string
  org: string
  iat: number
  exp: number
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
      exp: issuedAt + config.tokenTtlSeconds,
    } satisfies TokenPayload),
  )
  const signature = createHmac('sha256', config.jwtSecret)
    .update(`${header}.${payload}`)
    .digest('base64url')

  return `${header}.${payload}.${signature}`
}

export function verifyAccessToken(token: string): TokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, payload, signature] = parts
  const expected = createHmac('sha256', config.jwtSecret)
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
    ) as unknown
    if (!parsed || typeof parsed !== 'object') return null

    const candidate = parsed as Partial<TokenPayload>
    if (
      typeof candidate.sub !== 'string' ||
      typeof candidate.org !== 'string' ||
      typeof candidate.exp !== 'number' ||
      candidate.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null
    }

    return candidate as TokenPayload
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
