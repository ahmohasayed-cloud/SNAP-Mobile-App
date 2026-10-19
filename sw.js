/* SNAP test app — offline support. Network first (so a new version shows up straight away), cached copy when offline. */
const CACHE = 'snap-pwa-528978ece2-8d0478c4';
const CORE = ["./", "index.html", "manifest.webmanifest", "pwa-boot.js", "platform/snap-downloads.js", "platform/snap-platform-local.js", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "seed/version.json", "seed/demo-seed.json", "vendor/jspdf.umd.min.js", "vendor/pptxgen.bundle.js"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k.startsWith('snap-pwa-')).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
