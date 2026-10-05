/* MEDICARD — „get the app“ on iPhone / iPad (owner 2026-10-06: many people register in the web app).
   One script for both surfaces:
     - the web app (/app, noindex): a bottom sheet with a scrim — MedicardAppPromo.show({ mode: 'sheet', hint })
     - public pages (indexed): a small card at the bottom, no scrim, after a short delay or some scrolling,
       so Google never sees an interstitial — MedicardAppPromo.show({ mode: 'card' })
   iOS only (Android is not in the Play Store yet). Dismissed → quiet for 14 days; App Store tapped →
   quiet for 60 days; never inside a home-screen web app. Language follows localStorage "medicard.lang". */
(function () {
  'use strict';
  if (window.MedicardAppPromo) return;

  var APP_STORE = 'https://apps.apple.com/app/id6812517519';
  var KEY = 'medicard.appPromo';
  var DAY = 24 * 60 * 60 * 1000;

  function lang() {
    try { if (localStorage.getItem('medicard.lang') === 'en') return 'en'; } catch (e) { /* private mode */ }
    return document.documentElement.lang === 'en' ? 'en' : 'ka';
  }
  function t(ka, en) { return lang() === 'en' ? en : ka; }

  function isIos() {
    var ua = navigator.userAgent || '';
    var iPadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    return /iPhone|iPad|iPod/.test(ua) || iPadOs;
  }
  function standalone() {
    return window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function readState() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeState(patch) {
    try { var s = readState(); for (var k in patch) s[k] = patch[k]; localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  }
  function quiet() {
    var s = readState();
    var now = Date.now();
    return (s.clickedAt && now - s.clickedAt < 60 * DAY) || (s.dismissedAt && now - s.dismissedAt < 14 * DAY);
  }
  function eligible(opts) {
    if (opts && opts.force) return true;
    return isIos() && !standalone() && window.top === window.self && !quiet();
  }

  var CSS = [
    '.mcp{--mcp-surface:#fff;--mcp-ink:#0f1a1c;--mcp-muted:#566669;--mcp-line:#14b8a6;--mcp-tint:#e6f7f5;--mcp-store-bg:#000;--mcp-store-fg:#fff;--mcp-scrim:rgba(6,20,22,.42);',
    'font-family:FiraGO,-apple-system,system-ui,sans-serif;color:var(--mcp-ink);-webkit-font-smoothing:antialiased}',
    '@media (prefers-color-scheme:dark){html:not([data-theme="light"]) .mcp{--mcp-surface:#111827;--mcp-ink:#f3f7f7;--mcp-muted:#a3b0b3;--mcp-tint:#0c2f2c;--mcp-store-bg:#fff;--mcp-store-fg:#000;--mcp-scrim:rgba(0,0,0,.6)}}',
    'html[data-theme="dark"] .mcp{--mcp-surface:#111827;--mcp-ink:#f3f7f7;--mcp-muted:#a3b0b3;--mcp-tint:#0c2f2c;--mcp-store-bg:#fff;--mcp-store-fg:#000;--mcp-scrim:rgba(0,0,0,.6)}',
    '.mcp *{box-sizing:border-box}',
    /* public pages are light-only: the card keeps the light tokens whatever the phone theme */
    'html .mcp.mcp-card[class]{--mcp-surface:#fff;--mcp-ink:#0f1a1c;--mcp-muted:#566669;--mcp-store-bg:#000;--mcp-store-fg:#fff}',
    /* sheet */
    '.mcp-wrap{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center}',
    '.mcp-scrim{position:absolute;inset:0;background:var(--mcp-scrim);opacity:0;transition:opacity .28s ease}',
    '.mcp-sheet{position:relative;width:100%;max-width:440px;background:var(--mcp-surface);border-radius:30px 30px 0 0;',
    'padding:10px 24px calc(18px + env(safe-area-inset-bottom));transform:translateY(105%);transition:transform .42s cubic-bezier(.2,.9,.25,1);',
    'box-shadow:0 -12px 40px rgba(6,20,22,.18)}',
    '@media (min-width:600px){.mcp-wrap{align-items:center}.mcp-sheet{border-radius:30px;padding-bottom:22px}}',
    '.mcp-in .mcp-scrim{opacity:1}.mcp-in .mcp-sheet{transform:none}',
    '.mcp-handle{width:38px;height:5px;border-radius:3px;background:var(--mcp-muted);opacity:.28;margin:0 auto 6px}',
    /* the one bold element: a heartbeat line that beats once through the app icon */
    '.mcp-pulse{position:relative;height:96px;margin:0 -24px}',
    '.mcp-pulse svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}',
    '.mcp-pulse path{fill:none;stroke:var(--mcp-line);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:640;stroke-dashoffset:640}',
    '.mcp-in .mcp-pulse path{animation:mcp-draw 1.25s .18s cubic-bezier(.45,0,.2,1) forwards}',
    '@keyframes mcp-draw{to{stroke-dashoffset:0}}',
    '.mcp-icon{position:absolute;left:50%;top:50%;width:72px;height:72px;margin:-36px 0 0 -36px;border-radius:19px;',
    'box-shadow:0 0 0 7px var(--mcp-surface),0 10px 26px rgba(13,148,136,.32);transform:scale(.86);opacity:0;transition:transform .5s .55s cubic-bezier(.2,1.4,.35,1),opacity .3s .55s}',
    '.mcp-in .mcp-icon{transform:none;opacity:1}',
    '.mcp-title{margin:6px 0 0;font-size:23px;line-height:1.3;font-weight:700;letter-spacing:-.01em;text-align:center}',
    '.mcp-body{margin:8px auto 0;max-width:42ch;font-size:15px;line-height:1.55;color:var(--mcp-muted);text-align:center}',
    '.mcp-list{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:10px}',
    '.mcp-list li{display:flex;align-items:center;gap:12px;font-size:14.5px;line-height:1.4}',
    '.mcp-dot{flex:none;width:34px;height:34px;border-radius:11px;background:var(--mcp-tint);color:#0d9488;display:grid;place-items:center}',
    'html[data-theme="dark"] .mcp-dot{color:#5eead4}',
    '@media (prefers-color-scheme:dark){html:not([data-theme="light"]) .mcp-dot{color:#5eead4}}',
    '.mcp-hint{margin:16px 0 0;padding:11px 14px;border-radius:14px;background:var(--mcp-tint);font-size:13.5px;line-height:1.45}',
    '.mcp-store{margin-top:20px;display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:54px;border:0;border-radius:27px;',
    'background:var(--mcp-store-bg);color:var(--mcp-store-fg);font:inherit;font-size:16px;font-weight:600;text-decoration:none;cursor:pointer;transition:transform .08s}',
    '.mcp-store:active{transform:scale(.98)}',
    '.mcp-later{display:block;margin:8px auto 0;padding:10px 16px;border:0;background:none;font:inherit;font-size:15px;color:var(--mcp-muted);cursor:pointer}',
    '.mcp a:focus-visible,.mcp button:focus-visible{outline:3px solid #14b8a6;outline-offset:3px}',
    /* card (public pages) */
    '.mcp-card{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483000;margin:0 auto;max-width:440px;',
    'display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:10px;padding:10px 6px 12px 10px;border-radius:22px;background:var(--mcp-surface);',
    'box-shadow:0 14px 40px rgba(6,20,22,.22),0 0 0 1px rgba(15,26,28,.06);transform:translateY(140%);transition:transform .45s cubic-bezier(.2,.9,.25,1);overflow:hidden}',
    '.mcp-card.mcp-in{transform:none}',
    '.mcp-card img{width:46px;height:46px;border-radius:12px;display:block}',
    '.mcp-card b{display:block;font-size:14.5px;line-height:1.3;font-weight:700}',
    '.mcp-card span{display:block;font-size:12.5px;line-height:1.35;color:var(--mcp-muted);margin-top:2px}',
    '.mcp-card .mcp-get{border:0;border-radius:18px;padding:9px 15px;background:var(--mcp-store-bg);color:var(--mcp-store-fg);font:inherit;font-size:14px;font-weight:600;text-decoration:none;white-space:nowrap}',
    '.mcp-card .mcp-close{width:32px;height:32px;border:0;border-radius:16px;background:none;color:var(--mcp-muted);font-size:20px;line-height:1;cursor:pointer;display:grid;place-items:center}',
    '.mcp-card b,.mcp-card span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.mcp-card svg.mcp-mini{position:absolute;left:0;right:0;bottom:0;width:100%;height:14px}',
    '.mcp-card svg.mcp-mini path{fill:none;stroke:var(--mcp-line);stroke-width:1.6;opacity:.55;stroke-linecap:round;stroke-linejoin:round}',
    '@media (prefers-reduced-motion:reduce){.mcp-scrim,.mcp-sheet,.mcp-icon,.mcp-card{transition:none!important}.mcp-pulse path{animation:none!important;stroke-dashoffset:0}}',
  ].join('');

  var APPLE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1-2.9-4.3ZM13.9 5.3c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z"/></svg>';
  function glyph(d) {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var BELL = glyph('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>');
  var STEPS = glyph('<path d="M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6C14.6 6 14 7.8 14 9.5c0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0Z"/>');
  var RUN = glyph('<circle cx="13" cy="4" r="2"/><path d="m4 22 4-7 3 2 2-5 4 3 3-3"/><path d="M9 9.5 12 7l3 1.5"/>');

  var cssDone = false;
  function injectCss() {
    if (cssDone) return;
    cssDone = true;
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function storeLink(cls, inner, onTap) {
    var a = document.createElement('a');
    a.className = cls;
    a.href = APP_STORE;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = inner;
    a.addEventListener('click', function () { writeState({ clickedAt: Date.now() }); if (onTap) onTap(); });
    return a;
  }

  var open = false;

  /** Web app: bottom sheet with a scrim. `hint` = one line for a signed-in person (how to sign in in the app). */
  function sheet(opts) {
    injectCss();
    open = true;
    var wrap = document.createElement('div');
    wrap.className = 'mcp mcp-wrap';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', t('MEDICARD აპი', 'MEDICARD app'));

    var scrim = document.createElement('div');
    scrim.className = 'mcp-scrim';
    var panel = document.createElement('div');
    panel.className = 'mcp-sheet';
    panel.innerHTML =
      '<div class="mcp-handle" aria-hidden="true"></div>' +
      '<div class="mcp-pulse" aria-hidden="true"><svg viewBox="0 0 440 96" preserveAspectRatio="none">' +
      '<path d="M0 60 H86 l8 -5 l7 5 H112 l6 14 l11 -56 l11 48 l7 -6 H440"/></svg>' +
      '<img class="mcp-icon" src="/icon.png" alt=""></div>' +
      '<h2 class="mcp-title">' + t('MEDICARD აპში ყველაფერი ხელთ გაქვს', 'Everything is at hand in the MEDICARD app') + '</h2>' +
      '<p class="mcp-body">' + t('იგივე ანგარიში, რაც ვებზე. აპი უფასოა.', 'The same account as on the web. The app is free.') + '</p>' +
      '<ul class="mcp-list">' +
      '<li><span class="mcp-dot">' + BELL + '</span>' + t('წამლის შეხსენებები დროზე', 'Medication reminders on time') + '</li>' +
      '<li><span class="mcp-dot">' + STEPS + '</span>' + t('ნაბიჯები თავისით ითვლება', 'Steps counted for you') + '</li>' +
      '<li><span class="mcp-dot">' + RUN + '</span>' + t('MEDIRUN — სირბილი საჩუქრებით', 'MEDIRUN — run for prizes') + '</li>' +
      '</ul>' +
      (opts.hint ? '<p class="mcp-hint"></p>' : '');
    if (opts.hint) panel.querySelector('.mcp-hint').textContent = opts.hint;

    var store = storeLink('mcp-store', APPLE + '<span>' + t('გადმოწერა App Store-დან', 'Download on the App Store') + '</span>', function () { close(false); });
    var later = document.createElement('button');
    later.type = 'button';
    later.className = 'mcp-later';
    later.textContent = t('ვებში გაგრძელება', 'Continue on the web');
    panel.appendChild(store);
    panel.appendChild(later);
    wrap.appendChild(scrim);
    wrap.appendChild(panel);

    var prevFocus = document.activeElement;
    var prevOverflow = document.body.style.overflow;
    function onKey(e) { if (e.key === 'Escape') close(true); }
    function close(dismissed) {
      if (!open) return;
      open = false;
      if (dismissed) writeState({ dismissedAt: Date.now() });
      wrap.classList.remove('mcp-in');
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      setTimeout(function () { wrap.remove(); if (prevFocus && prevFocus.focus) prevFocus.focus(); }, 380);
    }
    scrim.addEventListener('click', function () { close(true); });
    later.addEventListener('click', function () { close(true); });
    document.addEventListener('keydown', onKey);

    // Swipe the sheet down to close.
    var startY = null;
    panel.addEventListener('touchstart', function (e) { startY = e.touches[0].clientY; }, { passive: true });
    panel.addEventListener('touchmove', function (e) {
      if (startY === null) return;
      var dy = Math.max(0, e.touches[0].clientY - startY);
      panel.style.transition = 'none';
      panel.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: true });
    panel.addEventListener('touchend', function (e) {
      if (startY === null) return;
      var dy = e.changedTouches[0].clientY - startY;
      startY = null;
      panel.style.transition = '';
      panel.style.transform = '';
      if (dy > 90) close(true);
    });

    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    void wrap.offsetHeight; // commit the closed position, then animate in
    setTimeout(function () { wrap.classList.add('mcp-in'); store.focus({ preventScroll: true }); }, 20);
  }

  /** Public pages: a small card at the bottom; the page stays fully usable around it. */
  function card() {
    injectCss();
    open = true;
    var el = document.createElement('aside');
    el.className = 'mcp mcp-card';
    el.setAttribute('aria-label', t('MEDICARD აპი iPhone-ზე', 'MEDICARD app for iPhone'));
    el.innerHTML =
      '<img src="/icon.png" alt="">' +
      '<div style="min-width:0"><b>' + t('MEDICARD აპი', 'MEDICARD app') + '</b><span>' + t('უფასოა, iPhone-ზე', 'Free, for iPhone') + '</span></div>' +
      '<svg class="mcp-mini" viewBox="0 0 440 14" preserveAspectRatio="none" aria-hidden="true"><path d="M0 9 H300 l6 -3 l5 3 H318 l5 4 l7 -12 l7 11 l5 -3 H440"/></svg>';
    var get = storeLink('mcp-get', t('გადმოწერა', 'Get'), function () { hide(false); });
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'mcp-close';
    x.setAttribute('aria-label', t('დახურვა', 'Close'));
    x.innerHTML = '&times;';
    el.appendChild(get);
    el.appendChild(x);
    function hide(dismissed) {
      if (!open) return;
      open = false;
      if (dismissed) writeState({ dismissedAt: Date.now() });
      el.classList.remove('mcp-in');
      setTimeout(function () { el.remove(); }, 460);
    }
    x.addEventListener('click', function () { hide(true); });
    document.body.appendChild(el);
    void el.offsetHeight;
    setTimeout(function () { el.classList.add('mcp-in'); }, 20);
  }

  /** The card waits for interest (6 s or a third of the page scrolled), never on first paint. */
  function cardWhenReady(opts) {
    var shown = false;
    function go() {
      if (shown || open || !eligible(opts)) return;
      shown = true;
      window.removeEventListener('scroll', onScroll);
      card();
    }
    function onScroll() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max > 0.33) go();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    setTimeout(go, opts && opts.delayMs != null ? opts.delayMs : 6000);
  }

  window.MedicardAppPromo = {
    eligible: eligible,
    show: function (opts) {
      opts = opts || {};
      if (open || !eligible(opts)) return false;
      if (opts.mode === 'card') { cardWhenReady(opts); return true; }
      setTimeout(function () { if (!open && eligible(opts)) sheet(opts); }, opts.delayMs != null ? opts.delayMs : 900);
      return true;
    },
  };

  // Public pages load this through site-nav.js with data-mode="card".
  var me = document.currentScript;
  if (me && me.getAttribute('data-mode') === 'card') window.MedicardAppPromo.show({ mode: 'card' });
})();
