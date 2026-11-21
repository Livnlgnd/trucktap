import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  net,
  protocol,
  screen,
  session,
  shell,
} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.join(__dirname, '..')
const DIST_DIR = path.join(ROOT_DIR, 'dist')
const APP_SCHEME = 'trucktap'
const APP_HOST = 'app'
const APP_URL = `${APP_SCHEME}://${APP_HOST}/index.html`
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const IS_DEV = Boolean(DEV_SERVER_URL)

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

      let filePath = path.normalize(path.join(DIST_DIR, pathname))
      const relative = path.relative(DIST_DIR, filePath)
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return new Response('Not found', { status: 404 })
      }

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        if (path.extname(pathname)) {
          return new Response('Not found', { status: 404 })
        }
        filePath = path.join(DIST_DIR, 'index.html')
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
    void mainWindow.loadURL(DEV_SERVER_URL)
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

    buildApplicationMenu()
    createWindow()

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
