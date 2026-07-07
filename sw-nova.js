// NovaPOS PRO — Service Worker v1.0
const CACHE = 'novapos-v1';
const ASSETS = ['./', './novapos-pro.html', './manifest-nova.json', './icon-nova-192.png', './icon-nova-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.allSettled(ASSETS.map(u => c.add(u).catch(()=>{}))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ok:false,error:'Sin conexión'}),{headers:{'Content-Type':'application/json'}})));
    return;
  }
  if (url.hostname.includes('fonts.google') || url.hostname.includes('fonts.gstatic')) {
    e.respondWith(caches.match(e.request).then(c => c || fetch(e.request).then(r => { const cl=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,cl)); return r; })));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached => {
    const net = fetch(e.request).then(r => { if(r&&r.status===200&&r.type!=='opaque'){const cl=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cl));} return r; }).catch(()=>cached);
    return cached || net;
  }));
});
self.addEventListener('message', e => { if(e.data==='skipWaiting') self.skipWaiting(); });
