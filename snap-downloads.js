/* ============================================================================
   SNAP platform adapter — the 'downloads' capability: save({ filename, data }) -> { status:'saved' }.

   SNAP calls this for CSV, JSON backups, PDF and PowerPoint exports. `data` is a string (CSV / JSON) or binary
   (ArrayBuffer, typed array, array of byte values, or Blob).

     SnapDownloads.createWeb()                         browser / PWA: normal file download
     SnapDownloads.createNative({ Filesystem, Share }) Capacitor app: writes a temporary file and opens the system share sheet
                                                       (Save to Files, Drive, email, WhatsApp, print...)
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SnapDownloads = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIME = {
    csv: 'text/csv;charset=utf-8', json: 'application/json;charset=utf-8', txt: 'text/plain;charset=utf-8',
    pdf: 'application/pdf', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', html: 'text/html;charset=utf-8'
  };
  function mimeFor(filename) { var m = /\.([a-z0-9]+)$/i.exec(filename || ''); return (m && MIME[m[1].toLowerCase()]) || 'application/octet-stream'; }

  /** Stops a file name from escaping a folder or confusing the OS. */
  function safeName(name) {
    var n = String(name || 'download').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^\.+/, '').trim();
    return (n || 'download').slice(0, 120);
  }

  function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) return new Uint8Array(data);
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (Array.isArray(data)) return Uint8Array.from(data);
    return null;
  }

  function toBase64(bytes) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return (typeof btoa === 'function' ? btoa : function (x) { return Buffer.from(x, 'binary').toString('base64'); })(s);
  }

  function createWeb(env) {
    env = env || {};
    var win = env.window || (typeof window !== 'undefined' ? window : null);
    return {
      save: async function (req) {
        if (!win) throw new Error('No browser window');
        var filename = safeName(req && req.filename), data = req && req.data;
        var bytes = toBytes(data);
        var part = (typeof Blob !== 'undefined' && data instanceof Blob) ? data : (bytes || String(data == null ? '' : data));
        var blob = new (env.Blob || win.Blob)([part], { type: mimeFor(filename) });
        var url = (env.URL || win.URL).createObjectURL(blob);
        var a = win.document.createElement('a');
        a.href = url; a.download = filename; a.style.display = 'none';
        win.document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { try { (env.URL || win.URL).revokeObjectURL(url); } catch (e) { /* ignore */ } }, 30000);
        return { status: 'saved' };
      }
    };
  }

  function createNative(plugins) {
    var FS = plugins && plugins.Filesystem, Share = plugins && plugins.Share;
    if (!FS || !Share) throw new Error('createNative needs { Filesystem, Share } from Capacitor');
    var dir = plugins.directory || 'CACHE';
    return {
      save: async function (req) {
        var filename = safeName(req && req.filename), data = req && req.data;
        var bytes = toBytes(data), wrote;
        if (bytes) wrote = await FS.writeFile({ path: filename, data: toBase64(bytes), directory: dir });
        else if (typeof Blob !== 'undefined' && data instanceof Blob) wrote = await FS.writeFile({ path: filename, data: toBase64(new Uint8Array(await data.arrayBuffer())), directory: dir });
        else wrote = await FS.writeFile({ path: filename, data: String(data == null ? '' : data), directory: dir, encoding: 'utf8' });
        await Share.share({ title: filename, url: wrote.uri, dialogTitle: filename });
        return { status: 'saved' };
      }
    };
  }

  return { createWeb: createWeb, createNative: createNative, _safeName: safeName, _mimeFor: mimeFor, _toBase64: toBase64, _toBytes: toBytes };
});
