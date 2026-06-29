/* Weather Dashboard service worker — installable PWA with smart caching.
 *
 * Strategy:
 *  - Navigations (HTML): network-first, fall back to cached shell when offline.
 *  - Next static assets (/_next/static, icons): stale-while-revalidate.
 *  - Public weather API (GET /api, no Authorization): network-first with a
 *    cached fallback so the last-seen data shows when offline.
 *  - Authenticated API responses are never cached (avoids leaking user data on
 *    a shared device).
 *
 * Bump CACHE_VERSION to force old caches to be discarded on the next visit.
 */
const CACHE_VERSION = 'v1'
const SHELL_CACHE = `wd-shell-${CACHE_VERSION}`
const ASSET_CACHE = `wd-assets-${CACHE_VERSION}`
const API_CACHE = `wd-api-${CACHE_VERSION}`
const KEEP = new Set([SHELL_CACHE, ASSET_CACHE, API_CACHE])

self.addEventListener('install', (event) => {
  // Pre-cache the app shell so the first offline launch has something to show.
  // We intentionally do NOT skipWaiting() here — an updated worker stays in the
  // "waiting" state until the user accepts the in-app "reload to update" prompt
  // (which posts SKIP_WAITING below). On first install there's no active worker,
  // so it activates immediately regardless.
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(['/'])).catch(() => {}),
  )
})

// The page asks the waiting worker to take over when the user clicks "Reload".
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static') ||
    /\.(?:js|css|woff2?|png|jpg|jpeg|svg|gif|ico|webp)$/.test(url.pathname) ||
    url.pathname.startsWith('/icon-') ||
    url.pathname === '/manifest.webmanifest'
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone())
      return res
    })
    .catch(() => cached)
  return cached || network
}

async function networkFirst(request, cacheName, { allowCache = true } = {}) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    if (allowCache && res && res.ok) cache.put(request, res.clone())
    return res
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw err
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // let the browser handle cross-origin

  // App navigations → network-first, fall back to cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () =>
        (await caches.match(request)) || (await caches.match('/')) || Response.error(),
      ),
    )
    return
  }

  // API requests
  if (url.pathname.startsWith('/api/')) {
    // Never cache authenticated responses.
    const authed = request.headers.has('authorization')
    event.respondWith(networkFirst(request, API_CACHE, { allowCache: !authed }))
    return
  }

  // Static assets → stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE))
    return
  }
})
