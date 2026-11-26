import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, LoaderCircle, RefreshCw, Truck, WifiOff, KeyRound } from 'lucide-react'
import type { AppView } from './types'
import {
  db,
  initializeDatabase,
} from './db'
import { useTheme } from './hooks/useTheme'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useTeamSync } from './hooks/useTeamSync'
import { useLicense } from './hooks/useLicense'
import { licenseCanUseApp } from './lib/license'
import { TopBar } from './components/TopBar'
import { TechView } from './components/TechView'
import { ShopPickListView } from './components/ShopPickListView'
import { TemplateManager } from './components/TemplateManager'
import { TeamSyncView } from './components/TeamSyncView'
import { LicenseGate, LicenseView } from './components/LicenseView'
import { FirstRunView } from './components/FirstRunView'
import { MobileJoinView } from './components/MobileJoinView'
import { TutorialOverlay } from './components/TutorialOverlay'
import { useTutorialWalkthrough } from './hooks/useTutorialWalkthrough'
import { Toast, type ToastData, type ToastTone } from './components/Toast'
import { isDesktopApp, isNativeMobile } from './lib/platform'
import { useDesktopUpdate } from './hooks/useDesktopUpdate'

const VIEW_KEY = 'trucktap.view'
const VAN_KEY = 'trucktap.active-van'

function getStoredView(): AppView {
  try {
    const value = window.localStorage.getItem(VIEW_KEY)
    if (
      value === 'tech' ||
      value === 'shop' ||
      value === 'manage' ||
      value === 'team' ||
      value === 'license'
    ) {
      return value
    }
  } catch {
    // Use the default.
  }
  return 'tech'
}

function getStoredVanId(): string {
  try {
    return window.localStorage.getItem(VAN_KEY) ?? ''
  } catch {
    return ''
  }
}

