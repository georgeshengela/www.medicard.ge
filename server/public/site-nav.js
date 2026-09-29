/* MEDICARD site navigation — one source for every public page.
   Pages place <header class="tb" id="topbar"></header> and load this script right after it
   (add data-offset when the page has no full-bleed hero and needs room under the bar). */
(function () {
  'use strict';

  var header = document.getElementById('topbar');
  if (!header) return;

  var APP_STORE = 'https://apps.apple.com/app/id6812517519';
  var path = location.pathname.replace(/\/+$/, '') || '/';
  var onHome = path === '/' || path === '/index.html';

  function svg(d, extra) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + d + '</svg>';
  }
  var ICON = {
    home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>'),
    about: svg('<path d="M19.5 12.6 12 20l-7.5-7.4A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 7.5 6.3Z"/><path d="M3.5 12h4l1.5-3 3 6 1.5-3h7"/>'),
    calc: svg('<rect x="4" y="2.5" width="16" height="19" rx="3"/><path d="M8 7h8"/><path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>'),
    run: svg('<path d="M5 17.5a2.5 2.5 0 0 0 5 0V15H5Z"/><path d="M5 15V9.5C5 7 6.2 5 7.5 5S10 7 10 9.5V15"/><path d="M14 13.5a2.5 2.5 0 0 0 5 0V11h-5Z"/><path d="M14 11V5.5C14 3 15.2 1 16.5 1S19 3 19 5.5V11"/>'),
    faq: svg('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6"/><path d="M12 17h.01"/>'),
    mail: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>'),
    download: svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>'),
    cycle: svg('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 8 8"/><circle cx="12" cy="12" r="2"/>'),
    baby: svg('<circle cx="12" cy="8" r="4.5"/><path d="M10.5 7.5h.01M13.5 7.5h.01"/><path d="M10.8 9.8a2 2 0 0 0 2.4 0"/><path d="M6 21a6 6 0 0 1 12 0"/>'),
    arrow: svg('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>'),
    user: svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    apple: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1-2.9-4.3ZM13.9 5.3c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z"/></svg>'
  };

  var CALC = {
    cycle: [
      ['ovulation', 'ოვულაცია', 'ნაყოფიერი ფანჯარა'],
      ['period', 'მენსტრუაცია', 'შემდეგი პერიოდი'],
      ['cycle', 'ციკლი', 'დღევანდელი ფაზა'],
      ['pregnancy-test', 'ორსულობის ტესტი', 'როდის გაიკეთო'],
      ['implantation', 'იმპლანტაცია', '6–10 დღიანი ფანჯარა']
    ],
    pregnancy: [
      ['due-date', 'მშობიარობის თარიღი', 'ბოლო პერიოდით'],
      ['weeks-to-months', 'კვირები თვეებში', 'თვე და ტრიმესტრი'],
      ['ivf', 'IVF და FET', 'ემბრიონის ასაკით'],
      ['ultrasound', 'ულტრაბგერა', 'სკანის თარიღით'],
      ['hcg', 'hCG', 'გაორმაგების დრო']
    ]
  };

  var ITEMS = [
    { key: 'home', href: '/', label: 'მთავარი', hint: 'დღე მედიქარდთან', icon: 'home' },
    { key: 'about', href: '/about', label: 'ჩვენ შესახებ', hint: 'ვინ ვართ და რისი გვჯერა', icon: 'about' },
    { key: 'calculators', href: '/calculators', label: 'კალკულატორები', hint: 'ციკლი და ორსულობა — 10 უფასო', icon: 'calc', mega: true },
    { key: 'medirun', href: '/medipulsi/', label: 'MEDIRUN', hint: 'ქალაქის აღმოჩენა ფეხით', icon: 'run' },
    { key: 'faq', href: onHome ? '#faq' : '/#faq', label: 'კითხვები', hint: 'ხშირი კითხვები', icon: 'faq' },
    { key: 'contact', href: '/contact', label: 'კონტაქტი', hint: 'მოგვწერე', icon: 'mail' }
  ];

  var current =
    onHome ? 'home' :
    /^\/about/.test(path) ? 'about' :
    /^\/contact/.test(path) ? 'contact' :
    /^\/calculators/.test(path) ? 'calculators' :
    /^\/medipulsi/.test(path) ? 'medirun' : '';

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function calcColumn(title, icon, list) {
    return '<div class="tb-mega-col"><p class="tb-mega-head">' + ICON[icon] + esc(title) + '</p><ul>' +
      list.map(function (c) {
        var on = path === '/calculators/' + c[0];
        return '<li><a href="/calculators/' + c[0] + '"' + (on ? ' aria-current="page"' : '') + '><b>' + esc(c[1]) + '</b><span>' + esc(c[2]) + '</span></a></li>';
      }).join('') + '</ul></div>';
  }

  var mega =
    '<div class="tb-mega" id="tb-mega" role="region" aria-label="კალკულატორები">' +
      '<div class="tb-mega-grid">' +
        calcColumn('ციკლი', 'cycle', CALC.cycle) +
        calcColumn('ორსულობა', 'baby', CALC.pregnancy) +
        '<a class="tb-mega-all" href="/calculators"><b>ყველა კალკულატორი</b><span>გამოთვლა რჩება შენს ბრაუზერში — სერვერზე არაფერი იგზავნება.</span>' + ICON.arrow + '</a>' +
      '</div>' +
    '</div>';

  var links = ITEMS.map(function (it) {
    var cur = it.key === current ? ' aria-current="page"' : '';
    var a = '<a class="tb-link" href="' + it.href + '" data-key="' + it.key + '"' + cur + '>' + ICON[it.icon] + '<span>' + esc(it.label) + '</span></a>';
    if (!it.mega) return a;
    return '<div class="tb-has-mega">' +
      '<a class="tb-link" href="' + it.href + '" data-key="' + it.key + '"' + cur + ' aria-haspopup="true" aria-expanded="false" aria-controls="tb-mega">' + ICON[it.icon] + '<span>' + esc(it.label) + '</span>' +
      '<svg class="tb-caret" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></a>' +
      mega + '</div>';
  }).join('');

  var sheetItems = ITEMS.map(function (it, i) {
    var cur = it.key === current ? ' aria-current="page"' : '';
    return '<li style="--i:' + i + '"><a href="' + it.href + '"' + cur + '><span class="tb-tile">' + ICON[it.icon] + '</span><span class="tb-sheet-text"><b>' + esc(it.label) + '</b><small>' + esc(it.hint) + '</small></span>' + ICON.arrow + '</a></li>';
  }).join('');

  // The web app (/app) keeps its token in localStorage under this key.
  var signedIn = false;
  try { signedIn = Boolean(localStorage.getItem('medicard.web.token')); } catch (e) { signedIn = false; }

  header.innerHTML =
    '<div class="tb-bar">' +
      '<a class="tb-brand" href="/" aria-label="მედიქარდი, მთავარი გვერდი"><img src="/icon.png" width="32" height="32" alt="" /><span>მედიქარდი</span></a>' +
      '<nav class="tb-links" aria-label="მთავარი მენიუ"><span class="tb-glide" aria-hidden="true"></span>' + links + '</nav>' +
      '<a class="tb-login" href="/app">' + ICON.user + '<span>' + (signedIn ? 'ჩემი ანგარიში' : 'შესვლა') + '</span></a>' +
      '<button class="tb-burger" type="button" aria-expanded="false" aria-controls="tb-sheet"><span class="tb-sr">მენიუ</span><i></i><i></i><i></i></button>' +
    '</div>' +
    '<div class="tb-sheet" id="tb-sheet" aria-label="მენიუ">' +
      '<ul class="tb-sheet-list">' + sheetItems + '</ul>' +
      '<div class="tb-sheet-foot">' +
        '<a class="store-badge is-official" href="' + APP_STORE + '"><img src="/icons/app-store-badge.svg" alt="Download on the App Store" width="144" height="48" /></a>' +
        '<span class="store-badge is-soon" aria-label="Google Play — Coming soon"><img src="/icons/google-play.svg" alt="" width="24" height="24" /><span><small>Coming soon</small><b>Google Play</b></span></span>' +
        '<a class="tb-sheet-login" href="/app">' + ICON.user + '<span>' + (signedIn ? 'ჩემი ანგარიში' : 'შესვლა ვებ-ვერსიაში') + '</span>' + ICON.arrow + '</a>' +
        '<a class="tb-sheet-mail" href="mailto:support@medicard.ge">support@medicard.ge</a>' +
      '</div>' +
    '</div>';

  if (header.hasAttribute('data-offset')) document.body.classList.add('tb-offset');

  /* ───── iPhone: download goes straight to the App Store ───── */
  var isApple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function wireDownloads() {
    if (!isApple) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-download]'), function (a) { a.href = APP_STORE; });
  }
  wireDownloads();
  document.addEventListener('DOMContentLoaded', wireDownloads);

  /* ───── Gliding highlight behind the links ───── */
  var nav = header.querySelector('.tb-links');
  var glide = header.querySelector('.tb-glide');
  var active = nav.querySelector('.tb-link[aria-current="page"]');
  function moveGlide(el) {
    if (!el) { glide.style.opacity = '0'; return; }
    var n = nav.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    glide.style.opacity = '1';
    glide.style.width = r.width + 'px';
    glide.style.transform = 'translateX(' + (r.left - n.left) + 'px)';
  }
  Array.prototype.forEach.call(nav.querySelectorAll('.tb-link'), function (a) {
    a.addEventListener('pointerenter', function () { moveGlide(a); });
    a.addEventListener('focus', function () { moveGlide(a); });
  });
  nav.addEventListener('pointerleave', function () { moveGlide(active); });
  nav.addEventListener('focusout', function (e) { if (!nav.contains(e.relatedTarget)) moveGlide(active); });
  function placeActive() {
    glide.style.transition = 'none';
    moveGlide(active);
    requestAnimationFrame(function () { glide.style.transition = ''; });
  }
  window.addEventListener('resize', placeActive);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeActive);
  placeActive();

  /* ───── Calculators mega panel ───── */
  var megaWrap = header.querySelector('.tb-has-mega');
  var megaLink = megaWrap.querySelector('.tb-link');
  var closeTimer;
  function setMega(open) {
    clearTimeout(closeTimer);
    megaWrap.classList.toggle('is-open', open);
    megaLink.setAttribute('aria-expanded', String(open));
  }
  megaWrap.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') setMega(true); });
  megaWrap.addEventListener('pointerleave', function (e) {
    if (e.pointerType !== 'mouse') return;
    closeTimer = setTimeout(function () { setMega(false); }, 160);
  });
  megaWrap.addEventListener('focusin', function () { setMega(true); });
  megaWrap.addEventListener('focusout', function (e) { if (!megaWrap.contains(e.relatedTarget)) setMega(false); });
  megaLink.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMega(true);
      var first = megaWrap.querySelector('.tb-mega a');
      if (first) first.focus();
    }
  });

  /* ───── Mobile sheet ───── */
  var burger = header.querySelector('.tb-burger');
  function setSheet(open) {
    header.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('tb-lock', open);
    burger.setAttribute('aria-expanded', String(open));
    var label = burger.querySelector('.tb-sr');
    if (label) label.textContent = open ? 'მენიუს დახურვა' : 'მენიუ';
  }
  burger.addEventListener('click', function () { setSheet(!header.classList.contains('is-open')); });
  header.querySelector('.tb-sheet').addEventListener('click', function (e) { if (e.target.closest('a')) setSheet(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    setSheet(false);
    setMega(false);
  });

  /* ───── Tone and compact state follow the page under the bar ───── */
  var lastTone = '';
  var ticking = false;
  function sync() {
    ticking = false;
    header.classList.toggle('is-scrolled', window.scrollY > 24);
    var tone = 'light';
    var sections = document.querySelectorAll('[data-tone]');
    for (var i = 0; i < sections.length; i++) {
      if (sections[i] === header) continue;
      var r = sections[i].getBoundingClientRect();
      if (r.top <= 40 && r.bottom > 40) { tone = sections[i].dataset.tone || tone; break; }
    }
    if (tone !== lastTone) {
      lastTone = tone;
      header.dataset.tone = tone;
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', tone === 'dark' ? '#030712' : '#E8F5F2');
    }
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(sync);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  // The day section recolours itself while scrolling; re-check after it updates
  window.addEventListener('medicard:tone', onScroll);
  document.addEventListener('DOMContentLoaded', sync);
  window.addEventListener('load', sync);
  sync();
})();
