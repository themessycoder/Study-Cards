// service-worker.js — TEMPORARY CLEANUP SW
self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', async (e) => {
  // wipe all caches
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  // unregister this SW
  await self.registration.unregister();
  // reload all controlled clients
  const clientsList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of clientsList) {
    client.navigate(client.url);
  }
});
self.addEventListener('fetch', (e) => {
  // do nothing: let network handle it
});
