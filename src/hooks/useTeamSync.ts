import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ApiError,
  loadTeamSession,
  saveTeamSession,
  teamApi,
} from '../lib/api'
import {
  applyServerSnapshot,
  clearSyncQueue,
  db,
  exportLocalSnapshot,
  finishSyncPush,
  getQueuedSyncOperations,
} from '../db'
import type { TeamOrganizationResponse, TeamSession } from '../types/team'
import { readStoredLicenseKey } from '../lib/license'

export type TeamSyncStatus =
  | 'local'
  | 'offline'
  | 'syncing'
  | 'pending'
  | 'synced'
  | 'error'

export interface TeamSyncController {
  session: TeamSession | null
  status: TeamSyncStatus
  queueCount: number
  lastSyncedAt: string | null
  error: string | null
  createWorkspace: (input: {
    name: string
    email: string
    password: string
    workspaceName: string
  }) => Promise<void>
  signIn: (input: { email: string; password: string }) => Promise<void>
  joinWorkspace: (input: {
    name: string
    email: string
    password: string
    joinCode: string
    role: 'tech' | 'shop'
  }) => Promise<void>
  signOut: () => Promise<void>
  syncNow: () => Promise<void>
  publishLicense: (licenseKey: string) => Promise<void>
  refreshOrganization: () => Promise<TeamOrganizationResponse>
}

