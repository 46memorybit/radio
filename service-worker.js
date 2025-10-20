// service-worker.js
const CACHE_NAME = 'reqpwa-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './db.js',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  // same-origin は cache-first、cross-origin は network-first（iframe先は基本ネットから）
  if (new URL(request.url).origin === self.location.origin) {
    e.respondWith(
      caches.match(request).then((res) => res || fetch(request))
    );
  } else {
    e.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
  }
});
