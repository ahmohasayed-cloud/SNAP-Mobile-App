/* SNAP phone layer: sign-in screen on phones.
   1) Shows SNAP's headline "DISCOVER WHAT IS NEW TODAY" on phone-width screens (SNAP's page hides it below 1080 px).
   2) The demo person list starts closed so the Employee ID box is free to type in; the round button at the bottom opens and closes it.
   SNAP's page is not edited: this only adds styles and toggles SNAP's own demo list. */
(function () {
  'use strict';
  var css = document.createElement('style');
  css.textContent =
    '@media (max-width:1080px){' +
    '.auth-right{display:block!important;position:absolute!important;top:84px!important;left:24px!important;right:24px!important;transform:none!important;text-align:left!important;pointer-events:none}' +
    'html[dir="rtl"] .auth-right{left:24px!important;right:24px!important;text-align:right!important}' +
    '.auth-right .auth-hero-headline{font-size:clamp(24px,7.4vw,34px)!important;line-height:1.06!important;text-align:inherit!important;margin:0 0 6px!important}' +
    'html[dir="rtl"] .auth-right .auth-hero-headline,html[dir="rtl"] .auth-right .auth-hero-sub{text-align:right!important;margin-left:0!important;margin-right:0!important}' +
    '.auth-right .auth-hero-sub{text-shadow:0 1px 10px rgba(30,16,60,.75);font-size:13px!important;text-align:inherit!important;margin:0!important;max-width:34ch}' +
    '.auth-right .hl-accent::after{right:auto!important;left:2px}' +
    '}' +
    '@media (max-width:1080px) and (max-height:700px){.auth-right .auth-hero-sub{display:none}}' +
    '#demoDock .dd-btn{display:inline-flex;align-items:center;gap:8px}' +
    '#demoDock .dd-btn::after{content:"";width:8px;height:8px;border-right:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(45deg) translateY(-2px);transition:transform .2s ease}' +
    '#demoDock.open .dd-btn::after{transform:rotate(-135deg) translateY(-2px)}' +
    '@media (max-width:520px){#demoDock{left:12px;right:12px}#demoDock .dd-panel{width:auto;right:0;max-height:62vh}}';
  document.head.appendChild(css);

  function tune() {
    var d = document.getElementById('demoDock'), b = d && d.querySelector('#ddToggle');
    if (!d || !b || d.__snapTuned) return !!d;
    d.__snapTuned = true;
    d.classList.remove('open');                                       // start closed: the sign-in box is free
    var label = function () { b.textContent = d.classList.contains('open') ? 'Hide demo list' : 'Demo: choose a person'; };
    b.addEventListener('click', function () { setTimeout(label, 0); });
    label();
    return true;
  }
  if (!tune()) {
    var mo = new MutationObserver(function () { if (tune()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', function () { tune(); });
  }
})();
