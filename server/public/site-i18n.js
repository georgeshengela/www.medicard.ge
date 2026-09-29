/* MEDICARD site language (ka / en) — load synchronously in <head>, before any other site script.

   Georgian is written in the HTML. English lives next to it:
     <h1 data-en="Your pocket health assistant">ჯიბის სამედიცინო ასისტენტი</h1>   → textContent
     <p data-en-html="Read the <a href='/privacy'>policy</a>">…</p>                 → innerHTML (trusted, our own copy)
     <input placeholder="…" data-en-placeholder="Search">                         → attribute
       (any attribute: data-en-aria-label, data-en-title, data-en-alt, data-en-content, data-en-value, data-en-href)
     <title data-en="…">, <meta name="description" content="…" data-en-content="…">
   Scripts use MedicardI18n.t('ქართული', 'English') and MedicardI18n.lang.
   A page with <meta name="medicard:en" content="/privacy-en"> is replaced by that page in English
   (and <meta name="medicard:ka" content="/privacy"> the other way).

   The choice is shared with the web app (/app) through localStorage "medicard.lang";
   ?lang=en|ka in the URL sets it too (shareable links). */
(function () {
  'use strict';

  var KEY = 'medicard.lang';
  var root = document.documentElement;

  function parse(v) {
    v = String(v || '').toLowerCase();
    return v === 'en' || v.indexOf('en-') === 0 ? 'en' : v === 'ka' || v.indexOf('ka-') === 0 ? 'ka' : '';
  }
  function read() {
    try { return parse(localStorage.getItem(KEY)); } catch (e) { return ''; }
  }
  function write(lang) {
    try { localStorage.setItem(KEY, lang); } catch (e) { /* private mode: this page only */ }
  }

  var fromUrl = '';
  try { fromUrl = parse(new URLSearchParams(location.search).get('lang')); } catch (e) { fromUrl = ''; }
  if (fromUrl) write(fromUrl);
  var lang = fromUrl || read() || 'ka';

  root.lang = lang;
  root.classList.add('lang-' + lang);

  function meta(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el ? el.getAttribute('content') : '';
  }

  // Separate-page translations (legal documents).
  function followPage() {
    var target = meta('medicard:' + lang);
    if (target && target !== location.pathname) {
      location.replace(target + location.hash);
      return true;
    }
    return false;
  }

  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt', 'content', 'value', 'href', 'label'];

  function apply(scope) {
    if (lang !== 'en') return;
    var nodes = (scope || document).querySelectorAll('[data-en],[data-en-html],[data-en-placeholder],[data-en-aria-label],[data-en-title],[data-en-alt],[data-en-content],[data-en-value],[data-en-href],[data-en-label]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.hasAttribute('data-en-html')) el.innerHTML = el.getAttribute('data-en-html');
      else if (el.hasAttribute('data-en')) el.textContent = el.getAttribute('data-en');
      for (var j = 0; j < ATTRS.length; j++) {
        var a = 'data-en-' + ATTRS[j];
        if (el.hasAttribute(a)) el.setAttribute(ATTRS[j], el.getAttribute(a));
      }
    }
  }

  function set(next) {
    next = parse(next);
    if (!next) return;
    write(next);
    if (next === lang) return;
    // Drop ?lang= so the stored choice wins after reload.
    var url = location.pathname + location.search.replace(/([?&])lang=[^&]*&?/, '$1').replace(/[?&]$/, '') + location.hash;
    var other = meta('medicard:' + next);
    location.href = other && other !== location.pathname ? other + location.hash : url;
  }

  window.MedicardI18n = {
    lang: lang,
    isEn: lang === 'en',
    t: function (ka, en) { return lang === 'en' ? en : ka; },
    locale: lang === 'en' ? 'en-GB' : 'ka-GE',
    apply: apply,
    set: set
  };

  if (lang === 'en') {
    // Hide Georgian until the English copy is in place (fail-safe after 1.2 s).
    var style = document.createElement('style');
    style.id = 'mc-i18n-cloak';
    style.textContent = 'html.lang-en body{visibility:hidden}';
    document.head.appendChild(style);
    var reveal = function () {
      var s = document.getElementById('mc-i18n-cloak');
      if (s) s.parentNode.removeChild(s);
    };
    setTimeout(reveal, 1200);
    document.addEventListener('DOMContentLoaded', function () {
      if (followPage()) return;
      apply(document);
      reveal();
    });
  } else {
    document.addEventListener('DOMContentLoaded', followPage);
  }
})();
