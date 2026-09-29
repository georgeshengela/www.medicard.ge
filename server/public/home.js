/* MEDICARD front page: the day dial, Medi demo, spaces.
   Works without WebGL; home-scene.js reads window.MedicardDay for the 3D stage. */
(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var day = document.getElementById('day');
  var dial = document.getElementById('dial');
  var stops = Array.prototype.slice.call(dial.querySelectorAll('.stop'));
  var panel = document.getElementById('moment-panel');
  var panelLabel = document.getElementById('moment-label');
  var panelTitle = document.getElementById('moment-title');
  var panelText = document.getElementById('moment-text');
  var clockTime = document.getElementById('clock-time');
  var posterImg = document.querySelector('.poster img');
  var year = document.getElementById('y');
  if (year) year.textContent = String(new Date().getFullYear());

  var SCREEN = function (key) { return '/screens/v3/' + key + '.webp?v=1'; };
  var DWELL = 6500; // autoplay time on each moment

  /* Sky for each moment: morning → night */
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
    n: stops.length,
    keys: stops.map(function (b) { return b.dataset.key; }),
    times: stops.map(function (b) { return b.dataset.time; }),
    hours: stops.map(function (b) {
      var p = (b.dataset.time || '0:0').split(':');
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
  function easeInOut(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }

  /* Paint sky, ink and the dial bead for a continuous position t (0 … n-1) */
  var lastTone = '';
  function paint(t) {
    state.t = t;
    var i0 = Math.min(Math.floor(t), SKY.length - 1);
    var i1 = Math.min(i0 + 1, SKY.length - 1);
    var k = smooth(t - i0);
    var a = mix(hex(SKY[i0].a), hex(SKY[i1].a), k);
    var b = mix(hex(SKY[i0].b), hex(SKY[i1].b), k);
    var sun = mix(SKY[i0].sun, SKY[i1].sun, k);
    var night = smooth(clamp((t - 3.25) / 0.75, 0, 1));
    state.night = night;
    var st = day.style;
    st.setProperty('--sky-a', rgb(a));
    st.setProperty('--sky-b', rgb(b));
    st.setProperty('--sun', 'rgba(' + sun.slice(0, 3).map(Math.round).join(',') + ',' + sun[3].toFixed(3) + ')');
    st.setProperty('--day-ink', rgb(mix([11, 43, 46], [255, 255, 255], night)));
    st.setProperty('--day-ink-2', rgb(mix([62, 90, 93], [209, 213, 219], night)));
    st.setProperty('--dial-pos', (t / (stops.length - 1)).toFixed(4));
    day.dataset.tone = night > 0.5 ? 'dark' : 'light';
    if (day.dataset.tone !== lastTone) {
      lastTone = day.dataset.tone;
      window.dispatchEvent(new Event('medicard:tone'));
    }
  }

  /* Tween the day to a moment; passing several hours plays them as a quick time-lapse */
  var current = 0;
  var from = 0;
  var tweenStart = 0;
  var tweenDur = 0;
  var tweening = false;
  function frame(now) {
    var k = tweenDur ? clamp((now - tweenStart) / tweenDur, 0, 1) : 1;
    paint(from + (current - from) * easeInOut(k));
    if (k < 1) requestAnimationFrame(frame);
    else tweening = false;
  }

  function show(i, opts) {
    i = clamp(i, 0, stops.length - 1);
    var b = stops[i];
    stops.forEach(function (s, j) {
      var on = j === i;
      s.setAttribute('aria-selected', String(on));
      s.tabIndex = on ? 0 : -1;
      s.classList.toggle('is-past', j < i);
    });
    if (opts && opts.focus) b.focus();
    panel.setAttribute('aria-labelledby', b.id);
    panel.classList.remove('is-swap');
    void panel.offsetWidth;
    panel.classList.add('is-swap');
    panelLabel.textContent = b.dataset.label + ' · ' + b.dataset.time;
    panelTitle.textContent = b.dataset.title;
    panelText.textContent = b.dataset.text;
    if (clockTime) {
      clockTime.classList.remove('is-tick');
      void clockTime.offsetWidth;
      clockTime.textContent = b.dataset.time;
      clockTime.classList.add('is-tick');
    }
    if (posterImg) posterImg.src = SCREEN(b.dataset.key);

    from = state.t;
    current = i;
    tweenStart = performance.now();
    tweenDur = reduced ? 0 : 700 + Math.abs(i - from) * 260;
    if (!tweening) { tweening = true; requestAnimationFrame(frame); }
    restartProgress();
  }

  /* Autoplay walks through the day until the person takes over */
  var autoplay = !reduced;
  var timer = null;
  function restartProgress() {
    clearTimeout(timer);
    dial.classList.remove('is-running');
    if (!autoplay || !state.visible) return;
    void dial.offsetWidth;
    dial.style.setProperty('--dwell', DWELL + 'ms');
    dial.classList.add('is-running');
    timer = setTimeout(function () { show((current + 1) % stops.length); }, DWELL);
  }
  function takeOver() {
    if (!autoplay) return;
    autoplay = false;
    clearTimeout(timer);
    dial.classList.remove('is-running');
    dial.classList.add('is-manual');
  }

  stops.forEach(function (b, i) {
    b.addEventListener('click', function () { takeOver(); show(i); });
  });
  dial.addEventListener('keydown', function (e) {
    var d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    var target = d ? current + d : e.key === 'Home' ? 0 : e.key === 'End' ? stops.length - 1 : null;
    if (target === null) return;
    e.preventDefault();
    takeOver();
    show(clamp(target, 0, stops.length - 1), { focus: true });
  });
  // Pause while the pointer rests on the dial so nobody is hurried
  dial.addEventListener('pointerenter', function (e) {
    if (autoplay && e.pointerType === 'mouse') { clearTimeout(timer); dial.classList.add('is-paused'); }
  });
  dial.addEventListener('pointerleave', function (e) {
    if (autoplay && e.pointerType === 'mouse') { dial.classList.remove('is-paused'); restartProgress(); }
  });

  // Only animate while the section is on screen
  new IntersectionObserver(function (entries) {
    state.visible = entries[0].isIntersecting;
    if (state.visible) restartProgress();
    else { clearTimeout(timer); dial.classList.remove('is-running'); }
  }, { threshold: 0.25 }).observe(day);

  window.addEventListener('pointermove', function (e) {
    state.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    state.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  paint(0);
  show(0);

  // Preload the day's screens for the poster fallback
  state.keys.forEach(function (key) { var im = new Image(); im.src = SCREEN(key); });

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
