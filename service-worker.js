
const CACHE='flashcards-pwa-mobile-v1';
const ASSETS=['./','./index.html','./index_csv.html','./flashcards-app.js','./manifest.json','./flashcards.csv'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(cached=>{const fetched=fetch(e.request).then(r=>{try{if(e.request.method==='GET'&&r.status===200&&r.type==='basic'){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}}catch{}return r;}).catch(()=>cached);return cached||fetched;}));});
