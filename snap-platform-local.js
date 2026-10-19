/* ============================================================================
   SNAP platform adapter — LOCAL (stand-alone) implementation, for the installable test app (PWA).

   A Firestore-shaped database that lives ON THIS DEVICE only (IndexedDB), pre-filled from a seed file (the fictional demo company).
   No server, no account. Nothing leaves the phone. Meant for testing SNAP's screens and flows with demo data;
   the real app uses snap-platform-firebase.js instead (same contract: docs/PLATFORM-CONTRACT.md).

     window.SnapPlatform = SnapLocalPlatform.create({
       seedUrl:   'seed/demo-seed.json',        // { version, collections: { name: { id: doc } } }
       versionUrl:'seed/version.json',          // small file { version }: when it changes, the seed is loaded again
       downloads: SnapDownloads.createWeb()
     });

   Reset to the original demo data: open the app link with ?reset=1 at the end.
   Behaviour matches the claude.ai database: update() creates a missing document; exists is a property.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SnapLocalPlatform = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function create(opts) {
    opts = opts || {};
    var idbFactory = opts.indexedDB || (typeof indexedDB !== 'undefined' ? indexedDB : null);
    var dbName = opts.dbName || 'snap-local';
    var store = {}, listeners = {}, conn = null, pending = [], flushing = false, ready = null;

    var coll = function (c) { return store[c] || (store[c] = new Map()); };
    var clone = function (v) { return JSON.parse(JSON.stringify(v)); };
    var emit = function (c) { (listeners[c] || new Set()).forEach(function (fn) { fn(); }); };

    /* ---------- IndexedDB (best effort: if it is not available the data simply lives until the page closes) ---------- */
    function idbOpen() {
      return new Promise(function (resolve) {
        if (!idbFactory) return resolve(null);
        try {
          var r = idbFactory.open(dbName, 1);
          r.onupgradeneeded = function () { r.result.createObjectStore('docs', { keyPath: 'k' }); r.result.createObjectStore('meta', { keyPath: 'k' }); };
          r.onsuccess = function () { resolve(r.result); };
          r.onerror = function () { resolve(null); };
          r.onblocked = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    }
    function tx(stores, mode, work) {
      return new Promise(function (resolve, reject) {
        if (!conn) return resolve();
        var t = conn.transaction(stores, mode);
        var out = work(t);
        t.oncomplete = function () { resolve(out); };
        t.onerror = t.onabort = function () { reject(t.error); };
      });
    }
    function readAll(storeName) {
      return new Promise(function (resolve) {
        if (!conn) return resolve([]);
        var req = conn.transaction([storeName], 'readonly').objectStore(storeName).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { resolve([]); };
      });
    }
    function persist(op) {
      if (!conn) return;
      pending.push(op);
      if (flushing) return;
      flushing = true;
      setTimeout(function () {
        var batch = pending; pending = []; flushing = false;
        tx(['docs'], 'readwrite', function (t) {
          var s = t.objectStore('docs');
          batch.forEach(function (o) { if (o.del) s.delete(o.c + '/' + o.id); else s.put({ k: o.c + '/' + o.id, c: o.c, id: o.id, d: o.d }); });
        }).catch(function () { /* storage full or blocked: keep working in memory */ });
      }, 0);
    }
    function loadSeed(seed) {
      Object.keys(store).forEach(function (c) { delete store[c]; });
      var cols = seed.collections || {}, rows = [];
      Object.keys(cols).forEach(function (c) {
        store[c] = new Map();
        Object.keys(cols[c]).forEach(function (id) { store[c].set(id, cols[c][id]); rows.push({ k: c + '/' + id, c: c, id: id, d: cols[c][id] }); });
      });
      return tx(['docs', 'meta'], 'readwrite', function (t) {
        t.objectStore('docs').clear();
        rows.forEach(function (r) { t.objectStore('docs').put(r); });
        t.objectStore('meta').put({ k: 'seedVersion', v: seed.version || '' });
      }).catch(function () { /* in-memory only */ });
    }

    async function fetchJson(url, noCache) {
      var r = await fetch(url, noCache ? { cache: 'no-cache' } : undefined);
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return r.json();
    }

    async function init() {
      conn = await idbOpen();
      var wantReset = opts.reset === true || (typeof location !== 'undefined' && /[?&]reset=1(&|$)/.test(location.search || ''));
      var rows = wantReset ? [] : await readAll('docs');
      var meta = wantReset ? [] : await readAll('meta');
      var have = (meta.filter(function (m) { return m.k === 'seedVersion'; })[0] || {}).v;
      rows.forEach(function (r) { coll(r.c).set(r.id, r.d); });
      var needSeed = rows.length === 0;
      if (!needSeed && opts.versionUrl) {
        try { var v = await fetchJson(opts.versionUrl, true); if (v && v.version && v.version !== have) needSeed = true; } catch (e) { /* offline: keep what is here */ }
      }
      if (needSeed && opts.seedUrl) {
        await loadSeed(await fetchJson(opts.seedUrl, true));
      }
      if (wantReset && typeof history !== 'undefined' && history.replaceState) {
        try { history.replaceState(null, '', location.pathname + (location.search || '').replace(/([?&])reset=1&?/, '$1').replace(/[?&]$/, '') + (location.hash || '')); } catch (e) { /* ignore */ }
      }
    }

    /* ---------- the Firestore-shaped database SNAP talks to ---------- */
    var n = 0;
    function docRef(c, id) {
      return {
        id: id,
        get: async function () { var has = coll(c).has(id); return { id: id, exists: has, data: function () { return has ? clone(coll(c).get(id)) : undefined; } }; },
        set: async function (d) { var v = clone(d); coll(c).set(id, v); persist({ c: c, id: id, d: v }); emit(c); },
        update: async function (p) { var cur = coll(c).get(id) || {}, v = Object.assign({}, cur, clone(p)); coll(c).set(id, v); persist({ c: c, id: id, d: v }); emit(c); },
        delete: async function () { coll(c).delete(id); persist({ c: c, id: id, del: true }); emit(c); }
      };
    }
    var dbCap = {
      collection: function (c) {
        return {
          add: async function (d) { var id = 'l' + Date.now().toString(36) + (++n).toString(36) + Math.random().toString(36).slice(2, 6); var v = clone(d); coll(c).set(id, v); persist({ c: c, id: id, d: v }); emit(c); return { id: id }; },
          doc: function (id) { return docRef(c, id); },
          onSnapshot: function (ok) {
            var set = (listeners[c] = listeners[c] || new Set());
            var fn = function () { ok({ docs: Array.from(coll(c).entries()).map(function (e) { return { id: e[0], data: function () { return clone(e[1]); } }; }) }); };
            set.add(fn); setTimeout(fn, 0);
            return function () { set.delete(fn); };
          }
        };
      },
      doc: function (path) { var i = String(path).indexOf('/'); return docRef(path.slice(0, i), path.slice(i + 1)); }
    };

    /* a stable id for this device's viewer (used for per-person records) */
    function deviceUid() {
      try {
        var k = 'snap-local-uid', v = localStorage.getItem(k);
        if (!v) { v = 'u_' + Array.from(crypto.getRandomValues(new Uint8Array(10))).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); localStorage.setItem(k, v); }
        return v;
      } catch (e) { return opts.fallbackUid || 'u_local_device_000000'; }
    }
    var userCap = { id: deviceUid };

    return {
      use: async function (name) {
        if (!ready) ready = init();
        await ready;
        if (name === 'db') return dbCap;
        if (name === 'user') return userCap;
        if (name === 'downloads') return opts.downloads || null;
        return null;
      },
      _store: store
    };
  }

  return { create: create };
});
