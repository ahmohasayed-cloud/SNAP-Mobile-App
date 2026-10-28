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

  window.SnapPlatform = SnapLocalPlatform.create({ seedUrl: 'demo-data.json', versionUrl: 'version.json', downloads: downloads });
  window.claude = window.SnapPlatform;        // replaces the in-memory stand-in that the web page ships with

  /* safe areas (notch, home bar) and a calm status bar; no effect in a normal browser tab */
  try {
    var vp = document.querySelector('meta[name=viewport]');
    if (vp && !/viewport-fit/.test(vp.content)) vp.content += ', viewport-fit=cover';
    var st = document.createElement('style');
    st.textContent = 'body{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom)}';
    document.head.appendChild(st);
    if (native && plugins.StatusBar) { plugins.StatusBar.setOverlaysWebView && plugins.StatusBar.setOverlaysWebView({ overlay: false }).catch(function () {}); }
    if (native && plugins.SplashScreen) window.addEventListener('load', function () { plugins.SplashScreen.hide().catch(function () {}); });
  } catch (e) { /* cosmetic only */ }

  if (!native && 'serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
