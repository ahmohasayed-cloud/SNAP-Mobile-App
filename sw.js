/* SNAP phone app — offline support. Network first (a new version shows up straight away); the saved copy is used only when offline.
   The cache name carries the build id, so a new build removes every older cache. */
const CACHE = 'snap-v76-3992091f-62a18698-69bce3';
const CORE = ["./", "index.html", "manifest.webmanifest", "pwa-boot.js", "snap-glide.js", "snap-login.js", "local-accounts.json", "snap-downloads.js", "snap-platform-local.js", "version.json", "demo-data.json", "jspdf.umd.min.js", "pptxgen.bundle.js", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
const LIBS = { '/jspdf.umd.min.js': 'jspdf.umd.min.js', '/pptxgen.bundle.js': 'pptxgen.bundle.js' };   // SNAP asks for these from the site root; on a sub-folder host they live next to index.html
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  let req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (LIBS[url.pathname] && new URL(self.registration.scope).pathname !== '/') req = new Request(new URL(LIBS[url.pathname], self.registration.scope).href);
  e.respondWith(fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
