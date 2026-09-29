/* MEDICARD front page: scroll-driven day, navigation, Medi demo, spaces.
   Works without WebGL; home-scene.js reads window.MedicardDay for the 3D stage. */
(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var nav = document.getElementById('nav');
  var day = document.getElementById('day');
  var moments = Array.prototype.slice.call(document.querySelectorAll('.moment'));
  var rail = document.getElementById('rail');
  var railLinks = rail ? Array.prototype.slice.call(rail.querySelectorAll('a')) : [];
  var clockTime = document.getElementById('clock-time');
  var clockLabel = document.getElementById('clock-label');
  var posterImg = document.querySelector('.poster img');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var year = document.getElementById('y');
  if (year) year.textContent = String(new Date().getFullYear());

  var SCREEN = function (key) { return '/screens/v3/' + key + '.webp?v=1'; };

  /* Sky for each moment: 06:40 dawn → 22:30 night */
  var SKY = [
    { a: '#F6E4DA', b: '#DCEFEA', sun: [255, 186, 150, 0.55] },
    { a: '#E4F4F1', b: '#CDEBE6', sun: [255, 236, 200, 0.50] },
    { a: '#EEF8FA', b: '#D3EDF0', sun: [255, 255, 235, 0.60] },
    { a: '#F4D9C6', b: '#C6D6E3', sun: [255, 160, 110, 0.50] },
    { a: '#17223F', b: '#0B1226', sun: [99, 102, 241, 0.18] },
    { a: '#030712', b: '#0A1024', sun: [20, 184, 166, 0.14] }
  ];

  var state = (window.MedicardDay = {
    t: 0,
    night: 0,
    n: moments.length,
    keys: moments.map(function (m) { return m.dataset.key; }),
    times: moments.map(function (m) { return m.dataset.time; }),
    hours: moments.map(function (m) {
      var p = (m.dataset.time || '0:0').split(':');
      return Number(p[0]) + Number(p[1]) / 60;
    }),
    pointer: { x: 0, y: 0 },
    visible: true,
    reduced: reduced
  });

  function hex(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, k) { return a.map(function (v, i) { return v + (b[i] - v) * k; }); }
  function rgb(c) { return 'rgb(' + c.slice(0, 3).map(Math.round).join(',') + ')'; }
  function smooth(k) { return k * k * (3 - 2 * k); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  var tops = [];
  function measure() {
    tops = moments.map(function (m) { return m.getBoundingClientRect().top + window.scrollY; });
  }

  var lastIndex = -1;
  var lastTone = '';
  function update() {
    var y = window.scrollY;
    var t = 0;
    for (var i = 0; i < tops.length - 1; i++) {
      if (y >= tops[i]) t = i + clamp((y - tops[i]) / (tops[i + 1] - tops[i]), 0, 1);
    }
    state.t = t;

    var i0 = Math.min(Math.floor(t), SKY.length - 1);
    var i1 = Math.min(i0 + 1, SKY.length - 1);
    var k = smooth(t - i0);
    var a = mix(hex(SKY[i0].a), hex(SKY[i1].a), k);
    var b = mix(hex(SKY[i0].b), hex(SKY[i1].b), k);
    var s = mix(SKY[i0].sun, SKY[i1].sun, k);
    var night = smooth(clamp((t - 3.25) / 0.75, 0, 1));
    state.night = night;

    var st = day.style;
    st.setProperty('--sky-a', rgb(a));
    st.setProperty('--sky-b', rgb(b));
    st.setProperty('--sun', 'rgba(' + s.slice(0, 3).map(Math.round).join(',') + ',' + s[3].toFixed(3) + ')');
    st.setProperty('--day-ink', rgb(mix([11, 43, 46], [255, 255, 255], night)));
    st.setProperty('--day-ink-2', rgb(mix([62, 90, 93], [209, 213, 219], night)));
    day.dataset.tone = night > 0.5 ? 'dark' : 'light';

    var idx = Math.round(t);
    if (idx !== lastIndex) {
      lastIndex = idx;
      moments.forEach(function (m, j) { m.classList.toggle('is-in', j === idx); });
      railLinks.forEach(function (l, j) {
        if (j === idx) l.setAttribute('aria-current', 'step'); else l.removeAttribute('aria-current');
      });
      if (clockTime) clockTime.textContent = moments[idx].dataset.time;
      if (clockLabel) clockLabel.textContent = moments[idx].dataset.label;
      if (posterImg && !day.classList.contains('is-3d')) posterImg.src = SCREEN(moments[idx].dataset.key);
    }

    var dayRect = day.getBoundingClientRect();
    var inDay = dayRect.top < 1 && dayRect.bottom > window.innerHeight * 0.5;
    state.visible = dayRect.bottom > 0 && dayRect.top < window.innerHeight;
    if (rail) rail.classList.toggle('is-on', inDay);

    // Nav tone follows whatever sits under it
    var tone = 'light';
    var probe = document.elementFromPoint(Math.round(window.innerWidth / 2), 40);
    var sec = probe && probe.closest ? probe.closest('[data-tone]:not(.nav)') : null;
    if (!sec || sec === nav) {
      var list = document.querySelectorAll('main > section, footer');
      for (var q = 0; q < list.length; q++) {
        var r = list[q].getBoundingClientRect();
        if (r.top <= 40 && r.bottom > 40) { sec = list[q]; break; }
      }
    }
    if (sec) tone = sec.dataset.tone || 'light';
    if (tone !== lastTone) {
      lastTone = tone;
      nav.dataset.tone = tone;
      if (themeMeta) themeMeta.setAttribute('content', tone === 'dark' ? '#030712' : '#E8F5F2');
    }
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; update(); });
  }

  measure();
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measure(); update(); });
  window.addEventListener('load', function () { measure(); update(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); update(); });

  window.addEventListener('pointermove', function (e) {
    state.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    state.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // Preload the day's screens for the poster fallback
  state.keys.forEach(function (key) { var im = new Image(); im.src = SCREEN(key); });

  /* ───── On an iPhone/iPad the download buttons open the App Store directly ───── */
  var APP_STORE = 'https://apps.apple.com/app/id6812517519';
  var isApple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isApple) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-download]'), function (a) { a.href = APP_STORE; });
  }

  /* ───── Mobile menu ───── */
  var menuBtn = document.getElementById('nav-menu');
  function closeMenu() {
    nav.classList.remove('is-open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    document.getElementById('nav-links').addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  /* ───── Medi demo conversation ───── */
  var CHATS = {
    medi: {
      label: 'Medi · მოქმედებები',
      turns: [
        { me: 'დღეს დილის წამალი დავლიე?' },
        { medi: 'კი, 08:05-ზე მონიშნე. შემდეგი მიღება 20:00-ზეა.', chip: 'შეხსენება 20:00' },
        { me: 'ჩაწერე ორი ჭიქა წყალი.' },
        { medi: 'ჩავწერე 500 მლ. დღის მიზნამდე 1 ლიტრი დაგრჩა.' }
      ]
    },
    doctor: {
      label: 'ექიმთან · კითხვა ჯანმრთელობაზე',
      turns: [
        { me: 'ბოლო დღეებში საღამოობით თავი მტკივა.' },
        { medi: 'ამ დღეებში წყალი მიზანზე ნაკლები დალიე და ძილი 6 საათზე ნაკლები იყო — ორივე შეიძლება იყოს ტკივილის მიზეზი.' },
        { medi: 'თუ ტკივილი უეცრად ძლიერდება, ან მხედველობა, მეტყველება ან ძალა გეცვლება, დაუყოვნებლივ დარეკე 112-ზე.', chip: 'კითხვები ექიმისთვის' }
      ]
    },
    deep: {
      label: 'ღრმა ანალიზი · დოკუმენტები',
      turns: [
        { me: 'სისხლის ანალიზის ფურცელი ავტვირთე.' },
        { medi: 'ამოვიკითხე 18 მაჩვენებელი. ჰემოგლობინი ნორმაშია, ფერიტინი ნორმის ქვედა ზღვართანაა.' },
        { medi: 'ეს დიაგნოზი არ არის. მოგიმზადე სამი კითხვა ექიმთან განსახილველად.', chip: 'ანალიზი შენახულია' }
      ]
    }
  };

  var chatBody = document.getElementById('chat-body');
  var chatMode = document.getElementById('chat-mode');
  var chatPanel = document.getElementById('chat');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.modes [role="tab"]'));
  var chatRun = 0;

  function bubble(cls, text, chip) {
    var el = document.createElement('div');
    el.className = 'bubble ' + cls;
    el.textContent = text;
    if (chip) {
      var c = document.createElement('span');
      c.className = 'chip';
      c.textContent = chip;
      el.appendChild(document.createElement('br'));
      el.appendChild(c);
    }
    return el;
  }

  function play(mode) {
    var run = ++chatRun;
    var conv = CHATS[mode];
    chatBody.textContent = '';
    chatMode.textContent = conv.label;
    if (reduced) {
      conv.turns.forEach(function (turn) {
        chatBody.appendChild(turn.me ? bubble('me', turn.me) : bubble('medi', turn.medi, turn.chip));
      });
      return;
    }
    var i = 0;
    (function next() {
      if (run !== chatRun || i >= conv.turns.length) return;
      var turn = conv.turns[i++];
      if (turn.me) {
        chatBody.appendChild(bubble('me', turn.me));
        setTimeout(next, 520);
      } else {
        var typing = document.createElement('div');
        typing.className = 'typing';
        typing.setAttribute('aria-hidden', 'true');
        typing.innerHTML = '<i></i><i></i><i></i>';
        chatBody.appendChild(typing);
        setTimeout(function () {
          if (run !== chatRun) return;
          typing.remove();
          chatBody.appendChild(bubble('medi', turn.medi, turn.chip));
          setTimeout(next, 700);
        }, 900);
      }
    })();
  }

  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    chatPanel.setAttribute('aria-labelledby', tab.id);
    if (focus) tab.focus();
    play(tab.dataset.mode);
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectTab(tab); });
    tab.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      selectTab(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });

  if (chatBody) {
    var started = false;
    var io = new IntersectionObserver(function (entries) {
      if (!started && entries[0].isIntersecting) {
        started = true;
        play('medi');
        io.disconnect();
      }
    }, { threshold: 0.35 });
    io.observe(chatPanel);
  }

  /* ───── Spaces ───── */
  var spaces = Array.prototype.slice.call(document.querySelectorAll('.space'));
  var mini = document.getElementById('mini-phone');
  var miniScreen = document.getElementById('mini-screen');
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  function showSpace(btn) {
    spaces.forEach(function (s) {
      var on = s === btn;
      s.classList.toggle('is-on', on);
      s.setAttribute('aria-pressed', String(on));
    });
    var key = btn.dataset.screen;
    miniScreen.src = SCREEN(key);
  }
  spaces.forEach(function (btn) {
    btn.addEventListener('click', function () { showSpace(btn); });
    if (fine) btn.addEventListener('pointerenter', function () { showSpace(btn); });
  });
  if (mini && fine && !reduced) {
    var preview = mini.parentElement;
    document.getElementById('spaces').addEventListener('pointermove', function (e) {
      var r = preview.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width) * 2 - 1;
      var y = ((e.clientY - r.top) / r.height) * 2 - 1;
      mini.style.setProperty('--ry', clamp(x * 12, -16, 16).toFixed(2) + 'deg');
      mini.style.setProperty('--rx', clamp(-y * 8, -10, 10).toFixed(2) + 'deg');
    });
  }
})();
