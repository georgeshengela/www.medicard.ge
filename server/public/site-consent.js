/* MEDICARD site cookie consent + Meta Pixel (owner 2026-10-05). Loaded by site-i18n.js on public pages only.

   Nothing from Meta loads until the visitor taps „ვეთანხმები“ / Accept. „უარი“ is one tap and as prominent.
   The choice lives in localStorage "medicard.consent" ({ v, marketing, at }) and is asked again after 12 months
   or when CONSENT_VERSION changes. Global Privacy Control = declined, no banner.
   Never on /app, /admin, the health calculators, invite / personal QR / coach / unsubscribe / delete-account / reset
   pages (EXCLUDED), never
   advanced matching, autoConfig off (no automatic button/form scraping), events carry no health data:
   PageView everywhere, ViewContent on /medirun, AppStoreClick { store } on App Store / Google Play links.
   Reopen the choice: any [data-cookie-settings] element or MedicardConsent.open(). */
(function () {
  'use strict';

  var PIXEL_ID = '1059707503561973'; // Meta dataset „MEDICARD Web“, business portfolio Medicard • მედიქარდი
  var KEY = 'medicard.consent';
  var CONSENT_VERSION = 1;
  var MAX_AGE = 365 * 24 * 3600 * 1000;
  // Calculators (cycle, ovulation, pregnancy …): the page address alone would tell Meta about a health interest.
  var EXCLUDED = /^\/(app|admin|api|u|i|unsubscribe|delete-account|reset-password|reset|press|open-app|coach|calculators|medipulsi)(\/|$|\.html)/;
  var path = location.pathname;
  if (EXCLUDED.test(path) || /^\/(invite|personal-qr|delete-account|open-app|coach)\.html$/.test(path)) return;

  var t = function (ka, en) { return window.MedicardI18n ? window.MedicardI18n.t(ka, en) : ka; };
  var isEn = function () { return !!(window.MedicardI18n && window.MedicardI18n.isEn); };

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!v || v.v !== CONSENT_VERSION || !v.at || Date.now() - Date.parse(v.at) > MAX_AGE) return null;
      return v;
    } catch (e) { return null; }
  }
  function write(marketing) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: CONSENT_VERSION, marketing: !!marketing, at: new Date().toISOString() })); } catch (e) { /* private mode: this page only */ }
  }
  function dropMetaCookies() {
    ['_fbp', '_fbc'].forEach(function (name) {
      document.cookie = name + '=; Max-Age=0; path=/';
      document.cookie = name + '=; Max-Age=0; path=/; domain=' + location.hostname.replace(/^www\./, '.');
    });
  }

  /* ───────── Meta Pixel ───────── */
  var pixelOn = false;
  function startPixel() {
    if (pixelOn) return;
    pixelOn = true;
    /* Meta's base code (fbevents.js), unchanged except the id. */
    !function (f, b, e, v, n, t2, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t2 = b.createElement(e); t2.async = !0; t2.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t2, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('set', 'autoConfig', false, PIXEL_ID);
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
    if (/^\/medirun(\/|$)/.test(path)) window.fbq('track', 'ViewContent', { content_name: 'MEDIRUN' });
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      var store = /apps\.apple\.com/.test(href) ? 'app_store' : /play\.google\.com/.test(href) ? 'google_play' : '';
      if (store) window.fbq('trackCustom', 'AppStoreClick', { store: store });
    }, true);
  }

  /* ───────── banner ───────── */
  var CSS = '' +
    '.mc-consent{position:fixed;z-index:90;left:16px;bottom:16px;width:min(420px,calc(100% - 32px));box-sizing:border-box;padding:18px 18px 16px;border-radius:22px;' +
    'background:rgba(255,255,255,.94);color:#0B2B2E;border:1px solid rgba(11,43,46,.08);box-shadow:0 24px 60px -24px rgba(3,7,18,.45);' +
    'backdrop-filter:blur(20px) saturate(1.4);-webkit-backdrop-filter:blur(20px) saturate(1.4);font:14px/1.5 "FiraGO",system-ui,-apple-system,"Segoe UI",sans-serif;' +
    'opacity:0;transform:translateY(12px);transition:opacity .35s cubic-bezier(.2,.7,.1,1),transform .35s cubic-bezier(.2,.7,.1,1)}' +
    '.mc-consent.is-in{opacity:1;transform:none}' +
    '.mc-consent h2{margin:0 0 6px;font-size:15px;font-weight:700;letter-spacing:-.01em}' +
    '.mc-consent p{margin:0 0 14px;color:#3E5A5D;font-size:13px}' +
    '.mc-consent a{color:#0D9488;font-weight:600;text-decoration:underline;text-underline-offset:2px}' +
    '.mc-consent-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
    '.mc-consent button{min-height:44px;border-radius:14px;font:600 14px/1 inherit;font-family:inherit;cursor:pointer;border:1px solid rgba(11,43,46,.14);background:#fff;color:#0B2B2E}' +
    '.mc-consent button[data-yes]{background:#0D9488;border-color:#0D9488;color:#fff}' +
    '.mc-consent button:focus-visible{outline:3px solid #14B8A6;outline-offset:2px}' +
    '@media (prefers-color-scheme:dark){.mc-consent{background:rgba(17,24,39,.94);color:#fff;border-color:rgba(255,255,255,.1)}.mc-consent p{color:#D1D5DB}.mc-consent a{color:#5EEAD4}' +
    '.mc-consent button{background:#1F2937;color:#fff;border-color:rgba(255,255,255,.14)}}' +
    '@media (prefers-reduced-motion:reduce){.mc-consent{transition:none}}';

  var box = null;
  function close() {
    if (!box) return;
    var el = box; box = null;
    el.classList.remove('is-in');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 350);
  }
  function choose(marketing) {
    var before = read();
    write(marketing);
    close();
    if (marketing) startPixel();
    else if (pixelOn || (before && before.marketing)) { dropMetaCookies(); location.reload(); }
  }
  function open() {
    if (box) return;
    if (!document.getElementById('mc-consent-css')) {
      var st = document.createElement('style'); st.id = 'mc-consent-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    box = document.createElement('section');
    box.className = 'mc-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-live', 'polite');
    box.setAttribute('aria-label', t('ქუქი-ფაილები', 'Cookies'));
    var privacy = isEn() ? '/privacy-en#s15' : '/privacy#s15';
    box.innerHTML =
      '<h2>' + t('ქუქი-ფაილები რეკლამისთვის', 'Cookies for advertising') + '</h2>' +
      '<p>' + t('თანხმობის შემთხვევაში ამ საიტზე ჩაირთვება Meta Pixel, რომ ვნახოთ, რომელი რეკლამა მუშაობს. ის მხოლოდ საიტის გვერდებს ხედავს — შენს ჯანმრთელობის მონაცემებს და აპს არასდროს. ',
        'If you agree, this site turns on the Meta Pixel so we can see which ads work. It only sees the site’s pages — never your health data or the app. ') +
      '<a href="' + privacy + '">' + t('დეტალურად', 'Details') + '</a></p>' +
      '<div class="mc-consent-row"><button type="button" data-no>' + t('უარი', 'Decline') + '</button><button type="button" data-yes>' + t('ვეთანხმები', 'Accept') + '</button></div>';
    box.querySelector('[data-no]').addEventListener('click', function () { choose(false); });
    box.querySelector('[data-yes]').addEventListener('click', function () { choose(true); });
    document.body.appendChild(box);
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (box) box.classList.add('is-in'); }); });
  }

  window.MedicardConsent = {
    open: open,
    get marketing() { var v = read(); return !!(v && v.marketing); }
  };

  function boot() {
    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-cookie-settings]') : null;
      if (el) { e.preventDefault(); open(); }
    });
    if (navigator.globalPrivacyControl === true) return;
    var v = read();
    if (!v) open();
    else if (v.marketing) startPixel();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
