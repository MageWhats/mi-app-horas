// Service worker de la app web instalable (PWA).
// Guarda la "cáscara" de la app para que abra al instante y sin conexión. Los datos NO pasan por aquí:
// las horas siempre se piden a Supabase (otro dominio, que este service worker no intercepta).
const CACHE = 'horas-v1';
const PRECARGA = ['/', '/login', '/manifest.webmanifest', '/brand/icon-192.png', '/brand/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Uno por uno: si alguno falla, los demás se guardan igual
      .then((cache) => Promise.allSettled(PRECARGA.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, Cloudflare, etc.: directo a la red

  // Páginas: primero la red (siempre la versión más reciente); sin conexión, la copia guardada
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copia));
          return respuesta;
        })
        .catch(() => caches.match(request).then((guardada) => guardada || caches.match('/'))),
    );
    return;
  }

  // Código con hash e íconos: no cambian nunca, se sirven desde la copia guardada
  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/brand/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((guardada) => guardada || fetch(request).then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copia));
        }
        return respuesta;
      })),
    );
  }
});
