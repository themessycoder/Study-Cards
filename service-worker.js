
const CACHE = 'flashcards-pwa-v1';
const ASSETS = [
  './',
  './index.html',
  './index_csv.html',
  './flashcards-app.js',
  './manifest.json',
  './flashcards.csv'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(networkRes => {
        try {
          if (e.request.method === 'GET' && networkRes.status === 200 && networkRes.type === 'basic') {
            const copy = networkRes.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, copy));
          }
        } catch {}
        return networkRes;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
