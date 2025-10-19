/* service-worker.js */
const CACHE = 'reqpwa-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/app.js',
  './js/db.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (e)=>{
  e.waitUntil((async()=>{
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e)=>{
  e.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith((async()=>{
      const c = await caches.open(CACHE);
      const hit = await c.match(e.request);
      if (hit) return hit;
      try {
        const res = await fetch(e.request);
        if (e.request.method==='GET' && res.status===200) c.put(e.request, res.clone());
        return res;
      } catch {
        return hit || new Response('オフラインで取得できませんでした。', { status: 503 });
      }
    })());
  }
});
