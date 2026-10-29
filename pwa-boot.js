/* SNAP phone layer. Runs right after SNAP's own page header and before SNAP starts.
   SNAP itself (index.html) is not edited: this file only replaces the three things SNAP asks its host for
   (database, user id, downloads) and adds phone-shell details (safe areas, status bar, offline support).

   Database + user: window.claude.use('db' | 'user' | 'downloads')  ->  SnapLocalPlatform (data kept on this device, pre-filled from demo-data.json)
   Downloads:       browser download in a browser/PWA; native share sheet inside the Capacitor app. */
(function () {
  var cap = window.Capacitor, native = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  var plugins = (cap && cap.Plugins) || {};
  var downloads;
  try { downloads = native && plugins.Filesystem && plugins.Share ? SnapDownloads.createNative({ Filesystem: plugins.Filesystem, Share: plugins.Share }) : SnapDownloads.createWeb(); }
  catch (e) { downloads = SnapDownloads.createWeb(); }

  window.SnapPlatform = SnapLocalPlatform.create({ seedUrl: 'demo-data.json', extraUrl: 'local-accounts.json', versionUrl: 'version.json', downloads: downloads });
  window.claude = window.SnapPlatform;        // replaces the in-memory stand-in that the web page ships with

  /* safe areas (notch, home bar) and a calm status bar; no effect in a normal browser tab */
  try {
    /* an app screen, not a web page: no pinch zoom, no double-tap zoom, no zoom when a field is focused */
    var vp = document.querySelector('meta[name=viewport]');
    var LOCK = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
    if (vp) vp.content = LOCK; else { vp = document.createElement('meta'); vp.name = 'viewport'; vp.content = LOCK; document.head.appendChild(vp); }
    var st = document.createElement('style');
    st.textContent = 'html,body{touch-action:pan-x pan-y;-webkit-text-size-adjust:100%;text-size-adjust:100%}' +
      'body{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom)}' +
      /* "How SNAP Works" round buttons: wide enough that a word such as "Compensation" is never cut in two */
      '@media (max-width:780px){.hw-bubbles{grid-template-columns:repeat(auto-fill,minmax(98px,1fr))!important}.hw-bub b{overflow-wrap:normal!important;word-break:normal!important}}';
    document.head.appendChild(st);
    if (native && plugins.StatusBar) { plugins.StatusBar.setOverlaysWebView && plugins.StatusBar.setOverlaysWebView({ overlay: false }).catch(function () {}); }
    if (native && plugins.SplashScreen) window.addEventListener('load', function () { plugins.SplashScreen.hide().catch(function () {}); });
  } catch (e) { /* cosmetic only */ }

  /* iPhone ignores user-scalable=no, so cancel its pinch events too; also trackpad pinch (ctrl + wheel) on a desktop browser */
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) { document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1 && e.cancelable) e.preventDefault(); }, { passive: false });
  document.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

  if (!native && 'serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