function App() {
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState('')
  const [view, setView] = useState<AppView>(getStoredView)
  const [activeVanId, setActiveVanId] = useState(getStoredVanId)
  const [toast, setToast] = useState<ToastData | null>(null)
  const toastTimer = useRef<number | null>(null)
  const { theme, toggleTheme } = useTheme()
  const {
    isOnline,
    simulatedOffline,
    toggleSimulatedOffline,
  } = useOnlineStatus()
  const teamSync = useTeamSync(isOnline, ready)
  const license = useLicense(ready)
  const desktopUpdate = useDesktopUpdate(license.state)

  const vans = useLiveQuery(() => db.vans.orderBy('name').toArray(), [])
  const tutorial = useTutorialWalkthrough(ready, Boolean(vans && vans.length > 0))

  const activeVan =
    vans?.find((van) => van.id === activeVanId) ?? vans?.[0] ?? null

  useEffect(() => {
    let cancelled = false
    initializeDatabase()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setInitError(
            error instanceof Error
              ? error.message
              : 'The local database could not be opened.',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, view)
    } catch {
      // View preference is non-critical.
    }
  }, [view])

  useEffect(() => {
    if (!activeVan) return
    try {
      window.localStorage.setItem(VAN_KEY, activeVan.id)
    } catch {
      // Van preference is non-critical.
    }
  }, [activeVan])

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
      setToast({ id: Date.now(), message, tone })
      toastTimer.current = window.setTimeout(() => setToast(null), 4200)
    },
    [],
  )

  if (initError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page px-4 text-ink">
        <div className="w-full max-w-md rounded-3xl border border-line bg-panel p-6 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400">
            <WifiOff size={28} />
          </div>
          <h1 className="mt-4 text-2xl font-black">Local storage is blocked</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            TruckTap stores everything in IndexedDB on this device. Allow site
            data or leave private browsing, then reload.
          </p>
          <p className="mt-3 rounded-xl bg-page px-3 py-2 font-mono text-[11px] text-muted">
            {initError}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-sm font-black uppercase tracking-wide text-accent-ink"
          >
            <RefreshCw size={19} />
            Reload TruckTap
          </button>
        </div>
      </div>
    )
  }

  if (!ready || !vans || license.loading || !license.state) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-page px-6 text-center text-ink">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-accent text-accent-ink shadow-2xl">
          <Truck size={42} />
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight">TruckTap</h1>
        <p className="mt-2 text-sm font-semibold text-muted">
          Opening your offline van board…
        </p>
        <LoaderCircle size={24} className="mt-6 animate-spin text-accent" />
      </div>
    )
  }

  if (!licenseCanUseApp(license.state)) {
    return (
      <>
        <LicenseGate
          state={license.state}
          activate={license.activate}
          onToast={showToast}
        />
        <Toast toast={toast} />
      </>
    )
  }

  if (isNativeMobile() && !teamSync.session) {
    return (
      <>
        <MobileJoinView controller={teamSync} onToast={showToast} />
        <Toast toast={toast} />
      </>
    )
  }

  if (vans.length === 0) {
    return (
      <>
        <FirstRunView
          onCreated={(van) => setActiveVanId(van.id)}
          onToast={showToast}
        />
        <Toast toast={toast} />
      </>
    )
  }

  if (tutorial.active) {
    return (
      <div className="min-h-screen bg-page text-ink">
        <TopBar
          view="tech"
          onViewChange={(next) => {
            if (next === 'team') tutorial.acknowledgeStatus()
          }}
          isOnline={isOnline}
          simulatedOffline={simulatedOffline}
          onToggleSimulatedOffline={toggleSimulatedOffline}
          queueCount={teamSync.queueCount}
          syncStatus={teamSync.status}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenTutorial={() => undefined}
          onTutorialStatusClick={tutorial.acknowledgeStatus}
        />
        <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
          <TechView
            vans={[tutorial.demoVan]}
            van={tutorial.demoVan}
            onVanChange={() => undefined}
            onOpenManage={() => undefined}
            onToast={showToast}
            sandbox={{
              parts: tutorial.demoParts,
              onIncrement: tutorial.handleIncrement,
              onDecrement: tutorial.handleDecrement,
              onScan: tutorial.handleDemoScan,
            }}
          />
        </main>
        <TutorialOverlay
          step={tutorial.step}
          onSkip={tutorial.finish}
          onFinish={tutorial.finish}
          onStatusAck={tutorial.acknowledgeStatus}
        />
        <Toast toast={toast} />
      </div>
    )
  }

  if (!activeVan) return null

  return (
    <div className="min-h-screen bg-page text-ink">
      <TopBar
        view={view}
        onViewChange={setView}
        isOnline={isOnline}
        simulatedOffline={simulatedOffline}
        onToggleSimulatedOffline={toggleSimulatedOffline}
        queueCount={teamSync.queueCount}
        syncStatus={teamSync.status}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenTutorial={tutorial.start}
      />

      {isDesktopApp() && desktopUpdate.status && (
        <>
          {desktopUpdate.status.state === 'downloaded' && (
            <div className="border-b border-success/30 bg-success/10">
              <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-3 py-2 text-[11px] font-bold text-success sm:px-6">
                <Download size={14} className="shrink-0" />
                <span>
                  TruckTap{' '}
                  {desktopUpdate.status.version
                    ? `v${desktopUpdate.status.version}`
                    : 'update'}{' '}
                  is ready to install.
                </span>
                <button
                  type="button"
                  onClick={() => void desktopUpdate.install()}
                  className="ml-auto min-h-8 rounded-lg bg-success px-3 text-[10px] font-black uppercase tracking-wide text-white"
                >
                  Restart and update
                </button>
              </div>
            </div>
          )}
          {desktopUpdate.status.state === 'downloading' && (
            <div className="border-b border-accent/20 bg-accent/10">
              <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-2 text-[11px] font-bold text-ink sm:px-6">
                <LoaderCircle size={14} className="shrink-0 animate-spin text-accent" />
                <span>
                  Downloading TruckTap{' '}
                  {desktopUpdate.status.version
                    ? `v${desktopUpdate.status.version}`
                    : 'update'}
                  … {desktopUpdate.status.percent}%
                </span>
              </div>
            </div>
          )}
          {desktopUpdate.status.state === 'available' &&
            !desktopUpdate.status.entitled && (
              <div className="border-b border-warn/25 bg-warn/10">
                <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-3 py-2 text-[11px] font-bold text-warn sm:px-6">
                  <Download size={14} className="shrink-0" />
                  <span>
                    TruckTap{' '}
                    {desktopUpdate.status.version
                      ? `v${desktopUpdate.status.version}`
                      : 'update'}{' '}
                    is available, but this license’s update window has ended.
                  </span>
                  <a
                    href="https://trucktap.net/pricing.html"
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto rounded-lg border border-warn/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide"
                  >
                    Renew
                  </a>
                </div>
              </div>
            )}
          {desktopUpdate.status.state === 'error' && (
            <div className="border-b border-line bg-page">
              <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-2 text-[11px] font-semibold text-muted sm:px-6">
                <span className="truncate">
                  Update check: {desktopUpdate.status.error ?? 'unavailable'}
                </span>
                <button
                  type="button"
                  onClick={() => void desktopUpdate.check()}
                  className="ml-auto rounded-lg border border-line px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-ink"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {license.state.source === 'trial' &&
        !license.state.trialExpired &&
        view !== 'license' && (
          <div className="border-b border-accent/20 bg-accent/10">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-2 text-[11px] font-bold text-ink sm:px-6">
              <KeyRound size={14} className="shrink-0 text-accent" />
              <span>
                Free trial ·{' '}
                <strong className="font-black">
                  {license.state.trialDaysLeft}{' '}
                  {license.state.trialDaysLeft === 1 ? 'day' : 'days'} left
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setView('license')}
                className="ml-auto shrink-0 rounded-full border border-accent/30 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-accent transition hover:bg-accent/10"
              >
                Activate license
              </button>
            </div>
          </div>
        )}

      {!isOnline && (
        <div className="border-b border-warn/25 bg-warn/10">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-2 text-[11px] font-bold text-warn sm:px-6">
            <WifiOff size={14} className="shrink-0" />
            <span>
              Offline mode — every tap saves on this device and queues for sync.
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {teamSync.session && teamSync.queueCount > 0 && (
                <span className="rounded-full border border-warn/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide">
                  {teamSync.queueCount} queued
                </span>
              )}
              {simulatedOffline && (
                <span className="hidden rounded-full border border-warn/30 px-2 py-0.5 text-[9px] uppercase tracking-wide sm:inline">
                  Simulated test
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        {view === 'tech' && (
          <TechView
            key={activeVan.id}
            vans={vans}
            van={activeVan}
            onVanChange={setActiveVanId}
            onOpenManage={() => setView('manage')}
            onToast={showToast}
          />
        )}
        {view === 'shop' && (
          <ShopPickListView
            onToast={showToast}
            onOpenTech={() => setView('tech')}
          />
        )}
        {view === 'manage' && (
          <TemplateManager
            vans={vans}
            van={activeVan}
            onVanChange={setActiveVanId}
            onToast={showToast}
            teamSyncActive={teamSync.session !== null}
          />
        )}
        {view === 'team' && (
          <TeamSyncView controller={teamSync} onToast={showToast} />
        )}
        {view === 'license' && (
          <LicenseView
            state={license.state}
            activate={license.activate}
            remove={license.remove}
            refresh={license.refresh}
            onToast={showToast}
            onReplayTutorial={tutorial.start}
          />
        )}
      </main>

      <Toast toast={toast} />
    </div>
  )
}

export default App
