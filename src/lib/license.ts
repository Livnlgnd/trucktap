import { TRUCKTAP_LICENSE_PUBLIC_KEY_PEM } from './license-public-key'

export type TruckTapPlanId = 'starter' | 'standard' | 'advanced'

export interface TruckTapLicensePayload {
  v: 1
  licenseId: string
  plan: TruckTapPlanId
  company: string
  maxVans: number
  shopSeats: number
  updatesUntil: string
  issuedAt: string
}

export interface TruckTapLicenseState {
  valid: boolean
  source: 'license' | 'trial'
  planId: TruckTapPlanId | null
  planName: string
  company: string | null
  maxVans: number
  shopSeats: number
  updatesUntil: string | null
  issuedAt: string | null
  licenseId: string | null
  raw: string
  error: string | null
  trialStartedAt: string
  trialExpiresAt: string
  trialDaysLeft: number
  trialExpired: boolean
}

export const PLAN_DETAILS: Record<
  TruckTapPlanId,
  {
    name: string
    price: number
    maxVans: number
    shopSeats: number
    updateMonths: number
  }
> = {
  starter: {
    name: 'Starter',
    price: 99,
    maxVans: 3,
    shopSeats: 1,
    updateMonths: 12,
  },
  standard: {
    name: 'Standard',
    price: 199,
    maxVans: 10,
    shopSeats: 3,
    updateMonths: 12,
  },
  advanced: {
    name: 'Advanced',
    price: 399,
    maxVans: 9999,
    shopSeats: 9999,
    updateMonths: 24,
  },
}

export const TRIAL_DAYS = 30
export const TRIAL_MAX_VANS = 3
const LICENSE_STORAGE_KEY = 'trucktap.license_key'
const TRIAL_STARTED_KEY = 'trucktap.trial_started_at'
const DAY_MS = 24 * 60 * 60 * 1000

