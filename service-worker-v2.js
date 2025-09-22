// sw-v5.js
const CACHE = 'flashcards-pwa-v5';
const ASSETS = [
  './',
  './index.html',
  './flashcards-app.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isCSV = url.pathname.endsWith('/flashcards.csv');

  if (isCSV) {
    e.respondWith(
      fetch(new Request(e.request, { cache: 'no-store' }))
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(r => {
        if (e.request.method === 'GET' && r.ok && r.type === 'basic') {
          caches.open(CACHE).then(c => c.put(e.request, r.clone())).catch(() => {});
        }
        return r;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
