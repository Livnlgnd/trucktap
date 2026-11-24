const CACHE_NAME = 'trucktap-shell-__TRUCKTAP_BUILD__'
const BASE = new URL('./', self.location.href).pathname
const APP_SHELL = [
  BASE,
  `${BASE}index.html`,
  `${BASE}app.html`,
  `${BASE}app/index.html`,
  `${BASE}manifest.json`,
  `${BASE}icons/icon.svg`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
  `${BASE}icons/icon-maskable-512.png`,
  `${BASE}icons/apple-touch-icon.png`,
]

function sameOriginAsset(value) {
  try {
    const url = new URL(value, self.location.origin + BASE)
    if (url.origin !== self.location.origin) return null
    if (!url.pathname.startsWith(BASE)) return null
    // Large demo video: stream on demand instead of precaching the app shell.
    if (url.pathname.endsWith('.mp4')) return null
    return url.pathname + url.search
  } catch {
    return null
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      const assetUrls = new Set()

      for (const page of ['index.html', 'app.html', 'app/index.html']) {
        const shellResponse = await fetch(`${BASE}${page}`, {
          cache: 'no-store',
        })
        await cache.put(`${BASE}${page}`, shellResponse.clone())

        // Vite emits hashed asset filenames. Discover them from each entry HTML
        // so the complete site and installed app work offline after install.
        const html = await shellResponse.text()
        for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
          const asset = sameOriginAsset(match[1])
          if (asset) assetUrls.add(asset)
        }
      }

      await cache.addAll([...new Set([...APP_SHELL, ...assetUrls])])
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Team Sync is live data. Never serve API responses from the app shell cache.
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    const isAppRoute =
      url.pathname === `${BASE}app` ||
      url.pathname.startsWith(`${BASE}app/`)
    const cacheKey = isAppRoute
      ? `${BASE}app/index.html`
      : `${BASE}index.html`

    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy))
          return response
        })
        .catch(async () => {
          return (
            (await caches.match(cacheKey)) ||
            (await caches.match(`${BASE}index.html`)) ||
            (await caches.match(BASE))
          )
        }),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