const publicKeyCache = new Map<string, Promise<CryptoKey>>()

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(
    Math.ceil(normalized.length / 4) * 4,
    '=',
  )
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function pemToDer(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
  return base64UrlToBytes(base64.replace(/\+/g, '-').replace(/\//g, '_'))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}

function publicKey(): Promise<CryptoKey> {
  const cached = publicKeyCache.get(TRUCKTAP_LICENSE_PUBLIC_KEY_PEM)
  if (cached) return cached

  const promise = crypto.subtle.importKey(
    'spki',
    toArrayBuffer(pemToDer(TRUCKTAP_LICENSE_PUBLIC_KEY_PEM)),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  )
  publicKeyCache.set(TRUCKTAP_LICENSE_PUBLIC_KEY_PEM, promise)
  return promise
}

export function readStoredLicenseKey(): string {
  try {
    return window.localStorage.getItem(LICENSE_STORAGE_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function storeLicenseKey(key: string): void {
  try {
    window.localStorage.setItem(LICENSE_STORAGE_KEY, key.trim())
  } catch {
    throw new Error('This browser could not save the license key.')
  }
}

export function removeStoredLicense(): void {
  try {
    window.localStorage.removeItem(LICENSE_STORAGE_KEY)
  } catch {
    // Optional cleanup.
  }
}

function getTrialStartedAt(): string {
  try {
    const existing = window.localStorage.getItem(TRIAL_STARTED_KEY)
    if (existing && !Number.isNaN(new Date(existing).getTime())) {
      return existing
    }
    const started = new Date().toISOString()
    window.localStorage.setItem(TRIAL_STARTED_KEY, started)
    return started
  } catch {
    return new Date().toISOString()
  }
}

export function trialState(
  error: string | null = null,
): TruckTapLicenseState {
  const trialStartedAt = getTrialStartedAt()
  const trialExpiresAt = new Date(
    new Date(trialStartedAt).getTime() + TRIAL_DAYS * DAY_MS,
  ).toISOString()
  const remaining = Math.max(
    0,
    Math.ceil(
      (new Date(trialExpiresAt).getTime() - Date.now()) / DAY_MS,
    ),
  )

  return {
    valid: false,
    source: 'trial',
    planId: null,
    planName: 'Free trial',
    company: null,
    maxVans: TRIAL_MAX_VANS,
    shopSeats: 1,
    updatesUntil: null,
    issuedAt: null,
    licenseId: null,
    raw: '',
    error,
    trialStartedAt,
    trialExpiresAt,
    trialDaysLeft: remaining,
    trialExpired: remaining <= 0,
  }
}

export async function validateLicenseKey(
  rawKey: string,
): Promise<TruckTapLicenseState> {
  const raw = rawKey.trim()
  if (!raw) return trialState()

  if (!raw.startsWith('TAP-')) {
    return trialState('License key must start with TAP-.')
  }

  const rest = raw.slice(4)
  const separator = rest.lastIndexOf('.')
  if (separator <= 0 || separator >= rest.length - 1) {
    return trialState('License key is missing its signature.')
  }

  const payloadText = rest.slice(0, separator)
  const signatureText = rest.slice(separator + 1)

  let payloadBytes: Uint8Array
  let signatureBytes: Uint8Array
  try {
    payloadBytes = base64UrlToBytes(payloadText)
    signatureBytes = base64UrlToBytes(signatureText)
  } catch {
    return trialState('License key could not be decoded.')
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(new TextDecoder().decode(payloadBytes))
  } catch {
    return trialState('License payload is not valid JSON.')
  }

  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    return trialState('License payload is not valid.')
  }

  let verified = false
  try {
    verified = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      await publicKey(),
      toArrayBuffer(signatureBytes),
      toArrayBuffer(payloadBytes),
    )
  } catch {
    return trialState('License signature could not be verified.')
  }

  if (!verified) return trialState('License signature is invalid.')

  const payload = decoded as Record<string, unknown>
  const planId =
    payload.plan === 'starter' ||
    payload.plan === 'standard' ||
    payload.plan === 'advanced'
      ? payload.plan
      : null
  const company =
    typeof payload.company === 'string' ? payload.company.trim() : ''
  const licenseId =
    typeof payload.licenseId === 'string' ? payload.licenseId.trim() : ''
  const issuedAt =
    typeof payload.issuedAt === 'string' ? payload.issuedAt : ''
  const updatesUntil =
    typeof payload.updatesUntil === 'string' ? payload.updatesUntil : ''
  const maxVans = Number(payload.maxVans)
  const shopSeats = Number(payload.shopSeats)

  if (!planId) return trialState('License plan is missing or unsupported.')
  if (!company) return trialState('License is missing a company name.')
  if (!licenseId) return trialState('License is missing an ID.')
  if (!Number.isInteger(maxVans) || maxVans <= 0) {
    return trialState('License has an invalid van limit.')
  }
  if (!Number.isInteger(shopSeats) || shopSeats <= 0) {
    return trialState('License has an invalid shop-seat limit.')
  }
  if (!updatesUntil || Number.isNaN(new Date(updatesUntil).getTime())) {
    return trialState('License has an invalid updates date.')
  }
  if (!issuedAt || Number.isNaN(new Date(issuedAt).getTime())) {
    return trialState('License has an invalid issue date.')
  }

  return {
    valid: true,
    source: 'license',
    planId,
    planName: PLAN_DETAILS[planId].name,
    company,
    maxVans,
    shopSeats,
    updatesUntil,
    issuedAt,
    licenseId,
    raw,
    error: null,
    trialStartedAt: '',
    trialExpiresAt: '',
    trialDaysLeft: 0,
    trialExpired: false,
  }
}

export async function loadLicenseState(): Promise<TruckTapLicenseState> {
  const raw = readStoredLicenseKey()
  if (!raw) return trialState()
  return validateLicenseKey(raw)
}

export async function activateLicense(
  rawKey: string,
): Promise<TruckTapLicenseState> {
  const state = await validateLicenseKey(rawKey)
  if (!state.valid) {
    throw new Error(state.error ?? 'That license key is not valid.')
  }
  storeLicenseKey(state.raw)
  return state
}

export function clearLicense(): void {
  removeStoredLicense()
}

export function licenseCanUseApp(state: TruckTapLicenseState): boolean {
  return state.valid || !state.trialExpired
}

export function updatesAreActive(
  state: TruckTapLicenseState,
): boolean {
  return Boolean(
    state.valid &&
      state.updatesUntil &&
      new Date(state.updatesUntil).getTime() > Date.now(),
  )
}
