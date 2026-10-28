/* SNAP phone layer: "glass glide" for the headline menu (Overview, Support, Workforce, ...).
   Touch hold + slide left/right on the menu bar: a clear-glass lens follows the finger, the headline under it grows and its name
   shows below; lift the finger to go there. A quick tap still works exactly as in SNAP (opens that headline's list).
   SNAP's own page is not edited: this file only listens to touches on SNAP's existing menu bar (#topNavList) and presses SNAP's own buttons. */
(function () {
  'use strict';
  var coarse = false;
  try { coarse = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window; } catch (e) {}
  if (!coarse) return;                                   // mouse-only computers keep the normal menu

  var HOLD_MS = 200, MOVE_PX = 9, TAB = '#topNavList .group-tab';
  var lens, bubble, hint, st = null, remembered = {}, suppressUntil = 0, lastIdx = -1;

  /* ---- styles ---- */
  var css = document.createElement('style');
  css.textContent =
    '#topNavList{touch-action:none;-webkit-user-select:none;user-select:none}' +
    '#topNavList .group-tab{-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;transition:transform .22s cubic-bezier(.2,.9,.3,1.25),background .15s ease,color .15s ease}' +
    '#topNavList .group-tab.snap-glide-on{transform:scale(1.22)!important;z-index:2;color:#5B2C91!important}' +
    '#topNavList .group-tab.snap-glide-on svg:first-child{color:#5B2C91!important;opacity:1!important}' +
    '.snap-lens,.snap-bubble,.snap-hint{position:fixed;z-index:2147483000;pointer-events:none;-webkit-backdrop-filter:blur(14px) saturate(1.8);backdrop-filter:blur(14px) saturate(1.8)}' +
    '.snap-lens{-webkit-backdrop-filter:saturate(1.7) brightness(1.05);backdrop-filter:saturate(1.7) brightness(1.05)}' +
    '.snap-lens{left:0;top:0;border-radius:999px;opacity:0;transform:translate3d(0,0,0) scale(.7);' +
    'background:linear-gradient(145deg,rgba(255,255,255,.34),rgba(255,255,255,.07));border:1px solid rgba(255,255,255,.9);' +
    'box-shadow:0 10px 28px rgba(51,42,68,.26),inset 0 1px 0 rgba(255,255,255,.95),inset 0 -10px 18px rgba(91,44,145,.10);' +
    'transition:opacity .16s ease,width .2s cubic-bezier(.2,.9,.3,1.2),height .2s ease}' +
    '.snap-lens.on{opacity:1}' +
    '.snap-lens.drag{transition:opacity .16s ease,width .2s cubic-bezier(.2,.9,.3,1.2),height .2s ease}' +
    '.snap-lens.settle{transition:opacity .16s ease,transform .18s cubic-bezier(.2,.9,.3,1.2),width .18s ease}' +
    '.snap-bubble{left:0;top:0;padding:8px 16px;border-radius:16px;font:600 14px/1.25 system-ui,-apple-system,"Segoe UI",sans-serif;color:#2b2140;text-align:center;opacity:0;white-space:nowrap;' +
    'background:linear-gradient(145deg,rgba(255,255,255,.95),rgba(255,255,255,.84));border:1px solid rgba(255,255,255,.95);box-shadow:0 10px 26px rgba(51,42,68,.22);' +
    'transition:opacity .16s ease}' +
    '.snap-bubble.on{opacity:1}' +
    '.snap-bubble small{display:block;font-weight:500;font-size:11.5px;color:#5b2c91;opacity:.85;margin-top:1px}' +
    '.snap-hint{left:50%;bottom:calc(76px + env(safe-area-inset-bottom));transform:translate(-50%,12px);max-width:86vw;padding:10px 16px;border-radius:999px;font:500 13px/1.3 system-ui,-apple-system,sans-serif;color:#2b2140;text-align:center;opacity:0;' +
    'background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(255,255,255,.88));border:1px solid rgba(255,255,255,.95);box-shadow:0 10px 26px rgba(51,42,68,.22);transition:opacity .3s ease,transform .3s ease}' +
    '.snap-hint.on{opacity:1;transform:translate(-50%,0)}' +
    '@media (prefers-reduced-motion:reduce){#topNavList .group-tab,.snap-lens,.snap-hint{transition:none!important}}';
  document.head.appendChild(css);

  function el(cls) { var d = document.createElement('div'); d.className = cls; document.body.appendChild(d); return d; }
  function tabs() { return Array.prototype.slice.call(document.querySelectorAll(TAB)); }
  function label(t) { var s = t.querySelector('span'); return ((s ? s.textContent : t.textContent) || '').trim(); }

  /* ---- where a headline leads: the page last used in it, else Dashboard, else its first page ---- */
  function panelOf(t) { var w = t.closest('.nav-dropdown'); return w ? w.querySelector('.nav-dropdown-panel') : null; }
  function itemsOf(t) { var p = panelOf(t); return p ? Array.prototype.slice.call(p.querySelectorAll('.dropdown-item')) : []; }
  function routeOf(btn) { return btn.getAttribute('data-route'); }
  function destination(t) {
    if (t.getAttribute('data-direct')) return { btn: t, name: label(t), same: t.classList.contains('active') };
    var its = itemsOf(t); if (!its.length) return null;
    var pick = null, key = remembered[label(t)];
    if (key) its.forEach(function (b) { if (routeOf(b) === key) pick = b; });
    if (!pick) its.forEach(function (b) { if (!pick && routeOf(b) === 'dashboard') pick = b; });
    var activeHere = its.filter(function (b) { return b.classList.contains('active'); })[0];
    if (!pick) pick = its[0];
    return { btn: pick, name: (pick.querySelector('span') || pick).textContent.trim(), same: !!activeHere };
  }
  function remember() {
    tabs().forEach(function (t) { itemsOf(t).forEach(function (b) { if (b.classList.contains('active')) remembered[label(t)] = routeOf(b); }); });
  }

  /* ---- gesture ---- */
  function nearest(x) {
    var best = null, bd = 1e9;
    tabs().forEach(function (t, i) { var r = t.getBoundingClientRect(), d = Math.abs(x - (r.left + r.width / 2)); if (d < bd) { bd = d; best = { t: t, i: i, r: r }; } });
    return best;
  }
  function closePanels() { Array.prototype.forEach.call(document.querySelectorAll('.nav-dropdown-panel.open'), function (p) { p.classList.remove('open'); }); }
  function buzz() { try { navigator.vibrate && navigator.vibrate(7); } catch (e) {} try { var H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics; H && H.selectionChanged && H.selectionChanged(); } catch (e) {} }

  function place(x, snap) {
    var n = nearest(x); if (!n) return;
    var navR = document.getElementById('topNavList').getBoundingClientRect();
    var w = Math.max(n.r.width + 14, 46), h = Math.max(navR.height - 8, 34);
    var cx = snap ? n.r.left + n.r.width / 2 : Math.min(Math.max(x, navR.left + w / 2), navR.right - w / 2);
    lens.style.width = w + 'px'; lens.style.height = h + 'px';
    lens.style.transform = 'translate3d(' + (cx - w / 2) + 'px,' + (navR.top + (navR.height - h) / 2) + 'px,0) scale(1)';
    if (n.i !== lastIdx) {
      tabs().forEach(function (t) { t.classList.remove('snap-glide-on'); }); n.t.classList.add('snap-glide-on');
      var d = destination(n.t);
      bubble.innerHTML = '';
      var b = document.createElement('b'); b.textContent = label(n.t); b.style.fontWeight = '700'; bubble.appendChild(b);
      if (d && d.name && d.name !== label(n.t)) { var s = document.createElement('small'); s.textContent = d.name; bubble.appendChild(s); }
      lastIdx = n.i; if (st && st.active) buzz();
    }
    var bw = bubble.offsetWidth || 120, bx = Math.min(Math.max(n.r.left + n.r.width / 2 - bw / 2, 8), window.innerWidth - bw - 8);
    bubble.style.transform = 'translate3d(' + bx + 'px,' + (navR.bottom + 12) + 'px,0)';
    st.cur = n;
  }

  function begin() {
    if (!st || st.active) return;
    st.active = true; closePanels(); lastIdx = -1;
    lens = lens || el('snap-lens'); bubble = bubble || el('snap-bubble');
    lens.classList.remove('settle'); lens.classList.add('on', 'drag'); bubble.classList.add('on');
    place(st.x, false); buzz();
  }
  function finish(go) {
    var s = st;
    window.removeEventListener('pointermove', onMove, true); window.removeEventListener('pointerup', onUp, true); window.removeEventListener('pointercancel', onCancel, true);
    clearTimeout(s.timer);
    if (!s.active) { st = null; return; }
    suppressUntil = Date.now() + 450;                                        // the finger lifting must not also count as a tap
    var n = s.cur, dest = go && n ? destination(n.t) : null;
    if (n && go) { lens.classList.remove('drag'); lens.classList.add('settle'); place(n.r.left + n.r.width / 2, true); }   // glass settles on the chosen headline
    st = null;
    setTimeout(function () {
      lens.classList.remove('on'); bubble.classList.remove('on');
      tabs().forEach(function (t) { t.classList.remove('snap-glide-on'); });
      if (!dest) return;
      suppressUntil = 0;
      if (dest.same && !n.t.getAttribute('data-direct')) n.t.click();       // already in this headline: open its list
      else dest.btn.click();                                                 // SNAP's own button does the navigation
    }, go ? 170 : 0);
  }
  function onMove(e) {
    if (!st || e.pointerId !== st.id) return;
    st.x = e.clientX;
    if (!st.active) {
      var dx = e.clientX - st.x0, dy = e.clientY - st.y0;
      if (Math.abs(dx) > MOVE_PX && Math.abs(dx) >= Math.abs(dy)) begin();
      else if (Math.abs(dy) > 22) { clearTimeout(st.timer); st.dead = true; }
      return;
    }
    place(e.clientX, false);
  }
  function onUp(e) { if (st && e.pointerId === st.id) finish(true); }
  function onCancel(e) { if (st && e.pointerId === st.id) finish(false); }

  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    var nav = e.target.closest && e.target.closest('#topNavList');
    if (!nav || e.target.closest('.nav-dropdown-panel') || st) return;
    remember();
    st = { id: e.pointerId, x: e.clientX, x0: e.clientX, y0: e.clientY, active: false, cur: null };
    st.timer = setTimeout(function () { if (st && !st.dead) begin(); }, HOLD_MS);
    window.addEventListener('pointermove', onMove, true); window.addEventListener('pointerup', onUp, true); window.addEventListener('pointercancel', onCancel, true);
  }, true);

  /* a slide that ends on the tab it started on must not also count as a tap */
  document.addEventListener('click', function (e) {
    if (Date.now() < suppressUntil && e.target.closest && e.target.closest('#topNavList')) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  /* ---- one-time hint ---- */
  var TXT = { en: 'Hold the menu bar and slide to switch', ar: 'اضغط مطولاً على شريط القائمة ثم اسحب للتبديل', fr: 'Maintenez la barre de menu et glissez pour changer' };
  function maybeHint() {
    var seen = false; try { seen = localStorage.getItem('snap-glide-hint') === '1'; } catch (e) {}
    if (seen || !document.querySelector(TAB)) return false;
    var ls = document.getElementById('loadscreen'); if (ls && ls.style.display !== 'none') return false;
    var lang = (document.documentElement.lang || 'en').slice(0, 2);
    hint = hint || el('snap-hint'); hint.textContent = TXT[lang] || TXT.en;
    setTimeout(function () { hint.classList.add('on'); }, 600);
    setTimeout(function () { hint.classList.remove('on'); }, 5200);
    try { localStorage.setItem('snap-glide-hint', '1'); } catch (e) {}
    return true;
  }
  var tries = 0, iv = setInterval(function () { if (maybeHint() || ++tries > 60) clearInterval(iv); }, 1000);
})();
