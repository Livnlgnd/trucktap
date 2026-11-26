import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  safeStorage,
  screen,
  session,
  shell,
} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import electronUpdater from 'electron-updater'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.join(__dirname, '..')
const DIST_DIR = path.join(ROOT_DIR, 'dist')
const APP_SCHEME = 'trucktap'
const APP_HOST = 'app'
const APP_URL = `${APP_SCHEME}://${APP_HOST}/app/index.html`
const ADMIN_URL = `${APP_SCHEME}://${APP_HOST}/admin/index.html`
const CONSOLE_API_BASE =
  process.env.TRUCKTAP_LICENSE_API ||
  'https://keytrack-license.joshua-c77.workers.dev'
const CONSOLE_ALLOWED_PATHS = [/^\/api\/trucktap\/admin\/licenses$/]
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const IS_DEV = Boolean(DEV_SERVER_URL)
const ADMIN_CONSOLE_ENABLED = process.env.TRUCTTAP_ADMIN_CONSOLE === '1'

const { autoUpdater } = electronUpdater
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000
let updateEntitled = false
let updateTimer = null
let updaterInitialized = false
let updateCheckInFlight = false
let updateStatus = {
  state: 'idle',
  version: null,
  percent: 0,
  error: null,
  entitled: false,
}

function publishUpdateStatus(patch = {}) {
  updateStatus = { ...updateStatus, ...patch, entitled: updateEntitled }
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('updates:status', updateStatus)
    }
  }
  return updateStatus
}

function scheduleUpdateCheck(delayMs = 15000) {
  if (updateTimer) clearInterval(updateTimer)
  updateTimer = null
  if (!updateEntitled || IS_DEV || !app.isPackaged) return
  updateTimer = setInterval(() => {
    void checkForUpdates(false)
  }, UPDATE_INTERVAL_MS)
  updateTimer.unref?.()
  setTimeout(() => {
    void checkForUpdates(false)
  }, delayMs).unref?.()
}

async function checkForUpdates(manual = false) {
  initializeUpdater()
  if (!app.isPackaged || IS_DEV) {
    return publishUpdateStatus({
      state: 'disabled',
      error: null,
      percent: 0,
    })
  }
  if (updateCheckInFlight) return updateStatus
  updateCheckInFlight = true
  try {
    publishUpdateStatus({ state: 'checking', error: null, percent: 0 })
    await autoUpdater.checkForUpdates()
  } catch (error) {
    publishUpdateStatus({
      state: 'error',
      error:
        error instanceof Error ? error.message : 'The update check failed.',
    })
  } finally {
    updateCheckInFlight = false
    if (manual && updateStatus.state === 'checking') {
      publishUpdateStatus({ state: 'idle' })
    }
  }
  return updateStatus
}

function initializeUpdater() {
  if (updaterInitialized) return
  updaterInitialized = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    publishUpdateStatus({ state: 'checking', error: null })
  })
  autoUpdater.on('update-available', (info) => {
    publishUpdateStatus({
      state: 'available',
      version: info?.version ?? null,
      error: null,
      percent: 0,
    })
    if (updateEntitled) {
      void autoUpdater.downloadUpdate().catch((error) => {
        publishUpdateStatus({
          state: 'error',
          error:
            error instanceof Error ? error.message : 'The update download failed.',
        })
      })
    }
  })
  autoUpdater.on('update-not-available', () => {
    publishUpdateStatus({
      state: 'idle',
      version: null,
      error: null,
      percent: 0,
    })
  })
  autoUpdater.on('download-progress', (progress) => {
    publishUpdateStatus({
      state: 'downloading',
      percent: Math.max(0, Math.min(100, Math.round(progress.percent ?? 0))),
      error: null,
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    publishUpdateStatus({
      state: 'downloaded',
      version: info?.version ?? updateStatus.version,
      percent: 100,
      error: null,
    })
  })
  autoUpdater.on('error', (error) => {
    publishUpdateStatus({
      state: 'error',
      error: error instanceof Error ? error.message : 'The updater failed.',
    })
  })
}

function registerUpdaterIpc() {
  ipcMain.handle('updates:status', () => updateStatus)
  ipcMain.handle('updates:check', () => checkForUpdates(true))
  ipcMain.handle('updates:set-entitlement', (_event, payload) => {
    updateEntitled = Boolean(payload?.allowed)
    publishUpdateStatus({ entitled: updateEntitled })
    if (updateEntitled) {
      scheduleUpdateCheck(8000)
      if (updateStatus.state === 'available') {
        void autoUpdater.downloadUpdate().catch(() => undefined)
      }
    } else if (updateTimer) {
      clearInterval(updateTimer)
      updateTimer = null
    }
    return updateStatus
  })
  ipcMain.handle('updates:download', async () => {
    initializeUpdater()
    if (!updateEntitled) {
      return publishUpdateStatus({
        state: 'blocked',
        error: 'This license’s update window has ended.',
      })
    }
    if (updateStatus.state !== 'available' && updateStatus.state !== 'error') {
      return updateStatus
    }
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      publishUpdateStatus({
        state: 'error',
        error:
          error instanceof Error ? error.message : 'The update download failed.',
      })
    }
    return updateStatus
  })
  ipcMain.handle('updates:install', () => {
    if (updateStatus.state !== 'downloaded') {
      return { ok: false, error: 'No downloaded update is ready.' }
    }
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true)
    })
    return { ok: true }
  })
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      allowServiceWorkers: false,
    },
  },
])

