import type {
  ServerSnapshot,
  SyncPushResponse,
  TeamMember,
  TeamOrganizationResponse,
  TeamSession,
} from '../types/team'
import { isNativeMobile } from './platform'

const API_BASE_KEY = 'trucktap.api-base'
const SESSION_KEY = 'trucktap.team-session'

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Settings and sessions are best-effort in restricted browser modes.
  }
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

export function getApiBaseUrl(): string {
  const saved = readStorage(API_BASE_KEY)
  if (saved) {
    const normalized = normalizeBaseUrl(saved)
    if (normalized === 'https://trucktap-blush.vercel.app') {
      writeStorage(API_BASE_KEY, 'https://sync.trucktap.net')
      return 'https://sync.trucktap.net'
    }
    return normalized
  }

  const configured = import.meta.env.VITE_API_URL?.trim()
  if (configured) return normalizeBaseUrl(configured)

  if (window.trucktapDesktop?.isDesktop) {
    return import.meta.env.DEV
      ? 'http://127.0.0.1:8787'
      : 'https://sync.trucktap.net'
  }
  if (isNativeMobile()) return 'https://sync.trucktap.net'
  if (import.meta.env.DEV) return 'http://127.0.0.1:8787'
  if (
    window.location.hostname.endsWith('.github.io') ||
    window.location.hostname === 'trucktap.net' ||
    window.location.hostname === 'www.trucktap.net'
  ) {
    return 'https://sync.trucktap.net'
  }

  if (
    (window.location.port === '4173' || window.location.port === '5173') &&
    window.location.hostname === 'localhost'
  ) {
    return 'http://localhost:8787'
  }
  if (
    (window.location.port === '4173' || window.location.port === '5173') &&
    window.location.hostname === '127.0.0.1'
  ) {
    return 'http://127.0.0.1:8787'
  }

  return window.location.origin
}

export function setApiBaseUrl(value: string): void {
  const normalized = normalizeBaseUrl(value)
  writeStorage(API_BASE_KEY, normalized || null)
}

export function loadTeamSession(): TeamSession | null {
  const raw = readStorage(SESSION_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as TeamSession
    if (
      parsed &&
      typeof parsed.token === 'string' &&
      parsed.user &&
      parsed.organization &&
      typeof parsed.organization.id === 'string'
    ) {
      return parsed
    }
  } catch {
    // Clear malformed sessions below.
  }

  writeStorage(SESSION_KEY, null)
  return null
}

export function saveTeamSession(session: TeamSession | null): void {
  writeStorage(SESSION_KEY, session ? JSON.stringify(session) : null)
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string
  timeoutMs?: number
}

async function requestApi<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 15_000,
  )

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    })

    const contentType = response.headers.get('content-type') ?? ''
    const data = contentType.includes('application/json')
      ? ((await response.json()) as unknown)
      : null

    if (!response.ok) {
      const message =
        data &&
        typeof data === 'object' &&
        'error' in data &&
        typeof data.error === 'string'
          ? data.error
          : `Request failed (${response.status}).`
      throw new ApiError(message, response.status, data)
    }

    return data as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('The Team Sync server took too long to respond.', 0)
    }
    throw new ApiError(
      'Could not reach the Team Sync server. Check the server address and connection.',
      0,
    )
  } finally {
    window.clearTimeout(timeout)
  }
}

export const teamApi = {
  register(input: {
    name: string
    email: string
    password: string
    workspaceName: string
    licenseKey?: string
    workspace?: {
      vans: unknown[]
      parts: unknown[]
      orders: unknown[]
    }
  }): Promise<TeamSession> {
    return requestApi('/api/auth/register', {
      method: 'POST',
      body: input,
    })
  },

  login(input: { email: string; password: string }): Promise<TeamSession> {
    return requestApi('/api/auth/login', {
      method: 'POST',
      body: input,
    })
  },

  join(input: {
    name: string
    email: string
    password: string
    joinCode: string
    role: 'tech' | 'shop'
  }): Promise<TeamSession> {
    return requestApi('/api/auth/join', {
      method: 'POST',
      body: input,
    })
  },

  org(token: string): Promise<TeamOrganizationResponse> {
    return requestApi('/api/org', { token })
  },

  updateLicense(
    token: string,
    licenseKey: string,
  ): Promise<{ organization: TeamSession['organization'] }> {
    return requestApi('/api/org/license', {
      method: 'PATCH',
      token,
      body: { licenseKey },
    })
  },

  importWorkspace(
    token: string,
    workspace: {
      vans: unknown[]
      parts: unknown[]
      orders: unknown[]
    },
  ): Promise<{ snapshot: ServerSnapshot }> {
    return requestApi('/api/workspace/import', {
      method: 'POST',
      token,
      body: workspace,
    })
  },

  snapshot(token: string): Promise<ServerSnapshot> {
    return requestApi('/api/sync/snapshot', { token })
  },

  push(
    token: string,
    body: {
      deviceId: string
      ops: Array<{
        opId: string
        action: string
        entityId: string
        payload: Record<string, unknown>
        createdAt?: string
      }>
    },
  ): Promise<SyncPushResponse> {
    return requestApi('/api/sync/push', {
      method: 'POST',
      token,
      body,
    })
  },

  updateMemberRole(
    token: string,
    userId: string,
    role: 'tech' | 'shop',
  ): Promise<{ members: TeamMember[] }> {
    return requestApi(
      `/api/org/member?userId=${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        token,
        body: { role },
      },
    )
  },

  removeMember(
    token: string,
    userId: string,
  ): Promise<{ members: TeamMember[] }> {
    return requestApi(
      `/api/org/member?userId=${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        token,
      },
    )
  },
}
