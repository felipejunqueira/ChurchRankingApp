const CACHE_NAME = 'pontos-es-v31';

// Core files only — fonts load from network (or cache if already fetched)
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/base.css',
  './css/components.css',
  './css/ranking.css',
  './js/data.js',
  './js/db.js',
  './js/ui.js',
  './js/app.js'
];

const STATIC_ASSET_RE = /\.(?:png|svg|ico|webp)$/i;
const FONT_ORIGINS = new Set([
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
]);

// Install: force fresh fetch into new cache version
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(
        CORE_ASSETS.map((asset) => new Request(asset, { cache: 'reload' }))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for HTML/JS/CSS/manifest so updates apply on first load;
// cache-first for static icons; never intercept Supabase API calls.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.origin === location.origin) {
    if (STATIC_ASSET_RE.test(url.pathname)) {
      event.respondWith(
        caches.open(CACHE_NAME).then((cache) =>
          cache.match(event.request).then((cached) => {
            const networkFetch = fetch(event.request).then((response) => {
              if (response && response.ok) {
                cache.put(event.request, response.clone());
              }
              return response;
            }).catch(() => cached);
            return cached || networkFetch;
          })
        )
      );
      return;
    }

    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(event.request, { cache: 'no-cache' })
          .then((response) => {
            if (response && response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(async () => {
            const cached = await cache.match(event.request);
            if (cached) return cached;
            if (event.request.mode === 'navigate') {
              return cache.match('./index.html');
            }
            return Response.error();
          })
      )
    );
    return;
  }

  // Only cache external font stylesheets/files; never cache Supabase API responses
  if (FONT_ORIGINS.has(url.origin)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(event.request)
          .then((response) => {
            if (response && response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => cache.match(event.request))
      )
    );
  }
});
