// sw-v6.js — no CSV precache; network-first for ANY *.csv
const CACHE = 'flashcards-pwa-v6';
const ASSETS = [
  './',
  './index.html',
  './index_csv.html',
  './flashcards-app.js',
  './manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Match ANY CSV filename, regardless of name or path
  const isCSV = /\.csv$/i.test(url.pathname);

  if (isCSV) {
    // Network-first, and don't store in HTTP cache
    e.respondWith(
      fetch(new Request(e.request, { cache: 'no-store' }))
        .then(r => {
          // Optional: don't cache CSV at all; just return it
          // If you do want an offline fallback, uncomment the 3 lines below:
          // const copy = r.clone();
          // caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          return r;
        })
        .catch(() => caches.match(e.request)) // fallback if previously cached
    );
    return;
  }

  // Default: cache-first, then network (fine for static assets)
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
