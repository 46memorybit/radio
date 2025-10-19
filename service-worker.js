/* service-worker.js */
const CACHE_NAME = 'gensen-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/app.js',
  './js/db.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // 同一オリジンのみキャッシュファースト
  if (new URL(req.url).origin === self.location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.status === 200 && req.method === 'GET') {
          cache.put(req, res.clone());
        }
        return res;
      } catch (_) {
        return cached || new Response('オフラインで取得できませんでした。', { status: 503 });
      }
    })());
  }
});
