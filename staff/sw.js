// Service worker: aplikacija se odpre tudi brez povezave.
// Strategija: najprej omrežje (sveže različice), ob napaki predpomnilnik.
const CACHE = 'deliz-staff-v2';
const SHELL = [
  './', './index.html', './app.js', './ui.js', './staff.css', './manifest.webmanifest',
  './icons/icon-192.png', './icons/apple-touch-icon.png',
  '../shared/config.js', '../shared/availability.js', '../shared/ui/tokens.css', '../shared/ui/deliz-logo.png',
  '../shared/data/index.js', '../shared/data/demo-adapter.js', '../shared/data/appsscript-adapter.js',
  '../shared/data/outbox.js', '../shared/data/seed.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