let mainWindow = null
let adminWindow = null
let saveStateTimer = null

function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json')
}

function windowBoundsAreVisible(bounds) {
  return screen.getAllDisplays().some(({ workArea }) => {
    const horizontal =
      bounds.x < workArea.x + workArea.width &&
      bounds.x + bounds.width > workArea.x
    const vertical =
      bounds.y < workArea.y + workArea.height &&
      bounds.y + bounds.height > workArea.y
    return horizontal && vertical
  })
}

function loadWindowState() {
  const fallback = {
    width: 1380,
    height: 900,
    x: undefined,
    y: undefined,
    isMaximized: false,
  }

  try {
    const raw = fs.readFileSync(getWindowStatePath(), 'utf8')
    const saved = JSON.parse(raw)
    const width = Math.max(900, Math.min(2600, Number(saved.width) || fallback.width))
    const height = Math.max(680, Math.min(1800, Number(saved.height) || fallback.height))
    const candidate = {
      width,
      height,
      x: Number(saved.x),
      y: Number(saved.y),
    }
    const hasPosition =
      Number.isFinite(candidate.x) && Number.isFinite(candidate.y)
    const canRestorePosition =
      hasPosition && windowBoundsAreVisible(candidate)

    return {
      width,
      height,
      ...(canRestorePosition ? { x: candidate.x, y: candidate.y } : {}),
      isMaximized: Boolean(saved.isMaximized),
    }
  } catch {
    return fallback
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return

  try {
    const isMaximized = mainWindow.isMaximized()
    const bounds = isMaximized
      ? mainWindow.getNormalBounds()
      : mainWindow.getBounds()
    fs.mkdirSync(path.dirname(getWindowStatePath()), { recursive: true })
    fs.writeFileSync(
      getWindowStatePath(),
      JSON.stringify({ ...bounds, isMaximized }, null, 2),
    )
  } catch {
    // Window state is a convenience; a failed write must not affect app use.
  }
}

function scheduleWindowStateSave() {
  if (saveStateTimer) clearTimeout(saveStateTimer)
  saveStateTimer = setTimeout(() => {
    saveStateTimer = null
    saveWindowState()
  }, 400)
}

function showAboutDialog() {
  const options = {
    type: 'info',
    title: 'About TruckTap',
    message: 'TruckTap',
    detail: [
      `Version ${app.getVersion()}`,
      '',
      'Local-first van and truck restock clicker for field service teams.',
      '',
      `Data folder: ${app.getPath('userData')}`,
    ].join('\n'),
    buttons: ['OK'],
  }

  if (mainWindow) {
    void dialog.showMessageBox(mainWindow, options)
  } else {
    void dialog.showMessageBox(options)
  }
}

function consoleTokenFile() {
  return path.join(app.getPath('userData'), 'license-console-token.bin')
}

function isConsolePathAllowed(apiPath) {
  if (typeof apiPath !== 'string') return false
  try {
    const pathname = new URL(apiPath, 'https://license-console.local').pathname
    return CONSOLE_ALLOWED_PATHS.some((pattern) => pattern.test(pathname))
  } catch {
    return false
  }
}

async function consoleApiRequest({ method = 'GET', path: apiPath, body, token }) {
  if (!isConsolePathAllowed(apiPath)) {
    return { ok: false, status: 0, error: 'That license API route is not allowed.' }
  }
  if (!token) {
    return { ok: false, status: 0, error: 'Admin token is required.' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const response = await fetch(`${CONSOLE_API_BASE}${apiPath}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Admin-Token': token,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    const data = await response.json().catch(() => null)
    return { ok: response.ok, status: response.status, data }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error:
        error?.name === 'AbortError'
          ? 'The license service timed out.'
          : 'Could not reach the license service.',
    }
  } finally {
    clearTimeout(timeout)
  }
}

function registerConsoleIpc() {
  ipcMain.handle('console:api', (_event, payload) =>
    consoleApiRequest(payload ?? {}),
  )

  ipcMain.handle('console:clipboard-write', (_event, text) => {
    clipboard.writeText(String(text ?? ''))
    return true
  })

  ipcMain.handle('console:token-load', () => {
    try {
      if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(consoleTokenFile())) {
        return ''
      }
      return safeStorage.decryptString(fs.readFileSync(consoleTokenFile()))
    } catch {
      return ''
    }
  })

  ipcMain.handle('console:token-save', (_event, token) => {
    try {
      if (
        typeof token !== 'string' ||
        !token ||
        !safeStorage.isEncryptionAvailable()
      ) {
        return false
      }
      fs.writeFileSync(consoleTokenFile(), safeStorage.encryptString(token))
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('console:token-clear', () => {
    try {
      if (fs.existsSync(consoleTokenFile())) fs.unlinkSync(consoleTokenFile())
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('console:export-csv', async (_event, payload) => {
    const content = String(payload?.content ?? '')
    const defaultName = String(payload?.filename ?? 'trucktap-licenses.csv')
    const result = await dialog.showSaveDialog(adminWindow ?? mainWindow, {
      title: 'Export TruckTap licenses',
      defaultPath: defaultName,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    })
    if (result.canceled || !result.filePath) return { saved: false }
    fs.writeFileSync(result.filePath, content, 'utf8')
    return { saved: true, filePath: result.filePath }
  })
}

function openAdminConsole() {
  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.show()
    adminWindow.focus()
    return
  }

  const iconPath = path.join(DIST_DIR, 'icons', 'icon-512.png')

  adminWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1040,
    minHeight: 700,
    backgroundColor: '#0c1118',
    title: 'TruckTap License Console',
    autoHideMenuBar: true,
    ...(mainWindow ? { parent: mainWindow } : {}),
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'console-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  })

  adminWindow.loadURL(ADMIN_URL)

  adminWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  adminWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  adminWindow.on('closed', () => {
    adminWindow = null
  })
}

function buildApplicationMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.reload(),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(IS_DEV
          ? [{ type: 'separator' }, { role: 'toggleDevTools' }]
          : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open Data Folder',
          click: () => {
            void shell.openPath(app.getPath('userData'))
          },
        },
        {
          label: 'Check for Updates…',
          click: () => {
            void checkForUpdates(true)
          },
        },
        { type: 'separator' },
        {
          label: 'About TruckTap',
          click: showAboutDialog,
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function registerAppProtocol() {
  await protocol.handle(APP_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      if (url.host !== APP_HOST) {
        return new Response('Not found', { status: 404 })
      }

      let pathname = decodeURIComponent(url.pathname)
      if (!pathname || pathname === '/') pathname = '/index.html'

      // The admin console ships only inside the desktop bundle, never in the
      // web build. Keep it in electron/admin and serve it from there.
      let baseDir = DIST_DIR
      let relativePath = pathname
      if (
        ADMIN_CONSOLE_ENABLED &&
        (pathname === '/admin' || pathname.startsWith('/admin/'))
      ) {
        baseDir = path.join(__dirname, 'admin')
        relativePath = pathname.slice('/admin'.length) || '/index.html'
      }

      let filePath = path.normalize(path.join(baseDir, relativePath))
      const relative = path.relative(baseDir, filePath)
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return new Response('Not found', { status: 404 })
      }

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        if (path.extname(relativePath)) {
          return new Response('Not found', { status: 404 })
        }
        filePath = path.join(baseDir, 'index.html')
      }

      return await net.fetch(pathToFileURL(filePath).toString())
    } catch {
      return new Response('Could not load TruckTap.', {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }
  })
}

function createWindow() {
  const state = loadWindowState()
  const iconPath = path.join(DIST_DIR, 'icons', 'icon-512.png')

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    ...(state.x !== undefined ? { x: state.x, y: state.y } : {}),
    minWidth: 900,
    minHeight: 680,
    show: false,
    title: 'TruckTap',
    backgroundColor: '#0b0f13',
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  })

  if (state.isMaximized) mainWindow.maximize()

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('move', scheduleWindowStateSave)
  mainWindow.on('resize', scheduleWindowStateSave)
  mainWindow.on('close', saveWindowState)
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    let allowed = false
    try {
      const target = new URL(targetUrl)
      allowed = IS_DEV
        ? target.origin === new URL(DEV_SERVER_URL).origin
        : target.protocol === `${APP_SCHEME}:` && target.host === APP_HOST
    } catch {
      allowed = false
    }

    if (!allowed) {
      event.preventDefault()
      if (/^https?:\/\//i.test(targetUrl)) {
        void shell.openExternal(targetUrl)
      }
    }
  })

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return
      console.error(
        `TruckTap failed to load ${validatedUrl}: ${errorDescription} (${errorCode})`,
      )
    },
  )

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('TruckTap renderer exited unexpectedly:', details.reason)
  })

  if (IS_DEV) {
    void mainWindow.loadURL(`${DEV_SERVER_URL.replace(/\/$/, '')}/app/`)
    if (process.env.TRUCKTAP_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    void mainWindow.loadURL(APP_URL)
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.trucktap.desktop')
    await registerAppProtocol()

    session.defaultSession.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false),
    )

    registerConsoleIpc()
    initializeUpdater()
    registerUpdaterIpc()
    buildApplicationMenu()

    if (ADMIN_CONSOLE_ENABLED && process.argv.includes('--admin')) {
      openAdminConsole()
    } else {
      createWindow()
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('before-quit', () => {
    if (saveStateTimer) {
      clearTimeout(saveStateTimer)
      saveStateTimer = null
    }
    saveWindowState()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
