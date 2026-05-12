const CACHE_NAME = 'vinylvault-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Special+Elite&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap'
];

// ── INSTALL: cache static assets ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Failed to cache some assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: clean up old caches ─────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: network-first for API, cache-first for static ──────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // iTunes API — network only (don't cache search results)
  if (url.hostname.includes('itunes.apple.com')) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response(JSON.stringify({ resultCount: 0, results: [] }), {
        headers: { 'Content-Type': 'application/json' }
      })
    ));
    return;
  }

  // Image assets (album art) — cache as they load
  if (url.hostname.includes('mzstatic.com') || url.pathname.match(/\.(png|jpg|jpeg|webp|svg)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Static assets — cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
