// service-worker.js
const CACHE_NAME = 'buscador-pro-v1.0';
const FILES = [
  './',
  './index.html',
  './styles/main.css',
  './scripts/app.js',
  './scripts/storage.js',
  './scripts/search-engine.js',
  './scripts/ui-manager.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(cached => {
      // Siempre intentar obtener de red primero, pero servir cache si no hay conexión
      return fetch(req).then(response => {
        // Si la respuesta es válida, actualizar cache
        if (response.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(req, response));
        }
        return response.clone();
      }).catch(() => {
        // Si falla la red, servir desde cache
        return cached || new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});