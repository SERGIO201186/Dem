// FarmaPos PRO — Service Worker v2.0
// Permite que la app funcione sin internet después de la primera carga

const CACHE_NAME = 'farmapos-v2';

// Archivos que se guardan en caché para funcionar offline
const ASSETS = [
  './farmapos-pro.html',
  './manifest.json',
  // Fuentes de Google (se cachean en primera visita)
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap',
];

// ── INSTALL: guardar archivos en caché ────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cacheando assets de FarmaPos');
      // Cachear lo que se pueda, ignorar errores en recursos externos
      return Promise.allSettled(
        ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] No se pudo cachear:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar cachés viejas ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Eliminando caché vieja:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia Cache-First para assets, Network-First para Sheets ──────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Las llamadas a Google Apps Script SIEMPRE van a la red (no cachear datos)
  if (url.hostname === 'script.google.com' ||
      url.hostname === 'sheets.googleapis.com') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ ok: false, error: 'Sin conexión a internet' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Las fuentes de Google: Cache-First
  if (url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => cached || new Response('', { status: 408 }));
      })
    );
    return;
  }

  // El archivo principal HTML y demás assets: Cache-First con fallback a red
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Actualizar en background (Stale-While-Revalidate)
        fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
          }
        }).catch(() => {});
        return cached;
      }
      // No está en caché: ir a la red
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() =>
        // Offline y no hay caché: mostrar mensaje
        new Response('<h2 style="font-family:sans-serif;text-align:center;margin-top:40px">Sin conexión — FarmaPos no está disponible offline todavía. Ábrelo una vez con internet.</h2>', {
          headers: { 'Content-Type': 'text/html' }
        })
      );
    })
  );
});

// ── MENSAJE: forzar actualización desde la app ────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
