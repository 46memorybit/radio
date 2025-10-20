// App Shell キャッシュ（バージョン更新で古いJSを確実に捨てる）
const CACHE_NAME = 'reqpwa-v3';
const CORE = [
  './',
  './index.html',
  './app.js?v=3',
  './db.js?v=3',
  './manifest.webmanifest'
  // 必要ならアイコンも: './assets/icon-192.png', './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE_NAME);
    await c.addAll(CORE);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k === CACHE_NAME ? null : caches.delete(k)));
    self.clients.claim();
  })());
});

// GETのみキャッシュ。クロスオリジンiframeはCORSでput失敗する事があるのでtry/catch。
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      try { const c = await caches.open(CACHE_NAME); c.put(req, res.clone()); } catch {}
      return res;
    } catch {
      return new Response('オフラインです。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
