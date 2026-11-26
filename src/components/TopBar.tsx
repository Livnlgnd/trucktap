import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Cloud,
  CloudOff,
  CloudUpload,
  CircleHelp,
  KeyRound,
  LoaderCircle,
  Moon,
  Sun,
  Truck,
  Users,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react'
import type { AppView } from '../types'
import type { Theme } from '../hooks/useTheme'
import type { TeamSyncStatus } from '../hooks/useTeamSync'
import { cn } from '../lib/utils'

const VIEWS: Array<{
  id: AppView
  label: string
  mobileLabel: string
  icon: typeof Wrench
}> = [
  {
    id: 'tech',
    label: 'Tech Clicker View',
    mobileLabel: 'Tech',
    icon: Wrench,
  },
  {
    id: 'shop',
    label: 'Shop Pick-List View',
    mobileLabel: 'Shop',
    icon: ClipboardList,
  },
  {
    id: 'manage',
    label: 'Manage Van Templates',
    mobileLabel: 'Templates',
    icon: Boxes,
  },
  {
    id: 'team',
    label: 'Team Sync',
    mobileLabel: 'Team',
    icon: Users,
  },
  {
    id: 'license',
    label: 'License & Downloads',
    mobileLabel: 'License',
    icon: KeyRound,
  },
]

export function TopBar({
  view,
  onViewChange,
  isOnline,
  simulatedOffline,
  onToggleSimulatedOffline,
  queueCount,
  syncStatus,
  theme,
  onToggleTheme,
  onOpenTutorial,
  onTutorialStatusClick,
}: {
  view: AppView
  onViewChange: (view: AppView) => void
  isOnline: boolean
  simulatedOffline: boolean
  onToggleSimulatedOffline: () => void
  queueCount: number
  syncStatus: TeamSyncStatus
  theme: Theme
  onToggleTheme: () => void
  onOpenTutorial: () => void
  onTutorialStatusClick?: () => void
}) {
  const synchronized = syncStatus !== 'local'
  const visibleQueueCount = synchronized ? queueCount : 0

  const syncPill =
    syncStatus === 'local'
      ? {
          icon: CloudOff,
          text: 'Local only',
          tone: 'text-muted',
        }
      : syncStatus === 'syncing'
        ? {
            icon: LoaderCircle,
            text: 'Syncing…',
            tone: 'text-accent',
          }
        : syncStatus === 'error'
          ? {
              icon: AlertTriangle,
              text: 'Sync issue',
              tone: 'text-red-600 dark:text-red-400',
            }
          : syncStatus === 'offline'
            ? {
                icon: CloudOff,
                text: 'Offline',
                tone: 'text-warn',
              }
            : syncStatus === 'pending'
              ? {
                  icon: CloudUpload,
                  text: `${queueCount} queued`,
                  tone: 'text-warn',
                }
              : {
                  icon: Cloud,
                  text: 'Synced',
                  tone: 'text-success',
                }
  const SyncPillIcon = syncPill.icon

  return (
    <header className="safe-top sticky top-0 z-50 border-b border-line bg-page/95 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
        <div className="flex min-h-16 items-center gap-3 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-[0_5px_20px_-8px_var(--accent)]">
              <Truck size={26} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-black leading-none tracking-tight sm:text-2xl">
                TruckTap
              </p>
              <p className="mt-1 hidden text-[10px] font-bold uppercase tracking-[0.18em] text-muted sm:block">
                Van &amp; truck restock
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => onViewChange('team')}
              className="hidden min-h-9 items-center gap-1.5 rounded-xl border border-line bg-panel px-3 py-2 text-[11px] font-bold text-muted transition hover:text-ink lg:flex"
              aria-live="polite"
              title={
                syncStatus === 'local'
                  ? 'Open Team Sync settings'
                  : syncStatus === 'synced'
                    ? 'Team workspace is up to date'
                    : syncStatus === 'error'
                      ? 'Open Team Sync to resolve the sync issue'
                      : 'Open Team Sync'
              }
            >
              <SyncPillIcon
                size={16}
                className={cn(
                  syncPill.tone,
                  syncStatus === 'syncing' && 'animate-spin',
                )}
              />
              <span className={syncPill.tone}>{syncPill.text}</span>
            </button>

            <div
              data-tutorial="status"
              onClick={onTutorialStatusClick}
              role={onTutorialStatusClick ? 'button' : undefined}
              tabIndex={onTutorialStatusClick ? 0 : undefined}
              aria-live="polite"
              title={
                simulatedOffline
                  ? 'Simulated offline mode is on'
                  : isOnline
                    ? 'Connected and syncing'
                    : 'No network connection'
              }
              className={cn(
                'relative flex h-11 items-center gap-2 rounded-xl border px-2.5 text-[11px] font-black uppercase tracking-wide sm:px-3',
                isOnline
                  ? 'border-success/35 bg-success/10 text-success'
                  : 'border-warn/40 bg-warn/10 text-warn',
              )}
            >
              {isOnline ? <Wifi size={17} /> : <WifiOff size={17} />}
              <span className="hidden min-[390px]:inline">
                {isOnline ? 'Online' : 'Offline'}
              </span>
              {visibleQueueCount > 0 && (
                <span
                  className="hidden h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-black text-page sm:flex"
                  title={`${visibleQueueCount} changes queued on this device`}
                >
                  {visibleQueueCount > 99 ? '99+' : visibleQueueCount}
                </span>
              )}
              {visibleQueueCount > 0 && (
                <span
                  className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-warn ring-2 ring-page sm:hidden"
                  title={`${visibleQueueCount} changes queued on this device`}
                  aria-hidden="true"
                />
              )}
            </div>

            <button
              type="button"
              onClick={onToggleSimulatedOffline}
              aria-pressed={simulatedOffline}
              title="Toggle simulated offline mode"
              aria-label={
                simulatedOffline
                  ? 'Switch to online mode'
                  : 'Simulate offline mode'
              }
              className={cn(
                'hidden h-11 items-center gap-2 rounded-xl border px-2.5 text-[11px] font-black uppercase tracking-wide transition active:scale-95 sm:flex sm:px-3',
                simulatedOffline
                  ? 'border-warn/40 bg-warn/10 text-warn hover:bg-warn/15'
                  : 'border-line bg-panel text-muted hover:bg-panel-2 hover:text-ink',
              )}
            >
              {simulatedOffline ? <Wifi size={17} /> : <WifiOff size={17} />}
              <span className="hidden md:inline">
                {simulatedOffline ? 'Go online' : 'Simulate offline'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenTutorial}
              aria-label="Open the TruckTap tutorial"
              title="Open the TruckTap tutorial"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-panel text-muted transition hover:text-ink active:scale-95"
            >
              <CircleHelp size={20} />
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-panel text-muted transition hover:text-ink active:scale-95"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>

        <nav
          aria-label="Role and view"
          className="mb-3 grid grid-cols-5 gap-1 rounded-2xl border border-line bg-panel p-1 shadow-sm"
        >
          {VIEWS.map(({ id, label, mobileLabel, icon: Icon }) => {
            const selected = id === view
            return (
              <button
                key={id}
                type="button"
                onClick={() => onViewChange(id)}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-black leading-tight tracking-tight transition sm:flex-row sm:gap-2 sm:px-3 sm:text-sm',
                  selected
                    ? 'bg-accent text-accent-ink shadow-md'
                    : 'text-muted hover:bg-panel-2 hover:text-ink active:scale-[0.99]',
                )}
              >
                <Icon size={17} strokeWidth={2.4} className="shrink-0" />
                <span className="sm:hidden">{mobileLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