export function useTeamSync(
  isOnline: boolean,
  enabled: boolean,
): TeamSyncController {
  const [session, setSession] = useState<TeamSession | null>(loadTeamSession)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const queueCount =
    useLiveQuery(() => db.syncQueue.count(), [], 0) ?? 0

  const sessionRef = useRef(session)
  const onlineRef = useRef(isOnline)
  const queueRef = useRef(queueCount)
  const inFlightRef = useRef(false)
  const enabledRef = useRef(enabled)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    onlineRef.current = isOnline
  }, [isOnline])

  useEffect(() => {
    queueRef.current = queueCount
  }, [queueCount])

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const persistSession = useCallback((next: TeamSession | null) => {
    saveTeamSession(next)
    setSession(next)
    sessionRef.current = next
  }, [])

  const handleExpiredSession = useCallback(() => {
    persistSession(null)
    setError('Your Team Sync session expired. Sign in again.')
    setLastSyncedAt(null)
    void clearSyncQueue()
  }, [persistSession])

  const updateSessionOrganization = useCallback(
    (next: TeamSession) => {
      persistSession(next)
    },
    [persistSession],
  )

  const runSync = useCallback(
    async (mode: 'full' | 'pull-only' = 'full') => {
      const activeSession = sessionRef.current
      if (
        !enabledRef.current ||
        !onlineRef.current ||
        !activeSession ||
        inFlightRef.current
      ) {
        return
      }

      inFlightRef.current = true
      setSyncing(true)
      setError(null)

      try {
        if (mode === 'full') {
          const operations = await getQueuedSyncOperations()
          if (operations.length > 0) {
            const result = await teamApi.push(activeSession.token, {
              deviceId: getDeviceId(),
              ops: operations.map((operation) => ({
                opId: operation.opId ?? '',
                action: operation.action,
                entityId: operation.entityId,
                payload: operation.payload,
                createdAt: operation.createdAt,
              })),
            })

            await finishSyncPush(result.acknowledged, result.failed)

            if (result.failed.length > 0) {
              throw new ApiError(
                result.failed[0].error,
                400,
                result.failed,
              )
            }

            // A new local mutation may have queued while the push was in
            // flight. Leave the snapshot for the next complete sync.
            if ((await db.syncQueue.count()) > 0) {
              setLastSyncedAt(new Date().toISOString())
              return
            }
          }
        } else if (queueRef.current > 0) {
          return
        }

        const snapshot = await teamApi.snapshot(activeSession.token)

        if (
          mode === 'pull-only' &&
          snapshot.organization.revision ===
            activeSession.organization.revision
        ) {
          setLastSyncedAt(new Date().toISOString())
          setError(null)
          return
        }

        if ((await db.syncQueue.count()) > 0) {
          return
        }

        await applyServerSnapshot(snapshot)
        const nextSession: TeamSession = {
          ...activeSession,
          organization: snapshot.organization,
        }
        updateSessionOrganization(nextSession)
        setLastSyncedAt(new Date().toISOString())
        setError(null)
      } catch (syncError) {
        if (syncError instanceof ApiError && syncError.status === 401) {
          handleExpiredSession()
          return
        }

        setError(
          syncError instanceof Error
            ? syncError.message
            : 'Team Sync could not complete.',
        )
        throw syncError
      } finally {
        inFlightRef.current = false
        setSyncing(false)
      }
    },
    [handleExpiredSession, updateSessionOrganization],
  )

  const syncNow = useCallback(async () => {
    await runSync('full')
  }, [runSync])

  const createWorkspace = useCallback(
    async (input: {
      name: string
      email: string
      password: string
      workspaceName: string
    }) => {
      const localWorkspace = await exportLocalSnapshot()
      const nextSession = await teamApi.register({
        ...input,
        licenseKey: readStoredLicenseKey() || undefined,
        workspace: localWorkspace,
      })
      await clearSyncQueue()
      persistSession(nextSession)
      setLastSyncedAt(new Date().toISOString())
      setError(null)
    },
    [persistSession],
  )

  const publishLicense = useCallback(
    async (licenseKey: string) => {
      const activeSession = sessionRef.current
      if (!activeSession || !licenseKey.trim()) return
      const result = await teamApi.updateLicense(
        activeSession.token,
        licenseKey.trim(),
      )
      persistSession({
        ...activeSession,
        organization: result.organization,
      })
    },
    [persistSession],
  )

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      const nextSession = await teamApi.login(input)
      const snapshot = await teamApi.snapshot(nextSession.token)
      await applyServerSnapshot(snapshot, { clearQueue: true })
      persistSession({
        ...nextSession,
        organization: snapshot.organization,
      })
      setLastSyncedAt(new Date().toISOString())
      setError(null)
    },
    [persistSession],
  )

  const joinWorkspace = useCallback(
    async (input: {
      name: string
      email: string
      password: string
      joinCode: string
      role: 'tech' | 'shop'
    }) => {
      const nextSession = await teamApi.join(input)
      const snapshot = await teamApi.snapshot(nextSession.token)
      await applyServerSnapshot(snapshot, { clearQueue: true })
      persistSession({
        ...nextSession,
        organization: snapshot.organization,
      })
      setLastSyncedAt(new Date().toISOString())
      setError(null)
    },
    [persistSession],
  )

  const signOut = useCallback(async () => {
    await clearSyncQueue()
    persistSession(null)
    setLastSyncedAt(null)
    setError(null)
  }, [persistSession])

  const refreshOrganization = useCallback(async () => {
    const activeSession = sessionRef.current
    if (!activeSession) throw new Error('Sign in to view Team Sync.')
    const info = await teamApi.org(activeSession.token)
    const nextSession: TeamSession = {
      ...activeSession,
      organization: info.organization,
    }
    persistSession(nextSession)
    return info
  }, [persistSession])

  // A local-only installation does not need a remote operation log. The full
  // local board is imported when the user eventually creates a workspace.
  useEffect(() => {
    if (!enabled || session || queueCount === 0) return
    void clearSyncQueue()
  }, [enabled, queueCount, session])

  // Debounced sync after local mutations queue up.
  useEffect(() => {
    if (!enabled || !session || !isOnline || queueCount === 0) return

    const timer = window.setTimeout(() => {
      void runSync('full').catch(() => {
        // The error is surfaced through the hook state.
      })
    }, 900)

    return () => window.clearTimeout(timer)
  }, [enabled, isOnline, queueCount, runSync, session])

  // Initial sync and reconnect.
  const hasSession = Boolean(session)

  useEffect(() => {
    if (!enabled || !hasSession || !isOnline) return

    const timer = window.setTimeout(() => {
      void runSync('full').catch(() => {
        // The error is surfaced through the hook state.
      })
    }, 500)

    return () => window.clearTimeout(timer)
  }, [enabled, hasSession, isOnline, runSync])

  // Poll for shop and tech updates while the local queue is clear.
  useEffect(() => {
    if (!enabled || !hasSession || !isOnline) return

    const timer = window.setInterval(() => {
      if (queueRef.current === 0 && !inFlightRef.current) {
        void runSync('pull-only').catch(() => {
          // The error is surfaced through the hook state.
        })
      }
    }, 8000)

    return () => window.clearInterval(timer)
  }, [enabled, hasSession, isOnline, runSync])

  const status: TeamSyncStatus = !session
    ? 'local'
    : !isOnline
      ? 'offline'
      : syncing
        ? 'syncing'
        : error
          ? 'error'
          : queueCount > 0
            ? 'pending'
            : 'synced'

  return {
    session,
    status,
    queueCount,
    lastSyncedAt,
    error,
    createWorkspace,
    signIn,
    joinWorkspace,
    signOut,
    syncNow,
    publishLicense,
    refreshOrganization,
  }
}

const DEVICE_ID_KEY = 'trucktap.device-id'

function getDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY)
    if (existing) return existing
    const next =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(DEVICE_ID_KEY, next)
    return next
  } catch {
    return 'unknown-device'
  }
}
