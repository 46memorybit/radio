const CACHE_NAME = 'reqpwa-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './db.js',
  './manifest.webmanifest'
  // 画像やアイコンがあればここに追記（例: './assets/icon-192.png', './assets/icon-512.png'）
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => k === CACHE_NAME ? null : caches.delete(k)));
    self.clients.claim();
  })());
});

// App Shell 優先
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // POST等は素通し
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      // クロスオリジンの iframe 等は CORS 制約で失敗することがあるため try/catch
      try { cache.put(req, res.clone()); } catch {}
      return res;
    } catch {
      // オフラインフォールバック（必要なら HTML を返す）
      return new Response('オフラインです。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
