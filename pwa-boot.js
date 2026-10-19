/* Runs before SNAP starts: gives it the on-device test database (pre-filled with the fictional demo company) and registers offline support. */
window.SnapPlatform = SnapLocalPlatform.create({
  seedUrl: 'demo-seed.json',
  versionUrl: 'version.json',
  downloads: SnapDownloads.createWeb()
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
