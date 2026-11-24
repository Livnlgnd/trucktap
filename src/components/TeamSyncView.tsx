import { useEffect, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  Building2,
  Check,
  ClipboardList,
  Cloud,
  CloudOff,
  Copy,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react'
import type { TeamMember, TeamRole } from '../types/team'
import type { TeamSyncController } from '../hooks/useTeamSync'
import { getApiBaseUrl, setApiBaseUrl, teamApi } from '../lib/api'
import { cn, formatDateTime, pluralize } from '../lib/utils'
import { ConfirmDialog } from './ConfirmDialog'
import type { ToastTone } from './Toast'

type AuthMode = 'signin' | 'create' | 'join'

const ROLE_LABELS: Record<TeamRole, string> = {
  owner: 'Owner',
  shop: 'Shop',
  tech: 'Tech',
}

const ROLE_ICONS: Record<TeamRole, typeof Users> = {
  owner: ShieldCheck,
  shop: ClipboardList,
  tech: Wrench,
}

function statusCopy(controller: TeamSyncController): {
  label: string
  tone: string
} {
  switch (controller.status) {
    case 'local':
      return { label: 'Local only', tone: 'text-muted' }
    case 'offline':
      return { label: 'Offline', tone: 'text-warn' }
    case 'syncing':
      return { label: 'Syncing…', tone: 'text-accent' }
    case 'pending':
      return {
        label: `${pluralize(controller.queueCount, 'change')} queued`,
        tone: 'text-warn',
      }
    case 'error':
      return { label: 'Sync needs attention', tone: 'text-red-600 dark:text-red-400' }
    default:
      return { label: 'Synced', tone: 'text-success' }
  }
}

export function TeamSyncView({
  controller,
  onToast,
}: {
  controller: TeamSyncController
  onToast: (message: string, tone?: ToastTone) => void
}) {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [name, setName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinRole, setJoinRole] = useState<'tech' | 'shop'>('tech')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState('')
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)
  const [serverValue, setServerValue] = useState(getApiBaseUrl)
  const [serverSaved, setServerSaved] = useState(false)

  const session = controller.session
  const status = statusCopy(controller)
  const refreshOrganization = controller.refreshOrganization
  const sessionToken = session?.token

  useEffect(() => {
    if (!sessionToken) return

    let cancelled = false

    refreshOrganization()
      .then((info) => {
        if (!cancelled) {
          setMembers(info.members)
          setMembersError('')
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMembersError(
            error instanceof Error
              ? error.message
              : 'Could not load workspace members.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [refreshOrganization, sessionToken])

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return

    setBusy(true)
    setFormError('')

    try {
      if (mode === 'signin') {
        await controller.signIn({ email, password })
        onToast('Signed in. This device now follows your team workspace.', 'success')
      } else if (mode === 'create') {
        await controller.createWorkspace({
          name,
          email,
          password,
          workspaceName,
        })
        onToast('Team workspace created and this van board uploaded.', 'success')
      } else {
        await controller.joinWorkspace({
          name,
          email,
          password,
          joinCode,
          role: joinRole,
        })
        onToast('Joined the team. This device now uses the shared workspace.', 'success')
      }
      setPassword('')
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Could not complete that request.',
      )
    } finally {
      setBusy(false)
    }
  }

  const copyJoinCode = async () => {
    if (!session) return
    try {
      await navigator.clipboard.writeText(session.organization.joinCode)
      onToast('Join code copied.', 'success')
    } catch {
      onToast('Could not copy automatically. Select the code and copy it.', 'error')
    }
  }

  const updateRole = async (member: TeamMember, role: 'tech' | 'shop') => {
    if (!session) return
    setMemberBusyId(member.id)
    try {
      const result = await teamApi.updateMemberRole(
        session.token,
        member.id,
        role,
      )
      setMembers(result.members)
      onToast(`${member.name} is now a ${ROLE_LABELS[role].toLowerCase()} member.`, 'success')
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : 'Could not update that member.',
        'error',
      )
    } finally {
      setMemberBusyId(null)
    }
  }

  const removeMember = async () => {
    if (!session || !memberToRemove) return
    setMemberBusyId(memberToRemove.id)
    try {
      const result = await teamApi.removeMember(session.token, memberToRemove.id)
      setMembers(result.members)
      onToast(`${memberToRemove.name} removed from the workspace.`, 'success')
      setMemberToRemove(null)
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : 'Could not remove that member.',
        'error',
      )
    } finally {
      setMemberBusyId(null)
    }
  }

  const saveServer = () => {
    setApiBaseUrl(serverValue)
    setServerValue(getApiBaseUrl())
    setServerSaved(true)
    onToast('Team Sync server address saved.', 'success')
    window.setTimeout(() => setServerSaved(false), 2200)
  }

  const disconnect = async () => {
    await controller.signOut()
    setMode('signin')
    setPassword('')
    setFormError('')
    onToast('Team Sync disconnected. A local copy stays on this device.', 'info')
  }

  return (
    <div>
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
          Shared workspace
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
          Team Sync
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Connect field devices, shop workstations, and the desktop app. Local taps
          keep working offline and queue automatically.
        </p>
      </div>

      {!session ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_440px]">
          <section className="rounded-2xl border border-line bg-panel p-5 shadow-sm sm:p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Cloud size={25} />
            </div>
            <h2 className="mt-4 text-xl font-black tracking-tight">
              One shop. Every van in sync.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              TruckTap still works entirely on its own. Turn on Team Sync when
              you want a field device, the shop tablet, and the office desktop
              to share the same restock board.
            </p>

            <div className="mt-5 space-y-3">
              {[
                {
                  icon: Users,
                  title: 'Invite the crew',
                  body: 'Share one join code with techs and shop runners.',
                },
                {
                  icon: RefreshCw,
                  title: 'Offline-first by default',
                  body: 'Taps land in the local queue first, then sync when connected.',
                },
                {
                  icon: ClipboardList,
                  title: 'Live shop pick-list',
                  body: 'Restock lists, picked items, and closures flow back to every device.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Your data stays yours',
                  body: 'You can disconnect at any time and keep the local copy.',
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-xl border border-line bg-page/50 p-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-ink">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{title}</p>
                    <p className="text-xs leading-relaxed text-muted">{body}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-5 flex items-center gap-2 text-xs font-semibold text-muted">
              <CloudOff size={15} />
              No account is required to keep using TruckTap locally.
            </p>
          </section>

          <section className="rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-page p-1">
              {[
                { id: 'signin' as const, label: 'Sign In' },
                { id: 'create' as const, label: 'Create' },
                { id: 'join' as const, label: 'Join' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMode(item.id)
                    setFormError('')
                  }}
                  className={cn(
                    'min-h-12 rounded-lg text-xs font-black transition',
                    mode === item.id
                      ? 'bg-accent text-accent-ink shadow-sm'
                      : 'text-muted hover:bg-panel-2 hover:text-ink',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <form onSubmit={(event) => void submitAuth(event)} className="mt-4 space-y-3">
              <div>
                <h2 className="text-lg font-black">
                  {mode === 'signin'
                    ? 'Welcome back'
                    : mode === 'create'
                      ? 'Create a workspace'
                      : 'Join your crew'}
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {mode === 'signin'
                    ? 'Pull this team’s data onto this device.'
                    : mode === 'create'
                      ? 'Your existing local board is uploaded to the new team.'
                      : 'Use the join code from your shop owner.'}
                </p>
              </div>

              {mode !== 'signin' && (
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-muted">
                    Your name
                  </span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Your name"
                    className="min-h-14 w-full rounded-xl border-2 border-line bg-page px-3 text-sm font-semibold text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
                  />
                </label>
              )}

              {mode === 'create' && (
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-muted">
                    Workspace name
                  </span>
                  <div className="relative">
                    <Building2
                      size={17}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      value={workspaceName}
                      onChange={(event) => setWorkspaceName(event.target.value)}
                      required
                      autoComplete="organization"
                      placeholder="Your shop name"
                      className="min-h-14 w-full rounded-xl border-2 border-line bg-page pl-10 pr-3 text-sm font-semibold text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
                    />
                  </div>
                </label>
              )}

              {mode === 'join' && (
                <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-muted">
                      Join code
                    </span>
                    <input
                      value={joinCode}
                      onChange={(event) =>
                        setJoinCode(event.target.value.toUpperCase())
                      }
                      required
                      autoCapitalize="characters"
                      autoComplete="off"
                      placeholder="ABCD2345"
                      className="min-h-14 w-full rounded-xl border-2 border-line bg-page px-3 font-mono text-sm font-black tracking-wider text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-muted">
                      Role
                    </span>
                    <select
                      value={joinRole}
                      onChange={(event) =>
                        setJoinRole(event.target.value as 'tech' | 'shop')
                      }
                      className="min-h-14 w-full rounded-xl border-2 border-line bg-page px-2 text-sm font-bold text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
                    >
                      <option value="tech">Tech</option>
                      <option value="shop">Shop</option>
                    </select>
                  </label>
                </div>
              )}

              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-muted">
                  Email
                </span>
                <div className="relative">
                  <Mail
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="min-h-14 w-full rounded-xl border-2 border-line bg-page pl-10 pr-3 text-sm font-semibold text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-muted">
                  Password
                </span>
                <div className="relative">
                  <LockKeyhole
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={mode === 'signin' ? 1 : 8}
                    autoComplete={
                      mode === 'signin' ? 'current-password' : 'new-password'
                    }
                    placeholder={mode === 'signin' ? 'Your password' : 'At least 8 characters'}
                    className="min-h-14 w-full rounded-xl border-2 border-line bg-page pl-10 pr-3 text-sm font-semibold text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
                  />
                </div>
              </label>

              {mode === 'signin' && (
                <p className="flex items-start gap-2 rounded-lg bg-warn/10 px-3 py-2 text-[11px] font-semibold leading-relaxed text-warn">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  Signing in replaces this device’s local board with the team
                  workspace.
                </p>
              )}

              {formError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300"
                >
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-sm font-black uppercase tracking-wide text-accent-ink shadow-lg transition active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? (
                  <LoaderCircle size={20} className="animate-spin" />
                ) : mode === 'signin' ? (
                  <Cloud size={20} />
                ) : mode === 'create' ? (
                  <Building2 size={20} />
                ) : (
                  <UserPlus size={20} />
                )}
                {busy
                  ? 'Connecting…'
                  : mode === 'signin'
                    ? 'Sign In & Sync'
                    : mode === 'create'
                      ? 'Create Workspace'
                      : 'Join Team'}
              </button>
            </form>

            <details className="mt-4 rounded-xl border border-line bg-page/50 p-3">
              <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.14em] text-muted">
                Server settings
              </summary>
              <div className="mt-2 flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Server
                    size={16}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    value={serverValue}
                    onChange={(event) => setServerValue(event.target.value)}
                    autoComplete="url"
                    className="min-h-11 w-full rounded-lg border border-line bg-panel pl-8 pr-2 font-mono text-[11px] text-ink outline-none focus:border-accent"
                  />
                </div>
                <button
                  type="button"
                  onClick={saveServer}
                  className="min-h-11 rounded-lg border border-line bg-panel px-3 text-xs font-black text-ink hover:bg-panel-2"
                >
                  {serverSaved ? <Check size={16} /> : 'Save'}
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-muted">
                Defaults to the local server or the same origin hosting the web app.
              </p>
            </details>
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
            <div className="flex flex-col gap-4 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                  <Cloud size={25} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black tracking-tight">
                      {session.organization.name}
                    </h2>
                    <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-accent">
                      {session.organization.plan === 'team' ? 'Team Sync' : session.organization.plan}
                    </span>
                    <span className="rounded-full bg-panel-2 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-muted">
                      {ROLE_LABELS[session.organization.role]}
                    </span>
                  </div>
                  <p className={cn('mt-1 flex items-center gap-1.5 text-xs font-bold', status.tone)}>
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        controller.status === 'synced' && 'bg-success',
                        controller.status === 'pending' && 'bg-warn',
                        controller.status === 'offline' && 'bg-warn',
                        controller.status === 'error' && 'bg-red-500',
                        controller.status === 'syncing' && 'bg-accent',
                      )}
                    />
                    {status.label}
                    {controller.lastSyncedAt && (
                      <span className="font-semibold text-muted">
                        · {formatDateTime(controller.lastSyncedAt)}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void controller.syncNow().catch(() => undefined)
                  }}
                  disabled={!controller.session || controller.status === 'syncing'}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-page px-4 text-xs font-black text-ink transition hover:bg-panel-2 disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={controller.status === 'syncing' ? 'animate-spin' : ''}
                  />
                  Sync now
                </button>
                <button
                  type="button"
                  onClick={() => void disconnect()}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-page px-4 text-xs font-black text-muted transition hover:border-red-500/40 hover:text-red-600 dark:hover:text-red-400"
                >
                  <LogOut size={16} />
                  Disconnect
                </button>
              </div>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
              <div className="rounded-xl border border-line bg-page/50 p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted">
                  Signed in as
                </p>
                <p className="mt-1 truncate text-sm font-bold">{session.user.name}</p>
                <p className="truncate text-[11px] text-muted">{session.user.email}</p>
              </div>
              <div className="rounded-xl border border-line bg-page/50 p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted">
                  Pending local changes
                </p>
                <p className="mt-1 text-2xl font-black tabular-nums">
                  {controller.queueCount}
                </p>
                <p className="text-[11px] text-muted">
                  Saved locally before syncing
                </p>
              </div>
              <div className="rounded-xl border border-line bg-page/50 p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted">
                  Team server
                </p>
                <p className="mt-1 truncate font-mono text-[11px] font-semibold text-ink">
                  {getApiBaseUrl()}
                </p>
                <p className="text-[11px] text-muted">Works across devices</p>
              </div>
            </div>

            {controller.error && (
              <div className="mx-4 mb-4 flex flex-col gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 sm:mx-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-xs font-bold text-red-700 dark:text-red-300">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  {controller.error}
                </p>
                <button
                  type="button"
                  onClick={() => void controller.syncNow().catch(() => undefined)}
                  className="min-h-10 shrink-0 rounded-lg border border-red-500/30 bg-panel px-3 text-xs font-black text-red-700 dark:text-red-300"
                >
                  Retry sync
                </button>
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="rounded-2xl border border-line bg-panel shadow-sm">
              <div className="flex items-center justify-between border-b border-line px-4 py-3.5 sm:px-5">
                <div>
                  <h2 className="text-base font-black">Members</h2>
                  <p className="text-[11px] text-muted">
                    {pluralize(members.length, 'person', 'people')} in this workspace
                  </p>
                </div>
                {session.organization.role === 'owner' && (
                  <span className="rounded-full bg-panel-2 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-muted">
                    Owner controls
                  </span>
                )}
              </div>

              {membersLoading ? (
                <div className="flex items-center justify-center py-12 text-muted">
                  <LoaderCircle size={24} className="animate-spin" />
                </div>
              ) : membersError ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-bold text-muted">{membersError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setMembersLoading(true)
                      controller
                        .refreshOrganization()
                        .then((info) => setMembers(info.members))
                        .catch((error: unknown) =>
                          setMembersError(
                            error instanceof Error
                              ? error.message
                              : 'Could not load members.',
                          ),
                        )
                        .finally(() => setMembersLoading(false))
                    }}
                    className="mt-3 min-h-11 rounded-lg border border-line bg-page px-4 text-xs font-bold"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-line/70">
                  {members.map((member) => {
                    const RoleIcon = ROLE_ICONS[member.role]
                    const isMe = member.id === session.user.id
                    const canManage =
                      session.organization.role === 'owner' &&
                      member.role !== 'owner' &&
                      !isMe

                    return (
                      <div
                        key={member.id}
                        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-panel-2 text-sm font-black text-ink">
                            {member.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                              {member.name}
                              {isMe && (
                                <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[8px] font-black uppercase text-accent">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="truncate text-[11px] text-muted">
                              {member.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:shrink-0">
                          <span className="flex items-center gap-1 rounded-full bg-panel-2 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-muted">
                            <RoleIcon size={12} />
                            {ROLE_LABELS[member.role]}
                          </span>
                          {canManage && (
                            <>
                              <select
                                value={member.role}
                                disabled={memberBusyId === member.id}
                                onChange={(event) =>
                                  void updateRole(
                                    member,
                                    event.target.value as 'tech' | 'shop',
                                  )
                                }
                                aria-label={`Change ${member.name}'s role`}
                                className="min-h-10 rounded-lg border border-line bg-page px-2 text-xs font-bold text-ink outline-none focus:border-accent disabled:opacity-50"
                              >
                                <option value="tech">Tech</option>
                                <option value="shop">Shop</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => setMemberToRemove(member)}
                                disabled={memberBusyId === member.id}
                                aria-label={`Remove ${member.name}`}
                                className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-page text-muted transition hover:border-red-500/40 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
                              >
                                {memberBusyId === member.id ? (
                                  <LoaderCircle size={16} className="animate-spin" />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
              <div className="flex items-center gap-2 text-muted">
                <UserPlus size={18} />
                <h2 className="text-sm font-black text-ink">Invite the crew</h2>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Share this code. New teammates create an account, choose Tech or
                Shop, and pull the shared board.
              </p>
              <button
                type="button"
                onClick={() => void copyJoinCode()}
                className="mt-3 flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border-2 border-dashed border-accent/40 bg-accent/5 px-4 text-left transition hover:bg-accent/10"
              >
                <span className="font-mono text-xl font-black tracking-[0.18em] text-ink">
                  {session.organization.joinCode}
                </span>
                <Copy size={18} className="shrink-0 text-accent" />
              </button>
              <p className="mt-2 text-center text-[10px] font-semibold text-muted">
                Tap to copy · Keep this inside your company
              </p>

              <div className="mt-5 rounded-xl bg-page/60 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-muted">
                  <Cloud size={13} />
                  How sync works
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  Every tap saves to this device first. When online, changes push
                  to the team server and the latest snapshot comes back. Shop
                  views refresh about every 8 seconds.
                </p>
              </div>
            </section>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={memberToRemove !== null}
        title="Remove this member?"
        description={
          memberToRemove
            ? `${memberToRemove.name} will lose access to ${session?.organization.name ?? 'this workspace'}. Their local device keeps its last copy.`
            : ''
        }
        confirmLabel="Remove Member"
        busy={memberBusyId !== null}
        onCancel={() => {
          if (memberBusyId === null) setMemberToRemove(null)
        }}
        onConfirm={() => void removeMember()}
      />
    </div>
  )
}
