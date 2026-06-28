// FarmaPos PRO — Service Worker v3.0
const CACHE = 'farmapos-v3';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// INSTALL
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(ASSETS.map(url => cache.add(url).catch(()=>{})))
    ).then(() => self.skipWaiting())
  );
});

// ACTIVATE — limpiar cachés viejas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// FETCH
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Llamadas a Apps Script/Sheets — siempre red, nunca caché
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ok:false,error:'Sin conexión'}),
          {headers:{'Content-Type':'application/json'}})
      )
    );
    return;
  }

  // Fuentes Google — cache first
  if (url.hostname.includes('fonts.google') || url.hostname.includes('fonts.gstatic')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached ||
        fetch(e.request).then(r => {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return r;
        })
      )
    );
    return;
  }

  // Todo lo demás — cache first, red como fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(r => {
        if (r && r.status === 200 && r.type !== 'opaque') {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return r;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
